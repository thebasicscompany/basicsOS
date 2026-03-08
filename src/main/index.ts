import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  clipboard,
  session,
  globalShortcut,
  shell,
  systemPreferences,
  dialog,
} from "electron";

if (process.env["REMOTE_DEBUGGING_PORT"]) {
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    process.env["REMOTE_DEBUGGING_PORT"],
  );
}

import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;
import path from "path";
import fs from "fs";
import { exec, execSync } from "child_process";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { getOverlaySettings, setOverlaySettings } from "./settings-store";
import { createShortcutManager } from "./shortcut-manager";
import type { ShortcutManager } from "./shortcut-manager";
import { createHoldKeyDetector } from "./hold-key-detector";
import { createMeetingManager } from "./meeting-manager-stub";
import type { ActivationMode, DictationInsertResult } from "@/shared-overlay/types";
import { PILL_WIDTH, PILL_HEIGHT } from "@/shared-overlay/constants";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayActive = false;
let activeMode: ActivationMode = "assistant";
let shortcutMgr: ShortcutManager | null = null;
let holdDetector: ReturnType<typeof createHoldKeyDetector> | null = null;
let meetingMgr: ReturnType<typeof createMeetingManager> | null = null;
let registeredMeetingAccelerator: string | null = null;
let registeredDictationAccelerator: string | null = null;
let dictationToggleActive = false;
const pendingDictationInsertRequests = new Map<
  string,
  {
    resolve: (handled: boolean) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

const WEB_URL = process.env["BASICSOS_URL"] ?? "http://localhost:5173";
const API_URL =
  process.env["BASICSOS_API_URL"] ??
  process.env["VITE_API_URL"] ??
  "http://localhost:3001";
const ALLOWED_PROXY_PATHS = new Set([
  "/v1/audio/transcriptions",
  "/v1/audio/speech",
  "/stream/assistant",
]);

const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  try {
    origins.add(new URL(WEB_URL).origin);
  } catch {
    // ignore invalid WEB_URL
  }
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (rendererUrl) {
    try {
      origins.add(new URL(rendererUrl).origin);
    } catch {
      // ignore invalid renderer URL
    }
  }
  return origins;
};

const resolveAllowedMainUrl = (urlOrPath: string): string | null => {
  if (!urlOrPath || typeof urlOrPath !== "string") return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    return `${WEB_URL.replace(/\/$/, "")}${trimmed}`;
  }

  try {
    const target = new URL(trimmed);
    if (!["http:", "https:"].includes(target.protocol)) return null;
    const allowedOrigins = getAllowedOrigins();
    return allowedOrigins.has(target.origin) ? target.toString() : null;
  } catch {
    return null;
  }
};

/** Absolute path to the preload script (CJS; sandbox does not support ESM). */
function getPreloadPath(): string {
  const filename = "index.cjs";
  const relative = path.join(__dirname, "../preload", filename);
  const absolute = path.resolve(relative);
  if (fs.existsSync(absolute)) {
    if (!app.isPackaged) {
      console.warn("[main] preload path:", absolute);
    }
    return absolute;
  }
  const fromAppPath = path.join(app.getAppPath(), "out", "preload", filename);
  const resolvedAppPath = path.resolve(fromAppPath);
  if (fs.existsSync(resolvedAppPath)) {
    if (!app.isPackaged) {
      console.warn("[main] preload path (from app path):", resolvedAppPath);
    }
    return resolvedAppPath;
  }
  console.warn("[main] preload not found at", absolute, "or", resolvedAppPath);
  return absolute;
}

const getOverlayStatus = () => ({
  visible: !!overlayWindow?.isVisible(),
  active: overlayActive,
});

const broadcastOverlayStatus = (): void => {
  const status = getOverlayStatus();
  mainWindow?.webContents.send("overlay-visibility-changed", status);
  overlayWindow?.webContents.send("overlay-visibility-changed", status);
};

const presentOverlayWindow = (focus: boolean): void => {
  if (!overlayWindow) return;
  if (focus) {
    overlayWindow.show();
    overlayWindow.focus();
  } else {
    overlayWindow.showInactive();
  }
};

const activateOverlay = (mode: ActivationMode): void => {
  if (!overlayWindow) return;
  overlayActive = true;
  activeMode = mode;
  presentOverlayWindow(true);
  overlayWindow.webContents.send("activate-overlay", mode);
  broadcastOverlayStatus();
};

const startDictationOverlay = (): void => {
  if (!overlayWindow) return;
  overlayActive = true;
  activeMode = "dictation";
  presentOverlayWindow(false);
  overlayWindow.webContents.send("dictation-hold-start");
  broadcastOverlayStatus();
};

const stopDictationOverlay = (): void => {
  if (!overlayWindow) return;
  overlayWindow.webContents.send("dictation-hold-end");
};

const deactivateOverlay = (): void => {
  if (!overlayWindow) return;
  overlayActive = false;
  overlayWindow.webContents.send("deactivate-overlay");
  broadcastOverlayStatus();
};

const detectNotch = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const menuBarHeight = primaryDisplay.workArea.y;

  const info = {
    hasNotch: false,
    notchHeight: 0,
    menuBarHeight: menuBarHeight > 0 ? menuBarHeight : 25,
    windowWidth: PILL_WIDTH,
  };

  if (process.platform !== "darwin") return info;

  try {
    const result = execSync(
      `swift -e 'import AppKit; if let s = NSScreen.main { print(s.safeAreaInsets.top) } else { print(0) }'`,
      { timeout: 3000, encoding: "utf8" },
    ).trim();
    const insetTop = parseFloat(result);
    if (insetTop > 0) {
      info.hasNotch = true;
      info.notchHeight = Math.round(insetTop);
    }
  } catch {
    // Swift not available or failed — assume no notch
  }

  return info;
};

function createMainWindow(): void {
  const iconPath = path.join(process.cwd(), "public", "favicon.png");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 18 },
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = resolveAllowedMainUrl(url);
    if (!allowed) {
      event.preventDefault();
    }
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function createOverlayWindow(): void {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const x = Math.round((screenW - PILL_WIDTH) / 2);

  overlayWindow = new BrowserWindow({
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    x,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    movable: false,
    roundedCorners: false,
    hiddenInMissionControl: true,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    hasShadow: false,
    backgroundColor: "#00000000",
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const overlayUrl =
    is.dev && process.env["ELECTRON_RENDERER_URL"]
      ? `${process.env["ELECTRON_RENDERER_URL"].replace(/\/$/, "")}/overlay.html`
      : path.join(__dirname, "../renderer/overlay.html");

  if (is.dev && overlayUrl.startsWith("http")) {
    overlayWindow.loadURL(overlayUrl);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay.html"));
  }

  overlayWindow.webContents.on("will-navigate", (e) => e.preventDefault());

  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const allowedOrigins = getAllowedOrigins();
      if (allowedOrigins.has(target.origin) && mainWindow) {
        mainWindow.show();
        mainWindow.loadURL(url).catch(() => undefined);
      } else if (target.protocol === "http:" || target.protocol === "https:") {
        shell.openExternal(url).catch(() => undefined);
      }
    } catch {
      // ignore
    }
    return { action: "deny" };
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.on("show", broadcastOverlayStatus);
  overlayWindow.on("hide", broadcastOverlayStatus);
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayActive = false;
    broadcastOverlayStatus();
  });

  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow?.webContents.send("notch-info", detectNotch());
  });

  overlayWindow.showInactive();
}

ipcMain.handle("get-api-url", () => API_URL);

ipcMain.handle("get-overlay-settings", () => getOverlaySettings());

ipcMain.handle(
  "update-overlay-settings",
  (_event, partial: Record<string, unknown>) => {
    const updated = setOverlaySettings(
      partial as Parameters<typeof setOverlaySettings>[0],
    );
    if (shortcutMgr) {
      shortcutMgr.registerAll(
        updated.shortcuts.assistantToggle,
        updated.behavior.doubleTapWindowMs,
      );
    }
    if (registeredMeetingAccelerator) {
      globalShortcut.unregister(registeredMeetingAccelerator);
      registeredMeetingAccelerator = null;
    }
    globalShortcut.register(updated.shortcuts.meetingToggle, () =>
      overlayWindow?.webContents.send("meeting-toggle"),
    );
    registeredMeetingAccelerator = updated.shortcuts.meetingToggle;
    if (holdDetector) {
      holdDetector.updateConfig({
        accelerator: updated.shortcuts.dictationHoldKey,
        holdThresholdMs: updated.behavior.holdThresholdMs,
      });
    }
    if (process.platform === "win32") {
      if (registeredDictationAccelerator) {
        globalShortcut.unregister(registeredDictationAccelerator);
        registeredDictationAccelerator = null;
        dictationToggleActive = false;
      }
      globalShortcut.register(
        updated.shortcuts.dictationHoldKey,
        () => {
          if (!overlayWindow) return;
          if (!dictationToggleActive) {
            startDictationOverlay();
            dictationToggleActive = true;
          } else {
            stopDictationOverlay();
            dictationToggleActive = false;
          }
        },
      );
      registeredDictationAccelerator = updated.shortcuts.dictationHoldKey;
    }
    overlayWindow?.webContents.send("settings-changed", updated);
    return updated;
  },
);

ipcMain.handle("resize-overlay", (_event, height: number) => {
  if (!overlayWindow) return;
  const { height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const maxH = Math.round(screenH * 0.4);
  const clampedH = Math.max(PILL_HEIGHT, Math.min(maxH, Math.round(height)));
  // Temporarily enable resizable — macOS can ignore setBounds on non-resizable windows
  overlayWindow.setResizable(true);
  overlayWindow.setSize(PILL_WIDTH, clampedH);
  overlayWindow.setResizable(false);
});

ipcMain.on("set-ignore-mouse", (_event, ignore: boolean) => {
  if (ignore) {
    overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow?.setIgnoreMouseEvents(false);
  }
});

ipcMain.on("overlay-dismissed", () => {
  overlayActive = false;
  dictationToggleActive = false;
  broadcastOverlayStatus();
});

ipcMain.on(
  "dictation-insert-result",
  (
    event,
    payload: {
      requestId: string;
      handled: boolean;
    },
  ) => {
    if (event.sender !== mainWindow?.webContents) return;
    const pending = pendingDictationInsertRequests.get(payload.requestId);
    if (!pending) return;
    pendingDictationInsertRequests.delete(payload.requestId);
    clearTimeout(pending.timeout);
    pending.resolve(payload.handled);
  },
);

ipcMain.on("navigate-main", (_event, urlOrPath: string) => {
  if (mainWindow) {
    mainWindow.show();
    const fullUrl = resolveAllowedMainUrl(urlOrPath);
    if (fullUrl) {
      mainWindow.loadURL(fullUrl).catch(() => undefined);
    }
  }
});

ipcMain.handle(
  "proxy-overlay-request",
  async (
    _event,
    req: {
      path: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ) => {
    const method = (req.method ?? "GET").toUpperCase();
    const pathName = req.path?.trim();
    if (!pathName || !ALLOWED_PROXY_PATHS.has(pathName)) {
      return {
        ok: false,
        status: 400,
        statusText: "Bad request",
        headers: {},
        body: "",
      };
    }
    if (!["GET", "POST"].includes(method)) {
      return {
        ok: false,
        status: 405,
        statusText: "Method not allowed",
        headers: {},
        body: "",
      };
    }

    const cookies = await session.defaultSession.cookies.get({
      name: "better-auth.session_token",
    });
    const token = cookies[0]?.value;
    if (!token) {
      return {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        body: "",
      };
    }

    const headers = new Headers(req.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${API_URL}${pathName}`, {
      method,
      headers,
      body: req.body,
    });
    const contentType = res.headers.get("content-type") ?? "";
    const isBinary =
      pathName === "/v1/audio/speech" || contentType.startsWith("audio/");
    const textBody = isBinary
      ? Buffer.from(await res.arrayBuffer()).toString("base64")
      : await res.text();
    const outHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      outHeaders[key] = value;
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
      body: textBody,
      encoding: isBinary ? "base64" : "text",
    };
  },
);

const requestMainWindowDictationInsert = (text: string): Promise<boolean> => {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return Promise.resolve(false);
  }

  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingDictationInsertRequests.delete(requestId);
      resolve(false);
    }, 1000);

    pendingDictationInsertRequests.set(requestId, { resolve, timeout });
    mainWindow?.webContents.send("dictation-insert-request", { requestId, text });
  });
};

const pasteClipboardText = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    clipboard.writeText(text);
    if (process.platform === "darwin") {
      setTimeout(() => {
        exec(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
          () => setTimeout(resolve, 200),
        );
      }, 50);
    } else if (process.platform === "win32") {
      setTimeout(() => {
        exec(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
          () => setTimeout(resolve, 200),
        );
      }, 50);
    } else {
      resolve();
    }
  });
};

ipcMain.handle("inject-text", (_event, text: string): Promise<void> => {
  return pasteClipboardText(text);
});

ipcMain.handle(
  "insert-dictation-text",
  async (_event, text: string): Promise<DictationInsertResult> => {
    const insertedInApp = await requestMainWindowDictationInsert(text);
    if (insertedInApp) {
      return { handled: true, method: "app" };
    }

    if (process.platform === "darwin" || process.platform === "win32") {
      await pasteClipboardText(text);
      return { handled: true, method: "clipboard" };
    }

    clipboard.writeText(text);
    return { handled: false, method: "none" };
  },
);

ipcMain.handle("copy-to-clipboard", (_event, text: string): void => {
  clipboard.writeText(text ?? "");
});

ipcMain.handle("start-meeting", async () => {
  if (!meetingMgr) return;
  const apiUrl = process.env["BASICSOS_API_URL"] ?? "http://localhost:3001";
  const cookies = await session.defaultSession.cookies.get({
    name: "better-auth.session_token",
  });
  const token = cookies[0]?.value;
  if (!token) throw new Error("No session token");
  await meetingMgr.start(apiUrl, token);
});

ipcMain.handle("stop-meeting", async () => {
  if (!meetingMgr) return;
  const apiUrl = process.env["BASICSOS_API_URL"] ?? "http://localhost:3001";
  await meetingMgr.stop(apiUrl);
});

ipcMain.handle("meeting-state", () => {
  return meetingMgr
    ? meetingMgr.getState()
    : { active: false, meetingId: null, startedAt: null };
});

ipcMain.handle("get-persisted-meeting", () => {
  return meetingMgr?.getPersistedState() ?? null;
});

ipcMain.handle("show-overlay", () => {
  try {
    if (!overlayWindow) {
      createOverlayWindow();
    }
    presentOverlayWindow(true);
    broadcastOverlayStatus();
  } catch (e) {
    console.error("[main] show-overlay failed:", e);
    throw e;
  }
});

ipcMain.handle("hide-overlay", () => {
  if (!overlayWindow) return;
  overlayActive = false;
  overlayWindow.webContents.send("deactivate-overlay");
  overlayWindow.hide();
  broadcastOverlayStatus();
});

ipcMain.handle("get-overlay-status", () => {
  return getOverlayStatus();
});

const registerMeetingShortcut = (accelerator: string): void => {
  if (registeredMeetingAccelerator) {
    globalShortcut.unregister(registeredMeetingAccelerator);
    registeredMeetingAccelerator = null;
  }
  const ok = globalShortcut.register(accelerator, () => {
    overlayWindow?.webContents.send("meeting-toggle");
  });
  if (ok) registeredMeetingAccelerator = accelerator;
};

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.basics-hub");

  // Allow microphone (and camera) for voice overlay and main window
  session.defaultSession.setPermissionRequestHandler(
    (_, permission, callback) => {
      const allowed = permission === "media";
      callback(allowed);
    },
  );

  // Auto-update (skip in dev)
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Ignore update errors (e.g. no network, no publish configured)
    });
  }

  // Ensure Accessibility permission (required for globalShortcut on macOS)
  if (process.platform === "darwin") {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!trusted) {
      await dialog.showMessageBox({
        type: "warning",
        title: "Accessibility Permission Required",
        message:
          "BasicsOS needs Accessibility permission for keyboard shortcuts.\n\n" +
          "Please grant access in System Settings → Privacy & Security → Accessibility, then restart the app.",
      });
    }
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  meetingMgr = createMeetingManager({
    onMeetingStart: (meetingId) => {
      overlayWindow?.webContents.send("meeting-started", meetingId);
    },
    onMeetingStop: (meetingId) => {
      overlayWindow?.webContents.send("meeting-stopped", meetingId);
    },
  });

  shortcutMgr = createShortcutManager({
    onAssistantPress: () => {
      if (!overlayWindow) return;
      if (overlayActive) {
        overlayWindow.webContents.send("activate-overlay", activeMode);
      } else {
        activateOverlay("assistant");
      }
    },
    onAssistantDoubleTap: () => {
      if (!overlayWindow) return;
      if (overlayActive) {
        deactivateOverlay();
      } else {
        activateOverlay("continuous");
      }
    },
  });

  holdDetector = createHoldKeyDetector(
    {
      accelerator: getOverlaySettings().shortcuts.dictationHoldKey,
      holdThresholdMs: getOverlaySettings().behavior.holdThresholdMs,
    },
    {
      onHoldStart: () => startDictationOverlay(),
      onHoldEnd: () => stopDictationOverlay(),
    },
  );

  const settings = getOverlaySettings();
  shortcutMgr.registerAll(
    settings.shortcuts.assistantToggle,
    settings.behavior.doubleTapWindowMs,
  );
  holdDetector.start();
  registerMeetingShortcut(settings.shortcuts.meetingToggle);

  if (process.platform === "win32") {
    globalShortcut.register(
      settings.shortcuts.dictationHoldKey,
      () => {
        if (!overlayWindow) return;
        if (!dictationToggleActive) {
          startDictationOverlay();
          dictationToggleActive = true;
        } else {
          stopDictationOverlay();
          dictationToggleActive = false;
        }
      },
    );
    registeredDictationAccelerator = settings.shortcuts.dictationHoldKey;
  }

  createMainWindow();
  createOverlayWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  shortcutMgr?.unregisterAll();
  holdDetector?.stop();
  if (registeredDictationAccelerator) {
    globalShortcut.unregister(registeredDictationAccelerator);
    registeredDictationAccelerator = null;
  }
});

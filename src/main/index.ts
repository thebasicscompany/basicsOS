import path from "path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  app,
  BrowserWindow,
  desktopCapturer,
  screen,
  ipcMain,
  clipboard,
  session,
  globalShortcut,
  shell,
} from "electron";

if (process.env["REMOTE_DEBUGGING_PORT"]) {
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    process.env["REMOTE_DEBUGGING_PORT"],
  );
}

// Prevent GPU process crash from killing the app (macOS Mission Control + transparent windows)
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");

import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;
import fs from "fs";
import { exec, execSync } from "child_process";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { getOverlaySettings, setOverlaySettings, OVERLAY_DEFAULTS } from "./settings-store";
import { createShortcutManager } from "./shortcut-manager";
import type { ShortcutManager } from "./shortcut-manager";
import { createHoldKeyDetector } from "./hold-key-detector";
import { createMeetingManager } from "./meeting-manager";
import {
  createKeyboardHook,
  DEFAULT_BINDINGS,
  type KeyboardHook,
} from "./keyboard-hook";
import {
  startSystemAudioCapture,
  stopSystemAudioCapture,
  checkSystemAudioPermission,
} from "./system-audio-capture";
import type {
  ActivationMode,
  DictationInsertResult,
} from "@/shared-overlay/types";
import { PILL_WIDTH, PILL_HEIGHT } from "@/shared-overlay/constants";

/** Electron accelerator must include a non-modifier key (e.g. Space). Returns default if invalid. */
const ensureValidAccelerator = (acc: string, defaultAcc: string): string => {
  if (!acc || typeof acc !== "string") return defaultAcc;
  const parts = acc.split("+").map((p) => p.trim().toLowerCase());
  const last = parts[parts.length - 1];
  const modifiers = new Set([
    "control",
    "ctrl",
    "alt",
    "option",
    "shift",
    "command",
    "cmd",
    "meta",
  ]);
  if (!last || modifiers.has(last)) return defaultAcc;
  return acc;
};

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayActive = false;
/** Intended position (primary display) so we can re-apply after OS or drag-induced drift */
let overlayAnchorX = 0;
let overlayAnchorY = 0;
let activeMode: ActivationMode = "assistant";
let shortcutMgr: ShortcutManager | null = null;
let holdDetector: ReturnType<typeof createHoldKeyDetector> | null = null;
let meetingMgr: ReturnType<typeof createMeetingManager> | null = null;
let keyboardHook: KeyboardHook | null = null;
let registeredMeetingAccelerator: string | null = null;
let registeredRecordScreenAccelerator: string | null = null;
let registeredDictationAccelerator: string | null = null;
let dictationToggleActive = false;
/** Tracks the current session type for the keyboard hook */
let hookSessionType:
  | "idle"
  | "hold-dictation"
  | "continuous-dictation"
  | "hold-assistant"
  | "continuous-assistant"
  | "single-assistant" = "idle";
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
const AUTH_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

const isLoopbackHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1";

const cookieMatchesHost = (
  cookieDomain: string | undefined,
  hostname: string,
): boolean => {
  if (!cookieDomain || !hostname) return false;
  const normalizedCookieDomain = cookieDomain.replace(/^\./, "");
  return (
    normalizedCookieDomain === hostname ||
    hostname.endsWith(`.${normalizedCookieDomain}`)
  );
};

const toDomainList = (domain?: string): string[] => (domain ? [domain] : []);

type SessionTokenLookup = {
  token: string | null;
  source:
    | "request-url"
    | "base-url"
    | "host-match"
    | "localhost-fallback"
    | "first-available"
    | "missing";
  apiHost: string;
  cookieDomain?: string;
  availableDomains: string[];
};

const getSessionTokenForApi = async (
  targetUrl: string,
): Promise<SessionTokenLookup> => {
  let apiHost = "";
  let baseUrl = API_URL.replace(/\/$/, "");
  try {
    const url = new URL(targetUrl);
    apiHost = url.hostname;
    baseUrl = url.origin;
  } catch {
    // keep fallback base URL
  }

  const requestCookies = (
    await Promise.all(
      AUTH_COOKIE_NAMES.map((name) =>
        session.defaultSession.cookies.get({
          url: targetUrl,
          name,
        }),
      ),
    )
  ).flat();
  const requestCookie = requestCookies[0];
  if (requestCookie?.value) {
    return {
      token: requestCookie.value,
      source: "request-url",
      apiHost,
      cookieDomain: requestCookie.domain,
      availableDomains: toDomainList(requestCookie.domain),
    };
  }

  const baseCookies = (
    await Promise.all(
      AUTH_COOKIE_NAMES.map((name) =>
        session.defaultSession.cookies.get({
          url: `${baseUrl}/`,
          name,
        }),
      ),
    )
  ).flat();
  const baseCookie = baseCookies[0];
  if (baseCookie?.value) {
    return {
      token: baseCookie.value,
      source: "base-url",
      apiHost,
      cookieDomain: baseCookie.domain,
      availableDomains: toDomainList(baseCookie.domain),
    };
  }

  const allCookies = (
    await Promise.all(
      AUTH_COOKIE_NAMES.map((name) =>
        session.defaultSession.cookies.get({
          name,
        }),
      ),
    )
  ).flat();
  const availableDomains = Array.from(
    new Set(
      allCookies
        .map((cookie) => cookie.domain)
        .filter((domain): domain is string => Boolean(domain)),
    ),
  );

  if (apiHost) {
    const apiHostCookie = allCookies.find((cookie) =>
      cookieMatchesHost(cookie.domain, apiHost),
    );
    if (apiHostCookie?.value) {
      return {
        token: apiHostCookie.value,
        source: "host-match",
        apiHost,
        cookieDomain: apiHostCookie.domain,
        availableDomains,
      };
    }
  }

  if (isLoopbackHost(apiHost)) {
    const localhostCookie = allCookies.find((cookie) =>
      isLoopbackHost(cookie.domain?.replace(/^\./, "") ?? ""),
    );
    if (localhostCookie?.value) {
      return {
        token: localhostCookie.value,
        source: "localhost-fallback",
        apiHost,
        cookieDomain: localhostCookie.domain,
        availableDomains,
      };
    }
  }

  const firstCookie = allCookies[0];
  if (firstCookie?.value) {
    return {
      token: firstCookie.value,
      source: "first-available",
      apiHost,
      cookieDomain: firstCookie.domain,
      availableDomains,
    };
  }

  return {
    token: null,
    source: "missing",
    apiHost,
    availableDomains,
  };
};

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
  if (!overlayWindow) createOverlayWindow();
  if (!overlayWindow) return;
  overlayActive = true;
  activeMode = mode;
  presentOverlayWindow(true);
  overlayWindow.webContents.send("activate-overlay", mode);
  broadcastOverlayStatus();
};

const startDictationOverlay = (): void => {
  if (!overlayWindow) createOverlayWindow();
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
    titleBarStyle: "hiddenInset",
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
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
    mainWindow = null;
  });

  // Re-pin overlay position after main window is dragged (stops drift/jitter when dragging near the pill)
  let mainMoveDebounce: ReturnType<typeof setTimeout> | null = null;
  mainWindow.on("moved", () => {
    if (mainMoveDebounce) clearTimeout(mainMoveDebounce);
    mainMoveDebounce = setTimeout(() => {
      mainMoveDebounce = null;
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        const b = overlayWindow.getBounds();
        overlayWindow.setBounds({
          x: overlayAnchorX,
          y: overlayAnchorY,
          width: b.width,
          height: b.height,
        });
      }
    }, 150);
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

  // Fix 3: Crash recovery for the main window (overlay already has this)
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.warn(`[main] Main renderer crashed: reason=${details.reason} exitCode=${details.exitCode}`);
    if (details.reason !== "killed" && details.reason !== "clean-exit") {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reload();
        } else {
          createMainWindow();
        }
      }, 1000);
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.warn(`[main] Main window load failed: ${errorCode} ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
          mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
        } else {
          mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
        }
      }
    }, 2000);
  });

  // Fix 5: macOS close-to-hide pattern — closing the window hides it, dock icon stays
  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
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
  overlayAnchorX = Math.round((screenW - PILL_WIDTH) / 2);
  overlayAnchorY = 0;

  overlayWindow = new BrowserWindow({
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    x: overlayAnchorX,
    y: overlayAnchorY,
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

  // Recover overlay if its renderer crashes (e.g. GPU process restart during Mission Control)
  overlayWindow.webContents.on("render-process-gone", (_event, details) => {
    console.warn(`[main] Overlay render process gone reason=${details.reason} exitCode=${details.exitCode} — recreating`);
    if (details.reason !== "killed" && details.reason !== "clean-exit") {
      // Delay slightly to let GPU process restart
      setTimeout(() => {
        if (!overlayWindow || overlayWindow.isDestroyed()) {
          createOverlayWindow();
        } else {
          overlayWindow.webContents.reload();
        }
      }, 1000);
    }
  });

  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow?.webContents.send("notch-info", detectNotch());
  });

  // Do not show on startup; user opens pill via shortcut or UI
}

ipcMain.handle("get-api-url", () => API_URL);

// Overlay signals that screen recording stopped → forward to main window to show save modal
ipcMain.on("record-screen-stopped", () => {
  mainWindow?.webContents.send("record-screen-stopped");
});

ipcMain.handle("get-overlay-settings", () => getOverlaySettings());

ipcMain.handle(
  "update-overlay-settings",
  (_event, partial: Record<string, unknown>) => {
    const updated = setOverlaySettings(
      partial as Parameters<typeof setOverlaySettings>[0],
    );

    if (keyboardHook && process.platform === "darwin") {
      // Re-register keyboard hook slots with updated bindings
      const dict =
        updated.shortcuts.dictation ?? DEFAULT_BINDINGS.dictation;
      const assist =
        updated.shortcuts.assistant ?? DEFAULT_BINDINGS.assistant;
      const meet =
        updated.shortcuts.meeting ?? DEFAULT_BINDINGS.meeting;
      // The hook slots are re-registered via the same pattern used in whenReady
      // We need to re-set slots since bindings may have changed
      keyboardHook.setSlots([
        {
          id: "dictation",
          binding: dict,
          holdThresholdMs: updated.behavior.holdThresholdMs,
          doubleTapWindowMs: updated.behavior.doubleTapWindowMs,
          onKeyDown: () => {
            if (hookSessionType === "continuous-dictation") {
              overlayWindow?.webContents.send("activate-overlay", "dictation");
              hookSessionType = "idle";
              return true;
            }
            return false;
          },
          onHoldStart: () => {
            if (!overlayWindow) return;
            hookSessionType = "hold-dictation";
            startDictationOverlay();
          },
          onHoldEnd: () => {
            if (hookSessionType === "hold-dictation") {
              hookSessionType = "idle";
              stopDictationOverlay();
            }
          },
          onDoubleTap: () => {
            if (!overlayWindow) return;
            hookSessionType = "continuous-dictation";
            activateOverlay("dictation");
          },
        },
        {
          id: "assistant",
          binding: assist,
          holdThresholdMs: updated.behavior.holdThresholdMs,
          doubleTapWindowMs: updated.behavior.doubleTapWindowMs,
          onKeyDown: () => {
            if (
              hookSessionType === "continuous-assistant" ||
              hookSessionType === "single-assistant"
            ) {
              overlayWindow?.webContents.send("activate-overlay", activeMode);
              hookSessionType = "idle";
              return true;
            }
            return false;
          },
          onHoldStart: () => {
            if (!overlayWindow) return;
            hookSessionType = "hold-assistant";
            activateOverlay("assistant");
          },
          onHoldEnd: () => {
            if (hookSessionType === "hold-assistant") {
              overlayWindow?.webContents.send("activate-overlay", "assistant");
              hookSessionType = "idle";
            }
          },
          onDoubleTap: () => {
            if (!overlayWindow) return;
            hookSessionType = "continuous-assistant";
            activateOverlay("continuous");
          },
          onSingleTap: () => {
            if (!overlayWindow) return;
            hookSessionType = "single-assistant";
            activateOverlay("assistant");
          },
        },
        {
          id: "meeting",
          binding: meet,
          onKeyDown: () => {
            overlayWindow?.webContents.send("meeting-toggle");
            return true;
          },
        },
      ]);
      registerRecordScreenShortcut(
        ensureValidAccelerator(
          updated.shortcuts.recordScreenToggle,
          OVERLAY_DEFAULTS.shortcuts.recordScreenToggle,
        ),
      );
    } else {
      // Legacy fallback for non-macOS
      if (shortcutMgr) {
        shortcutMgr.registerAll(
          ensureValidAccelerator(
            updated.shortcuts.assistantToggle,
            OVERLAY_DEFAULTS.shortcuts.assistantToggle,
          ),
          updated.behavior.doubleTapWindowMs,
        );
      }
      if (registeredMeetingAccelerator) {
        globalShortcut.unregister(registeredMeetingAccelerator);
        registeredMeetingAccelerator = null;
      }
      const meetingAcc = ensureValidAccelerator(
        updated.shortcuts.meetingToggle,
        OVERLAY_DEFAULTS.shortcuts.meetingToggle,
      );
      globalShortcut.register(meetingAcc, () =>
        overlayWindow?.webContents.send("meeting-toggle"),
      );
      registeredMeetingAccelerator = meetingAcc;
      registerRecordScreenShortcut(
        ensureValidAccelerator(
          updated.shortcuts.recordScreenToggle,
          OVERLAY_DEFAULTS.shortcuts.recordScreenToggle,
        ),
      );
      if (holdDetector) {
        holdDetector.updateConfig({
          accelerator: ensureValidAccelerator(
            updated.shortcuts.dictationHoldKey,
            OVERLAY_DEFAULTS.shortcuts.dictationHoldKey,
          ),
          holdThresholdMs: updated.behavior.holdThresholdMs,
        });
      }
      if (registeredDictationAccelerator) {
        globalShortcut.unregister(registeredDictationAccelerator);
        registeredDictationAccelerator = null;
        dictationToggleActive = false;
      }
      const dictationAcc = ensureValidAccelerator(
        updated.shortcuts.dictationHoldKey,
        OVERLAY_DEFAULTS.shortcuts.dictationHoldKey,
      );
      globalShortcut.register(dictationAcc, () => {
        if (!overlayWindow) return;
        if (!dictationToggleActive) {
          startDictationOverlay();
          dictationToggleActive = true;
        } else {
          stopDictationOverlay();
          dictationToggleActive = false;
        }
      });
      registeredDictationAccelerator = dictationAcc;
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
  overlayWindow.setBounds({
    x: overlayAnchorX,
    y: overlayAnchorY,
    width: PILL_WIDTH,
    height: clampedH,
  });
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
  hookSessionType = "idle";
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

// Forward data-changed from overlay to main window for query invalidation
ipcMain.on("data-changed", (_event, queryKeys: string[]) => {
  mainWindow?.webContents.send("data-changed", queryKeys);
});

ipcMain.on("navigate-main", (_event, urlOrPath: string) => {
  if (!urlOrPath || typeof urlOrPath !== "string") return;
  const trimmed = urlOrPath.trim();

  // External URLs → open in system browser
  if (/^https?:\/\//i.test(trimmed)) {
    const fullUrl = resolveAllowedMainUrl(trimmed);
    if (fullUrl && mainWindow) {
      mainWindow.show();
      mainWindow.loadURL(fullUrl).catch(() => undefined);
    } else {
      shell.openExternal(trimmed).catch(() => undefined);
    }
    return;
  }

  // Internal paths → navigate main window
  if (mainWindow) {
    mainWindow.show();
    const fullUrl = resolveAllowedMainUrl(trimmed);
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
    const fullUrl = `${API_URL.replace(/\/$/, "")}${pathName ?? ""}`;
    console.warn(
      "[proxy-overlay] request",
      method,
      pathName,
      "->",
      fullUrl,
      "API_URL=",
      API_URL,
    );
    if (
      !pathName ||
      !(
        ALLOWED_PROXY_PATHS.has(pathName) ||
        pathName.startsWith("/api/meetings")
      )
    ) {
      console.warn("[proxy-overlay] rejected: path not allowed");
      return {
        ok: false,
        status: 400,
        statusText: "Bad request",
        headers: {},
        body: "",
      };
    }
    if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      console.warn("[proxy-overlay] rejected: method not allowed");
      return {
        ok: false,
        status: 405,
        statusText: "Method not allowed",
        headers: {},
        body: "",
      };
    }

    const tokenLookup = await getSessionTokenForApi(fullUrl);
    const token = tokenLookup.token;
    if (
      tokenLookup.source === "localhost-fallback" &&
      tokenLookup.apiHost &&
      !isLoopbackHost(tokenLookup.apiHost)
    ) {
      console.warn(
        "[proxy-overlay] no cookie for API host; using localhost session token against configured API",
        tokenLookup.apiHost,
        "cookieDomain=",
        tokenLookup.cookieDomain,
      );
    } else if (tokenLookup.source === "host-match") {
      console.warn(
        "[proxy-overlay] using session cookie for API host",
        tokenLookup.apiHost,
        "domain=",
        tokenLookup.cookieDomain,
      );
    }
    if (!token) {
      console.warn(
        "[proxy-overlay] 401: no session cookie for",
        `${API_URL.replace(/\/$/, "")}/`,
        "cookiesFound=",
        0,
        "lookupSource=",
        tokenLookup.source,
        "allAuthCookies=",
        tokenLookup.availableDomains.length,
        "domains=",
        tokenLookup.availableDomains,
      );
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
    if (!res.ok) {
      const errSnippet = (await res.clone().text()).slice(0, 200);
      console.warn(
        "[proxy-overlay] fetch failed",
        res.status,
        res.statusText,
        "path=",
        pathName,
        "body=",
        errSnippet,
      );
    } else {
      console.warn("[proxy-overlay] ok", res.status, pathName);
    }
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
    mainWindow?.webContents.send("dictation-insert-request", {
      requestId,
      text,
    });
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

ipcMain.on("log-from-overlay", (_event, msg: string) => {
  console.warn("[overlay]", msg);
});

ipcMain.handle("start-meeting", async () => {
  console.warn("[IPC] start-meeting received, meetingMgr=", !!meetingMgr);
  console.warn(`[MEETING:MAIN:HN] start-meeting entry meetingMgr=${!!meetingMgr} t=${Date.now()}`);
  if (!meetingMgr) return;
  const apiUrl = API_URL;
  const tokenLookup = await getSessionTokenForApi(apiUrl);
  const token = tokenLookup.token;
  console.warn(
    "[IPC] start-meeting: apiUrl=",
    apiUrl,
    "hasToken=",
    !!token,
    "source=",
    tokenLookup.source,
    "domain=",
    tokenLookup.cookieDomain ?? "n/a",
  );
  console.warn(`[MEETING:MAIN:HN] start-meeting tokenPresent=${!!token} t=${Date.now()}`);
  if (!token) throw new Error("No session token");
  try {
    console.warn(`[MEETING:MAIN:HN] start-meeting before meetingMgr.start apiUrl=${apiUrl} t=${Date.now()}`);
    await meetingMgr.start(apiUrl, token);
    console.warn("[IPC] start-meeting completed");
    console.warn(`[MEETING:MAIN:HN] start-meeting success t=${Date.now()}`);
  } catch (err) {
    console.warn(`[MEETING:MAIN:HN] start-meeting error msg=${(err as Error).message} t=${Date.now()}`);
    throw err;
  }
});

ipcMain.handle("stop-meeting", async () => {
  console.warn("[IPC] stop-meeting received, meetingMgr=", !!meetingMgr);
  console.warn(`[MEETING:MAIN:HN] stop-meeting entry meetingMgr=${!!meetingMgr} t=${Date.now()}`);
  if (!meetingMgr) return;
  const apiUrl = API_URL;
  try {
    console.warn(`[MEETING:MAIN:HN] stop-meeting before meetingMgr.stop t=${Date.now()}`);
    await meetingMgr.stop(apiUrl);
    console.warn("[IPC] stop-meeting completed");
    console.warn(`[MEETING:MAIN:HN] stop-meeting success t=${Date.now()}`);
  } catch (err) {
    console.warn(`[MEETING:MAIN:HN] stop-meeting error msg=${(err as Error).message} t=${Date.now()}`);
    throw err;
  }
});

ipcMain.handle("meeting-state", () => {
  return meetingMgr
    ? meetingMgr.getState()
    : { active: false, meetingId: null, startedAt: null };
});

ipcMain.handle("get-persisted-meeting", () => {
  return meetingMgr?.getPersistedState() ?? null;
});

ipcMain.handle("start-system-audio", async (_event, meetingId: string) => {
  console.warn(`[MEETING:MAIN:HN] start-system-audio entry meetingId=${meetingId} t=${Date.now()}`);
  const tokenLookup = await getSessionTokenForApi(API_URL);
  const token = tokenLookup.token;
  console.warn(`[MEETING:MAIN:HN] start-system-audio tokenPresent=${!!token} meetingId=${meetingId} t=${Date.now()}`);
  if (!token) return false;
  return startSystemAudioCapture(meetingId, API_URL, token);
});

ipcMain.handle("stop-system-audio", async () => {
  console.warn(`[MEETING:MAIN:HN] stop-system-audio entry t=${Date.now()}`);
  const result = stopSystemAudioCapture();
  console.warn(`[MEETING:MAIN:HN] stop-system-audio result=${result} t=${Date.now()}`);
  return result;
});

ipcMain.handle("check-system-audio-permission", () => {
  return checkSystemAudioPermission();
});

ipcMain.handle("prompt-screen-recording", () => {
  if (process.platform !== "darwin") return true;
  const hasPermission = checkSystemAudioPermission();
  if (!hasPermission) {
    shell
      .openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
      )
      .catch(() => {});
  }
  return hasPermission;
});

ipcMain.handle("get-session-token", async () => {
  const tokenLookup = await getSessionTokenForApi(API_URL);
  return tokenLookup.token ?? "";
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
  const acc = ensureValidAccelerator(
    accelerator,
    OVERLAY_DEFAULTS.shortcuts.meetingToggle,
  );
  if (registeredMeetingAccelerator) {
    globalShortcut.unregister(registeredMeetingAccelerator);
    registeredMeetingAccelerator = null;
  }
  const ok = globalShortcut.register(acc, () => {
    console.warn("[SHORTCUT] Meeting toggle fired, overlayWindow=", !!overlayWindow);
    overlayWindow?.webContents.send("meeting-toggle");
  });
  if (ok) registeredMeetingAccelerator = acc;
  console.warn("[SHORTCUT] Meeting shortcut registered:", acc, "ok=", ok);
};

const registerRecordScreenShortcut = (accelerator: string): void => {
  const acc = ensureValidAccelerator(
    accelerator,
    OVERLAY_DEFAULTS.shortcuts.recordScreenToggle,
  );
  if (registeredRecordScreenAccelerator) {
    globalShortcut.unregister(registeredRecordScreenAccelerator);
    registeredRecordScreenAccelerator = null;
  }
  const ok = globalShortcut.register(acc, () => {
    if (!overlayWindow) return;
    // Show the overlay if it's hidden so the user can see the recording dot / save modal
    if (!overlayWindow.isVisible()) {
      presentOverlayWindow(false);
    }
    overlayWindow.webContents.send("record-screen-toggle");
  });
  if (ok) {
    registeredRecordScreenAccelerator = acc;
    console.warn("[SHORTCUT] Record screen shortcut registered:", acc);
  } else {
    console.warn("[SHORTCUT] FAILED to register record screen shortcut:", acc, "— shortcut may already be in use by another app");
  }
};

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.basics-hub");

  // Allow microphone, camera, and display-capture for voice overlay and main window
  session.defaultSession.setPermissionRequestHandler(
    (_, permission, callback) => {
      const allowed =
        permission === "media" || permission === "display-capture";
      callback(allowed);
    },
  );

  // Handle getDisplayMedia requests — auto-select entire screen with system audio loopback
  // This avoids the native screen picker (Finder-like window)
  // audio: 'loopback' requests system audio on macOS and Windows (when supported by Electron/Chromium)
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer.getSources({ types: ["screen"] }).then((srcs) => {
        const primary = srcs[0];
        if (primary) {
          callback({
            video: primary,
            audio: "loopback",
            enableLocalEcho: false,
          });
        } else {
          callback({});
        }
      }).catch(() => callback({}));
    },
  );

  // In packaged Electron builds the renderer loads from file://, which causes
  // cross-origin requests to the API to carry Origin: null (or no Origin at all).
  // Better Auth's CSRF middleware rejects that with MISSING_OR_NULL_ORIGIN before
  // it ever reaches the trustedOrigins callback.
  // Fix: for any outbound request that has a null/missing Origin, inject the
  // target URL's own origin.  We use the *target* origin rather than API_URL
  // because API_URL is a runtime env var that may not be set in the installed
  // app (VITE_API_URL is baked into the renderer at build time, but the main
  // process can only read env vars present at launch).
  session.defaultSession.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      const origin = headers["Origin"] ?? headers["origin"];
      if (!origin || origin === "null") {
        try {
          const targetOrigin = new URL(details.url).origin;
          // Only inject for http/https targets (skip file://, chrome-extension://, etc.)
          if (targetOrigin.startsWith("http")) {
            headers["Origin"] = targetOrigin;
          }
        } catch {
          // ignore unparseable URLs
        }
      }
      callback({ requestHeaders: headers });
    },
  );

  // Auto-update (skip in dev)
  if (!is.dev) {
    // Log updater events for debugging when updates don't appear
    const logUpdater = (msg: string, ...args: unknown[]) =>
      console.warn(`[auto-updater] ${msg}`, ...args);
    autoUpdater.on("checking-for-update", () => logUpdater("Checking for updates..."));
    autoUpdater.on("update-available", (info) =>
      logUpdater("Update available:", info.version),
    );
    autoUpdater.on("update-not-available", (info) =>
      logUpdater("No update available.", "current:", info?.version),
    );
    autoUpdater.on("update-downloaded", (info) =>
      logUpdater("Update downloaded, will install on quit:", info.version),
    );
    autoUpdater.on("error", (err) =>
      logUpdater("Error:", err?.message ?? err),
    );
    autoUpdater
      .checkForUpdatesAndNotify()
      .catch((err) =>
        logUpdater("checkForUpdatesAndNotify failed:", err?.message ?? err),
      );
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Handle GPU process crash (e.g. from Mission Control on macOS with transparent windows)
  app.on("child-process-gone", (_event, details) => {
    if (details.type === "GPU" || details.name === "GPU") {
      console.warn(`[main] GPU process gone reason=${details.reason} exitCode=${details.exitCode} — app will recover`);
      // Don't crash the app — Electron will restart the GPU process automatically
    }
  });

  meetingMgr = createMeetingManager({
    onMeetingStart: (meetingId) => {
      console.warn("[meeting-manager] onMeetingStart callback: sending meeting-started IPC, meetingId=", meetingId, "overlayWindow=", !!overlayWindow);
      console.warn(`[MEETING:MAIN:HN] onMeetingStart meetingId=${meetingId} overlayWindow=${!!overlayWindow} t=${Date.now()}`);
      overlayWindow?.webContents.send("meeting-started", meetingId);
    },
    onMeetingStop: (meetingId) => {
      console.warn("[meeting-manager] onMeetingStop callback: sending meeting-stopped IPC, meetingId=", meetingId, "overlayWindow=", !!overlayWindow);
      console.warn(`[MEETING:MAIN:HN] onMeetingStop meetingId=${meetingId} overlayWindow=${!!overlayWindow} t=${Date.now()}`);
      overlayWindow?.webContents.send("meeting-stopped", meetingId);
      mainWindow?.webContents.send("meeting-stopped", meetingId);
    },
  });

  const settings = getOverlaySettings();

  if (process.platform === "darwin") {
    // ── macOS: use native keyboard hook (CGEventTap) ──────────────────
    // Supports Fn key, hold-to-talk, double-tap, single modifier keys
    keyboardHook = createKeyboardHook();

    const dictBinding =
      settings.shortcuts.dictation ?? DEFAULT_BINDINGS.dictation;
    const assistBinding =
      settings.shortcuts.assistant ?? DEFAULT_BINDINGS.assistant;
    const meetBinding =
      settings.shortcuts.meeting ?? DEFAULT_BINDINGS.meeting;

    const registerHookSlots = (
      dict = dictBinding,
      assist = assistBinding,
      meet = meetBinding,
    ): void => {
      keyboardHook?.setSlots([
        {
          id: "dictation",
          binding: dict,
          holdThresholdMs: settings.behavior.holdThresholdMs,
          doubleTapWindowMs: settings.behavior.doubleTapWindowMs,
          onKeyDown: () => {
            // If overlay is in continuous dictation, stop immediately
            if (hookSessionType === "continuous-dictation") {
              overlayWindow?.webContents.send("activate-overlay", "dictation");
              hookSessionType = "idle";
              return true;
            }
            return false;
          },
          onHoldStart: () => {
            if (!overlayWindow) return;
            hookSessionType = "hold-dictation";
            startDictationOverlay();
          },
          onHoldEnd: () => {
            if (hookSessionType === "hold-dictation") {
              hookSessionType = "idle";
              stopDictationOverlay();
            }
          },
          onDoubleTap: () => {
            if (!overlayWindow) return;
            hookSessionType = "continuous-dictation";
            activateOverlay("dictation");
          },
          onSingleTap: () => {
            // Single tap dictation key: no action (avoid accidental triggers)
          },
        },
        {
          id: "assistant",
          binding: assist,
          holdThresholdMs: settings.behavior.holdThresholdMs,
          doubleTapWindowMs: settings.behavior.doubleTapWindowMs,
          onKeyDown: () => {
            // If overlay is active via assistant, stop immediately
            if (
              hookSessionType === "continuous-assistant" ||
              hookSessionType === "single-assistant"
            ) {
              overlayWindow?.webContents.send("activate-overlay", activeMode);
              hookSessionType = "idle";
              return true;
            }
            return false;
          },
          onHoldStart: () => {
            if (!overlayWindow) return;
            hookSessionType = "hold-assistant";
            activateOverlay("assistant");
          },
          onHoldEnd: () => {
            if (hookSessionType === "hold-assistant") {
              // Send activation again to toggle off (overlay handles this)
              overlayWindow?.webContents.send("activate-overlay", "assistant");
              hookSessionType = "idle";
            }
          },
          onDoubleTap: () => {
            if (!overlayWindow) return;
            hookSessionType = "continuous-assistant";
            activateOverlay("continuous");
          },
          onSingleTap: () => {
            if (!overlayWindow) return;
            hookSessionType = "single-assistant";
            activateOverlay("assistant");
          },
        },
        {
          id: "meeting",
          binding: meet,
          onKeyDown: () => {
            console.warn(`[MEETING:MAIN:HN] meeting-toggle sent to overlay via keyboard hook t=${Date.now()}`);
            overlayWindow?.webContents.send("meeting-toggle");
            return true; // No timing detection needed
          },
        },
      ]);
    };

    registerHookSlots();
    keyboardHook.start();

    // Register combo shortcuts with globalShortcut to suppress system handlers
    // (e.g., prevent Cmd+Space from opening Spotlight)
    // Only for non-modifier-only bindings (Fn alone can't be registered)
    const MODIFIER_KEYCODES_SET = new Set([
      55, 54, 56, 60, 58, 61, 59, 62, 63, 57,
    ]);
    if (!MODIFIER_KEYCODES_SET.has(assistBinding.keyCode)) {
      try {
        globalShortcut.register(
          ensureValidAccelerator(
            settings.shortcuts.assistantToggle,
            OVERLAY_DEFAULTS.shortcuts.assistantToggle,
          ),
          () => {
            /* suppressed — keyboard hook handles timing */
          },
        );
      } catch {
        /* ignore registration failure */
      }
    }
    if (!MODIFIER_KEYCODES_SET.has(meetBinding.keyCode)) {
      try {
        globalShortcut.register(
          ensureValidAccelerator(
            settings.shortcuts.meetingToggle,
            OVERLAY_DEFAULTS.shortcuts.meetingToggle,
          ),
          () => {
            /* suppressed — keyboard hook handles it */
          },
        );
      } catch {
        /* ignore */
      }
    }

    // IPC for shortcut recording
    ipcMain.handle("start-shortcut-recording", async () => {
      if (!keyboardHook) return null;
      return keyboardHook.startRecording();
    });
    ipcMain.handle("cancel-shortcut-recording", () => {
      keyboardHook?.cancelRecording();
    });
  } else {
    // ── Non-macOS: fall back to Electron globalShortcut (legacy) ───────
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
        accelerator: ensureValidAccelerator(
          settings.shortcuts.dictationHoldKey,
          OVERLAY_DEFAULTS.shortcuts.dictationHoldKey,
        ),
        holdThresholdMs: settings.behavior.holdThresholdMs,
      },
      {
        onHoldStart: () => startDictationOverlay(),
        onHoldEnd: () => stopDictationOverlay(),
      },
    );

    shortcutMgr.registerAll(
      ensureValidAccelerator(
        settings.shortcuts.assistantToggle,
        OVERLAY_DEFAULTS.shortcuts.assistantToggle,
      ),
      settings.behavior.doubleTapWindowMs,
    );
    holdDetector.start();
    registerMeetingShortcut(
      ensureValidAccelerator(
        settings.shortcuts.meetingToggle,
        OVERLAY_DEFAULTS.shortcuts.meetingToggle,
      ),
    );

    globalShortcut.register(
      ensureValidAccelerator(
        settings.shortcuts.dictationHoldKey,
        OVERLAY_DEFAULTS.shortcuts.dictationHoldKey,
      ),
      () => {
      if (!overlayWindow) return;
      if (!dictationToggleActive) {
        startDictationOverlay();
        dictationToggleActive = true;
      } else {
        stopDictationOverlay();
        dictationToggleActive = false;
      }
    });
    registeredDictationAccelerator = ensureValidAccelerator(
      settings.shortcuts.dictationHoldKey,
      OVERLAY_DEFAULTS.shortcuts.dictationHoldKey,
    );

    // IPC for shortcut recording (no-op on non-macOS; handlers must exist to avoid "No handler registered")
    ipcMain.handle("start-shortcut-recording", async () => null);
    ipcMain.handle("cancel-shortcut-recording", () => {});
  }

  // Record screen shortcut (both platforms — uses accelerator string)
  registerRecordScreenShortcut(
    ensureValidAccelerator(
      settings.shortcuts.recordScreenToggle,
      OVERLAY_DEFAULTS.shortcuts.recordScreenToggle,
    ),
  );

  createMainWindow();
  createOverlayWindow();

  // Fix 1: Force dock visibility — both windows start with show:false and the overlay
  // uses skipTaskbar:true, so macOS may never set the activation policy to "regular".
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }

  // Fix 2: Properly handle dock icon click — the overlay always exists so
  // BrowserWindow.getAllWindows().length is never 0.
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Fix 5 (cont.): Track when the user actually wants to quit (Cmd+Q / app menu Quit)
app.on("before-quit", () => {
  (app as any).isQuitting = true;
});

app.on("will-quit", () => {
  keyboardHook?.stop();
  shortcutMgr?.unregisterAll();
  holdDetector?.stop();
  if (registeredDictationAccelerator) {
    globalShortcut.unregister(registeredDictationAccelerator);
    registeredDictationAccelerator = null;
  }
  if (registeredMeetingAccelerator) {
    globalShortcut.unregister(registeredMeetingAccelerator);
    registeredMeetingAccelerator = null;
  }
  if (registeredRecordScreenAccelerator) {
    globalShortcut.unregister(registeredRecordScreenAccelerator);
    registeredRecordScreenAccelerator = null;
  }
});

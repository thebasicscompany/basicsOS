import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  clipboard,
  session,
  globalShortcut,
  shell,
} from "electron";
import path from "path";
import { exec } from "child_process";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { getOverlaySettings, setOverlaySettings } from "./settings-store";
import { createShortcutManager } from "./shortcut-manager";
import type { ShortcutManager } from "./shortcut-manager";
import { createHoldKeyDetector } from "./hold-key-detector";
import { createMeetingManager } from "./meeting-manager-stub";
import type { ActivationMode } from "../shared-overlay/types";
import { PILL_WIDTH, PILL_HEIGHT } from "../shared-overlay/constants";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayActive = false;
let activeMode: ActivationMode = "assistant";
let shortcutMgr: ShortcutManager | null = null;
let holdDetector: ReturnType<typeof createHoldKeyDetector> | null = null;
let meetingMgr: ReturnType<typeof createMeetingManager> | null = null;
let registeredMeetingAccelerator: string | null = null;

const WEB_URL = process.env["BASICOS_URL"] ?? "http://localhost:5173";

const activateOverlay = (mode: ActivationMode): void => {
  if (!overlayWindow) return;
  overlayActive = true;
  activeMode = mode;
  overlayWindow.webContents.send("activate-overlay", mode);
};

const deactivateOverlay = (): void => {
  if (!overlayWindow) return;
  overlayActive = false;
  overlayWindow.webContents.send("deactivate-overlay");
};

const detectNotch = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const menuBarHeight = primaryDisplay.workArea.y;
  return {
    hasNotch: false,
    notchHeight: 0,
    menuBarHeight: menuBarHeight > 0 ? menuBarHeight : 25,
    windowWidth: PILL_WIDTH,
  };
};

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
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
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      sandbox: false,
    },
    hasShadow: false,
    backgroundColor: "#00000000",
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");

  const overlayUrl = is.dev && process.env["ELECTRON_RENDERER_URL"]
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
      const base = new URL(WEB_URL);
      if (target.origin === base.origin && mainWindow) {
        mainWindow.show();
        mainWindow.loadURL(url).catch(() => undefined);
      } else if (
        target.protocol === "http:" ||
        target.protocol === "https:"
      ) {
        shell.openExternal(url).catch(() => undefined);
      }
    } catch {
      // ignore
    }
    return { action: "deny" };
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow?.webContents.send("notch-info", detectNotch());
  });

  overlayWindow.showInactive();
}

ipcMain.handle("get-session-token", async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      name: "better-auth.session_token",
    });
    return cookies[0]?.value ?? null;
  } catch {
    return null;
  }
});

ipcMain.handle("get-api-url", () => {
  return process.env["BASICOS_API_URL"] ?? process.env["VITE_API_URL"] ?? "http://localhost:3001";
});

ipcMain.handle("get-overlay-settings", () => getOverlaySettings());

ipcMain.handle("update-overlay-settings", (_event, partial: Record<string, unknown>) => {
  const updated = setOverlaySettings(partial as Parameters<typeof setOverlaySettings>[0]);
  if (shortcutMgr) {
    shortcutMgr.registerAll(
      updated.shortcuts.assistantToggle,
      updated.behavior.doubleTapWindowMs
    );
  }
  if (registeredMeetingAccelerator) {
    globalShortcut.unregister(registeredMeetingAccelerator);
    registeredMeetingAccelerator = null;
  }
  globalShortcut.register(
    updated.shortcuts.meetingToggle,
    () => overlayWindow?.webContents.send("meeting-toggle")
  );
  registeredMeetingAccelerator = updated.shortcuts.meetingToggle;
  if (holdDetector) {
    holdDetector.updateConfig({
      accelerator: updated.shortcuts.dictationHoldKey,
      holdThresholdMs: updated.behavior.holdThresholdMs,
    });
  }
  overlayWindow?.webContents.send("settings-changed", updated);
  return updated;
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
});

ipcMain.on("navigate-main", (_event, urlOrPath: string) => {
  if (mainWindow) {
    mainWindow.show();
    const fullUrl = urlOrPath.startsWith("http")
      ? urlOrPath
      : `${WEB_URL}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
    mainWindow.loadURL(fullUrl).catch(() => undefined);
  }
});

ipcMain.handle("inject-text", (_event, text: string): Promise<void> => {
  return new Promise((resolve) => {
    clipboard.writeText(text);
    if (process.platform === "darwin") {
      setTimeout(() => {
        exec(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
          () => setTimeout(resolve, 200)
        );
      }, 50);
    } else if (process.platform === "win32") {
      setTimeout(() => {
        exec(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
          () => setTimeout(resolve, 200)
        );
      }, 50);
    } else {
      resolve();
    }
  });
});

ipcMain.handle("start-meeting", async () => {
  if (!meetingMgr) return;
  const apiUrl = process.env["BASICOS_API_URL"] ?? "http://localhost:3001";
  const cookies = await session.defaultSession.cookies.get({
    name: "better-auth.session_token",
  });
  const token = cookies[0]?.value;
  if (!token) throw new Error("No session token");
  await meetingMgr.start(apiUrl, token);
});

ipcMain.handle("stop-meeting", async () => {
  if (!meetingMgr) return;
  const apiUrl = process.env["BASICOS_API_URL"] ?? "http://localhost:3001";
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
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
  }
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.basics-hub");
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
      onHoldStart: () => overlayWindow?.webContents.send("dictation-hold-start"),
      onHoldEnd: () => overlayWindow?.webContents.send("dictation-hold-end"),
    }
  );

  const settings = getOverlaySettings();
  shortcutMgr.registerAll(
    settings.shortcuts.assistantToggle,
    settings.behavior.doubleTapWindowMs
  );
  holdDetector.start();
  registerMeetingShortcut(settings.shortcuts.meetingToggle);

  createMainWindow();
  createOverlayWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createOverlayWindow();
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
});

import { app, globalShortcut, ipcMain, session, clipboard, BrowserWindow, screen, shell } from "electron";
import path from "path";
import { exec } from "child_process";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import fs from "fs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const IS_PRODUCTION = typeof process !== "undefined" && process.env["NODE_ENV"] === "production";
const createDesktopLogger = (tag) => {
  const prefix = `[${tag}]`;
  return {
    debug: IS_PRODUCTION ? () => {
    } : (...args) => console.log(prefix, ...args),
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  };
};
const log$2 = createDesktopLogger("settings");
const OVERLAY_DEFAULTS = {
  shortcuts: {
    assistantToggle: "CommandOrControl+Space",
    dictationToggle: "CommandOrControl+Shift+Space",
    dictationHoldKey: "CommandOrControl+Shift+Space",
    meetingToggle: "CommandOrControl+Alt+Space"
  },
  voice: {
    language: "en-US",
    silenceTimeoutMs: 2e3,
    ttsEnabled: true,
    ttsRate: 1.05
  },
  behavior: {
    doubleTapWindowMs: 400,
    autoDismissMs: 5e3,
    showDictationPreview: true,
    holdThresholdMs: 150
  },
  meeting: {
    autoDetect: false,
    chunkIntervalMs: 5e3
  }
};
const getSettingsPath = () => path.join(app.getPath("userData"), "basicos-overlay-settings.json");
const getOverlaySettings = () => {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      shortcuts: { ...OVERLAY_DEFAULTS.shortcuts, ...parsed.shortcuts },
      voice: { ...OVERLAY_DEFAULTS.voice, ...parsed.voice },
      behavior: { ...OVERLAY_DEFAULTS.behavior, ...parsed.behavior },
      meeting: { ...OVERLAY_DEFAULTS.meeting, ...parsed.meeting }
    };
  } catch {
    return OVERLAY_DEFAULTS;
  }
};
const setOverlaySettings = (partial) => {
  const current = getOverlaySettings();
  const merged = {
    shortcuts: { ...current.shortcuts, ...partial.shortcuts },
    voice: { ...current.voice, ...partial.voice },
    behavior: { ...current.behavior, ...partial.behavior },
    meeting: { ...current.meeting, ...partial.meeting }
  };
  try {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(merged, null, 2),
      "utf8"
    );
  } catch (err) {
    log$2.error("Failed to write settings:", err);
  }
  return merged;
};
const log$1 = createDesktopLogger("shortcuts");
const createDoubleTapDetector = (doubleTapMs, onSingle, onDouble) => {
  let lastTap = 0;
  let timer = null;
  return () => {
    const now = Date.now();
    const elapsed = now - lastTap;
    lastTap = now;
    if (elapsed < doubleTapMs && timer) {
      clearTimeout(timer);
      timer = null;
      onDouble();
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onSingle();
      }, doubleTapMs);
    }
  };
};
const createShortcutManager = (callbacks) => {
  const registerAll = (assistantKey, doubleTapMs) => {
    unregisterAll();
    const handleAssistant = createDoubleTapDetector(
      doubleTapMs,
      () => callbacks.onAssistantPress(),
      () => callbacks.onAssistantDoubleTap()
    );
    const ok = globalShortcut.register(assistantKey, handleAssistant);
    if (!ok) {
      log$1.warn(`Failed to register assistant shortcut: ${assistantKey}`);
    }
  };
  const unregisterAll = () => {
    globalShortcut.unregisterAll();
  };
  return { registerAll, unregisterAll };
};
const log = createDesktopLogger("hold-key");
const noopDetector = {
  start: () => log.debug("Hold-key detector disabled (stub)"),
  stop: () => {
  },
  updateConfig: () => {
  }
};
const createHoldKeyDetector = (_config, _callbacks) => {
  return noopDetector;
};
let state = {
  active: false,
  meetingId: null,
  startedAt: null
};
function createMeetingManager(options) {
  const { onMeetingStart, onMeetingStop } = options;
  return {
    async start(apiUrl, _token) {
      if (state.active) return;
      console.warn("Meeting recording requires backend support");
      const meetingId = `stub-${Date.now()}`;
      state = {
        active: true,
        meetingId,
        startedAt: Date.now()
      };
      onMeetingStart(meetingId);
    },
    async stop(_apiUrl) {
      if (!state.active) return;
      const meetingId = state.meetingId;
      state = {
        active: false,
        meetingId: null,
        startedAt: null
      };
      if (meetingId) onMeetingStop(meetingId);
    },
    getState() {
      return { ...state };
    },
    getPersistedState() {
      if (!state.active) return null;
      return { ...state };
    }
  };
}
const PILL_WIDTH = 400;
const PILL_HEIGHT = 200;
let mainWindow = null;
let overlayWindow = null;
let overlayActive = false;
let activeMode = "assistant";
let shortcutMgr = null;
let holdDetector = null;
let meetingMgr = null;
let registeredMeetingAccelerator = null;
const WEB_URL = process.env["BASICOS_URL"] ?? "http://localhost:5173";
const getOverlayStatus = () => ({
  visible: !!overlayWindow?.isVisible(),
  active: overlayActive
});
const broadcastOverlayStatus = () => {
  const status = getOverlayStatus();
  mainWindow?.webContents.send("overlay-visibility-changed", status);
  overlayWindow?.webContents.send("overlay-visibility-changed", status);
};
const activateOverlay = (mode) => {
  if (!overlayWindow) return;
  overlayActive = true;
  activeMode = mode;
  overlayWindow.webContents.send("activate-overlay", mode);
  broadcastOverlayStatus();
};
const deactivateOverlay = () => {
  if (!overlayWindow) return;
  overlayActive = false;
  overlayWindow.webContents.send("deactivate-overlay");
  broadcastOverlayStatus();
};
const detectNotch = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const menuBarHeight = primaryDisplay.workArea.y;
  return {
    hasNotch: false,
    notchHeight: 0,
    menuBarHeight: menuBarHeight > 0 ? menuBarHeight : 25,
    windowWidth: PILL_WIDTH
  };
};
function createMainWindow() {
  const iconPath = path.join(process.cwd(), "public", "favicon.png");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      sandbox: false
    }
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
function createOverlayWindow() {
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
      sandbox: false
    },
    hasShadow: false,
    backgroundColor: "#00000000"
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  const overlayUrl = is.dev && process.env["ELECTRON_RENDERER_URL"] ? `${process.env["ELECTRON_RENDERER_URL"].replace(/\/$/, "")}/overlay.html` : path.join(__dirname, "../renderer/overlay.html");
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
        mainWindow.loadURL(url).catch(() => void 0);
      } else if (target.protocol === "http:" || target.protocol === "https:") {
        shell.openExternal(url).catch(() => void 0);
      }
    } catch {
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
ipcMain.handle("get-session-token", async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      name: "better-auth.session_token"
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
ipcMain.handle("update-overlay-settings", (_event, partial) => {
  const updated = setOverlaySettings(partial);
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
      holdThresholdMs: updated.behavior.holdThresholdMs
    });
  }
  overlayWindow?.webContents.send("settings-changed", updated);
  return updated;
});
ipcMain.on("set-ignore-mouse", (_event, ignore) => {
  if (ignore) {
    overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow?.setIgnoreMouseEvents(false);
  }
});
ipcMain.on("overlay-dismissed", () => {
  overlayActive = false;
  broadcastOverlayStatus();
});
ipcMain.on("navigate-main", (_event, urlOrPath) => {
  if (mainWindow) {
    mainWindow.show();
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${WEB_URL}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
    mainWindow.loadURL(fullUrl).catch(() => void 0);
  }
});
ipcMain.handle("inject-text", (_event, text) => {
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
    name: "better-auth.session_token"
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
  return meetingMgr ? meetingMgr.getState() : { active: false, meetingId: null, startedAt: null };
});
ipcMain.handle("get-persisted-meeting", () => {
  return meetingMgr?.getPersistedState() ?? null;
});
ipcMain.handle("show-overlay", () => {
  if (!overlayWindow) {
    createOverlayWindow();
  }
  overlayWindow?.show();
  overlayWindow?.focus();
  broadcastOverlayStatus();
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
const registerMeetingShortcut = (accelerator) => {
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
    }
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
    }
  });
  holdDetector = createHoldKeyDetector(
    {
      accelerator: getOverlaySettings().shortcuts.dictationHoldKey,
      holdThresholdMs: getOverlaySettings().behavior.holdThresholdMs
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
});

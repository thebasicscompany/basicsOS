import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  screen,
  nativeImage,
  ipcMain,
  clipboard,
  desktopCapturer,
  shell,
  session,
} from "electron";
import path from "path";
import { exec, execSync } from "child_process";
import { autoUpdater } from "electron-updater";
import { is } from "@electron-toolkit/utils";
import { getOverlaySettings, setOverlaySettings } from "./settings-store.js";
import { createShortcutManager } from "./shortcut-manager.js";
import type { ShortcutManager } from "./shortcut-manager.js";

type ActivationMode = "assistant" | "continuous" | "dictation" | "transcribe";

const WEB_URL = process.env["BASICOS_URL"] ?? "http://localhost:3000";
const PILL_WIDTH = 400;
const PILL_HEIGHT = 200;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let overlayActive = false;
let activeMode: ActivationMode = "assistant";
let shortcutMgr: ShortcutManager | null = null;
let cachedBranding: Branding | null = null;

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

type Branding = {
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
  apiUrl: string;
  mcpUrl: string;
};

const DEFAULT_BRANDING: Branding = {
  companyName: "Basics OS",
  logoUrl: null,
  accentColor: "#6366f1",
  apiUrl: "http://localhost:3001",
  mcpUrl: "http://localhost:4000",
};

const fetchBranding = async (): Promise<Branding> => {
  try {
    const res = await fetch(`${WEB_URL}/api/branding`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return DEFAULT_BRANDING;
    return (await res.json()) as Branding;
  } catch {
    return DEFAULT_BRANDING;
  }
};

// ---------------------------------------------------------------------------
// Notch detection (macOS only)
// ---------------------------------------------------------------------------

type NotchInfo = {
  hasNotch: boolean;
  notchHeight: number;
  windowWidth: number;
};

const detectNotch = (): NotchInfo => {
  const info: NotchInfo = { hasNotch: false, notchHeight: 0, windowWidth: PILL_WIDTH };

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

// ---------------------------------------------------------------------------
// Overlay activation helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

const createMainWindow = (branding: Branding): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: branding.companyName,
    webPreferences: { contextIsolation: true },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#f9fafb",
  });
  mainWindow.loadURL(WEB_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// ---------------------------------------------------------------------------
// Overlay window — fixed 400x200, flush top-center
// ---------------------------------------------------------------------------

const createOverlayWindow = (): void => {
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
    enableLargerThanScreen: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js"),
    },
    hasShadow: false,
    backgroundColor: "#00000000",
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");

  // Load the local renderer
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    overlayWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Block navigation away from local renderer
  overlayWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  // Handle window.open links
  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const base = new URL(WEB_URL);
      if (target.origin === base.origin) {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.loadURL(url).catch(() => undefined);
        }
      } else if (target.protocol === "http:" || target.protocol === "https:") {
        shell.openExternal(url).catch(() => undefined);
      }
    } catch {
      // Invalid URL — deny silently
    }
    return { action: "deny" as const };
  });

  // Start in click-through mode
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Send notch info + branding once renderer is ready
  overlayWindow.webContents.on("did-finish-load", () => {
    const notchInfo = detectNotch();
    overlayWindow?.webContents.send("notch-info", notchInfo);
    if (cachedBranding) {
      overlayWindow?.webContents.send("branding-info", {
        companyName: cachedBranding.companyName,
        logoUrl: cachedBranding.logoUrl,
        accentColor: cachedBranding.accentColor,
      });
    }
  });

  // Show overlay (always visible, click-through by default)
  overlayWindow.showInactive();
};

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

// Auth: extract session token from main window's cookies
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

// Config: return API server URL
ipcMain.handle("get-api-url", () => {
  return process.env["BASICOS_API_URL"] ?? "http://localhost:3001";
});

// Settings: get current overlay settings
ipcMain.handle("get-overlay-settings", () => {
  return getOverlaySettings();
});

// Settings: update overlay settings (partial merge)
ipcMain.handle("update-overlay-settings", (_event, partial: Record<string, unknown>) => {
  const updated = setOverlaySettings(partial as Parameters<typeof setOverlaySettings>[0]);

  // Re-register shortcuts with new keys
  if (shortcutMgr) {
    shortcutMgr.registerAll(
      updated.shortcuts.assistantToggle,
      updated.shortcuts.dictationToggle,
      updated.behavior.doubleTapWindowMs,
    );
  }

  // Notify renderer of changes
  overlayWindow?.webContents.send("settings-changed", updated);

  return updated;
});

// Click-through toggle
ipcMain.on("set-ignore-mouse", (_event, ignore: boolean) => {
  if (ignore) {
    overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow?.setIgnoreMouseEvents(false);
  }
});

// Overlay self-dismissed
ipcMain.on("overlay-dismissed", () => {
  overlayActive = false;
});

// Navigate main window
ipcMain.on("navigate-main", (_event, urlOrPath: string) => {
  if (mainWindow) {
    mainWindow.show();
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${WEB_URL}${urlOrPath}`;
    mainWindow.loadURL(fullUrl).catch(() => undefined);
  }
});

// Inject text via clipboard + simulated paste
ipcMain.handle("inject-text", (_event, text: string): Promise<void> => {
  return new Promise((resolve) => {
    clipboard.writeText(text);

    if (process.platform === "darwin") {
      setTimeout(() => {
        exec(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
          (err) => {
            if (err) console.error("[inject-text] osascript error:", err.message);
            resolve();
          },
        );
      }, 120);
    } else if (process.platform === "win32") {
      setTimeout(() => {
        exec(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
          (err) => {
            if (err) console.error("[inject-text] powershell error:", err.message);
            resolve();
          },
        );
      }, 120);
    } else {
      resolve();
    }
  });
});

// Capture screenshot
ipcMain.handle("capture-screen", async (): Promise<string> => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  });

  const primary = sources[0];
  if (!primary) throw new Error("No screen source found");

  return primary.thumbnail.toPNG().toString("base64");
});

// ---------------------------------------------------------------------------
// Shortcuts — 4 modes via press / double-tap on two keys
// ---------------------------------------------------------------------------

const setupShortcuts = (): void => {
  const settings = getOverlaySettings();

  shortcutMgr = createShortcutManager({
    // Ctrl+Space press → AI assistant (silence auto-stop)
    onAssistantPress: () => {
      if (!overlayWindow) return;
      if (overlayActive) {
        // Re-send — renderer handles stop logic per current mode
        overlayWindow.webContents.send("activate-overlay", activeMode);
      } else {
        activateOverlay("assistant");
      }
    },

    // Ctrl+Space double-tap → continuous AI listening
    onAssistantDoubleTap: () => {
      if (!overlayWindow) return;
      if (overlayActive) {
        deactivateOverlay();
      } else {
        activateOverlay("continuous");
      }
    },

    // Ctrl+Shift+Space press → dictation to paste
    onDictationPress: () => {
      if (!overlayWindow) return;
      if (overlayActive && (activeMode === "dictation" || activeMode === "transcribe")) {
        // Re-send — renderer handles paste/copy + dismiss
        overlayWindow.webContents.send("activate-overlay", activeMode);
      } else if (!overlayActive) {
        activateOverlay("dictation");
      } else {
        deactivateOverlay();
      }
    },

    // Ctrl+Shift+Space double-tap → speech-to-text (copy to clipboard)
    onDictationDoubleTap: () => {
      if (!overlayWindow) return;
      if (overlayActive) {
        deactivateOverlay();
      } else {
        activateOverlay("transcribe");
      }
    },
  });

  shortcutMgr.registerAll(
    settings.shortcuts.assistantToggle,
    settings.shortcuts.dictationToggle,
    settings.behavior.doubleTapWindowMs,
  );
};

// ---------------------------------------------------------------------------
// Protocol handler (basicos://)
// ---------------------------------------------------------------------------

const setupProtocolHandler = (): void => {
  if (!app.isDefaultProtocolClient("basicos")) {
    app.setAsDefaultProtocolClient("basicos");
  }
};

const handleProtocolUrl = (url: string): void => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "activate-overlay") {
      const mode = (parsed.searchParams.get("mode") ?? "assistant") as ActivationMode;
      if (!overlayActive) {
        activateOverlay(mode);
      }
    } else if (parsed.hostname === "update-settings") {
      const json = parsed.searchParams.get("json");
      if (json) {
        try {
          const partial = JSON.parse(decodeURIComponent(json)) as Record<string, unknown>;
          const updated = setOverlaySettings(partial as Parameters<typeof setOverlaySettings>[0]);
          if (shortcutMgr) {
            shortcutMgr.registerAll(
              updated.shortcuts.assistantToggle,
              updated.shortcuts.dictationToggle,
              updated.behavior.doubleTapWindowMs,
            );
          }
          overlayWindow?.webContents.send("settings-changed", updated);
        } catch {
          console.error("[protocol] Failed to parse settings JSON");
        }
      }
    }
  } catch {
    // Invalid protocol URL
  }
};

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

const createTray = (branding: Branding): void => {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB2SURBVDiNY2AYBUMHMBITtLOzYyAk2NDQUP/v37+NSUVFRX1jY+P/hoaGekxAQIBBX1+fgRgXEONiYmJiYHBxcTGws7MzMDIyMjAzMzMwMjIyMDAwMDAyMjIwMDAwMDAwMDAyMjIwMDAwMDAwMDAAAAAA//8DANiHJWwAAAAASUVORK5CYII=",
  );
  icon.setTemplateImage(true);

  const settings = getOverlaySettings();
  const fmtAssistant = formatShortcutLabel(settings.shortcuts.assistantToggle);
  const fmtDictation = formatShortcutLabel(settings.shortcuts.dictationToggle);

  tray = new Tray(icon);
  tray.setToolTip(branding.companyName);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Open ${branding.companyName}`,
        click: () => {
          mainWindow?.show() ?? createMainWindow(branding);
        },
      },
      { type: "separator" },
      {
        label: `AI Assistant  ${fmtAssistant}`,
        click: () => activateOverlay("assistant"),
      },
      {
        label: `Dictation  ${fmtDictation}`,
        click: () => activateOverlay("dictation"),
      },
      {
        label: `Continuous  2x ${fmtAssistant}`,
        click: () => activateOverlay("continuous"),
      },
      {
        label: `Transcribe  2x ${fmtDictation}`,
        click: () => activateOverlay("transcribe"),
      },
      { type: "separator" },
      {
        label: "Check for Updates",
        click: () => {
          void autoUpdater.checkForUpdatesAndNotify();
        },
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  tray.on("click", () => mainWindow?.show() ?? createMainWindow(branding));
};

const formatShortcutLabel = (shortcut: string): string => {
  if (process.platform === "darwin") {
    return shortcut
      .replace("Control", "\u2303")
      .replace("Shift", "\u21e7")
      .replace("Alt", "\u2325")
      .replace("Command", "\u2318")
      .replace("CommandOrControl", "\u2318")
      .replace(/\+/g, "");
  }
  return shortcut;
};

// ---------------------------------------------------------------------------
// Auto-updater
// ---------------------------------------------------------------------------

const setupAutoUpdater = (): void => {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    console.error("[auto-updater] Check failed:", err);
  });

  autoUpdater.on("update-available", () => {
    console.warn("[auto-updater] Update available -- downloading...");
  });

  autoUpdater.on("update-downloaded", () => {
    console.warn("[auto-updater] Update downloaded -- will install on next restart.");
  });

  autoUpdater.on("error", (err: Error) => {
    console.error("[auto-updater] Error:", err.message);
  });
};

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

setupProtocolHandler();

app.whenReady().then(async () => {
  const branding = await fetchBranding();
  cachedBranding = branding;

  // Try to create main window — skip silently if web server unavailable
  try {
    const probe = await fetch(WEB_URL, { signal: AbortSignal.timeout(2000) });
    if (probe.ok) createMainWindow(branding);
  } catch {
    console.warn("[main] Web server not reachable at", WEB_URL, "-- skipping main window");
  }

  createOverlayWindow();
  createTray(branding);
  setupAutoUpdater();
  setupShortcuts();

  app.on("activate", () => {
    if (mainWindow === null) {
      try {
        createMainWindow(branding);
      } catch {
        // web server still unavailable
      }
    }
  });
});

// macOS: handle protocol URL when app is already running
app.on("open-url", (_event, url) => {
  handleProtocolUrl(url);
});

// Windows/Linux: handle protocol URL via second-instance
app.on("second-instance", (_event, argv) => {
  const protocolUrl = argv.find((a) => a.startsWith("basicos://"));
  if (protocolUrl) handleProtocolUrl(protocolUrl);
  mainWindow?.show();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  shortcutMgr?.unregisterAll();
});

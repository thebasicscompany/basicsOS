import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
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

const WEB_URL = process.env["BASICOS_URL"] ?? "http://localhost:3000";
const PILL_WIDTH = 400;
const PILL_HEIGHT = 200;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let overlayActive = false;

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
    // Use Swift to query NSScreen.main?.safeAreaInsets.top
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
// Overlay window — fixed 400×200, flush top-center
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

  // Send notch info once renderer is ready
  overlayWindow.webContents.on("did-finish-load", () => {
    const notchInfo = detectNotch();
    overlayWindow?.webContents.send("notch-info", notchInfo);
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
// Shortcuts
// ---------------------------------------------------------------------------

const setupShortcuts = (): void => {
  // Primary: Alt+Space
  globalShortcut.register("Alt+Space", () => {
    if (!overlayWindow) return;
    if (!overlayActive) {
      overlayActive = true;
      overlayWindow.webContents.send("activate-overlay");
    } else {
      overlayActive = false;
      overlayWindow.webContents.send("deactivate-overlay");
    }
  });

  // Secondary: Cmd+Shift+Space
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!overlayWindow) return;
    if (!overlayActive) {
      overlayActive = true;
      overlayWindow.webContents.send("activate-overlay");
    } else {
      overlayActive = false;
      overlayWindow.webContents.send("deactivate-overlay");
    }
  });
};

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

const createTray = (branding: Branding): void => {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB2SURBVDiNY2AYBUMHMBITtLOzYyAk2NDQUP/v37+NSUVFRX1jY+P/hoaGekxAQIBBX1+fgRgXEONiYmJiYHBxcTGws7MzMDIyMjAzMzMwMjIyMDAwMDAyMjIwMDAwMDAwMDAyMjIwMDAwMDAwMDAAAAAA//8DANiHJWwAAAAASUVORK5CYII=",
  );
  icon.setTemplateImage(true);

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
      {
        label: "Toggle Overlay  \u2325Space",
        click: () => {
          if (!overlayWindow) return;
          if (!overlayActive) {
            overlayActive = true;
            overlayWindow.webContents.send("activate-overlay");
          } else {
            overlayActive = false;
            overlayWindow.webContents.send("deactivate-overlay");
          }
        },
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

app.whenReady().then(async () => {
  const branding = await fetchBranding();

  // Try to create main window — skip silently if web server unavailable
  try {
    const probe = await fetch(WEB_URL, { signal: AbortSignal.timeout(2000) });
    if (probe.ok) createMainWindow(branding);
  } catch {
    console.warn("[main] Web server not reachable at", WEB_URL, "— skipping main window");
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

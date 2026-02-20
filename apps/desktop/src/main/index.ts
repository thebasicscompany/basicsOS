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
import { exec } from "child_process";
import { autoUpdater } from "electron-updater";
import { is } from "@electron-toolkit/utils";

const WEB_URL = process.env["BASICOS_URL"] ?? "http://localhost:3000";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Branding fetched from /api/branding on launch
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

const createMainWindow = (branding: Branding): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: branding.companyName,
    webPreferences: { contextIsolation: true },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: "#f9fafb",
  });
  mainWindow.loadURL(WEB_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const createOverlayWindow = (): void => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 480,
    x: width - 440,
    y: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      // sandbox: false is required for electron-vite preload scripts using contextBridge
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js"),
    },
    hasShadow: false,
    backgroundColor: "#00000000",
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");

  // Load the local renderer (Vite dev server in dev, bundled file in production)
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    overlayWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Block any navigation away from the local renderer
  overlayWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  // Handle window.open / target="_blank" links: same-origin → main window, external → system browser
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

  overlayWindow.on("show", () => {
    overlayWindow?.setIgnoreMouseEvents(false);
  });

  // No blur-to-hide — overlay stays visible alongside dashboard
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

// IPC: renderer tells us whether the mouse is over an interactive element.
ipcMain.on("set-ignore-mouse", (_event, ignore: boolean) => {
  if (ignore) {
    overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow?.setIgnoreMouseEvents(false);
  }
});

// IPC: inject text into the currently focused field.
// Strategy: write to clipboard, then simulate Cmd+V in the previously active app.
// Requires Accessibility permission on macOS (prompted automatically on first use).
ipcMain.handle("inject-text", (_event, text: string): Promise<void> => {
  return new Promise((resolve) => {
    clipboard.writeText(text);

    if (process.platform === "darwin") {
      // Hide overlay so the previously focused window regains focus, then paste
      overlayWindow?.hide();
      setTimeout(() => {
        exec(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
          (err) => {
            if (err) console.error("[inject-text] osascript error:", err.message);
            resolve();
          },
        );
      }, 120); // wait for focus to return to previous app
    } else if (process.platform === "win32") {
      // Windows: use PowerShell to send Ctrl+V
      overlayWindow?.hide();
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
      // Linux / fallback: clipboard is set; user must paste manually
      resolve();
    }
  });
});

// IPC: navigate the main window to a URL path (for overlay quick actions / voice commands).
ipcMain.on("navigate-main", (_event, urlOrPath: string) => {
  if (mainWindow) {
    mainWindow.show();
    // If it's a relative path, prepend the web URL
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${WEB_URL}${urlOrPath}`;
    mainWindow.loadURL(fullUrl).catch(() => undefined);
  }
});

// IPC: capture a screenshot of the primary display and return base64 PNG.
// Hides the overlay first so it doesn't appear in the capture.
ipcMain.handle("capture-screen", async (): Promise<string> => {
  // Hide overlay so it's excluded from the capture
  const wasVisible = overlayWindow?.isVisible() ?? false;
  overlayWindow?.hide();

  // Wait for the OS to composite the display without the overlay
  await new Promise<void>((resolve) => setTimeout(resolve, 300));

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  });

  const primary = sources[0];
  if (!primary) {
    if (wasVisible) overlayWindow?.show();
    throw new Error("No screen source found");
  }

  const png = primary.thumbnail.toPNG();
  if (wasVisible) overlayWindow?.show();

  return png.toString("base64");
});

const toggleOverlay = (): void => {
  if (!overlayWindow) return;
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    overlayWindow.setPosition(width - 440, 60);
    overlayWindow.show();
    overlayWindow.focus();
  }
};

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
      { label: "Toggle Overlay  ⌘⇧Space", click: toggleOverlay },
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
  // Only run in packaged builds — not in dev
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    console.error("[auto-updater] Check failed:", err);
  });

  autoUpdater.on("update-available", () => {
    console.warn("[auto-updater] Update available — downloading...");
  });

  autoUpdater.on("update-downloaded", () => {
    console.warn("[auto-updater] Update downloaded — will install on next restart.");
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

  createMainWindow(branding);
  createOverlayWindow();
  createTray(branding);
  setupAutoUpdater();

  globalShortcut.register("CommandOrControl+Shift+Space", toggleOverlay);

  app.on("activate", () => {
    if (mainWindow === null) createMainWindow(branding);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

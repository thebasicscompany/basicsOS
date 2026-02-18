import { app, BrowserWindow, Tray, Menu, globalShortcut, screen, nativeImage, ipcMain } from "electron";
import path from "path";

const WEB_URL = process.env["BASICOS_URL"] ?? "http://localhost:3000";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const createMainWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Basics OS",
    webPreferences: { contextIsolation: true },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: "#f9fafb",
  });
  mainWindow.loadURL(WEB_URL);
  mainWindow.on("closed", () => { mainWindow = null; });
};

const createOverlayWindow = (): void => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 440,
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
      preload: path.join(app.getAppPath(), "dist/preload/index.js"),
    },
    vibrancy: "under-window",
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.loadURL(`${WEB_URL}/overlay`);

  // On show, start with mouse events enabled so the renderer can refine via IPC
  overlayWindow.on("show", () => {
    overlayWindow?.setIgnoreMouseEvents(false);
  });

  // Click outside to hide
  overlayWindow.on("blur", () => {
    overlayWindow?.hide();
  });
};

// IPC: renderer tells us whether the mouse is over an interactive element.
// When ignore=true (transparent area): forward events so underlying app receives them.
// When ignore=false (interactive panel): capture events normally.
ipcMain.on("set-ignore-mouse", (_event, ignore: boolean) => {
  if (ignore) {
    overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow?.setIgnoreMouseEvents(false);
  }
});

const toggleOverlay = (): void => {
  if (!overlayWindow) return;
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    // Reposition to top-right of primary display on show
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    overlayWindow.setPosition(width - 440, 60);
    overlayWindow.show();
    overlayWindow.focus();
  }
};

const createTray = (): void => {
  // Create a simple tray icon (16x16 template image)
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB2SURBVDiNY2AYBUMHMBITtLOzYyAk2NDQUP/v37+MSUVFRX1jY+P/hoaGekxAQIBBX1+fgRgXEONiYmJiYHBxcTGws7MzMDIyMjAzMzMwMjIyMDAwMDAyMjIwMDAwMDAwMDAyMjIwMDAwMDAwMDAwAAAA//8DANiHJWwAAAAASUVORK5CYII="
  );
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Basics OS");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Basics OS", click: () => { mainWindow?.show() ?? createMainWindow(); } },
      { label: "Toggle Overlay  ⌘⇧Space", click: toggleOverlay },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
  tray.on("click", () => mainWindow?.show() ?? createMainWindow());
};

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  createTray();

  globalShortcut.register("CommandOrControl+Shift+Space", toggleOverlay);

  app.on("activate", () => {
    if (mainWindow === null) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

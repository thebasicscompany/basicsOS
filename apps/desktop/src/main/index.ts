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
  dialog,
  globalShortcut,
  shell,
  session,
  systemPreferences,
} from "electron";
import path from "path";
import { exec, execSync } from "child_process";
import { autoUpdater } from "electron-updater";
import { is } from "@electron-toolkit/utils";
import { getOverlaySettings, setOverlaySettings } from "./settings-store.js";
import { createShortcutManager } from "./shortcut-manager.js";
import type { ShortcutManager } from "./shortcut-manager.js";
import { createHoldKeyDetector } from "./hold-key-detector.js";
import { createMeetingManager } from "./meeting-manager.js";
import type { MeetingManager } from "./meeting-manager.js";
import { startSystemAudioCapture, stopSystemAudioCapture, checkSystemAudioPermission } from "./system-audio-capture.js";

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
let holdDetector: ReturnType<typeof createHoldKeyDetector> | null = null;
let meetingMgr: MeetingManager | null = null;
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
  menuBarHeight: number;
  windowWidth: number;
};

const detectNotch = (): NotchInfo => {
  // Get menu bar height from the primary display work area offset
  const primaryDisplay = screen.getPrimaryDisplay();
  const menuBarHeight = primaryDisplay.workArea.y;

  const info: NotchInfo = {
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
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js"),
    },
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
    hiddenInMissionControl: true,
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
    // Open DevTools detached in dev mode so we can see renderer console logs
    overlayWindow.webContents.openDevTools({ mode: "detach" });
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
    const found = !!cookies[0]?.value;
    console.log(`[H2] get-session-token: found=${found}, cookieCount=${cookies.length}${found ? `, token=${cookies[0]!.value.slice(0, 8)}...` : ""}`);
    return cookies[0]?.value ?? null;
  } catch (err: unknown) {
    console.error(`[H2] get-session-token ERROR: ${err instanceof Error ? err.message : String(err)}`);
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
      updated.behavior.doubleTapWindowMs,
    );
  }
  registerMeetingShortcut(updated.shortcuts.meetingToggle);

  if (holdDetector) {
    holdDetector.updateConfig({
      accelerator: updated.shortcuts.dictationHoldKey,
      holdThresholdMs: updated.behavior.holdThresholdMs,
    });
  }

  // Notify renderer of changes
  overlayWindow?.webContents.send("settings-changed", updated);

  return updated;
});

// Shortcut capture: temporarily unregister all shortcuts so keypresses reach the web renderer
ipcMain.handle("start-shortcut-capture", () => {
  shortcutMgr?.unregisterAll();
  holdDetector?.stop();
  if (registeredMeetingAccelerator) {
    globalShortcut.unregister(registeredMeetingAccelerator);
    registeredMeetingAccelerator = null;
  }
});

// Shortcut capture: re-register all shortcuts after capture completes or is cancelled
ipcMain.handle("stop-shortcut-capture", () => {
  const settings = getOverlaySettings();
  shortcutMgr?.registerAll(settings.shortcuts.assistantToggle, settings.behavior.doubleTapWindowMs);
  holdDetector?.start();
  registerMeetingShortcut(settings.shortcuts.meetingToggle);
});

// Forward renderer console logs to main process stdout (for log file capture)
ipcMain.on("renderer-log", (_event, msg: string) => {
  console.log(`[renderer] ${msg}`);
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
  console.log(`[H5] inject-text IPC: text="${text.slice(0, 40)}..." (${text.length} chars)`);
  return new Promise((resolve) => {
    clipboard.writeText(text);
    console.log("[H5] inject-text: clipboard.writeText done, scheduling osascript paste...");

    if (process.platform === "darwin") {
      setTimeout(() => {
        exec(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
          (err) => {
            console.log(`[H5] inject-text: osascript exit=${err ? err.message : "ok"}`);
            setTimeout(() => resolve(), 200);
          },
        );
      }, 50);
    } else if (process.platform === "win32") {
      setTimeout(() => {
        exec(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
          (err) => {
            if (err) console.error("[inject-text] powershell error:", err.message);
            setTimeout(() => resolve(), 200);
          },
        );
      }, 50);
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

// Accessibility permission checks (macOS — required for uiohook-napi)
ipcMain.handle("check-accessibility", () => {
  if (process.platform !== "darwin") return true;
  return systemPreferences.isTrustedAccessibilityClient(false);
});

ipcMain.handle("request-accessibility", () => {
  if (process.platform !== "darwin") return true;
  return systemPreferences.isTrustedAccessibilityClient(true);
});

// Meeting: start a new meeting via API
ipcMain.handle("start-meeting", async () => {
  console.log("[main] start-meeting IPC received");
  if (!meetingMgr) { console.error("[main] No meeting manager!"); return; }
  const apiUrl = process.env["BASICOS_API_URL"] ?? "http://localhost:3001";
  const cookies = await session.defaultSession.cookies.get({
    name: "better-auth.session_token",
  });
  const token = cookies[0]?.value;
  if (!token) { console.error("[main] No session token for meeting start"); throw new Error("No session token — user must be logged in"); }
  console.log("[main] Starting meeting with API:", apiUrl, "token:", token.slice(0, 8) + "...");
  await meetingMgr.start(apiUrl, token);
  console.log("[main] Meeting start complete");
});

// Meeting: stop the current meeting
ipcMain.handle("stop-meeting", async () => {
  console.log("[main] stop-meeting IPC received");
  if (!meetingMgr) { console.error("[main] No meeting manager!"); return; }
  const apiUrl = process.env["BASICOS_API_URL"] ?? "http://localhost:3001";
  const cookies = await session.defaultSession.cookies.get({
    name: "better-auth.session_token",
  });
  const token = cookies[0]?.value;
  if (!token) { console.error("[main] No session token for meeting stop"); throw new Error("No session token — user must be logged in"); }
  await meetingMgr.stop(apiUrl, token);
  console.log("[main] Meeting stop complete");
});

// Meeting: get current state
ipcMain.handle("meeting-state", () => {
  const state = meetingMgr ? meetingMgr.getState() : { active: false, meetingId: null, startedAt: null };
  console.log("[main] meeting-state query:", JSON.stringify(state));
  return state;
});

// Meeting: get available desktop capture sources (for system audio)
ipcMain.handle("get-desktop-sources", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen"] });
  console.log("[main] get-desktop-sources:", sources.length, "sources:", sources.map((s) => `${s.name} (${s.id})`).join(", "));
  return sources.map((s) => ({ id: s.id, name: s.name }));
});

// Meeting: get persisted meeting state for crash recovery
ipcMain.handle("get-persisted-meeting", () => {
  if (!meetingMgr) { console.log("[main] get-persisted-meeting: no meeting manager"); return null; }
  const persisted = meetingMgr.getPersistedState();
  console.log("[main] get-persisted-meeting:", persisted ? JSON.stringify(persisted) : "none");
  return persisted;
});

// System audio capture (macOS 14.2+ via AudioTee)
ipcMain.handle("start-system-audio", async (_event, meetingId: string) => {
  console.log("[main] start-system-audio IPC received, meetingId:", meetingId);
  const apiUrl = process.env["BASICOS_API_URL"] ?? "http://localhost:3001";
  const cookies = await session.defaultSession.cookies.get({
    name: "better-auth.session_token",
  });
  const token = cookies[0]?.value;
  if (!token) { console.error("[main] No session token for system audio"); return false; }
  return startSystemAudioCapture(meetingId, apiUrl, token, {
    onSilenceDetected: () => {
      overlayWindow?.webContents.send("system-audio-silent");
    },
    onTranscript: (speaker, text) => {
      overlayWindow?.webContents.send("system-audio-transcript", speaker, text);
    },
  });
});

ipcMain.handle("stop-system-audio", async () => {
  console.log("[main] stop-system-audio IPC received");
  return stopSystemAudioCapture();
});

// System audio: check if Screen & System Audio Recording permission is granted (macOS)
ipcMain.handle("check-system-audio-permission", () => {
  const status = checkSystemAudioPermission();
  console.log("[main] check-system-audio-permission:", status);
  return status;
});

// Screen recording permission check (macOS)
// On macOS, if Screen Recording permission is denied, desktopCapturer returns blank thumbnails.
ipcMain.handle("check-screen-recording", async (): Promise<boolean> => {
  if (process.platform !== "darwin") return true;
  try {
    const screenMediaStatus = systemPreferences.getMediaAccessStatus("screen");
    console.log(`[main] check-screen-recording: mediaAccessStatus(screen)=${screenMediaStatus}`);
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    });
    if (sources.length === 0) { console.log("[main] check-screen-recording: no sources"); return false; }
    // Check if the thumbnail is blank (all zeros = permission denied)
    const thumbnail = sources[0]!.thumbnail;
    const bitmap = thumbnail.toBitmap();
    // A 1x1 RGBA bitmap is 4 bytes — if all zero, permission is denied
    const hasPixels = bitmap.some((byte) => byte !== 0);
    console.log(`[main] check-screen-recording: bitmapSize=${bitmap.length}, hasPixels=${hasPixels}`);
    return hasPixels;
  } catch (err: unknown) {
    console.error(`[main] check-screen-recording error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
});

// Screen recording permission prompt (macOS)
// Checks permission via bitmap test, and if denied shows a dialog offering to open System Settings.
ipcMain.handle("prompt-screen-recording", async (): Promise<boolean> => {
  if (process.platform !== "darwin") return true;
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    });
    if (sources.length === 0) {
      // No sources at all — treat as denied
    } else {
      const bitmap = sources[0]!.thumbnail.toBitmap();
      if (bitmap.some((byte) => byte !== 0)) return true; // Permission already granted
    }
  } catch {
    // Failed to check — treat as denied
  }

  const { response } = await dialog.showMessageBox({
    type: "warning",
    title: "Screen Recording Permission Required",
    message:
      "Basics OS needs Screen Recording permission to capture system audio during meetings.\n\n" +
      "Please grant access in System Settings → Privacy & Security → Screen Recording, then try again.",
    buttons: ["Open System Settings", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    void shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }

  return false;
});

// ---------------------------------------------------------------------------
// Accessibility permission check (macOS — required for global shortcuts + uiohook)
// ---------------------------------------------------------------------------

const ensureAccessibility = async (): Promise<void> => {
  if (process.platform !== "darwin") return;
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  if (!trusted) {
    await dialog.showMessageBox({
      type: "warning",
      title: "Accessibility Permission Required",
      message:
        "Basics OS needs Accessibility permission for keyboard shortcuts.\n\n" +
        "Please grant access in System Settings \u2192 Privacy & Security \u2192 Accessibility, then restart the app.",
    });
  }
};

// ---------------------------------------------------------------------------
// Shortcuts — assistant via globalShortcut, dictation via hold-key detector
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
  });

  shortcutMgr.registerAll(
    settings.shortcuts.assistantToggle,
    settings.behavior.doubleTapWindowMs,
  );

  // Hold-to-talk dictation via uiohook-napi (global key listener)
  holdDetector = createHoldKeyDetector(
    {
      accelerator: settings.shortcuts.dictationHoldKey,
      holdThresholdMs: settings.behavior.holdThresholdMs,
    },
    {
      onHoldStart: () => {
        overlayWindow?.webContents.send("dictation-hold-start");
      },
      onHoldEnd: () => {
        overlayWindow?.webContents.send("dictation-hold-end");
      },
    },
  );
  holdDetector.start();

  // Meeting manager — orchestrates meeting state + IPC to renderer
  meetingMgr = createMeetingManager({
    onMeetingStart: (meetingId) => {
      console.log("[main] Meeting manager callback: onMeetingStart, meetingId:", meetingId);
      overlayWindow?.webContents.send("meeting-started", meetingId);
    },
    onMeetingStop: (meetingId) => {
      console.log("[main] Meeting manager callback: onMeetingStop, meetingId:", meetingId);
      overlayWindow?.webContents.send("meeting-stopped", meetingId);
    },
  });

  // Meeting toggle shortcut — registered directly (not via shortcut-manager)
  registerMeetingShortcut(settings.shortcuts.meetingToggle);
};

let registeredMeetingAccelerator: string | null = null;

const registerMeetingShortcut = (accelerator: string): void => {
  console.log("[shortcuts] Registering meeting shortcut:", accelerator);
  // Unregister the previously registered key (may differ from the new one)
  if (registeredMeetingAccelerator) {
    globalShortcut.unregister(registeredMeetingAccelerator);
    registeredMeetingAccelerator = null;
  }

  const ok = globalShortcut.register(accelerator, () => {
    console.log(`[H6] Meeting shortcut pressed! overlayWindow=${!!overlayWindow}, webContents=${!!overlayWindow?.webContents}`);
    if (!overlayWindow) { console.log("[H6] Meeting shortcut: overlayWindow is null — aborting"); return; }
    overlayWindow.webContents.send("meeting-toggle");
    console.log("[H6] Meeting shortcut: meeting-toggle IPC sent to renderer");
  });
  if (ok) {
    console.log("[shortcuts] Meeting shortcut registered successfully:", accelerator);
    registeredMeetingAccelerator = accelerator;
  } else {
    console.warn(`[shortcuts] Failed to register meeting shortcut: ${accelerator}`);
  }
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
              updated.behavior.doubleTapWindowMs,
            );
          }
          registerMeetingShortcut(updated.shortcuts.meetingToggle);
          if (holdDetector) {
            holdDetector.updateConfig({
              accelerator: updated.shortcuts.dictationHoldKey,
              holdThresholdMs: updated.behavior.holdThresholdMs,
            });
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
  await ensureAccessibility();
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
  holdDetector?.stop();
});

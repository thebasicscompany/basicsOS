import { contextBridge, ipcRenderer } from "electron";
import { electronAPI as toolkitAPI } from "@electron-toolkit/preload";
import type {
  ActivationMode,
  OverlaySettings,
  BrandingInfo,
  DictationInsertResult,
  ShortcutBinding,
  PushNotificationPayload,
} from "@/shared-overlay/types";

const overlayAPI = {
  onActivate: (cb: (mode: ActivationMode) => void) => {
    ipcRenderer.on("activate-overlay", (_e, mode: ActivationMode) => cb(mode));
  },
  onDeactivate: (cb: () => void) => {
    ipcRenderer.on("deactivate-overlay", cb);
  },
  onNotchInfo: (
    cb: (info: {
      hasNotch: boolean;
      notchHeight: number;
      menuBarHeight?: number;
      windowWidth: number;
    }) => void,
  ) => {
    ipcRenderer.on("notch-info", (_e, info) => cb(info));
  },
  onBranding: (cb: (b: BrandingInfo) => void) => {
    ipcRenderer.on("branding-info", (_e, b: BrandingInfo) => cb(b));
  },
  onSettingsChanged: (cb: (s: OverlaySettings) => void) => {
    ipcRenderer.on("settings-changed", (_e, s: OverlaySettings) => cb(s));
  },
  notifyDismissed: () => ipcRenderer.send("overlay-dismissed"),
  setIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.send("set-ignore-mouse", ignore),
  navigateMain: (path: string) => ipcRenderer.send("navigate-main", path),
  injectText: (text: string) => ipcRenderer.invoke("inject-text", text),
  insertDictationText: (text: string) =>
    ipcRenderer.invoke(
      "insert-dictation-text",
      text,
    ) as Promise<DictationInsertResult>,
  copyToClipboard: (text: string) =>
    ipcRenderer.invoke("copy-to-clipboard", text) as Promise<void>,
  logToMain: (msg: string) => ipcRenderer.send("log-from-overlay", msg),
  getApiUrl: () => ipcRenderer.invoke("get-api-url") as Promise<string>,
  proxyOverlayRequest: (req: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) =>
    ipcRenderer.invoke("proxy-overlay-request", req) as Promise<{
      ok: boolean;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      encoding: "text" | "base64";
    }>,
  resizeOverlay: (height: number) =>
    ipcRenderer.invoke("resize-overlay", height) as Promise<void>,
  getOverlaySettings: () =>
    ipcRenderer.invoke("get-overlay-settings") as Promise<OverlaySettings>,
  updateOverlaySettings: (partial: Partial<OverlaySettings>) =>
    ipcRenderer.invoke(
      "update-overlay-settings",
      partial,
    ) as Promise<OverlaySettings>,
  onHoldStart: (cb: () => void) => {
    ipcRenderer.on("dictation-hold-start", cb);
  },
  onHoldEnd: (cb: () => void) => {
    ipcRenderer.on("dictation-hold-end", cb);
  },
  onMeetingToggle: (cb: () => void) => {
    ipcRenderer.on("meeting-toggle", cb);
  },
  onMeetingStarted: (cb: (id: string) => void) => {
    ipcRenderer.on("meeting-started", (_e, id: string) => cb(id));
  },
  onMeetingStopped: (cb: (id: string) => void) => {
    ipcRenderer.on("meeting-stopped", (_e, id: string) => cb(id));
  },
  onNotification: (cb: (payload: PushNotificationPayload) => void) => {
    ipcRenderer.on("push-notification", (_e, payload: PushNotificationPayload) => cb(payload));
  },
  onNavigateInApp: (cb: (path: string) => void) => {
    ipcRenderer.on("navigate-in-app", (_e, path: string) => cb(path));
  },
  notifyDataChanged: (queryKeys: string[]) =>
    ipcRenderer.send("data-changed", queryKeys),
  startMeeting: () => ipcRenderer.invoke("start-meeting"),
  stopMeeting: () => ipcRenderer.invoke("stop-meeting"),
  getMeetingState: () =>
    ipcRenderer.invoke("meeting-state") as Promise<{
      active: boolean;
      meetingId: string | null;
      startedAt: number | null;
    }>,
  getPersistedMeeting: () =>
    ipcRenderer.invoke("get-persisted-meeting") as Promise<{
      meetingId: string;
      startedAt: number;
    } | null>,
  showOverlay: () => ipcRenderer.invoke("show-overlay"),
  hideOverlay: () => ipcRenderer.invoke("hide-overlay"),
  getOverlayStatus: () =>
    ipcRenderer.invoke("get-overlay-status") as Promise<{
      visible: boolean;
      active: boolean;
    }>,
  onOverlayStatusChanged: (
    cb: (status: { visible: boolean; active: boolean }) => void,
  ) => {
    ipcRenderer.on(
      "overlay-visibility-changed",
      (_e, status: { visible: boolean; active: boolean }) => cb(status),
    );
  },
  onSystemAudioTranscript: (
    cb: (speaker: number | undefined, text: string) => void,
  ) => {
    ipcRenderer.on(
      "system-audio-transcript",
      (_e, speaker: number | undefined, text: string) => cb(speaker, text),
    );
  },
  startSystemAudio: (meetingId: string) =>
    ipcRenderer.invoke("start-system-audio", meetingId) as Promise<boolean>,
  stopSystemAudio: () =>
    ipcRenderer.invoke("stop-system-audio") as Promise<Array<{ speaker: string; text: string; timestamp: number }>>,
  checkSystemAudioPermission: () =>
    ipcRenderer.invoke("check-system-audio-permission") as Promise<boolean>,
  promptScreenRecording: () =>
    ipcRenderer.invoke("prompt-screen-recording") as Promise<boolean>,
  checkAccessibilityPermission: () =>
    ipcRenderer.invoke("check-accessibility-permission") as Promise<boolean>,
  promptAccessibility: () =>
    ipcRenderer.invoke("prompt-accessibility") as Promise<boolean>,
  restartApp: () =>
    ipcRenderer.invoke("restart-app") as Promise<void>,
  restartKeyMonitor: () =>
    ipcRenderer.invoke("restart-key-monitor") as Promise<boolean>,
  checkKeyMonitorStatus: () =>
    ipcRenderer.invoke("check-key-monitor-status") as Promise<boolean>,
  getSessionToken: () =>
    ipcRenderer.invoke("get-session-token") as Promise<string>,
  onDictationInsertRequest: (
    cb: (payload: { requestId: string; text: string }) => void | Promise<void>,
  ) => {
    ipcRenderer.on(
      "dictation-insert-request",
      (_e, payload: { requestId: string; text: string }) => {
        void cb(payload);
      },
    );
  },
  sendDictationInsertResult: (payload: {
    requestId: string;
    handled: boolean;
  }) => {
    ipcRenderer.send("dictation-insert-result", payload);
  },
  startShortcutRecording: () =>
    ipcRenderer.invoke("start-shortcut-recording") as Promise<ShortcutBinding | null>,
  cancelShortcutRecording: () =>
    ipcRenderer.invoke("cancel-shortcut-recording") as Promise<void>,
  removeAllListeners: () => {
    const channels = [
      "activate-overlay",
      "deactivate-overlay",
      "dictation-hold-start",
      "dictation-hold-end",
      "notch-info",
      "branding-info",
      "settings-changed",
      "meeting-toggle",
      "meeting-started",
      "meeting-stopped",
      "push-notification",
      "navigate-in-app",
      "data-changed",
      "overlay-visibility-changed",
      "system-audio-silent",
      "system-audio-transcript",
      "dictation-insert-request",
    ];
    for (const ch of channels) ipcRenderer.removeAllListeners(ch);
  },

  // App update (Discord-style): used by main window for update banner + progress
  updater: {
    onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string }) => void) => {
      ipcRenderer.on("app-update-available", (_e, info) => cb(info));
    },
    onUpdateProgress: (
      cb: (progress: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void,
    ) => {
      ipcRenderer.on("app-update-progress", (_e, progress) => cb(progress));
    },
    onUpdateDownloaded: (cb: (data: { squirrelReady: boolean }) => void) => {
      ipcRenderer.on("app-update-downloaded", (_e, data: { squirrelReady?: boolean }) =>
        cb({ squirrelReady: data?.squirrelReady ?? false }),
      );
    },
    onSquirrelReady: (cb: () => void) => {
      ipcRenderer.on("app-squirrel-ready", () => cb());
    },
    onUpdateError: (cb: (data: { message: string }) => void) => {
      ipcRenderer.on("app-update-error", (_e, data: { message?: string }) =>
        cb({ message: data?.message ?? "Unknown update error" }),
      );
    },
    installUpdate: () => ipcRenderer.invoke("install-app-update") as Promise<void>,
  },

  /** Open the basicsos.com hosted auth page in the system browser and begin
   *  the deep-link sign-in / sign-up / password-reset flow. */
  openAuthBrowser: (
    action: "login" | "signup" | "forgot-password",
    apiUrl: string,
  ) =>
    ipcRenderer.invoke("open-auth-browser", action, apiUrl) as Promise<void>,
};

// Fetch the resolved API URL synchronously (main process reads userData/org-config.json).
// This runs before any renderer script so module-level constants in the renderer
// can read it from window.__runtimeApiUrl__ instead of the compile-time baked value.
const runtimeApiUrl = ipcRenderer.sendSync("get-api-url-sync") as string;

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", toolkitAPI);
  } catch (e) {
    console.error("[preload] Failed to expose electron toolkit API:", e);
  }
  try {
    contextBridge.exposeInMainWorld("electronAPI", overlayAPI);
  } catch (e) {
    console.error("[preload] Failed to expose electronAPI:", e);
  }
  try {
    contextBridge.exposeInMainWorld("__runtimeApiUrl__", runtimeApiUrl);
  } catch (e) {
    console.error("[preload] Failed to expose runtimeApiUrl:", e);
  }
} else {
  (window as unknown as { electron: typeof toolkitAPI }).electron = toolkitAPI;
  (window as unknown as { electronAPI: typeof overlayAPI }).electronAPI =
    overlayAPI;
  (window as unknown as { __runtimeApiUrl__: string }).__runtimeApiUrl__ =
    runtimeApiUrl;
}

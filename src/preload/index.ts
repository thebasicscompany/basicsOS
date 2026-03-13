import { contextBridge, ipcRenderer } from "electron";
import { electronAPI as toolkitAPI } from "@electron-toolkit/preload";
import type {
  ActivationMode,
  OverlaySettings,
  BrandingInfo,
  DictationInsertResult,
  ShortcutBinding,
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
  onRecordScreenToggle: (cb: () => void) => {
    ipcRenderer.on("record-screen-toggle", cb);
  },
  notifyRecordScreenStopped: () => ipcRenderer.send("record-screen-stopped"),
  onRecordScreenStopped: (cb: () => void) => {
    ipcRenderer.on("record-screen-stopped", cb);
  },
  onMeetingStarted: (cb: (id: string) => void) => {
    ipcRenderer.on("meeting-started", (_e, id: string) => cb(id));
  },
  onMeetingStopped: (cb: (id: string) => void) => {
    ipcRenderer.on("meeting-stopped", (_e, id: string) => cb(id));
  },
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
      "record-screen-toggle",
      "record-screen-stopped",
      "meeting-started",
      "meeting-stopped",
      "overlay-visibility-changed",
      "system-audio-silent",
      "system-audio-transcript",
      "dictation-insert-request",
    ];
    for (const ch of channels) ipcRenderer.removeAllListeners(ch);
  },
};

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
} else {
  (window as unknown as { electron: typeof toolkitAPI }).electron = toolkitAPI;
  (window as unknown as { electronAPI: typeof overlayAPI }).electronAPI =
    overlayAPI;
}

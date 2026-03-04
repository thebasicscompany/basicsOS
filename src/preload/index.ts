import { contextBridge, ipcRenderer } from "electron";
import { electronAPI as toolkitAPI } from "@electron-toolkit/preload";
import type {
  ActivationMode,
  OverlaySettings,
  BrandingInfo,
} from "../shared-overlay/types";

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
    }) => void
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
  getSessionToken: () =>
    ipcRenderer.invoke("get-session-token") as Promise<string | null>,
  getApiUrl: () =>
    ipcRenderer.invoke("get-api-url") as Promise<string>,
  getOverlaySettings: () =>
    ipcRenderer.invoke("get-overlay-settings") as Promise<OverlaySettings>,
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
  onSystemAudioTranscript: (
    cb: (speaker: number | undefined, text: string) => void
  ) => {
    ipcRenderer.on(
      "system-audio-transcript",
      (_e, speaker: number | undefined, text: string) => cb(speaker, text)
    );
  },
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
      "system-audio-silent",
      "system-audio-transcript",
    ];
    for (const ch of channels) ipcRenderer.removeAllListeners(ch);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("electron", toolkitAPI);
  contextBridge.exposeInMainWorld("electronAPI", overlayAPI);
} else {
  (window as unknown as { electron: typeof toolkitAPI }).electron = toolkitAPI;
  (window as unknown as { electronAPI: typeof overlayAPI }).electronAPI = overlayAPI;
}

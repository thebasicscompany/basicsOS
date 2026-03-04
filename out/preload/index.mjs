import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
const overlayAPI = {
  onActivate: (cb) => {
    ipcRenderer.on("activate-overlay", (_e, mode) => cb(mode));
  },
  onDeactivate: (cb) => {
    ipcRenderer.on("deactivate-overlay", cb);
  },
  onNotchInfo: (cb) => {
    ipcRenderer.on("notch-info", (_e, info) => cb(info));
  },
  onBranding: (cb) => {
    ipcRenderer.on("branding-info", (_e, b) => cb(b));
  },
  onSettingsChanged: (cb) => {
    ipcRenderer.on("settings-changed", (_e, s) => cb(s));
  },
  notifyDismissed: () => ipcRenderer.send("overlay-dismissed"),
  setIgnoreMouse: (ignore) => ipcRenderer.send("set-ignore-mouse", ignore),
  navigateMain: (path) => ipcRenderer.send("navigate-main", path),
  injectText: (text) => ipcRenderer.invoke("inject-text", text),
  getSessionToken: () => ipcRenderer.invoke("get-session-token"),
  getApiUrl: () => ipcRenderer.invoke("get-api-url"),
  getOverlaySettings: () => ipcRenderer.invoke("get-overlay-settings"),
  onHoldStart: (cb) => {
    ipcRenderer.on("dictation-hold-start", cb);
  },
  onHoldEnd: (cb) => {
    ipcRenderer.on("dictation-hold-end", cb);
  },
  onMeetingToggle: (cb) => {
    ipcRenderer.on("meeting-toggle", cb);
  },
  onMeetingStarted: (cb) => {
    ipcRenderer.on("meeting-started", (_e, id) => cb(id));
  },
  onMeetingStopped: (cb) => {
    ipcRenderer.on("meeting-stopped", (_e, id) => cb(id));
  },
  startMeeting: () => ipcRenderer.invoke("start-meeting"),
  stopMeeting: () => ipcRenderer.invoke("stop-meeting"),
  getMeetingState: () => ipcRenderer.invoke("meeting-state"),
  getPersistedMeeting: () => ipcRenderer.invoke("get-persisted-meeting"),
  showOverlay: () => ipcRenderer.invoke("show-overlay"),
  hideOverlay: () => ipcRenderer.invoke("hide-overlay"),
  getOverlayStatus: () => ipcRenderer.invoke("get-overlay-status"),
  onOverlayStatusChanged: (cb) => {
    ipcRenderer.on(
      "overlay-visibility-changed",
      (_e, status) => cb(status)
    );
  },
  onSystemAudioTranscript: (cb) => {
    ipcRenderer.on(
      "system-audio-transcript",
      (_e, speaker, text) => cb(speaker, text)
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
      "overlay-visibility-changed",
      "system-audio-silent",
      "system-audio-transcript"
    ];
    for (const ch of channels) ipcRenderer.removeAllListeners(ch);
  }
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("electron", electronAPI);
  contextBridge.exposeInMainWorld("electronAPI", overlayAPI);
} else {
  window.electron = electronAPI;
  window.electronAPI = overlayAPI;
}

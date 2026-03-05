"use strict";
const electron = require("electron");
const electronAPI = {
  ipcRenderer: {
    send(channel, ...args) {
      electron.ipcRenderer.send(channel, ...args);
    },
    sendTo(webContentsId, channel, ...args) {
      const electronVer = process.versions.electron;
      const electronMajorVer = electronVer ? parseInt(electronVer.split(".")[0]) : 0;
      if (electronMajorVer >= 28) {
        throw new Error('"sendTo" method has been removed since Electron 28.');
      } else {
        electron.ipcRenderer.sendTo(webContentsId, channel, ...args);
      }
    },
    sendSync(channel, ...args) {
      return electron.ipcRenderer.sendSync(channel, ...args);
    },
    sendToHost(channel, ...args) {
      electron.ipcRenderer.sendToHost(channel, ...args);
    },
    postMessage(channel, message, transfer) {
      electron.ipcRenderer.postMessage(channel, message, transfer);
    },
    invoke(channel, ...args) {
      return electron.ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    once(channel, listener) {
      electron.ipcRenderer.once(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener(channel, listener) {
      electron.ipcRenderer.removeListener(channel, listener);
      return this;
    },
    removeAllListeners(channel) {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  webFrame: {
    insertCSS(css) {
      return electron.webFrame.insertCSS(css);
    },
    setZoomFactor(factor) {
      if (typeof factor === "number" && factor > 0) {
        electron.webFrame.setZoomFactor(factor);
      }
    },
    setZoomLevel(level) {
      if (typeof level === "number") {
        electron.webFrame.setZoomLevel(level);
      }
    }
  },
  webUtils: {
    getPathForFile(file) {
      return electron.webUtils.getPathForFile(file);
    }
  },
  process: {
    get platform() {
      return process.platform;
    },
    get versions() {
      return process.versions;
    },
    get env() {
      return { ...process.env };
    }
  }
};
const overlayAPI = {
  onActivate: (cb) => {
    electron.ipcRenderer.on("activate-overlay", (_e, mode) => cb(mode));
  },
  onDeactivate: (cb) => {
    electron.ipcRenderer.on("deactivate-overlay", cb);
  },
  onNotchInfo: (cb) => {
    electron.ipcRenderer.on("notch-info", (_e, info) => cb(info));
  },
  onBranding: (cb) => {
    electron.ipcRenderer.on("branding-info", (_e, b) => cb(b));
  },
  onSettingsChanged: (cb) => {
    electron.ipcRenderer.on("settings-changed", (_e, s) => cb(s));
  },
  notifyDismissed: () => electron.ipcRenderer.send("overlay-dismissed"),
  setIgnoreMouse: (ignore) => electron.ipcRenderer.send("set-ignore-mouse", ignore),
  navigateMain: (path) => electron.ipcRenderer.send("navigate-main", path),
  injectText: (text) => electron.ipcRenderer.invoke("inject-text", text),
  copyToClipboard: (text) => electron.ipcRenderer.invoke("copy-to-clipboard", text),
  getApiUrl: () => electron.ipcRenderer.invoke("get-api-url"),
  proxyOverlayRequest: (req) => electron.ipcRenderer.invoke("proxy-overlay-request", req),
  getOverlaySettings: () => electron.ipcRenderer.invoke("get-overlay-settings"),
  updateOverlaySettings: (partial) => electron.ipcRenderer.invoke(
    "update-overlay-settings",
    partial
  ),
  onHoldStart: (cb) => {
    electron.ipcRenderer.on("dictation-hold-start", cb);
  },
  onHoldEnd: (cb) => {
    electron.ipcRenderer.on("dictation-hold-end", cb);
  },
  onMeetingToggle: (cb) => {
    electron.ipcRenderer.on("meeting-toggle", cb);
  },
  onMeetingStarted: (cb) => {
    electron.ipcRenderer.on("meeting-started", (_e, id) => cb(id));
  },
  onMeetingStopped: (cb) => {
    electron.ipcRenderer.on("meeting-stopped", (_e, id) => cb(id));
  },
  startMeeting: () => electron.ipcRenderer.invoke("start-meeting"),
  stopMeeting: () => electron.ipcRenderer.invoke("stop-meeting"),
  getMeetingState: () => electron.ipcRenderer.invoke("meeting-state"),
  getPersistedMeeting: () => electron.ipcRenderer.invoke("get-persisted-meeting"),
  showOverlay: () => electron.ipcRenderer.invoke("show-overlay"),
  hideOverlay: () => electron.ipcRenderer.invoke("hide-overlay"),
  getOverlayStatus: () => electron.ipcRenderer.invoke("get-overlay-status"),
  onOverlayStatusChanged: (cb) => {
    electron.ipcRenderer.on(
      "overlay-visibility-changed",
      (_e, status) => cb(status)
    );
  },
  onSystemAudioTranscript: (cb) => {
    electron.ipcRenderer.on(
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
    for (const ch of channels) electron.ipcRenderer.removeAllListeners(ch);
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
  } catch (e) {
    console.error("[preload] Failed to expose electron toolkit API:", e);
  }
  try {
    electron.contextBridge.exposeInMainWorld("electronAPI", overlayAPI);
  } catch (e) {
    console.error("[preload] Failed to expose electronAPI:", e);
  }
} else {
  window.electron = electronAPI;
  window.electronAPI = overlayAPI;
}

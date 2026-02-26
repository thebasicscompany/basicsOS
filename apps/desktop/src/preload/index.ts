import { contextBridge, ipcRenderer } from "electron";

export type ActivationMode = "assistant" | "continuous" | "dictation" | "transcribe";

export type OverlaySettings = {
  shortcuts: { assistantToggle: string; dictationToggle: string; dictationHoldKey: string; meetingToggle: string };
  voice: { language: string; silenceTimeoutMs: number; ttsEnabled: boolean; ttsRate: number };
  behavior: { doubleTapWindowMs: number; autoDismissMs: number; showDictationPreview: boolean; holdThresholdMs: number };
  meeting: { autoDetect: boolean; chunkIntervalMs: number };
};

export type BrandingInfo = {
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
};

contextBridge.exposeInMainWorld("electronAPI", {
  /** Listen for activate signal from main process. */
  onActivate: (cb: (mode: ActivationMode) => void): void => {
    ipcRenderer.on("activate-overlay", (_event, mode: ActivationMode) => cb(mode));
  },

  /** Listen for deactivate signal from main process. */
  onDeactivate: (cb: () => void): void => {
    ipcRenderer.on("deactivate-overlay", cb);
  },

  /** Receive notch info from main process. */
  onNotchInfo: (cb: (info: { hasNotch: boolean; notchHeight: number; windowWidth: number }) => void): void => {
    ipcRenderer.on("notch-info", (_event, info) => cb(info));
  },

  /** Receive branding info from main process. */
  onBranding: (cb: (branding: BrandingInfo) => void): void => {
    ipcRenderer.on("branding-info", (_event, branding: BrandingInfo) => cb(branding));
  },

  /** Listen for settings changes from main process. */
  onSettingsChanged: (cb: (settings: OverlaySettings) => void): void => {
    ipcRenderer.on("settings-changed", (_event, settings: OverlaySettings) => cb(settings));
  },

  /** Notify main process that the overlay dismissed itself. */
  notifyDismissed: (): void => {
    ipcRenderer.send("overlay-dismissed");
  },

  /** Toggle click-through on the overlay window. */
  setIgnoreMouse: (ignore: boolean): void => {
    ipcRenderer.send("set-ignore-mouse", ignore);
  },

  /** Navigate the main window to a URL path. */
  navigateMain: (path: string): void => {
    ipcRenderer.send("navigate-main", path);
  },

  /** Inject text into the active field via clipboard + simulated paste. */
  injectText: (text: string): Promise<void> => ipcRenderer.invoke("inject-text", text),

  /** Capture the primary display and return a base64 PNG string. */
  captureScreen: (): Promise<string> => ipcRenderer.invoke("capture-screen"),

  /** Get session token from main window cookies for API auth. */
  getSessionToken: (): Promise<string | null> => ipcRenderer.invoke("get-session-token"),

  /** Get the API server URL. */
  getApiUrl: (): Promise<string> => ipcRenderer.invoke("get-api-url"),

  /** Get current overlay settings. */
  getOverlaySettings: (): Promise<OverlaySettings> => ipcRenderer.invoke("get-overlay-settings"),

  /** Update overlay settings (partial merge). */
  updateOverlaySettings: (partial: Partial<OverlaySettings>): Promise<OverlaySettings> =>
    ipcRenderer.invoke("update-overlay-settings", partial),

  /** Listen for dictation hold-start from main process. */
  onHoldStart: (cb: () => void): void => {
    ipcRenderer.on("dictation-hold-start", cb);
  },

  /** Listen for dictation hold-end from main process. */
  onHoldEnd: (cb: () => void): void => {
    ipcRenderer.on("dictation-hold-end", cb);
  },

  /** Check if accessibility permission is granted (macOS). */
  checkAccessibility: (): Promise<boolean> => ipcRenderer.invoke("check-accessibility"),

  /** Request accessibility permission (macOS). Triggers system dialog. */
  requestAccessibility: (): Promise<boolean> => ipcRenderer.invoke("request-accessibility"),

  /** Listen for meeting toggle from main process. */
  onMeetingToggle: (cb: () => void): void => {
    ipcRenderer.on("meeting-toggle", cb);
  },

  /** Listen for meeting started confirmation from main process. */
  onMeetingStarted: (cb: (meetingId: string) => void): void => {
    ipcRenderer.on("meeting-started", (_event, meetingId: string) => cb(meetingId));
  },

  /** Listen for meeting stopped from main process. */
  onMeetingStopped: (cb: (meetingId: string) => void): void => {
    ipcRenderer.on("meeting-stopped", (_event, meetingId: string) => cb(meetingId));
  },

  /** Start a meeting (main process creates it via API). */
  startMeeting: (): Promise<void> => ipcRenderer.invoke("start-meeting"),

  /** Stop the current meeting. */
  stopMeeting: (): Promise<void> => ipcRenderer.invoke("stop-meeting"),

  /** Get current meeting state. */
  getMeetingState: (): Promise<{ active: boolean; meetingId: string | null; startedAt: number | null }> =>
    ipcRenderer.invoke("meeting-state"),

  /** Get available desktop capture sources (for system audio). */
  getDesktopSources: (): Promise<Array<{ id: string; name: string }>> =>
    ipcRenderer.invoke("get-desktop-sources"),

  /** Check if screen recording permission is granted (macOS). */
  checkScreenRecording: (): Promise<boolean> => ipcRenderer.invoke("check-screen-recording"),

  /** Get persisted meeting state for crash recovery. */
  getPersistedMeeting: (): Promise<{ meetingId: string; startedAt: number } | null> =>
    ipcRenderer.invoke("get-persisted-meeting"),

  /** Temporarily unregister all global shortcuts for key capture in settings. */
  startShortcutCapture: (): Promise<void> => ipcRenderer.invoke("start-shortcut-capture"),

  /** Re-register all global shortcuts after key capture completes. */
  stopShortcutCapture: (): Promise<void> => ipcRenderer.invoke("stop-shortcut-capture"),

  /** Remove all overlay IPC listeners (cleanup for HMR/unmount). */
  removeAllListeners: (): void => {
    const channels = [
      "activate-overlay", "deactivate-overlay", "dictation-hold-start",
      "dictation-hold-end", "notch-info", "branding-info", "settings-changed",
      "meeting-toggle", "meeting-started", "meeting-stopped",
    ];
    for (const ch of channels) ipcRenderer.removeAllListeners(ch);
  },
});

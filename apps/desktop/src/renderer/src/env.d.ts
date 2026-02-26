/** Notch info sent from main process. */
type NotchInfo = {
  hasNotch: boolean;
  notchHeight: number;
  menuBarHeight: number;
  windowWidth: number;
};

/** Activation mode for the overlay pill. */
type ActivationMode = "assistant" | "continuous" | "dictation" | "transcribe";

/** Branding info from the web app. */
type BrandingInfo = {
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
};

/** Overlay settings shape (mirrors main process settings-store). */
type OverlaySettings = {
  shortcuts: { assistantToggle: string; dictationToggle: string; dictationHoldKey: string; meetingToggle: string };
  voice: { language: string; silenceTimeoutMs: number; ttsEnabled: boolean; ttsRate: number };
  behavior: { doubleTapWindowMs: number; autoDismissMs: number; showDictationPreview: boolean; holdThresholdMs: number };
  meeting: { autoDetect: boolean; chunkIntervalMs: number };
};

/** IPC bridge exposed by the preload script via contextBridge. */
interface ElectronAPI {
  onActivate: (cb: (mode: ActivationMode) => void) => void;
  onDeactivate: (cb: () => void) => void;
  onNotchInfo: (cb: (info: NotchInfo) => void) => void;
  onBranding: (cb: (branding: BrandingInfo) => void) => void;
  onSettingsChanged: (cb: (settings: OverlaySettings) => void) => void;
  notifyDismissed: () => void;
  setIgnoreMouse: (ignore: boolean) => void;
  injectText: (text: string) => Promise<void>;
  captureScreen: () => Promise<string>;
  getSessionToken: () => Promise<string | null>;
  getApiUrl: () => Promise<string>;
  navigateMain: (path: string) => void;
  getOverlaySettings: () => Promise<OverlaySettings>;
  updateOverlaySettings: (partial: Partial<OverlaySettings>) => Promise<OverlaySettings>;
  onHoldStart: (cb: () => void) => void;
  onHoldEnd: (cb: () => void) => void;
  checkAccessibility: () => Promise<boolean>;
  requestAccessibility: () => Promise<boolean>;
  onMeetingToggle: (cb: () => void) => void;
  onMeetingStarted: (cb: (meetingId: string) => void) => void;
  onMeetingStopped: (cb: (meetingId: string) => void) => void;
  startMeeting: () => Promise<void>;
  stopMeeting: () => Promise<void>;
  getMeetingState: () => Promise<{ active: boolean; meetingId: string | null; startedAt: number | null }>;
  getDesktopSources: () => Promise<Array<{ id: string; name: string }>>;
  checkScreenRecording: () => Promise<boolean>;
  getPersistedMeeting: () => Promise<{ meetingId: string; startedAt: number } | null>;
  startShortcutCapture: () => Promise<void>;
  stopShortcutCapture: () => Promise<void>;
  removeAllListeners: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

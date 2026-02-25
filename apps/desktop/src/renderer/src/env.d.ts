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
  shortcuts: { assistantToggle: string; dictationToggle: string };
  voice: { language: string; silenceTimeoutMs: number; ttsEnabled: boolean; ttsRate: number };
  behavior: { doubleTapWindowMs: number; autoDismissMs: number; showDictationPreview: boolean };
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
}

interface Window {
  electronAPI?: ElectronAPI;
}

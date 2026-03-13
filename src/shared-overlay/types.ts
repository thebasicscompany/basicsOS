// Shared types for the voice pill overlay (main + renderer)

export type ActivationMode =
  | "assistant"
  | "continuous"
  | "dictation"
  | "transcribe";

/** A key binding: keyCode + modifier flags + display label */
export type ShortcutBinding = {
  /** macOS virtual keycode (e.g., 63 for Fn, 49 for Space) */
  keyCode: number;
  /** Required modifier flags mask (macOS CGEventFlags, 0 for no extra modifiers) */
  modifiers: number;
  /** Human-readable label (e.g., "Fn", "⌘Space") */
  label: string;
};

export type OverlaySettings = {
  shortcuts: {
    /** New native key bindings (macOS CGEventTap-based) */
    dictation?: ShortcutBinding;
    assistant?: ShortcutBinding;
    meeting?: ShortcutBinding;
    /** Legacy Electron accelerator strings (used as fallback on non-macOS) */
    assistantToggle: string;
    dictationToggle: string;
    dictationHoldKey: string;
    meetingToggle: string;
    recordScreenToggle: string;
  };
  voice: {
    language: string;
    silenceTimeoutMs: number;
    ttsEnabled: boolean;
    ttsRate: number;
    /** Preferred audio input device ID from navigator.mediaDevices.enumerateDevices(); null = system default. */
    audioInputDeviceId: string | null;
  };
  behavior: {
    doubleTapWindowMs: number;
    autoDismissMs: number;
    showDictationPreview: boolean;
    holdThresholdMs: number;
  };
  meeting: {
    autoDetect: boolean;
    chunkIntervalMs: number;
  };
};

export type BrandingInfo = {
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
};

export type NotchInfo = {
  hasNotch: boolean;
  notchHeight: number;
  menuBarHeight: number;
  windowWidth: number;
};

export type DictationInsertResult = {
  handled: boolean;
  method: "app" | "clipboard" | "none";
};

// ElectronAPI extensions for system audio capture
export type SystemAudioAPI = {
  startSystemAudio?: (meetingId: string) => Promise<boolean>;
  stopSystemAudio?: () => Promise<Array<{ speaker: string; text: string; timestamp: number }>>;
  checkSystemAudioPermission?: () => Promise<boolean>;
  promptScreenRecording?: () => Promise<boolean>;
  getSessionToken?: () => Promise<string>;
};

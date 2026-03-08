// Shared types for the voice pill overlay (main + renderer)

export type ActivationMode =
  | "assistant"
  | "continuous"
  | "dictation"
  | "transcribe";

export type OverlaySettings = {
  shortcuts: {
    assistantToggle: string;
    dictationToggle: string;
    dictationHoldKey: string;
    meetingToggle: string;
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

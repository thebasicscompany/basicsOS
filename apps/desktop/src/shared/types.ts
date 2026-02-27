// ---------------------------------------------------------------------------
// Shared types — single source of truth for desktop app types
// Used by main, preload, and renderer processes
// ---------------------------------------------------------------------------

export type ActivationMode = "assistant" | "continuous" | "dictation" | "transcribe";

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

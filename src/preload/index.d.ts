import type { ElectronAPI } from "@electron-toolkit/preload";

export type OverlayElectronAPI = {
  onActivate?: (cb: (mode: string) => void) => void;
  onDeactivate?: (cb: () => void) => void;
  onNotchInfo?: (cb: (info: unknown) => void) => void;
  onBranding?: (cb: (b: unknown) => void) => void;
  onSettingsChanged?: (cb: (s: unknown) => void) => void;
  notifyDismissed?: () => void;
  setIgnoreMouse?: (ignore: boolean) => void;
  navigateMain?: (path: string) => void;
  injectText?: (text: string) => Promise<void>;
  getSessionToken?: () => Promise<string | null>;
  getApiUrl?: () => Promise<string>;
  getOverlaySettings?: () => Promise<unknown>;
  onHoldStart?: (cb: () => void) => void;
  onHoldEnd?: (cb: () => void) => void;
  onMeetingToggle?: (cb: () => void) => void;
  onMeetingStarted?: (cb: (id: string) => void) => void;
  onMeetingStopped?: (cb: (id: string) => void) => void;
  startMeeting?: () => Promise<void>;
  stopMeeting?: () => Promise<void>;
  getMeetingState?: () => Promise<unknown>;
  getPersistedMeeting?: () => Promise<unknown>;
  onSystemAudioTranscript?: (cb: (s: number | undefined, t: string) => void) => void;
  removeAllListeners?: () => void;
};

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    electronAPI?: OverlayElectronAPI;
  }
}

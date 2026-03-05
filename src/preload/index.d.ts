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
  copyToClipboard?: (text: string) => Promise<void>;
  getApiUrl?: () => Promise<string>;
  proxyOverlayRequest?: (req: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    encoding: "text" | "base64";
  }>;
  getOverlaySettings?: () => Promise<unknown>;
  updateOverlaySettings?: (partial: Record<string, unknown>) => Promise<unknown>;
  onHoldStart?: (cb: () => void) => void;
  onHoldEnd?: (cb: () => void) => void;
  onMeetingToggle?: (cb: () => void) => void;
  onMeetingStarted?: (cb: (id: string) => void) => void;
  onMeetingStopped?: (cb: (id: string) => void) => void;
  startMeeting?: () => Promise<void>;
  stopMeeting?: () => Promise<void>;
  getMeetingState?: () => Promise<unknown>;
  getPersistedMeeting?: () => Promise<unknown>;
  showOverlay?: () => Promise<void>;
  hideOverlay?: () => Promise<void>;
  getOverlayStatus?: () => Promise<{ visible: boolean; active: boolean }>;
  onOverlayStatusChanged?: (
    cb: (status: { visible: boolean; active: boolean }) => void,
  ) => void;
  onSystemAudioTranscript?: (
    cb: (s: number | undefined, t: string) => void,
  ) => void;
  removeAllListeners?: () => void;
};

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    electronAPI?: OverlayElectronAPI;
  }
}

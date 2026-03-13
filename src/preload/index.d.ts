import type { ElectronAPI } from "@electron-toolkit/preload";
import type {
  ActivationMode,
  DictationInsertResult,
  NotchInfo,
  OverlaySettings,
} from "@/shared-overlay/types";

export type OverlayElectronAPI = {
  onActivate?: (cb: (mode: ActivationMode) => void) => void;
  onDeactivate?: (cb: () => void) => void;
  onNotchInfo?: (cb: (info: NotchInfo) => void) => void;
  onBranding?: (cb: (b: unknown) => void) => void;
  onSettingsChanged?: (cb: (s: OverlaySettings) => void) => void;
  notifyDismissed?: () => void;
  setIgnoreMouse?: (ignore: boolean) => void;
  navigateMain?: (path: string) => void;
  injectText?: (text: string) => Promise<void>;
  insertDictationText?: (text: string) => Promise<DictationInsertResult>;
  copyToClipboard?: (text: string) => Promise<void>;
  logToMain?: (msg: string) => void;
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
  getOverlaySettings?: () => Promise<OverlaySettings>;
  updateOverlaySettings?: (
    partial: Record<string, unknown>,
  ) => Promise<unknown>;
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
  onDictationInsertRequest?: (
    cb: (payload: { requestId: string; text: string }) => void | Promise<void>,
  ) => void;
  sendDictationInsertResult?: (payload: {
    requestId: string;
    handled: boolean;
  }) => void;
  getSessionToken?: () => Promise<string>;
  startSystemAudio?: (meetingId: string) => Promise<boolean>;
  stopSystemAudio?: () => Promise<Array<{ speaker: string; text: string; timestamp: number }>>;
  removeAllListeners?: () => void;
  resizeOverlay?: (height: number) => Promise<void>;
  updater?: {
    onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string }) => void) => void;
    onUpdateProgress: (
      cb: (progress: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void,
    ) => void;
    onUpdateDownloaded: (cb: () => void) => void;
    installUpdate: () => Promise<void>;
  };
};

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    electronAPI?: OverlayElectronAPI;
  }
}

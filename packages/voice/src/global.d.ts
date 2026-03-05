/** Minimal electron overlay API used by VoiceApp when running in Electron. */
declare global {
  interface Window {
    electronAPI?: {
      getOverlayStatus?(): Promise<{ visible: boolean; active: boolean }>;
      onOverlayStatusChanged?(
        cb: (status: { visible: boolean; active: boolean }) => void,
      ): void;
      showOverlay?(): Promise<void>;
      hideOverlay?(): Promise<void>;
    };
  }
}

export {};

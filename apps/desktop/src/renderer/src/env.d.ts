/** Notch info sent from main process. */
type NotchInfo = {
  hasNotch: boolean;
  notchHeight: number;
  windowWidth: number;
};

/** IPC bridge exposed by the preload script via contextBridge. */
interface ElectronAPI {
  onActivate: (cb: () => void) => void;
  onDeactivate: (cb: () => void) => void;
  onNotchInfo: (cb: (info: NotchInfo) => void) => void;
  notifyDismissed: () => void;
  setIgnoreMouse: (ignore: boolean) => void;
  injectText: (text: string) => Promise<void>;
  captureScreen: () => Promise<string>;
  getSessionToken: () => Promise<string | null>;
  getApiUrl: () => Promise<string>;
  navigateMain: (path: string) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

/** IPC bridge exposed by the preload script via contextBridge. */
interface ElectronAPI {
  send: (channel: string, ...args: unknown[]) => void;
  injectText: (text: string) => Promise<void>;
  captureScreen: () => Promise<string>;
  getSessionToken: () => Promise<string | null>;
  getApiUrl: () => Promise<string>;
}

interface Window {
  electronAPI?: ElectronAPI;
}

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel: string, ...args: unknown[]): void => {
    const validChannels = ["set-ignore-mouse", "navigate-main"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  /** Inject text into the active field via clipboard + simulated paste. */
  injectText: (text: string): Promise<void> => ipcRenderer.invoke("inject-text", text),

  /** Capture the primary display and return a base64 PNG string. */
  captureScreen: (): Promise<string> => ipcRenderer.invoke("capture-screen"),

  /** Get session token from main window cookies for API auth. */
  getSessionToken: (): Promise<string | null> => ipcRenderer.invoke("get-session-token"),

  /** Get the API server URL. */
  getApiUrl: (): Promise<string> => ipcRenderer.invoke("get-api-url"),
});

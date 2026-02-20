import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  /** Listen for activate signal from main process. */
  onActivate: (cb: () => void): void => {
    ipcRenderer.on("activate-overlay", cb);
  },

  /** Listen for deactivate signal from main process. */
  onDeactivate: (cb: () => void): void => {
    ipcRenderer.on("deactivate-overlay", cb);
  },

  /** Receive notch info from main process. */
  onNotchInfo: (cb: (info: { hasNotch: boolean; notchHeight: number; windowWidth: number }) => void): void => {
    ipcRenderer.on("notch-info", (_event, info) => cb(info));
  },

  /** Notify main process that the overlay dismissed itself. */
  notifyDismissed: (): void => {
    ipcRenderer.send("overlay-dismissed");
  },

  /** Toggle click-through on the overlay window. */
  setIgnoreMouse: (ignore: boolean): void => {
    ipcRenderer.send("set-ignore-mouse", ignore);
  },

  /** Navigate the main window to a URL path. */
  navigateMain: (path: string): void => {
    ipcRenderer.send("navigate-main", path);
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

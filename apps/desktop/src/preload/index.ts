import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronIPC", {
  send: (channel: string, ...args: unknown[]): void => {
    const validChannels = ["set-ignore-mouse"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
});

export const getIPC = (): Window["electronAPI"] | undefined => window.electronAPI;

export const sendIPC = (channel: string, ...args: unknown[]): void => {
  window.electronAPI?.send(channel, ...args);
};

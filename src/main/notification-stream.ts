import type { BrowserWindow } from "electron";

type GetTokenFn = () => Promise<string | null>;

let abortController: AbortController | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let overlayRef: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60_000;
let currentReconnectDelay = RECONNECT_DELAY_MS;

function resetReconnectDelay(): void {
  currentReconnectDelay = RECONNECT_DELAY_MS;
}

function scheduleReconnect(getToken: GetTokenFn, apiUrl: string): void {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    currentReconnectDelay = Math.min(
      currentReconnectDelay * 1.5,
      MAX_RECONNECT_DELAY_MS,
    );
    connect(getToken, apiUrl);
  }, currentReconnectDelay);
}

export function connectNotificationStream(
  getToken: GetTokenFn,
  apiUrl: string,
  overlay: BrowserWindow | null,
  mainWindow?: BrowserWindow | null,
): void {
  overlayRef = overlay;
  mainWindowRef = mainWindow ?? null;
  connect(getToken, apiUrl);
}

export function disconnectNotificationStream(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  overlayRef = null;
}

export function setNotificationStreamOverlay(overlay: BrowserWindow | null): void {
  overlayRef = overlay;
}

export function setNotificationStreamMainWindow(mainWindow: BrowserWindow | null): void {
  mainWindowRef = mainWindow;
}

async function connect(getToken: GetTokenFn, apiUrl: string): Promise<void> {
  const token = await getToken();
  if (!token) {
    scheduleReconnect(getToken, apiUrl);
    return;
  }

  abortController = new AbortController();
  const url = `${apiUrl.replace(/\/$/, "")}/api/notifications/stream`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: abortController.signal,
    });

    if (!res.ok) {
      scheduleReconnect(getToken, apiUrl);
      return;
    }

    resetReconnectDelay();

    const reader = res.body?.getReader();
    if (!reader) {
      scheduleReconnect(getToken, apiUrl);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const json = line.slice(6).trim();
          if (json && json !== "undefined") {
            try {
              const payload = JSON.parse(json) as {
                title: string;
                body: string;
                actions?: Array<{ id: string; label: string; url?: string }>;
                context?: string;
              };
              // On Windows the overlay starts hidden and has no notch to hide
              // behind when idle. Show it without stealing focus so the
              // notification pill is actually visible to the user.
              if (
                overlayRef &&
                !overlayRef.isDestroyed() &&
                !overlayRef.isVisible()
              ) {
                overlayRef.showInactive();
              }
              overlayRef?.webContents.send("push-notification", payload);
              mainWindowRef?.webContents.send("push-notification", payload);
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    scheduleReconnect(getToken, apiUrl);
  } finally {
    abortController = null;
  }
}

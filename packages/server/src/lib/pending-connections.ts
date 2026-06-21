// Tracks apps that returned NEEDS_CONNECTION during an agent turn, so the chat
// endpoint can render a deterministic Connect card for EACH missing app — instead
// of depending on the model to paste the authUrl into its prose (unreliable, and
// it can't surface multiple). The Broker and the chat route share this process;
// they're linked by the per-turn sessionKey.

interface Pending {
  app: string;
  authUrl: string;
  ts: number;
}

const TTL_MS = 2 * 60 * 1000;
const store = new Map<string, Map<string, Pending>>(); // sessionKey -> app -> Pending

/** Record (per session) an app the agent tried to use but isn't connected to. */
export function recordNeedsConnection(sessionKey: string | null | undefined, app: string, authUrl: string): void {
  if (!sessionKey || !app || !authUrl) return;
  let perApp = store.get(sessionKey);
  if (!perApp) {
    perApp = new Map();
    store.set(sessionKey, perApp);
  }
  perApp.set(app.toLowerCase(), { app, authUrl, ts: Date.now() });
  if (store.size > 1000) sweep();
}

/** Take (and clear) the apps recorded for this session this turn, freshest only. */
export function drainNeedsConnections(sessionKey: string): Pending[] {
  const perApp = store.get(sessionKey);
  if (!perApp) return [];
  store.delete(sessionKey);
  const now = Date.now();
  return [...perApp.values()].filter((p) => now - p.ts < TTL_MS);
}

function sweep(): void {
  const now = Date.now();
  for (const [key, perApp] of store) {
    for (const [app, p] of perApp) if (now - p.ts >= TTL_MS) perApp.delete(app);
    if (perApp.size === 0) store.delete(key);
  }
}

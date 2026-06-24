// Shell-facing live push for the app registry (APP-3) — the apps analog of
// tool-change-bus.ts. When an admin publishes/updates/suspends an app, the server
// pushes an `apps/list_changed` event over a Better-Auth SSE stream
// (GET /api/app-config/stream) that every open shell's AppRegistryProvider holds.
// The shell then refetches /api/app-config, so a published app appears in everyone's
// sidebar within seconds — no refresh, and (like all custom-app changes) no
// signed-client rebuild. Mirrors the broker's tools/list_changed mechanism.

type SendFn = (payload: unknown) => void;

const clients = new Set<SendFn>();

/** Register a connected shell SSE stream. Returns an unregister fn. */
export function addAppsStreamClient(send: SendFn): () => void {
  clients.add(send);
  return () => {
    clients.delete(send);
  };
}

/** Push `apps/list_changed` to every connected shell so they refetch the registry. */
export function notifyAppsListChanged(): void {
  const payload = { type: "apps/list_changed" };
  for (const send of clients) {
    try {
      send(payload);
    } catch {
      /* drop a broken client; its stream cleanup will unregister it */
    }
  }
}

export function appsStreamClientCount(): number {
  return clients.size;
}

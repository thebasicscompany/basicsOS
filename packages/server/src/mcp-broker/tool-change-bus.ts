// In-process bus that lets the rest of the server tell connected hermes
// instances their tool surface changed (a custom grid/field was added or
// removed), so the agent re-fetches tools/list WITHOUT a restart.
//
// Mechanism: the Broker's GET /mcp server->client SSE stream registers a client
// here; when an object/field mutation calls notifyToolsListChanged() we (1) drop
// the Broker's tool cache so the next tools/list is freshly generated, and (2)
// push a standard MCP `notifications/tools/list_changed` to each connected hermes
// — which its streamablehttp_client handler turns into a live tools/list re-fetch.

type SendFn = (payload: unknown) => void;

const clients = new Set<SendFn>();
let invalidateCache: (() => void) | null = null;

/** Register a connected server->client SSE stream. Returns an unregister fn. */
export function addToolStreamClient(send: SendFn): () => void {
  clients.add(send);
  return () => {
    clients.delete(send);
  };
}

/** Wire the Broker's tool-cache invalidator (called on tool-surface changes). */
export function setToolCacheInvalidator(fn: () => void): void {
  invalidateCache = fn;
}

/** Invalidate the Broker tool cache + push tools/list_changed to all clients. */
export function notifyToolsListChanged(): void {
  invalidateCache?.();
  const payload = { jsonrpc: "2.0", method: "notifications/tools/list_changed" };
  for (const send of clients) {
    try {
      send(payload);
    } catch {
      /* drop a broken client; its stream cleanup will unregister it */
    }
  }
}

export function toolStreamClientCount(): number {
  return clients.size;
}

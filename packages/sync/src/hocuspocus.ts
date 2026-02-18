import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import * as Y from "yjs";

export type HocuspocusServerOptions = {
  port?: number;
  onDocumentSaved?: (documentName: string, document: Y.Doc) => Promise<void>;
};

export const createHocuspocusServer = (opts: HocuspocusServerOptions = {}): Server => {
  const extensions = [
    new Logger(),
    ...(opts.onDocumentSaved
      ? [
          new Database({
            fetch: async ({ documentName }) => {
              // Return null to start fresh — documents are loaded via initial content
              console.warn(`[hocuspocus] Fetching document: ${documentName}`);
              return null;
            },
            store: async ({ documentName, state }) => {
              // state is a Buffer containing the encoded Yjs document
              const doc = new Y.Doc();
              Y.applyUpdate(doc, state);
              await opts.onDocumentSaved?.(documentName, doc);
            },
          }),
        ]
      : []),
  ];

  return new Server({
    port: opts.port ?? 4001,
    extensions,
    async onAuthenticate(data) {
      // Phase 1: accept all connections
      // Phase 2: validate JWT token from data.token
      console.warn(`[hocuspocus] Connection authenticated for doc: ${data.documentName}`);
    },
    async onChange({ documentName }) {
      console.warn(`[hocuspocus] Document changed: ${documentName}`);
    },
  });
};

export const startHocuspocusServer = async (opts: HocuspocusServerOptions = {}): Promise<void> => {
  const server = createHocuspocusServer(opts);
  await server.listen();
  console.warn(`[hocuspocus] Collaboration server running on port ${opts.port ?? 4001}`);
};

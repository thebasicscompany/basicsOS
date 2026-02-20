import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createEngineerMCPServer } from "../server.js";

export const createHttpEngineerServer = async (): Promise<void> => {
  const port = Number(process.env["MCP_PORT"] ?? "4001");
  const httpServer = createServer((req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    }) as unknown as Transport;
    const server = createEngineerMCPServer();
    server
      .connect(transport)
      .then(() => {
        const raw = transport as unknown as StreamableHTTPServerTransport;
        return raw.handleRequest(req, res);
      })
      .catch((err: unknown) => {
        console.error("[engineer-mcp] handler error:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, () => {
      process.stderr.write(`Basics OS Engineer MCP Server running on HTTP port ${port}\n`);
      resolve();
    });
  });
};

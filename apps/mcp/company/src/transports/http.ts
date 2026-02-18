import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createMCPServer } from "../server.js";

export const createHttpMCPServer = async (): Promise<void> => {
  const port = Number(process.env["MCP_PORT"] ?? "4000");

  const httpServer = createServer((req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    }) as unknown as Transport;
    const mcpServer = createMCPServer();
    mcpServer
      .connect(transport)
      .then(() => {
        // Transport is connected — cast back to handle the request
        const raw = transport as unknown as StreamableHTTPServerTransport;
        return raw.handleRequest(req, res);
      })
      .catch((err: unknown) => {
        console.error("[http] MCP handler error:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", (err) => {
      process.stderr.write(`[http] Server error: ${String(err)}\n`);
      reject(err);
    });
    httpServer.listen(port, () => {
      process.stderr.write(`Basics OS MCP Server running on HTTP port ${port}\n`);
      resolve();
    });
  });
};

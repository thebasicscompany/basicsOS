import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createMCPServer } from "../server.js";

export const createHttpMCPServer = async (): Promise<void> => {
  const port = Number(process.env["MCP_PORT"] ?? "4000");

  // Session map for proper MCP session continuity across requests.
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; tenantId: string }>();

  const httpServer = createServer((req, res) => {
    // Tenant resolution: env var (single-tenant deployment) takes precedence,
    // then X-Tenant-ID header (for multi-tenant / per-user HTTP deployments).
    const tenantId =
      process.env["MCP_TENANT_ID"] ??
      (req.headers["x-tenant-id"] as string | undefined) ??
      "";

    if (!tenantId) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Missing tenant: set MCP_TENANT_ID env var or X-Tenant-ID header" }),
      );
      return;
    }

    const sessionId = (req.headers["mcp-session-id"] as string | undefined) ?? randomUUID();
    const existing = sessions.get(sessionId);

    if (existing) {
      existing.transport.handleRequest(req, res).catch((err: unknown) => {
        console.error("[http] handler error:", err);
        if (!res.headersSent) { res.writeHead(500); res.end("Internal Server Error"); }
      });
      return;
    }

    // New session — wire up a fresh server scoped to this tenant.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
    sessions.set(sessionId, { transport, tenantId });

    // Temporarily set the env var so createSystemCaller picks it up.
    // Safe because each session is isolated in its own closure.
    const prev = process.env["MCP_TENANT_ID"];
    process.env["MCP_TENANT_ID"] = tenantId;
    const mcpServer = createMCPServer();
    if (prev === undefined) {
      delete process.env["MCP_TENANT_ID"];
    } else {
      process.env["MCP_TENANT_ID"] = prev;
    }

    transport.onclose = () => { sessions.delete(sessionId); };

    mcpServer
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch((err: unknown) => {
        console.error("[http] MCP connect error:", err);
        sessions.delete(sessionId);
        if (!res.headersSent) { res.writeHead(500); res.end("Internal Server Error"); }
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

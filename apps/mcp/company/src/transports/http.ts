import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createMCPServer } from "../server.js";

export const createHttpMCPServer = async (): Promise<void> => {
  const port = Number(process.env["MCP_PORT"] ?? "4000");

  // Session map for proper MCP session continuity across requests.
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; tenantId: string; userId: string | undefined }
  >();

  const httpServer = createServer((req, res) => {
    // Tenant resolution: env var (single-tenant deployment) takes precedence,
    // then X-Tenant-ID header (for multi-tenant / per-user HTTP deployments).
    const tenantId =
      process.env["MCP_TENANT_ID"] ?? (req.headers["x-tenant-id"] as string | undefined) ?? "";

    if (!tenantId) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Missing tenant: set MCP_TENANT_ID env var or X-Tenant-ID header",
        }),
      );
      return;
    }

    // User resolution: env var takes precedence, then X-User-ID header.
    const userId = process.env["MCP_USER_ID"] ?? (req.headers["x-user-id"] as string | undefined);

    const sessionId = (req.headers["mcp-session-id"] as string | undefined) ?? randomUUID();
    const existing = sessions.get(sessionId);

    if (existing) {
      existing.transport.handleRequest(req, res).catch((err: unknown) => {
        console.error("[http] handler error:", err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      });
      return;
    }

    // New session — wire up a fresh server scoped to this tenant + user.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
    sessions.set(sessionId, { transport, tenantId, userId });

    // Temporarily set env vars so createSystemCaller picks them up.
    // Safe because each session is isolated in its own closure.
    const prevTenant = process.env["MCP_TENANT_ID"];
    const prevUser = process.env["MCP_USER_ID"];
    process.env["MCP_TENANT_ID"] = tenantId;
    if (userId !== undefined) {
      process.env["MCP_USER_ID"] = userId;
    } else {
      delete process.env["MCP_USER_ID"];
    }
    const mcpServer = createMCPServer();
    if (prevTenant === undefined) {
      delete process.env["MCP_TENANT_ID"];
    } else {
      process.env["MCP_TENANT_ID"] = prevTenant;
    }
    if (prevUser === undefined) {
      delete process.env["MCP_USER_ID"];
    } else {
      process.env["MCP_USER_ID"] = prevUser;
    }

    transport.onclose = () => {
      sessions.delete(sessionId);
    };

    mcpServer
      .connect(transport as Transport)
      .then(() => transport.handleRequest(req, res))
      .catch((err: unknown) => {
        console.error("[http] MCP connect error:", err);
        sessions.delete(sessionId);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
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

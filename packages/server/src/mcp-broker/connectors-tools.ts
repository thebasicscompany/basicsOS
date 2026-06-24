// connector.* — call admin-configured external APIs. The admin registers a
// connector (base URL + how to send the key) and stores the key ENCRYPTED; here
// the broker decrypts + injects it server-side, so app code never holds the key.
// Egress is HOST-PINNED to the connector's base URL (the app supplies a path, not
// a host), which blocks SSRF via path tricks. Gated for apps via `connector.*`;
// the agent (appGrants=null) is ungated.

import type { Db } from "@/db/client.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, asc } from "drizzle-orm";
import { decryptApiKey } from "@/lib/api-key-crypto.js";

const MAX_RESP = 200_000;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function buildConnectorTools(db: Db): BrokerTool[] {
  return [
    {
      name: "connector.list",
      description:
        "List the org's admin-configured external API connectors (slug, name, base URL, description, auth type). These are custom APIs an admin added (with a stored key). Use connector.request to actually call one — you never need the key.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      meta: { source: "system", writes: false },
      handle: async (_args, ctx) => {
        const rows = await db
          .select()
          .from(schema.connectors)
          .where(eq(schema.connectors.organizationId, ctx.orgId))
          .orderBy(asc(schema.connectors.name));
        return {
          connectors: rows.map((r) => ({
            slug: r.slug,
            name: r.name,
            baseUrl: r.baseUrl,
            description: r.description ?? "",
            authScheme: r.authScheme,
            hasKey: Boolean(r.secretCiphertext),
          })),
        };
      },
    },
    {
      name: "connector.request",
      description:
        "Call an admin-configured external API connector by slug. The platform injects the stored API key server-side (you never see it) and restricts the call to the connector's base URL host. Pass { connector: <slug>, method, path, query?, body?, headers? }: `path` is appended to the base URL (start with '/'). Returns { status, ok, body }.",
      inputSchema: {
        type: "object",
        properties: {
          connector: { type: "string", description: "connector slug (see connector.list)" },
          method: { type: "string", description: "GET|POST|PUT|PATCH|DELETE (default GET)" },
          path: { type: "string", description: "path appended to the base URL, e.g. '/v1/forecast' (start with '/')" },
          query: { type: "object", description: "optional query params as a flat object" },
          body: { type: "object", description: "optional JSON request body (POST/PUT/PATCH)" },
          headers: { type: "object", description: "optional extra request headers" },
        },
        required: ["connector", "path"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const slug = String(args.connector ?? "").trim();
        if (!slug) throw new BrokerError("VALIDATION", "`connector` slug is required.");
        const [conn] = await db
          .select()
          .from(schema.connectors)
          .where(and(eq(schema.connectors.organizationId, ctx.orgId), eq(schema.connectors.slug, slug)))
          .limit(1);
        if (!conn)
          throw new BrokerError("NOT_FOUND", `No connector '${slug}'. Call connector.list to see available connectors.`);

        const method = (typeof args.method === "string" ? args.method : "GET").toUpperCase();
        if (!METHODS.includes(method)) throw new BrokerError("VALIDATION", `Unsupported method '${method}'.`);

        const base = new URL(conn.baseUrl);
        const rawPath = String(args.path ?? "").trim();
        const path = rawPath.startsWith("/") || rawPath.startsWith("?") ? rawPath : `/${rawPath}`;
        let url: URL;
        try {
          url = new URL(conn.baseUrl + path);
        } catch {
          throw new BrokerError("VALIDATION", "Invalid path.");
        }
        // HOST-PIN: the request must stay on the connector's host (blocks SSRF via
        // path tricks like "@evil.com" or "//evil.com").
        if (url.host !== base.host || (url.protocol !== "http:" && url.protocol !== "https:")) {
          throw new BrokerError("VALIDATION", "path must stay within the connector's base URL host.");
        }

        const query =
          args.query && typeof args.query === "object" && !Array.isArray(args.query)
            ? (args.query as Record<string, unknown>)
            : {};
        for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));

        // Case-insensitive Headers so an app can't smuggle a duplicate auth header
        // (e.g. lowercase "authorization") that fetch would comma-merge with the
        // injected one. App-supplied auth / hop-by-hop headers are dropped; the
        // connector's own auth is set LAST so it always wins.
        const BLOCKED_HEADERS = new Set([
          "authorization",
          "host",
          "content-length",
          "connection",
          "transfer-encoding",
          "cookie",
        ]);
        const headers = new Headers({ Accept: "application/json" });
        const extra =
          args.headers && typeof args.headers === "object" && !Array.isArray(args.headers)
            ? (args.headers as Record<string, unknown>)
            : {};
        for (const [k, v] of Object.entries(extra)) {
          if (typeof v === "string" && !BLOCKED_HEADERS.has(k.toLowerCase())) headers.set(k, v);
        }

        const key = conn.secretCiphertext ? decryptApiKey(conn.secretCiphertext) : null;
        if (key) {
          if (conn.authScheme === "bearer") headers.set("Authorization", `Bearer ${key}`);
          else if (conn.authScheme === "header" && conn.authName) headers.set(conn.authName, key);
          else if (conn.authScheme === "query" && conn.authName) url.searchParams.set(conn.authName, key);
        }

        let reqBody: string | undefined;
        if (args.body != null && method !== "GET" && method !== "DELETE") {
          headers.set("Content-Type", "application/json");
          reqBody = JSON.stringify(args.body);
        }

        let res: Response;
        try {
          res = await fetch(url.toString(), { method, headers, body: reqBody });
        } catch (e) {
          throw new BrokerError("UPSTREAM", `Connector request failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        const text = (await res.text()).slice(0, MAX_RESP);
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          /* keep raw text */
        }
        return { status: res.status, ok: res.ok, body };
      },
    },
  ];
}

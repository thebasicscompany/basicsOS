import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { listCustomObjects, listCustomFieldDefs } from "@/mcp-broker/data.js";
import { scanDeclarativeSpec, scanHostedApp } from "@/lib/apps/scan.js";
import { writeHostedBundle, buildHostedSpec, deleteHostedBundle } from "@/lib/apps/hosted-deploy.js";
import { parseSpecFromText, derivePermissions } from "@/lib/apps/builder.js";
import { writeAuditLogSafe } from "@/lib/audit-log.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const STANDARD_OBJECTS = ["contacts", "companies", "deals", "tasks"];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "app";

/**
 * The MCP contract handed to an external coding agent (Cursor / Claude Code /
 * Codex) so it builds a VALID BasicsOS app. Concise on purpose — the app talks to
 * the host ONLY through the broker bridge; no raw network / DB / cookies.
 */
const APP_SDK = `BasicsOS app SDK (build a HOSTED app = a single sandboxed index.html, OR a DECLARATIVE JSON spec).

HOSTED app contract (index.html, runs in a sandboxed iframe at an opaque origin — NO localStorage/fetch/cookies):
- On load, post {type:'app:ready'} to parent; the host replies with a theme; call applyTheme(vars) to set CSS variables (var(--background)/--card/--primary/--input/--border/--foreground/--radius). Style EVERYTHING with those tokens (no hardcoded colors).
- Call the broker: request('tools.call', { name, params }) -> result (throws if the tool isn't granted). request('tools.list') -> granted tools. request('storage.get'/'storage.set', {key, value?, scope:'app'|'user'}) for transient/UI state only.
- For RECORDS people add over time, do NOT use storage — write to a structured object via tools.call('object.create',{object:'<slug>', ...fields}) and read via tools.call('object.search',{object:'<slug>'}). Declare the object in deploy_app.backingObject so the platform creates it; records are then a browsable grid AND agent-queryable.

Capabilities (request the matching grant in deploy_app.permissions):
- object.create / object.search / object.update / object.delete  ({object:'<slug>', ...})   grant: object.* (or object.<slug>.*)
- context.remember / context.recent / context.search   (company knowledge/status the agent recalls)   grant: context.*
- ai.complete ({prompt}) / ai.vision ({imageUrl,prompt})   grant: ai.*
- connector.list / connector.request ({connector,path,...})  (admin-connected external APIs; key injected server-side)  grant: connector.*

DECLARATIVE spec shape: { version:1, pages:[{slug,title,layout:'single'|'split'|'grid', blocks:[ {kind:'metric'|'table'|'chart'|'form'|'markdown', ...} ]}], dataSources:[{id,tool,params}], actions:[{id,tool,params,confirm?}] }.`;

export function createBuildMcpRoutes(db: Db, auth: BetterAuthInstance, env: Env) {
  const app = new Hono();
  app.use("*", authMiddleware(auth, db));

  app.post("/", async (c) => {
    // Building/deploying apps is admin — gate like the in-app builder. External
    // agents authenticate with a bos_crm_* token belonging to an admin.
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId as string;

    const body = (await c.req.json().catch(() => ({}))) as {
      jsonrpc?: string;
      id?: unknown;
      method?: string;
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    const { id, method } = body;

    if (method === "initialize") {
      c.header("Mcp-Session-Id", randomUUID());
      return c.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "basicsos-app-builder", version: "1.0.0" },
          instructions:
            "Build internal apps for BasicsOS. Call get_build_context first, then deploy_app. Deployed apps are scanned + AI-verified and land as drafts for an admin to publish.",
        },
      });
    }
    if (method === "notifications/initialized") return c.body(null, 202);

    const TOOLDEFS = [
      {
        name: "get_build_context",
        description:
          "REQUIRED FIRST. Returns everything needed to build a correct BasicsOS app: the org's objects (with fields), connected external APIs, the available broker capabilities, and the app SDK contract. Build against this.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "deploy_app",
        description:
          "Deploy an app into BasicsOS. It is SCANNED + AI-verified, then created as a DRAFT for an admin to publish. For a hosted app pass the full index.html as `artifact`; for declarative pass the JSON spec as `artifact`. Declare `permissions` (grants the app needs, e.g. ['object.*','ai.*']) and, if it stores records, a `backingObject`.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "app name" },
            type: { type: "string", description: "'hosted' or 'declarative'" },
            artifact: { type: "string", description: "hosted: full index.html; declarative: JSON spec" },
            permissions: { type: "array", items: { type: "string" }, description: "broker grants the app needs" },
            backingObject: {
              type: "object",
              description: "optional structured store: { singularName, pluralName, fields:[{name,label,fieldType}] }",
            },
          },
          required: ["name", "type", "artifact"],
        },
      },
      {
        name: "list_apps",
        description: "List the org's existing apps (slug, name, type, status).",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
    ];

    if (method === "tools/list") {
      return c.json({ jsonrpc: "2.0", id, result: { tools: TOOLDEFS } });
    }

    if (method === "tools/call") {
      const name = body.params?.name;
      const args = body.params?.arguments ?? {};
      const ok = (data: unknown) =>
        c.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } });
      const fail = (msg: string) =>
        c.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true } });

      try {
        if (name === "get_build_context") {
          const customs = await listCustomObjects(db, orgId);
          const customWithFields = await Promise.all(
            customs.map(async (o) => ({
              slug: o.slug,
              singular: o.singular,
              plural: o.plural,
              kind: "custom",
              fields: (await listCustomFieldDefs(db, orgId, o.slug, o.tableName)).map((f) => ({
                name: f.name,
                label: f.label,
                type: f.fieldType,
              })),
            })),
          );
          const connectors = await db
            .select()
            .from(schema.connectors)
            .where(eq(schema.connectors.organizationId, orgId));
          return ok({
            objects: [
              ...STANDARD_OBJECTS.map((s) => ({ slug: s, kind: "builtin" })),
              ...customWithFields,
            ],
            connectors: connectors.map((r) => ({
              slug: r.slug,
              name: r.name,
              baseUrl: r.baseUrl,
              description: r.description ?? "",
              authScheme: r.authScheme,
            })),
            appSdk: APP_SDK,
          });
        }

        if (name === "list_apps") {
          const apps = await db
            .select({
              slug: schema.appConfig.slug,
              name: schema.appConfig.name,
              type: schema.appConfig.type,
              status: schema.appConfig.status,
            })
            .from(schema.appConfig)
            .where(eq(schema.appConfig.organizationId, orgId));
          return ok({ apps });
        }

        if (name === "deploy_app") {
          const appName = String(args.name ?? "").trim();
          const type = String(args.type ?? "").trim();
          const artifact = String(args.artifact ?? "");
          const permissions = Array.isArray(args.permissions)
            ? (args.permissions as unknown[]).filter((p): p is string => typeof p === "string")
            : [];
          if (!appName || !artifact) return fail("`name` and `artifact` are required.");
          if (type !== "hosted" && type !== "declarative") return fail("`type` must be 'hosted' or 'declarative'.");

          // Unique slug — scoped to THIS org (slugs are unique per org, not global).
          let slug = slugify(appName);
          const taken = new Set(
            (
              await db
                .select({ slug: schema.appConfig.slug })
                .from(schema.appConfig)
                .where(eq(schema.appConfig.organizationId, orgId))
            ).map((r) => r.slug),
          );
          if (taken.has(slug)) {
            let i = 2;
            while (taken.has(`${slug}-${i}`)) i++;
            slug = `${slug}-${i}`;
          }

          if (type === "declarative") {
            const spec = parseSpecFromText(artifact);
            if (!spec) return fail("Could not parse a valid declarative JSON spec from `artifact`.");
            const perms = derivePermissions(spec);
            const scan = await scanDeclarativeSpec(env, { spec, name: appName, permissions: perms });
            if (!scan.allowed)
              return ok({ deployed: false, scan, reason: "Failed security verification — not deployed." });
            const [created] = await db
              .insert(schema.appConfig)
              .values({
                slug,
                name: appName,
                type: "declarative",
                spec: spec as never,
                permissions: perms,
                status: "draft",
                createdByCrmUserId: authz.crmUser.id,
                organizationId: orgId,
              } as typeof schema.appConfig.$inferInsert)
              .returning();
            await writeAuditLogSafe(db, {
              crmUserId: authz.crmUser.id,
              organizationId: orgId,
              action: "app.deployed_via_mcp",
              entityType: "app_config",
              entityId: created?.id ?? 0,
              metadata: { slug, source: "build-mcp" },
            });
            return ok({ deployed: true, slug, status: "draft", type, permissions: perms, scan });
          }

          // hosted
          writeHostedBundle(env, slug, artifact);
          const spec = buildHostedSpec(env, slug, permissions);
          const scan = await scanHostedApp(env, slug, { spec, name: appName, permissions });
          if (!scan.allowed) {
            // SECURITY: a rejected bundle (may contain hardcoded secrets) must NOT
            // linger on disk where it could be fetched — delete it before returning.
            deleteHostedBundle(env, slug);
            return ok({ deployed: false, scan, reason: "Failed security verification — not deployed." });
          }
          const [created] = await db
            .insert(schema.appConfig)
            .values({
              slug,
              name: appName,
              type: "hosted",
              icon: "app-window",
              spec: spec as never,
              permissions,
              status: "draft",
              createdByCrmUserId: authz.crmUser.id,
              organizationId: orgId,
            } as typeof schema.appConfig.$inferInsert)
            .returning();
          await writeAuditLogSafe(db, {
            crmUserId: authz.crmUser.id,
            organizationId: orgId,
            action: "app.deployed_via_mcp",
            entityType: "app_config",
            entityId: created?.id ?? 0,
            metadata: { slug, source: "build-mcp" },
          });
          return ok({ deployed: true, slug, status: "draft", type, permissions, scan });
        }

        return c.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    }

    return c.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
  });

  return app;
}

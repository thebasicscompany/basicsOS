import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, asc } from "drizzle-orm";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { writeAuditLogSafe } from "@/lib/audit-log.js";
import { encryptApiKey, hasApiKeyEncryptionConfigured } from "@/lib/api-key-crypto.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const AUTH_SCHEMES = ["bearer", "header", "query", "none"] as const;

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(128),
  baseUrl: z.string().trim().url().max(512),
  description: z.string().trim().max(2000).optional(),
  authScheme: z.enum(AUTH_SCHEMES).default("bearer"),
  authName: z.string().trim().max(128).optional(),
  // Plaintext API key from the admin (encrypted before storage). Omit on update to
  // keep the existing key; required on create unless authScheme="none".
  apiKey: z.string().trim().max(4096).optional(),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "connector";

/** Public (no-secret) shape returned to clients + agent. */
const toPublic = (r: schema.ConnectorRow) => ({
  slug: r.slug,
  name: r.name,
  baseUrl: r.baseUrl,
  description: r.description ?? "",
  authScheme: r.authScheme,
  authName: r.authName ?? "",
  hasKey: Boolean(r.secretCiphertext),
});

export function createConnectorsRoutes(db: Db, auth: BetterAuthInstance, _env: Env) {
  const app = new Hono();
  app.use("*", authMiddleware(auth, db));

  // GET / — list connectors (any authed user; NEVER returns the key)
  app.get("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const rows = await db
      .select()
      .from(schema.connectors)
      .where(eq(schema.connectors.organizationId, (authz.crmUser.organizationId as string)))
      .orderBy(asc(schema.connectors.name));
    return c.json({ connectors: rows.map(toPublic) });
  });

  // POST / — create a connector (admin)
  app.post("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = (authz.crmUser.organizationId as string);
    const parsed = upsertSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
    const body = parsed.data;
    if (body.authScheme !== "none") {
      if (!body.apiKey) return c.json({ error: "An API key is required for this auth type." }, 400);
      if (!hasApiKeyEncryptionConfigured())
        return c.json({ error: "Secret storage is not configured on the server." }, 500);
      if ((body.authScheme === "header" || body.authScheme === "query") && !body.authName)
        return c.json({ error: "A header/parameter name is required for this auth type." }, 400);
    }
    let slug = slugify(body.name);
    const existing = await db
      .select({ slug: schema.connectors.slug })
      .from(schema.connectors)
      .where(eq(schema.connectors.organizationId, orgId));
    const taken = new Set(existing.map((e) => e.slug));
    if (taken.has(slug)) {
      let i = 2;
      while (taken.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    const [row] = await db
      .insert(schema.connectors)
      .values({
        organizationId: orgId,
        slug,
        name: body.name,
        baseUrl: body.baseUrl.replace(/\/+$/, ""),
        description: body.description ?? "",
        authScheme: body.authScheme,
        authName: body.authName ?? "",
        secretCiphertext: body.apiKey ? encryptApiKey(body.apiKey) : null,
      })
      .returning();
    await writeAuditLogSafe(db, {
      crmUserId: authz.crmUser.id,
      organizationId: orgId,
      action: "connector.created",
      entityType: "connector",
      entityId: slug,
    });
    return c.json(toPublic(row!));
  });

  // PUT /:slug — update a connector (admin); omit apiKey to keep the existing key
  app.put("/:slug", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = (authz.crmUser.organizationId as string);
    const slug = c.req.param("slug");
    const [existing] = await db
      .select()
      .from(schema.connectors)
      .where(and(eq(schema.connectors.organizationId, orgId), eq(schema.connectors.slug, slug)))
      .limit(1);
    if (!existing) return c.json({ error: "Connector not found" }, 404);
    const parsed = upsertSchema.partial().safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
    const b = parsed.data;
    const updates: Partial<schema.ConnectorRow> = { updatedAt: new Date() };
    if (b.name !== undefined) updates.name = b.name;
    if (b.baseUrl !== undefined) updates.baseUrl = b.baseUrl.replace(/\/+$/, "");
    if (b.description !== undefined) updates.description = b.description;
    if (b.authScheme !== undefined) updates.authScheme = b.authScheme;
    if (b.authName !== undefined) updates.authName = b.authName;
    if (b.apiKey) {
      if (!hasApiKeyEncryptionConfigured())
        return c.json({ error: "Secret storage is not configured on the server." }, 500);
      updates.secretCiphertext = encryptApiKey(b.apiKey);
    }
    const [row] = await db
      .update(schema.connectors)
      .set(updates)
      .where(and(eq(schema.connectors.organizationId, orgId), eq(schema.connectors.slug, slug)))
      .returning();
    return c.json(toPublic(row!));
  });

  // DELETE /:slug — delete a connector (admin)
  app.delete("/:slug", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = (authz.crmUser.organizationId as string);
    const slug = c.req.param("slug");
    const deleted = await db
      .delete(schema.connectors)
      .where(and(eq(schema.connectors.organizationId, orgId), eq(schema.connectors.slug, slug)))
      .returning({ slug: schema.connectors.slug });
    if (deleted.length === 0) return c.json({ error: "Connector not found" }, 404);
    await writeAuditLogSafe(db, {
      crmUserId: authz.crmUser.id,
      organizationId: orgId,
      action: "connector.deleted",
      entityType: "connector",
      entityId: slug,
    });
    return c.json({ ok: true, slug });
  });

  return app;
}

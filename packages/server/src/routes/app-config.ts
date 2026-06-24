// Custom-app registry routes (APP-1). The shell's AppRegistryProvider reads GET /
// to render the Apps sidebar + /apps/:slug for everyone in the company. Create /
// update are admin-only (gated like object_config.write) — that's the "admins
// build, everyone uses" decision. Mirrors routes/object-config.ts, minus the
// backing-table / attribute-override machinery (apps are pure config).
//
// The actual publish lifecycle (draft → scan → active + live apps/list_changed
// push) lands in APP-3; here we provide the registry CRUD it builds on.

import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { writeAuditLogSafe } from "@/lib/audit-log.js";
import {
  addAppsStreamClient,
  notifyAppsListChanged,
} from "@/mcp-broker/apps-change-bus.js";
import { scanDeclarativeSpec, scanHostedApp, validateHostedSpec } from "@/lib/apps/scan.js";
import { buildSessionKey, hermesComplete } from "@/lib/hermes/client.js";
import {
  buildPlanSystemPrompt,
  buildDeclarativeSystemPrompt,
  buildHostedSystemPrompt,
  buildRefineSystemPrompt,
  parsePlan,
  parseSpecFromText,
  extractHtmlFromText,
  derivePermissions,
  hostedPermissions,
  type BuildPlan,
} from "@/lib/apps/builder.js";
import { buildHostedSpec, writeHostedBundle, readHostedBundle, deleteHostedBundle } from "@/lib/apps/hosted-deploy.js";
import { createCustomObject } from "@/lib/apps/create-object.js";
import { randomUUID } from "node:crypto";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const appCreateSchema = z.object({
  name: z.string().min(1).max(128),
  icon: z.string().max(64).optional(),
  iconColor: z.string().max(32).optional(),
  type: z.enum(["declarative", "hosted"]).optional(),
  spec: z.record(z.string(), z.unknown()).optional(),
  permissions: z.array(z.string()).optional(),
});

const builderSchema = z.object({
  prompt: z.string().min(1).max(4000),
  // iterate on an existing draft (keep its slug + bundle path)
  slug: z.string().max(64).optional(),
});

const appUpdateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  icon: z.string().max(64).optional(),
  iconColor: z.string().max(32).optional(),
  type: z.enum(["declarative", "hosted"]).optional(),
  status: z.enum(["draft", "preview", "scanning", "active", "suspended"]).optional(),
  spec: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
  permissions: z.array(z.string()).optional(),
  backendModule: z.object({ slug: z.string(), version: z.string() }).nullable().optional(),
  version: z.string().max(32).optional(),
  position: z.number().int().optional(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function createAppConfigRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
) {
  const app = new Hono();

  app.use("*", authMiddleware(auth, db));

  const requireAppWrite = async (c: Context) => {
    // Admins-only to build/publish apps — gate like object_config.write.
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    return null;
  };

  // GET / — list this org's apps (+ global defaults). Any authenticated user can
  // read the registry, so apps appear in every member's sidebar.
  app.get("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    try {
      const apps = await db
        .select()
        .from(schema.appConfig)
        .where(
          or(
            eq(schema.appConfig.organizationId, orgId),
            isNull(schema.appConfig.organizationId),
          ),
        )
        .orderBy(asc(schema.appConfig.position), asc(schema.appConfig.id));
      return c.json(apps);
    } catch (err) {
      console.error("[app-config] list failed:", err);
      return c.json({ error: "Failed to load apps" }, 500);
    }
  });

  // GET /stream — Better-Auth SSE stream of apps/list_changed. The shell's
  // AppRegistryProvider holds this open and refetches /api/app-config when an app
  // is published/suspended, so a new app appears in every open sidebar live.
  app.get("/stream", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    return streamSSE(c, async (stream) => {
      const send = (payload: unknown) => {
        void stream.writeSSE({ data: JSON.stringify(payload) });
      };
      const remove = addAppsStreamClient(send);
      stream.onAbort(remove);
      try {
        while (!c.req.raw.signal.aborted) {
          await stream.sleep(20_000);
          await stream.write(":\n\n"); // keepalive comment
        }
      } finally {
        remove();
      }
    });
  });

  // POST / — create a new app (admins only). Status starts "draft"; publishing to
  // "active" is the publish endpoint below. Returns the created row.
  app.post("/", async (c) => {
    const adminError = await requireAppWrite(c);
    if (adminError) return adminError;
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = appCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, 400);
    }
    const body = parsed.data;
    // A hosted app's spec loads as the sandbox iframe src — validate it fail-closed.
    if ((body.type ?? "declarative") === "hosted") {
      const v = validateHostedSpec(body.spec);
      if (!v.ok) return c.json({ error: v.error }, 400);
    }
    const slug = slugify(body.name);
    if (!slug) return c.json({ error: "Could not derive a slug from name" }, 400);

    const [existing] = await db
      .select()
      .from(schema.appConfig)
      .where(and(eq(schema.appConfig.slug, slug), eq(schema.appConfig.organizationId, orgId)))
      .limit(1);
    if (existing) return c.json({ error: "An app with this name already exists" }, 409);

    try {
      const [created] = await db
        .insert(schema.appConfig)
        .values({
          slug,
          name: body.name,
          icon: body.icon ?? "layout-grid",
          iconColor: body.iconColor ?? "blue",
          type: body.type ?? "declarative",
          status: "draft",
          spec: body.spec ?? {},
          permissions: body.permissions ?? [],
          createdByCrmUserId: authz.crmUser.id,
          organizationId: orgId,
        })
        .returning();

      await writeAuditLogSafe(db, {
        crmUserId: authz.crmUser.id,
        organizationId: orgId,
        action: "app_config.created",
        entityType: "app_config",
        entityId: created?.id ?? 0,
        metadata: { slug, type: created?.type },
      });
      notifyAppsListChanged();
      return c.json(created, 201);
    } catch (err) {
      console.error("[app-config] create failed:", err);
      return c.json({ error: "Failed to create app" }, 500);
    }
  });

  // Ensure a slug is unique (or keep the one we're iterating on).
  const findUniqueSlug = async (base: string, keep?: string): Promise<string> => {
    const safe = base || "app";
    if (keep) return keep;
    let slug = safe;
    let n = 1;
    // bounded loop; slugs are short
    while (n < 200) {
      const [ex] = await db
        .select({ id: schema.appConfig.id })
        .from(schema.appConfig)
        .where(eq(schema.appConfig.slug, slug))
        .limit(1);
      if (!ex) return slug;
      n += 1;
      slug = `${safe}-${n}`;
    }
    return `${safe}-${randomUUID().slice(0, 6)}`;
  };

  // POST /builder — the DELIBERATE app builder (APP-3 + APP-4e). Streams its phases
  // (plan → build → review) via SSE so the admin watches the work, then writes a
  // DRAFT app (declarative spec, or a hosted bundle on disk) for sandboxed preview
  // before publish. Ephemeral hermes session. Admins only.
  app.post("/builder", async (c) => {
    const adminError = await requireAppWrite(c);
    if (adminError) return adminError;
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = builderSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, 400);
    }
    const { prompt, slug: iterateSlug } = parsed.data;

    // Load the app being edited (if any) so the builder REFINES the existing
    // artifact + keeps its kind — iterative editing, not regeneration.
    let editing:
      | { type: "declarative" | "hosted"; artifact: string; name: string; permissions: string[] }
      | null = null;
    if (iterateSlug) {
      const [cur] = await db
        .select({
          type: schema.appConfig.type,
          spec: schema.appConfig.spec,
          name: schema.appConfig.name,
          permissions: schema.appConfig.permissions,
        })
        .from(schema.appConfig)
        .where(eq(schema.appConfig.slug, iterateSlug))
        .limit(1);
      if (cur) {
        const artifact =
          cur.type === "hosted"
            ? (readHostedBundle(env, iterateSlug) ?? "")
            : JSON.stringify(cur.spec, null, 2);
        editing = {
          type: cur.type === "hosted" ? "hosted" : "declarative",
          artifact,
          name: cur.name ?? "App",
          permissions: Array.isArray(cur.permissions) ? (cur.permissions as string[]) : [],
        };
      }
    }

    // Builder session: STABLE per app when editing (slug-keyed) so the chat keeps
    // its conversation context across refinements AND persists (hermes stores the
    // session) — the admin can keep talking to it until they publish. Throwaway
    // thread for a brand-new app (no slug yet).
    const builderThread = iterateSlug ? `builder-${iterateSlug}` : `builder-${randomUUID()}`;
    const sessionKey = buildSessionKey(authz.crmUser.id, builderThread);

    const upsertDraft = async (slug: string, fields: Record<string, unknown>) => {
      const [ex] = await db
        .select({ id: schema.appConfig.id })
        .from(schema.appConfig)
        .where(eq(schema.appConfig.slug, slug))
        .limit(1);
      if (ex) {
        const [u] = await db
          .update(schema.appConfig)
          .set({ ...fields, status: "draft", updatedAt: new Date() })
          .where(eq(schema.appConfig.slug, slug))
          .returning();
        return u;
      }
      const [created] = await db
        .insert(schema.appConfig)
        .values({
          slug,
          status: "draft",
          createdByCrmUserId: authz.crmUser.id,
          organizationId: orgId,
          ...fields,
        } as typeof schema.appConfig.$inferInsert)
        .returning();
      return created;
    };

    return streamSSE(c, async (stream) => {
      const emit = (obj: unknown) => stream.writeSSE({ data: JSON.stringify(obj) });
      const gen = (systemPrompt: string, message: string) =>
        hermesComplete({ env, sessionKey, message, systemPrompt });
      const iterNote = iterateSlug
        ? `\n\n(You are improving an existing app, slug "${iterateSlug}". Apply the request and return the full updated artifact.)`
        : "";

      try {
        // PHASE 1 — PLAN. Editing skips planning (we already know the app); we
        // synthesize a plan from the existing app so a short change request like
        // "make the button blue" doesn't get mis-parsed as a whole new app.
        let plan: BuildPlan | null;
        if (editing) {
          await emit({ type: "phase", phase: "planning", label: "Reviewing your app…" });
          plan = { kind: editing.type, name: editing.name, summary: prompt, tools: editing.permissions };
        } else {
          await emit({ type: "phase", phase: "planning", label: "Planning the app…" });
          const planRaw = await gen(buildPlanSystemPrompt(), `${prompt}${iterNote}`);
          plan = parsePlan(planRaw);
          if (!plan) {
            await emit({ type: "error", error: "Could not plan the app from that request.", raw: planRaw.slice(0, 4000) });
            return;
          }
        }
        await emit({ type: "plan", plan });

        // PHASE 1b — SCAFFOLD the structured backing object (a grid) for a data
        // app, BEFORE building, so its object.<slug>.* tools exist + the app's
        // records are agent-readable/filterable (not an opaque blob).
        if (!editing && plan.backingObject) {
          try {
            const obj = await createCustomObject(db, authz.crmUser.organizationId as string, {
              singularName: plan.backingObject.singularName,
              pluralName: plan.backingObject.pluralName,
              fields: plan.backingObject.fields,
            });
            await emit({
              type: "phase",
              phase: "building",
              label: obj.existed
                ? `Using the existing "${plan.backingObject.pluralName}" data store…`
                : `Created the "${plan.backingObject.pluralName}" data store (object.${obj.slug}.*)…`,
            });
          } catch {
            // Best-effort: if scaffolding fails, continue — the app build still runs.
          }
        }

        // PHASE 2 — BUILD
        await emit({ type: "phase", phase: editing ? "editing" : "building", label: editing ? "Applying your change…" : `Building the ${plan.kind} app…` });
        const buildMsg = editing
          ? `You are EDITING an existing ${editing.type} app. Here is its CURRENT artifact:\n\n${editing.artifact.slice(0, 60000)}\n\nApply ONLY this change, keeping everything else intact: ${prompt}\n\nReturn the FULL updated ${editing.type} artifact.`
          : `Approved plan:\n${JSON.stringify(plan, null, 2)}\n\nUser request:\n${prompt}${iterNote}`;
        const buildRaw = await gen(
          plan.kind === "hosted" ? buildHostedSystemPrompt() : buildDeclarativeSystemPrompt(),
          buildMsg,
        );

        // PHASE 3 — REVIEW / REFINE
        await emit({ type: "phase", phase: "refining", label: "Reviewing & refining…" });
        const refineRaw = await gen(
          buildRefineSystemPrompt(plan.kind),
          `Here is the app you just built. Review it carefully and return the improved final version.\n\n${buildRaw.slice(0, 60000)}`,
        );

        // FINALIZE
        const slug = await findUniqueSlug(slugify(plan.name), iterateSlug);
        if (plan.kind === "declarative") {
          const spec = parseSpecFromText(refineRaw) ?? parseSpecFromText(buildRaw);
          if (!spec) {
            await emit({ type: "error", error: "Could not parse a valid spec.", raw: refineRaw.slice(0, 4000) });
            return;
          }
          const permissions = derivePermissions(spec);
          const app = await upsertDraft(slug, { name: plan.name, type: "declarative", spec, permissions });
          await emit({ type: "done", kind: "declarative", app, plan });
        } else {
          const html = extractHtmlFromText(refineRaw) ?? extractHtmlFromText(buildRaw);
          if (!html) {
            await emit({ type: "error", error: "Could not parse a hosted bundle.", raw: refineRaw.slice(0, 4000) });
            return;
          }
          const permissions = hostedPermissions(plan);
          writeHostedBundle(env, slug, html);
          const app = await upsertDraft(slug, {
            name: plan.name,
            type: "hosted",
            icon: "app-window",
            spec: buildHostedSpec(env, slug, permissions),
            permissions,
            backendModule: null,
          });
          await emit({ type: "done", kind: "hosted", app, plan });
        }
      } catch (err) {
        const isTimeout =
          err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /timed? ?out|aborted/i.test(err.message));
        await emit({
          type: "error",
          error: isTimeout ? "The builder timed out — the AI service is busy. Please try again." : "Builder failed.",
          detail: err instanceof Error ? err.message.slice(0, 200) : "error",
        });
      }
    });
  });

  // PUT /:slug — partial update (admins only).
  app.put("/:slug", async (c) => {
    const adminError = await requireAppWrite(c);
    if (adminError) return adminError;
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);
    const slug = c.req.param("slug");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = appUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, 400);
    }
    const body = parsed.data;

    const [existing] = await db
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.slug, slug))
      .limit(1);
    if (!existing) return c.json({ error: "App not found" }, 404);
    // Org-scope guard: don't let one org mutate another org's app (global apps are
    // immutable here — managed centrally).
    if (existing.organizationId && existing.organizationId !== orgId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // SECURITY: activation only via the publish endpoint (which scans). PUT may
    // only park an app at draft or suspended — never active/preview/scanning — so
    // a hosted app can't be flipped active (skipping the bundle scan) via update.
    if (body.status !== undefined && body.status !== "draft" && body.status !== "suspended") {
      return c.json(
        { error: "Activate an app via POST /:slug/publish; PUT may only set draft or suspended." },
        400,
      );
    }
    // The type is fixed at creation — changing it would let a declarative app
    // morph into an unscanned hosted app.
    if (body.type !== undefined && body.type !== existing.type) {
      return c.json({ error: "An app's type cannot be changed after creation." }, 400);
    }
    // If the (hosted) spec is being changed, validate it fail-closed.
    if (body.spec !== undefined && existing.type === "hosted") {
      const v = validateHostedSpec(body.spec);
      if (!v.ok) return c.json({ error: v.error }, 400);
    }
    // Any spec/permission/backend-module change must be re-scanned before going
    // live again, so an active app drops back to draft on edit (re-publish to
    // re-scan) — incl. backendModule, so app server logic can't be swapped live.
    const editsCapabilities =
      body.spec !== undefined || body.permissions !== undefined || body.backendModule !== undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (editsCapabilities && existing.status === "active" && body.status === undefined) {
      updates.status = "draft";
    }
    if (body.name !== undefined) updates.name = body.name;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.iconColor !== undefined) updates.iconColor = body.iconColor;
    if (body.type !== undefined) updates.type = body.type;
    if (body.status !== undefined) updates.status = body.status;
    if (body.spec !== undefined) updates.spec = body.spec;
    if (body.permissions !== undefined) updates.permissions = body.permissions;
    if (body.backendModule !== undefined) updates.backendModule = body.backendModule;
    if (body.version !== undefined) updates.version = body.version;
    if (body.position !== undefined) updates.position = body.position;

    try {
      const [updated] = await db
        .update(schema.appConfig)
        .set(updates)
        .where(eq(schema.appConfig.slug, slug))
        .returning();

      await writeAuditLogSafe(db, {
        crmUserId: authz.crmUser.id,
        organizationId: orgId,
        action: "app_config.updated",
        entityType: "app_config",
        entityId: updated?.id ?? 0,
        metadata: { slug, updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
      });
      // A status/visibility change should surface in every open shell live.
      if (body.status !== undefined || body.name !== undefined || body.icon !== undefined) {
        notifyAppsListChanged();
      }
      return c.json(updated);
    } catch (err) {
      console.error("[app-config] update failed:", err);
      return c.json({ error: "Failed to update app" }, 500);
    }
  });

  // DELETE /:slug — delete an app (admins only): removes the config row, its
  // hosted bundle (if any), and pushes apps/list_changed so it disappears from
  // every sidebar live.
  app.delete("/:slug", async (c) => {
    const adminError = await requireAppWrite(c);
    if (adminError) return adminError;
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const slug = c.req.param("slug");
    try {
      const [existing] = await db
        .select({ id: schema.appConfig.id, type: schema.appConfig.type })
        .from(schema.appConfig)
        .where(eq(schema.appConfig.slug, slug))
        .limit(1);
      if (!existing) return c.json({ error: "App not found" }, 404);

      await db.delete(schema.appConfig).where(eq(schema.appConfig.id, existing.id));
      if (existing.type === "hosted") deleteHostedBundle(env, slug);

      await writeAuditLogSafe(db, {
        crmUserId: authz.crmUser.id,
        organizationId: authz.crmUser.organizationId,
        action: "app_config.deleted",
        entityType: "app_config",
        entityId: existing.id,
        metadata: { slug },
      });
      notifyAppsListChanged();
      return c.json({ ok: true, slug });
    } catch (err) {
      console.error("[app-config] delete failed:", err);
      return c.json({ error: "Failed to delete app" }, 500);
    }
  });

  // POST /:slug/publish — scan the spec (fail-closed) then flip to active and push
  // apps/list_changed. Declarative only; hosted-app publish rides the deploy rail
  // (APP-4d/4f). Admins only.
  app.post("/:slug/publish", async (c) => {
    const adminError = await requireAppWrite(c);
    if (adminError) return adminError;
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);
    const slug = c.req.param("slug");

    const [row] = await db
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.slug, slug))
      .limit(1);
    if (!row) return c.json({ error: "App not found" }, 404);
    if (row.organizationId && row.organizationId !== orgId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // draft → scanning → (scan, fail-closed) → active | suspended. Declarative and
    // hosted both scan here (hosted = spec validation + bundle static checks +
    // best-effort gateway AI scan); activation NEVER happens without a passing scan.
    await db
      .update(schema.appConfig)
      .set({ status: "scanning", updatedAt: new Date() })
      .where(eq(schema.appConfig.slug, slug));

    const scanInput = { name: row.name, spec: row.spec, permissions: row.permissions };
    const scan =
      row.type === "hosted"
        ? await scanHostedApp(env, slug, scanInput)
        : await scanDeclarativeSpec(env, scanInput);

    if (!scan.allowed) {
      const [blocked] = await db
        .update(schema.appConfig)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(schema.appConfig.slug, slug))
        .returning();
      await writeAuditLogSafe(db, {
        crmUserId: authz.crmUser.id,
        organizationId: orgId,
        action: "app_config.scan_failed",
        entityType: "app_config",
        entityId: row.id,
        metadata: { slug, risk: scan.risk, reasons: scan.reasons },
      });
      notifyAppsListChanged();
      return c.json({ ok: false, status: blocked?.status ?? "suspended", scan }, 200);
    }

    const [active] = await db
      .update(schema.appConfig)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(schema.appConfig.slug, slug))
      .returning();
    await writeAuditLogSafe(db, {
      crmUserId: authz.crmUser.id,
      organizationId: orgId,
      action: "app_config.published",
      entityType: "app_config",
      entityId: row.id,
      metadata: { slug, risk: scan.risk, scanSource: scan.source },
    });
    notifyAppsListChanged();
    return c.json({ ok: true, status: "active", app: active, scan });
  });

  return app;
}

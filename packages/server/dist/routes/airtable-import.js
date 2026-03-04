import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";
/**
 * Hono proxy for NocoDB's Airtable import API.
 *
 * Validates the Better Auth session, then forwards requests to NocoDB's
 * sync endpoints. This keeps the NocoDB API token and Airtable credentials
 * on the server side.
 *
 * Flow:
 *   1. POST /api/airtable-import/sync     — Create sync source
 *   2. POST /api/airtable-import/trigger   — Trigger import job
 *   3. GET  /api/airtable-import/status/:id — Check job status
 *   4. POST /api/airtable-import/abort/:id  — Abort import
 */
export function createAirtableImportRoutes(db, auth, env) {
    const app = new Hono();
    app.use("*", authMiddleware(auth, db));
    /** Proxy helper: forward request to NocoDB API */
    async function nocoProxy(path, method, body) {
        const url = `${env.NOCODB_BASE_URL}${path}`;
        const res = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "xc-token": env.NOCODB_API_TOKEN,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { "Content-Type": "application/json" },
        });
    }
    /**
     * Create a sync source for Airtable import.
     * Expects: { baseId: string, airtableKey: string, airtableUrl?: string, options?: {...} }
     *
     * NOTE: `baseId` here is the Airtable base ID (appXXX). The NocoDB base ID
     * comes from env.NOCODB_BASE_ID — that's the NocoDB base where imported
     * tables are created.
     */
    app.post("/sync", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        if (!env.NOCODB_BASE_ID) {
            return c.json({ error: "NOCODB_BASE_ID not configured" }, 503);
        }
        const body = await c.req.json();
        if (!body.baseId || !body.airtableKey) {
            return c.json({ error: "baseId and airtableKey are required" }, 400);
        }
        const syncBody = {
            type: "Airtable",
            details: {
                apiKey: body.airtableKey,
                shareId: body.airtableUrl ?? body.baseId,
                syncData: body.options?.syncData ?? true,
                syncViews: body.options?.syncViews ?? false,
                syncAttachment: body.options?.syncAttachment ?? false,
                syncLookup: body.options?.syncLookup ?? false,
                syncRollup: body.options?.syncRollup ?? false,
                syncFormula: body.options?.syncFormula ?? false,
                syncUsers: body.options?.syncUsers ?? false,
            },
        };
        // Use the NocoDB base ID, not the Airtable base ID
        return nocoProxy(`/api/v2/meta/bases/${env.NOCODB_BASE_ID}/syncs`, "POST", syncBody);
    });
    /**
     * Trigger an import job for a previously created sync source.
     * Expects: { syncId: string }
     */
    app.post("/trigger", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        const { syncId } = await c.req.json();
        if (!syncId) {
            return c.json({ error: "syncId is required" }, 400);
        }
        return nocoProxy(`/api/v2/meta/syncs/${syncId}/trigger`, "POST");
    });
    /**
     * Get import job status.
     */
    app.get("/status/:syncId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        const syncId = c.req.param("syncId");
        return nocoProxy(`/api/v2/meta/syncs/${syncId}`, "GET");
    });
    /**
     * Abort a running import.
     */
    app.post("/abort/:syncId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        const syncId = c.req.param("syncId");
        return nocoProxy(`/api/v2/meta/syncs/${syncId}/abort`, "POST");
    });
    return app;
}

import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { resolveOrgAiConfig, buildGatewayHeaders, } from "@/lib/org-ai-config.js";
export function createConnectionsRoutes(db, auth, env) {
    const app = new Hono();
    /** Extract Better Auth user ID from session */
    const getUserId = (c) => {
        const session = c.get("session");
        return session.user.id;
    };
    app.get("/", authMiddleware(auth, db), async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const aiResult = await resolveOrgAiConfig(c, db, env);
        if (!aiResult.ok)
            return c.json([]);
        const headers = buildGatewayHeaders(aiResult.data.aiConfig);
        headers["X-User-Id"] = getUserId(c);
        const res = await fetch(`${env.BASICSOS_API_URL}/v1/connections`, {
            headers,
        });
        if (!res.ok)
            return c.json([]);
        return c.json(await res.json());
    });
    app.get("/:provider/authorize", authMiddleware(auth, db), async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const aiResult = await resolveOrgAiConfig(c, db, env);
        if (!aiResult.ok)
            return aiResult.response;
        const headers = buildGatewayHeaders(aiResult.data.aiConfig);
        headers["X-User-Id"] = getUserId(c);
        const provider = c.req.param("provider");
        const redirectAfter = encodeURIComponent(`${env.BETTER_AUTH_URL}/connections`);
        const res = await fetch(`${env.BASICSOS_API_URL}/v1/connections/${provider}/authorize?redirect_after=${redirectAfter}`, { headers });
        if (!res.ok) {
            const text = await res.text();
            return c.json({ error: text }, 400);
        }
        const { url } = (await res.json());
        return c.json({ url });
    });
    app.delete("/:provider", authMiddleware(auth, db), async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const aiResult = await resolveOrgAiConfig(c, db, env);
        if (!aiResult.ok)
            return aiResult.response;
        const headers = buildGatewayHeaders(aiResult.data.aiConfig);
        headers["X-User-Id"] = getUserId(c);
        const provider = c.req.param("provider");
        const res = await fetch(`${env.BASICSOS_API_URL}/v1/connections/${provider}`, {
            method: "DELETE",
            headers,
        });
        if (!res.ok)
            return c.json({ error: "Failed to delete connection" }, 500);
        return c.json({ ok: true });
    });
    return app;
}

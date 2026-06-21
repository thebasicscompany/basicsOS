import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import {
  resolveOrgAiConfig,
  buildGatewayHeaders,
} from "@/lib/org-ai-config.js";
import type { createAuth } from "@/auth.js";

type Auth = ReturnType<typeof createAuth>;

export function createConnectionsRoutes(db: Db, auth: Auth, env: Env) {
  const app = new Hono();

  /** Extract Better Auth user ID from session */
  const getUserId = (c: any): string => {
    const session = c.get("session") as { user?: { id?: string } } | undefined;
    return session!.user!.id!;
  };

  /**
   * Headers (Basics key + acting user) for gateway calls. The acting user MUST
   * be the integer crmUserId (the same identity the agent/Broker uses), NOT the
   * Better Auth UUID — otherwise the Composio entity (`${tenant}:${userId}`)
   * differs and the UI can't see connections the agent made (and vice-versa).
   */
  const gwHeaders = async (c: any, crmUserId?: number): Promise<Record<string, string> | null> => {
    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return null;
    const headers = buildGatewayHeaders(aiResult.data.aiConfig);
    if (crmUserId != null) headers["X-User-Id"] = String(crmUserId);
    return headers;
  };

  // ── Composio (current) ──────────────────────────────────────────────────
  // The connectable app catalog (all provisioned Composio apps).
  app.get("/catalog", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const headers = await gwHeaders(c);
    if (!headers) return c.json({ apps: [] });
    const res = await fetch(`${env.BASICSOS_API_URL}/v1/composio/catalog`, { headers });
    return c.json(res.ok ? await res.json() : { apps: [] });
  });

  // Which apps the current user (and org) has connected.
  app.get("/status", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const headers = await gwHeaders(c, authz.crmUser.id);
    if (!headers) return c.json({ apps: [] });
    const res = await fetch(`${env.BASICSOS_API_URL}/v1/composio/connections`, { headers });
    return c.json(res.ok ? await res.json() : { apps: [] });
  });

  // Start an OAuth connection for an app; returns { url } to open.
  app.post("/:provider/connect", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const headers = await gwHeaders(c, authz.crmUser.id);
    if (!headers) return c.json({ error: "Not configured" }, 400);
    const res = await fetch(`${env.BASICSOS_API_URL}/v1/composio/connect`, {
      method: "POST",
      headers,
      body: JSON.stringify({ app: c.req.param("provider") }),
    });
    if (!res.ok) return c.json({ error: await res.text() }, 400);
    const { authUrl } = (await res.json()) as { authUrl?: string };
    return c.json({ url: authUrl });
  });

  // ── Legacy hand-rolled OAuth (kept for onboarding/help until migrated) ────
  app.get("/", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return c.json([]);
    const headers = buildGatewayHeaders(aiResult.data.aiConfig);
    headers["X-User-Id"] = getUserId(c);

    const res = await fetch(`${env.BASICSOS_API_URL}/v1/connections`, {
      headers,
    });
    if (!res.ok) return c.json([]);
    return c.json(await res.json());
  });

  app.get("/:provider/authorize", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return aiResult.response;
    const headers = buildGatewayHeaders(aiResult.data.aiConfig);
    headers["X-User-Id"] = getUserId(c);

    const provider = c.req.param("provider");
    // Default: basicsos.com/connections/success?provider=slack|google — that page should say "Connected. You can close this tab and return to your app."
    const successBase =
      env.CONNECTIONS_SUCCESS_URL ?? "https://basicsos.com/connections/success";
    const apiHost = new URL(env.BASICSOS_API_URL).host;
    const useFrontendRedirect =
      env.FRONTEND_URL &&
      new URL(env.FRONTEND_URL).host !== apiHost &&
      !env.FRONTEND_URL.startsWith(env.BASICSOS_API_URL);
    const redirectUrl = useFrontendRedirect
      ? `${env.FRONTEND_URL}/connections?connected=${provider}`
      : `${successBase}?provider=${provider}`;
    const redirectAfter = encodeURIComponent(redirectUrl);
    const res = await fetch(
      `${env.BASICSOS_API_URL}/v1/connections/${provider}/authorize?redirect_after=${redirectAfter}`,
      { headers },
    );

    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, 400);
    }

    const { url } = (await res.json()) as { url: string };
    return c.json({ url });
  });

  app.delete("/:provider", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return aiResult.response;
    const headers = buildGatewayHeaders(aiResult.data.aiConfig);
    headers["X-User-Id"] = getUserId(c);

    const provider = c.req.param("provider");
    const res = await fetch(
      `${env.BASICSOS_API_URL}/v1/connections/${provider}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!res.ok) return c.json({ error: "Failed to delete connection" }, 500);
    return c.json({ ok: true });
  });

  return app;
}

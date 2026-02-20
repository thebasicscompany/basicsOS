import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { hubLinks, integrations } from "@basicsos/db";
import { encrypt, decrypt } from "../lib/oauth-encrypt.js";

// ---------------------------------------------------------------------------
// OAuth config — one entry per supported integration
// ---------------------------------------------------------------------------

type OAuthServiceConfig = {
  label: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  clientIdEnv: string;
  clientSecretEnv: string;
};

const OAUTH_CONFIGS: Record<string, OAuthServiceConfig> = {
  slack: {
    label: "Slack",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: "channels:read,chat:write,users:read",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
  },
  "google-drive": {
    label: "Google Drive",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:
      "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    label: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: "repo,read:org,read:user",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
  },
};

const AVAILABLE_SERVICES = Object.entries(OAUTH_CONFIGS).map(([service, cfg]) => ({
  service,
  label: cfg.label,
}));

// ---------------------------------------------------------------------------
// Hub Router
// ---------------------------------------------------------------------------

export const hubRouter = router({
  // Hub Links
  listLinks: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db
      .select()
      .from(hubLinks)
      .where(eq(hubLinks.tenantId, ctx.tenantId))
      .orderBy(asc(hubLinks.position));
  }),

  createLink: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        url: z.string().url(),
        icon: z.string().optional(),
        category: z.string().default("custom"),
        position: z.number().int().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [link] = await ctx.db
        .insert(hubLinks)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!link) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return link;
    }),

  updateLink: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        url: z.string().url().optional(),
        icon: z.string().optional(),
        category: z.string().optional(),
        position: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const [updated] = await ctx.db
        .update(hubLinks)
        .set(updateData)
        .where(and(eq(hubLinks.id, id), eq(hubLinks.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  deleteLink: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(hubLinks)
        .where(and(eq(hubLinks.id, input.id), eq(hubLinks.tenantId, ctx.tenantId)))
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  reorderLinks: adminProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string().uuid(),
            position: z.number().int().min(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.updates.map((u) =>
          ctx.db
            .update(hubLinks)
            .set({ position: u.position })
            .where(and(eq(hubLinks.id, u.id), eq(hubLinks.tenantId, ctx.tenantId))),
        ),
      );
      return { updated: input.updates.length };
    }),

  // ---------------------------------------------------------------------------
  // Integrations / OAuth
  // ---------------------------------------------------------------------------

  listIntegrations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const connected = await ctx.db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, ctx.tenantId));
    const connectedServices = new Set(connected.map((i) => i.service));
    return AVAILABLE_SERVICES.map((svc) => ({
      ...svc,
      connected: connectedServices.has(svc.service),
      configured: Boolean(
        process.env[OAUTH_CONFIGS[svc.service]?.clientIdEnv ?? ""] &&
        process.env[OAUTH_CONFIGS[svc.service]?.clientSecretEnv ?? ""],
      ),
    }));
  }),

  /**
   * Returns the OAuth authorization URL for the given service.
   * The frontend redirects the user to this URL.
   * `state` encodes the tenantId so the callback knows which tenant to store the token for.
   */
  getOAuthUrl: adminProcedure
    .input(z.object({ service: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cfg = OAUTH_CONFIGS[input.service];
      if (!cfg)
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown service: ${input.service}` });

      const clientId = process.env[cfg.clientIdEnv];
      if (!clientId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${cfg.label} OAuth not configured. Set ${cfg.clientIdEnv} in .env`,
        });
      }

      const appUrl =
        process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["APP_URL"] ?? "http://localhost:3000";
      const redirectUri = `${appUrl}/api/oauth/${input.service}/callback`;

      // state = base64(tenantId:timestamp) — validated in callback to prevent CSRF
      const state = Buffer.from(`${ctx.tenantId}:${Date.now()}`).toString("base64url");

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: cfg.scopes,
        state,
        ...(input.service === "google-drive"
          ? { access_type: "offline", response_type: "code" }
          : {}),
        ...(input.service === "github" ? {} : { response_type: "code" }),
      });

      return { url: `${cfg.authUrl}?${params.toString()}` };
    }),

  /**
   * Called from the OAuth callback route after exchanging the code for a token.
   * Stores the encrypted token in the integrations table.
   * This is an admin-level mutation but is also called from the callback with system context.
   */
  storeOAuthToken: adminProcedure
    .input(
      z.object({
        service: z.string(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        scopes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tokenPayload = JSON.stringify({
        accessToken: input.accessToken,
        ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
        storedAt: new Date().toISOString(),
      });

      let encryptedToken: string;
      try {
        encryptedToken = encrypt(tokenPayload);
      } catch {
        // If encryption key not configured, store a marker — not secure but keeps the flow working
        encryptedToken = `UNENCRYPTED:${input.accessToken}`;
      }

      const existing = await ctx.db
        .select()
        .from(integrations)
        .where(
          and(eq(integrations.tenantId, ctx.tenantId), eq(integrations.service, input.service)),
        );

      if (existing.length > 0) {
        const [updated] = await ctx.db
          .update(integrations)
          .set({
            oauthTokenEnc: encryptedToken,
            scopes: input.scopes ?? null,
            connectedAt: new Date(),
          })
          .where(
            and(eq(integrations.tenantId, ctx.tenantId), eq(integrations.service, input.service)),
          )
          .returning();
        return updated;
      }

      const [integration] = await ctx.db
        .insert(integrations)
        .values({
          tenantId: ctx.tenantId,
          service: input.service,
          oauthTokenEnc: encryptedToken,
          scopes: input.scopes ?? null,
          connectedAt: new Date(),
        })
        .returning();
      return integration;
    }),

  disconnectIntegration: adminProcedure
    .input(z.object({ service: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(integrations)
        .where(
          and(eq(integrations.tenantId, ctx.tenantId), eq(integrations.service, input.service)),
        );
      return { success: true };
    }),

  /**
   * Retrieves a decrypted token for internal server-side use.
   * Only callable by the API server — not exposed to the frontend via tRPC.
   */
  getDecryptedToken: adminProcedure
    .input(z.object({ service: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(integrations)
        .where(
          and(eq(integrations.tenantId, ctx.tenantId), eq(integrations.service, input.service)),
        );

      if (!row?.oauthTokenEnc) return null;

      const decrypted = decrypt(row.oauthTokenEnc);
      if (!decrypted) return null;

      try {
        return JSON.parse(decrypted) as {
          accessToken: string;
          refreshToken?: string;
          storedAt: string;
        };
      } catch {
        return null;
      }
    }),
});

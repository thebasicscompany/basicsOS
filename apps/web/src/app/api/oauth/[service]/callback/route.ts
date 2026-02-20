export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@basicsos/db";
import { integrations } from "@basicsos/db";
import { and, eq } from "drizzle-orm";
import { createCipheriv, randomBytes } from "node:crypto";

// GET /api/oauth/[service]/callback
// Handles the OAuth 2.0 authorization code exchange for Slack, Google Drive, and GitHub.
// The state parameter carries base64url(tenantId:timestamp) set by hub.getOAuthUrl.

type OAuthConfig = {
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  isJsonResponse: boolean;
};

const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  slack: {
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    isJsonResponse: true,
  },
  "google-drive": {
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    isJsonResponse: true,
  },
  github: {
    tokenUrl: "https://github.com/login/oauth/access_token",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    isJsonResponse: false,
  },
};

// Simple AES-256-GCM encryption — mirrors packages/api/src/lib/oauth-encrypt.ts
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

const encryptToken = (plaintext: string): string => {
  const hexKey = process.env["OAUTH_ENCRYPTION_KEY"] ?? "";
  if (hexKey.length !== 64) return `UNENCRYPTED:${plaintext}`;
  const key = Buffer.from(hexKey, "hex");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
};

const storeToken = async (
  tenantId: string,
  service: string,
  accessToken: string,
  refreshToken: string | undefined,
  scopes: string | undefined,
): Promise<void> => {
  const payload = JSON.stringify({
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    storedAt: new Date().toISOString(),
  });
  const encryptedToken = encryptToken(payload);

  const existing = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.service, service)));

  if (existing.length > 0) {
    await db
      .update(integrations)
      .set({ oauthTokenEnc: encryptedToken, scopes: scopes ?? null, connectedAt: new Date() })
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.service, service)));
  } else {
    await db.insert(integrations).values({
      tenantId,
      service,
      oauthTokenEnc: encryptedToken,
      scopes: scopes ?? null,
      connectedAt: new Date(),
    });
  }
};

type RouteParams = { params: Promise<{ service: string }> };

export const GET = async (req: NextRequest, { params }: RouteParams): Promise<NextResponse> => {
  const { service } = await params;
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["APP_URL"] ?? "http://localhost:3000";
  const hubUrl = `${appUrl}/hub`;

  if (errorParam) {
    console.error(`[oauth-callback] ${service} returned error: ${errorParam}`);
    return NextResponse.redirect(`${hubUrl}?oauth_error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${hubUrl}?oauth_error=missing_params`);
  }

  const cfg = OAUTH_CONFIGS[service];
  if (!cfg) return NextResponse.redirect(`${hubUrl}?oauth_error=unknown_service`);

  // Decode state to extract tenantId (format: base64url(tenantId:timestamp))
  let tenantId: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const colonIdx = decoded.indexOf(":");
    tenantId = decoded.slice(0, colonIdx);
    if (!tenantId) throw new Error("empty tenantId");
  } catch {
    return NextResponse.redirect(`${hubUrl}?oauth_error=invalid_state`);
  }

  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${hubUrl}?oauth_error=not_configured`);
  }

  const redirectUri = `${appUrl}/api/oauth/${service}/callback`;

  try {
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    type TokenResponse = {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      ok?: boolean;
      error?: string;
      authed_user?: { access_token?: string };
    };

    let tokenData: TokenResponse;
    if (cfg.isJsonResponse) {
      tokenData = (await tokenRes.json()) as TokenResponse;
    } else {
      const text = await tokenRes.text();
      tokenData = Object.fromEntries(new URLSearchParams(text).entries()) as TokenResponse;
    }

    // Slack wraps the user token inside authed_user
    const accessToken =
      service === "slack"
        ? (tokenData.authed_user?.access_token ?? tokenData.access_token)
        : tokenData.access_token;

    if (!accessToken || tokenData.error) {
      const errMsg = tokenData.error ?? "no_access_token";
      console.error(`[oauth-callback] ${service} token exchange failed:`, errMsg);
      return NextResponse.redirect(`${hubUrl}?oauth_error=${encodeURIComponent(errMsg)}`);
    }

    await storeToken(tenantId, service, accessToken, tokenData.refresh_token, tokenData.scope);

    return NextResponse.redirect(`${hubUrl}?oauth_success=${service}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[oauth-callback] ${service} error:`, message);
    return NextResponse.redirect(`${hubUrl}?oauth_error=server_error`);
  }
};

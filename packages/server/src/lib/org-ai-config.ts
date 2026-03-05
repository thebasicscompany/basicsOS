import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";

export type AiKeyConfig = {
  keyType: "basicsos" | "byok";
  apiKey: string;
  byokProvider?: string | null;
};

/** When set, gateway uses this for STT (e.g. Deepgram). */
export type TranscriptionByokConfig = {
  provider: string;
  apiKey: string;
};

export type OrgAiResolution = {
  crmUser: typeof schema.crmUsers.$inferSelect;
  aiConfig: AiKeyConfig;
  /** Optional transcription BYOK (e.g. Deepgram). When set, use for /v1/audio/transcriptions. */
  transcriptionByok: TranscriptionByokConfig | null;
};

type OrgAiResult =
  | { ok: true; data: OrgAiResolution }
  | { ok: false; response: Response };

/**
 * Resolves the org-level AI config for the authenticated user.
 * Priority: org_ai_config table → env vars → error.
 */
export async function resolveOrgAiConfig(
  c: Context,
  db: Db,
  env: Env,
): Promise<OrgAiResult> {
  const session = c.get("session") as { user?: { id?: string } } | undefined;
  const userId = session?.user?.id;

  if (!userId) {
    return { ok: false, response: c.json({ error: "Unauthorized" }, 401) };
  }

  const [crmUser] = await db
    .select()
    .from(schema.crmUsers)
    .where(eq(schema.crmUsers.userId, userId))
    .limit(1);

  if (!crmUser) {
    return {
      ok: false,
      response: c.json({ error: "User not found in CRM" }, 404),
    };
  }

  if (!crmUser.organizationId) {
    return {
      ok: false,
      response: c.json({ error: "Organization not found" }, 404),
    };
  }

  const [orgConfig] = await db
    .select()
    .from(schema.orgAiConfig)
    .where(eq(schema.orgAiConfig.organizationId, crmUser.organizationId))
    .limit(1);

  if (orgConfig?.apiKeyEnc) {
    const decrypted = decryptApiKey(orgConfig.apiKeyEnc);
    if (decrypted) {
      let transcriptionByok: TranscriptionByokConfig | null = null;
      if (
        orgConfig.transcriptionByokProvider &&
        orgConfig.transcriptionApiKeyEnc
      ) {
        const transKey = decryptApiKey(orgConfig.transcriptionApiKeyEnc);
        if (transKey) {
          transcriptionByok = {
            provider: orgConfig.transcriptionByokProvider,
            apiKey: transKey,
          };
        }
      }
      if (
        !transcriptionByok &&
        env.SERVER_TRANSCRIPTION_BYOK_PROVIDER &&
        env.SERVER_TRANSCRIPTION_BYOK_API_KEY
      ) {
        transcriptionByok = {
          provider: env.SERVER_TRANSCRIPTION_BYOK_PROVIDER,
          apiKey: env.SERVER_TRANSCRIPTION_BYOK_API_KEY,
        };
      }
      return {
        ok: true,
        data: {
          crmUser,
          aiConfig: {
            keyType: orgConfig.keyType as "basicsos" | "byok",
            apiKey: decrypted,
            byokProvider: orgConfig.byokProvider,
          },
          transcriptionByok,
        },
      };
    }
  }

  // Fallback to env vars
  let transcriptionByok: TranscriptionByokConfig | null = null;
  if (
    env.SERVER_TRANSCRIPTION_BYOK_PROVIDER &&
    env.SERVER_TRANSCRIPTION_BYOK_API_KEY
  ) {
    transcriptionByok = {
      provider: env.SERVER_TRANSCRIPTION_BYOK_PROVIDER,
      apiKey: env.SERVER_TRANSCRIPTION_BYOK_API_KEY,
    };
  }

  if (env.SERVER_BASICS_API_KEY) {
    return {
      ok: true,
      data: {
        crmUser,
        aiConfig: {
          keyType: "basicsos",
          apiKey: env.SERVER_BASICS_API_KEY,
        },
        transcriptionByok,
      },
    };
  }

  if (env.SERVER_BYOK_PROVIDER && env.SERVER_BYOK_API_KEY) {
    return {
      ok: true,
      data: {
        crmUser,
        aiConfig: {
          keyType: "byok",
          apiKey: env.SERVER_BYOK_API_KEY,
          byokProvider: env.SERVER_BYOK_PROVIDER,
        },
        transcriptionByok,
      },
    };
  }

  return {
    ok: false,
    response: c.json(
      {
        error:
          "AI is not configured. An administrator must set up API keys in Settings.",
      },
      400,
    ),
  };
}

/**
 * Builds the headers for the AI gateway request based on key type.
 * - BasicOS key: Authorization: Bearer <bos_live_sk_...>
 * - BYOK: x-byok-provider + x-byok-api-key headers only (no Authorization needed per gateway docs)
 */
export function buildGatewayHeaders(config: AiKeyConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.keyType === "byok" && config.byokProvider) {
    headers["x-byok-provider"] = config.byokProvider;
    headers["x-byok-api-key"] = config.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return headers;
}

/**
 * Builds headers for transcription requests. When transcriptionByok is set,
 * adds x-byok-transcription-provider and x-byok-transcription-api-key so the
 * gateway can use the org's Deepgram (or other) key for STT.
 */
export function buildTranscriptionHeaders(
  baseHeaders: Record<string, string>,
  transcriptionByok: TranscriptionByokConfig | null,
): Record<string, string> {
  if (!transcriptionByok) return baseHeaders;
  return {
    ...baseHeaders,
    "x-byok-transcription-provider": transcriptionByok.provider,
    "x-byok-transcription-api-key": transcriptionByok.apiKey,
  };
}

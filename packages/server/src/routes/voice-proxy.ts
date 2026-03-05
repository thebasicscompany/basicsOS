/**
 * Voice proxy routes — BFF layer for the pill overlay.
 * Session auth → lookup basicsApiKey → proxy to basicsAdmin with request/response transformation.
 */

import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import {
  resolveOrgAiConfig,
  buildGatewayHeaders,
  buildTranscriptionHeaders,
} from "@/lib/org-ai-config.js";
import { writeUsageLogSafe } from "@/lib/usage-log.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import {
  transcriptionsPostSchema,
  speechPostSchema,
} from "@/schemas/voice-proxy.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

type DeepgramAlternative = {
  transcript?: string;
  confidence?: number;
};
type DeepgramChannel = {
  alternatives?: DeepgramAlternative[];
};
type TranscriptionResult = {
  /** OpenAI-compatible top-level field */
  text?: string;
  /** Simplified top-level field */
  transcript?: string;
  /** Deepgram native format (api.basicsos.com returns this) */
  results?: { channels?: DeepgramChannel[] };
};

export function createVoiceProxyRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
) {
  const app = new Hono();

  app.post("/transcriptions", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return aiResult.response;
    const { crmUser, aiConfig, transcriptionByok } = aiResult.data;
    const gatewayHeaders = buildGatewayHeaders(aiConfig);
    const transcriptionHeaders = buildTranscriptionHeaders(
      gatewayHeaders,
      transcriptionByok,
    );

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = transcriptionsPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const { audio, mime_type } = parsed.data;

    // Decode base64 audio and send as multipart/form-data (gateway expects `file` field)
    const audioBuffer = Buffer.from(audio, "base64");
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioBuffer], { type: mime_type }),
      `audio.webm`,
    );

    // Strip Content-Type so fetch can set the multipart boundary automatically
    const { "Content-Type": _ct, ...headersWithoutContentType } =
      transcriptionHeaders;

    const requestStart = Date.now();
    const abortCtl = new AbortController();
    const abortTimer = setTimeout(() => abortCtl.abort(), 20_000);
    let proxyRes: Response;
    try {
      proxyRes = await fetch(
        `${env.BASICSOS_API_URL}/v1/audio/transcriptions`,
        {
          method: "POST",
          headers: headersWithoutContentType,
          body: formData,
          signal: abortCtl.signal,
        },
      );
    } catch (fetchErr) {
      clearTimeout(abortTimer);
      const isTimeout =
        fetchErr instanceof Error && fetchErr.name === "AbortError";
      console.error(
        "[voice-proxy] transcriptions fetch failed:",
        isTimeout ? "timed out after 20s" : fetchErr,
      );
      return c.json(
        { error: isTimeout ? "Transcription timed out" : "Transcription failed" },
        isTimeout ? 504 : 502,
      );
    }
    clearTimeout(abortTimer);

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => "");
      console.error(
        "[voice-proxy] transcriptions error:",
        proxyRes.status,
        errText,
      );
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: proxyRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const providerJson = (await proxyRes.json()) as TranscriptionResult;
    const transcript =
      providerJson.text ??
      providerJson.transcript ??
      providerJson.results?.channels?.[0]?.alternatives?.[0]?.transcript ??
      "";

    if (crmUser.organizationId) {
      writeUsageLogSafe(db, {
        organizationId: crmUser.organizationId,
        crmUserId: crmUser.id,
        feature: "voice_transcription",
        durationMs: Date.now() - requestStart,
      });
    }

    return c.json({ transcript });
  });

  app.post("/speech", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return aiResult.response;
    const { crmUser, aiConfig } = aiResult.data;
    const gatewayHeaders = buildGatewayHeaders(aiConfig);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = speechPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const { text } = parsed.data;

    const requestStart = Date.now();
    const speechAbort = new AbortController();
    const speechTimer = setTimeout(() => speechAbort.abort(), 15_000);
    let proxyRes: Response;
    try {
      proxyRes = await fetch(`${env.BASICSOS_API_URL}/v1/audio/speech`, {
        method: "POST",
        headers: gatewayHeaders,
        body: JSON.stringify({
          model: "basics-tts",
          input: text,
        }),
        signal: speechAbort.signal,
      });
    } catch (fetchErr) {
      clearTimeout(speechTimer);
      const isTimeout =
        fetchErr instanceof Error && fetchErr.name === "AbortError";
      console.error(
        "[voice-proxy] speech fetch failed:",
        isTimeout ? "timed out after 15s" : fetchErr,
      );
      return c.json(
        { error: isTimeout ? "TTS timed out" : "TTS failed" },
        isTimeout ? 504 : 502,
      );
    }
    clearTimeout(speechTimer);

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => "");
      console.error("[voice-proxy] speech error:", proxyRes.status, errText);
      return new Response(JSON.stringify({ error: "TTS failed" }), {
        status: proxyRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await proxyRes.arrayBuffer();
    const contentType = proxyRes.headers.get("content-type") ?? "audio/mpeg";

    if (crmUser.organizationId) {
      writeUsageLogSafe(db, {
        organizationId: crmUser.organizationId,
        crmUserId: crmUser.id,
        feature: "voice_speech",
        durationMs: Date.now() - requestStart,
      });
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  });

  return app;
}

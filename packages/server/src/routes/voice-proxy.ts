/**
 * Voice proxy routes — BFF layer for the pill overlay.
 * Session auth → lookup basicsApiKey → proxy to basicsAdmin with request/response transformation.
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import * as schema from "../db/schema/index.js";
import { eq } from "drizzle-orm";

type BetterAuthInstance = ReturnType<typeof createAuth>;

type DeepgramTranscriptionResult = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string }>;
    }>;
  };
};

export function createVoiceProxyRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env
) {
  const app = new Hono();

  app.post("/transcriptions", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);

    const sale = salesRow[0];
    if (!sale) {
      return c.json({ error: "User not found in CRM" }, 404);
    }

    const apiKey =
      c.req.header("X-Basics-API-Key")?.trim() || sale.basicsApiKey;
    if (!apiKey) {
      return c.json(
        { error: "Basics API key not configured. Add your key in Settings." },
        400
      );
    }

    let body: { audio?: string; mime_type?: string };
    try {
      body = (await c.req.json()) as { audio?: string; mime_type?: string };
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.audio) {
      return c.json({ error: "audio (base64) is required" }, 400);
    }

    const proxyRes = await fetch(`${env.BASICOS_API_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        audio: body.audio,
        mime_type: body.mime_type ?? "audio/webm",
      }),
    });

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => "");
      console.error("[voice-proxy] transcriptions error:", proxyRes.status, errText);
      return c.json({ error: "Transcription failed" }, proxyRes.status);
    }

    const providerJson = (await proxyRes.json()) as DeepgramTranscriptionResult;
    const transcript =
      providerJson.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    return c.json({ transcript });
  });

  app.post("/speech", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);

    const sale = salesRow[0];
    if (!sale) {
      return c.json({ error: "User not found in CRM" }, 404);
    }

    const apiKey =
      c.req.header("X-Basics-API-Key")?.trim() || sale.basicsApiKey;
    if (!apiKey) {
      return c.json(
        { error: "Basics API key not configured. Add your key in Settings." },
        400
      );
    }

    let body: { text?: string };
    try {
      body = (await c.req.json()) as { text?: string };
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const text = body.text?.trim();
    if (!text) {
      return c.json({ error: "text is required" }, 400);
    }

    const proxyRes = await fetch(`${env.BASICOS_API_URL}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "basics-tts",
        input: text,
      }),
    });

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => "");
      console.error("[voice-proxy] speech error:", proxyRes.status, errText);
      return c.json({ error: "TTS failed" }, proxyRes.status);
    }

    const audioBuffer = await proxyRes.arrayBuffer();
    const contentType = proxyRes.headers.get("content-type") ?? "audio/mpeg";

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  });

  return app;
}

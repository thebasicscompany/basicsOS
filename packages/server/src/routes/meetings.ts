import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import {
  resolveOrgAiConfig,
  buildGatewayHeaders,
} from "@/lib/org-ai-config.js";
import {
  embedMeetingTranscript,
  deleteMeetingEmbeddings,
} from "@/lib/meeting-embeddings.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createMeetingsRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
) {
  const app = new Hono();

  app.use("*", authMiddleware(auth, db));

  // Helper to get crmUser for the current session
  const getCrmUser = async (c: { get: (k: string) => unknown }) => {
    const session = c.get("session") as { user?: { id?: string } } | undefined;
    const userId = session?.user?.id;
    if (!userId) return null;

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    return crmUser ?? null;
  };

  // POST /api/meetings — Create a new meeting
  app.post("/", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const [meeting] = await db
      .insert(schema.meetings)
      .values({
        organizationId: crmUser.organizationId,
        crmUserId: crmUser.id,
        status: "recording",
        startedAt: new Date(),
      })
      .returning();

    return c.json(meeting, 201);
  });

  // GET /api/meetings — List meetings
  app.get("/", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);
    if (!crmUser.organizationId)
      return c.json({ error: "No organization" }, 400);

    const page = parseInt(c.req.query("page") ?? "1", 10);
    const perPage = Math.min(parseInt(c.req.query("perPage") ?? "25", 10), 100);
    const offset = (page - 1) * perPage;

    const rows = await db
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.organizationId, crmUser.organizationId))
      .orderBy(desc(schema.meetings.startedAt))
      .limit(perPage)
      .offset(offset);

    return c.json(rows);
  });

  // GET /api/meetings/:id — Get meeting with transcripts and summary
  app.get("/:id", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    const [meeting] = await db
      .select()
      .from(schema.meetings)
      .where(
        and(
          eq(schema.meetings.id, meetingId),
          eq(schema.meetings.organizationId, crmUser.organizationId!),
        ),
      )
      .limit(1);

    if (!meeting) return c.json({ error: "Meeting not found" }, 404);

    const transcripts = await db
      .select()
      .from(schema.meetingTranscripts)
      .where(eq(schema.meetingTranscripts.meetingId, meetingId))
      .orderBy(schema.meetingTranscripts.timestampMs);

    const [summary] = await db
      .select()
      .from(schema.meetingSummaries)
      .where(eq(schema.meetingSummaries.meetingId, meetingId))
      .limit(1);

    return c.json({ ...meeting, transcripts, summary: summary ?? null });
  });

  // POST /api/meetings/:id/transcript — Upload transcript segments
  app.post("/:id/transcript", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    // Verify meeting belongs to user's org
    const [meeting] = await db
      .select()
      .from(schema.meetings)
      .where(
        and(
          eq(schema.meetings.id, meetingId),
          eq(schema.meetings.organizationId, crmUser.organizationId!),
        ),
      )
      .limit(1);

    if (!meeting) return c.json({ error: "Meeting not found" }, 404);

    const body = await c.req.json<{
      segments?: Array<{
        speaker?: string;
        text?: string;
        timestampMs?: number;
      }>;
      text?: string;
    }>();

    console.warn(`[meetings] POST /${meetingId}/transcript — body.segments=${body.segments?.length ?? 0}, body.text length=${body.text?.length ?? 0}`);
    if (body.text) {
      const lines = body.text.split("\n").filter((l) => l.trim());
      console.warn(`[meetings] Text transcript has ${lines.length} lines. First 3:`, lines.slice(0, 3));
      console.warn(`[meetings] Last 3:`, lines.slice(-3));
    }

    // Support both structured segments and plain text
    if (body.segments && body.segments.length > 0) {
      console.warn(`[meetings] Saving ${body.segments.length} structured segments`);
      await db.insert(schema.meetingTranscripts).values(
        body.segments.map((seg) => ({
          meetingId,
          speaker: seg.speaker ?? null,
          text: seg.text ?? null,
          timestampMs: seg.timestampMs ?? null,
          organizationId: crmUser.organizationId,
        })),
      );
    } else if (body.text) {
      // Parse plain text transcript into segments
      const lines = body.text.split("\n").filter((l) => l.trim());
      const segments = lines.map((line) => {
        const match = line.match(/^(.+?):\s*(.+)$/);
        return {
          meetingId,
          speaker: match ? match[1] : null,
          text: match ? match[2] : line,
          timestampMs: null as number | null,
          organizationId: crmUser.organizationId,
        };
      });
      console.warn(`[meetings] Parsed ${segments.length} segments from text. Saving to DB...`);
      if (segments.length > 0) {
        await db.insert(schema.meetingTranscripts).values(segments);
      }
      console.warn(`[meetings] Saved ${segments.length} segments to DB`);
    } else {
      console.warn(`[meetings] WARNING: No transcript data received!`);
    }

    // Update meeting status and end time
    const now = new Date();
    const duration = meeting.startedAt
      ? Math.round(
          (now.getTime() - new Date(meeting.startedAt).getTime()) / 1000,
        )
      : null;

    await db
      .update(schema.meetings)
      .set({
        status: "processing",
        endedAt: now,
        duration,
        updatedAt: now,
      })
      .where(eq(schema.meetings.id, meetingId));

    return c.json({ ok: true });
  });

  // POST /api/meetings/:id/process — LLM summarization
  app.post("/:id/process", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    const [meeting] = await db
      .select()
      .from(schema.meetings)
      .where(
        and(
          eq(schema.meetings.id, meetingId),
          eq(schema.meetings.organizationId, crmUser.organizationId!),
        ),
      )
      .limit(1);

    if (!meeting) return c.json({ error: "Meeting not found" }, 404);

    // Get transcript text
    const transcripts = await db
      .select()
      .from(schema.meetingTranscripts)
      .where(eq(schema.meetingTranscripts.meetingId, meetingId))
      .orderBy(schema.meetingTranscripts.timestampMs);

    const transcriptText = transcripts
      .map((t) => (t.speaker ? `${t.speaker}: ${t.text}` : t.text))
      .join("\n");

    if (!transcriptText.trim()) {
      await db
        .update(schema.meetings)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(schema.meetings.id, meetingId));
      return c.json({ ok: true, summary: null });
    }

    // Resolve AI config for LLM call
    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) {
      // Still mark as completed even if no AI config
      await db
        .update(schema.meetings)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(schema.meetings.id, meetingId));
      return c.json({ ok: true, summary: null });
    }

    const { aiConfig } = aiResult.data;
    const headers = buildGatewayHeaders(aiConfig);

    try {
      const res = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "basics-small",
          messages: [
            {
              role: "system",
              content: `You are a meeting summarizer. Analyze the transcript and return a JSON object with these fields:
- "title": a short meeting title (max 6 words, e.g. "Q1 Planning Review", "Product Demo Feedback")
- "note": a two-sentence summary of what was discussed

Return ONLY valid JSON, no markdown fences.`,
            },
            {
              role: "user",
              content: `Summarize this meeting transcript:\n\n${transcriptText.slice(0, 12000)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content ?? "";

        let summaryJson: {
          title?: string;
          note?: string;
        } = {};

        try {
          // Try to parse JSON from the response, stripping markdown fences if present
          const cleaned = content
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
          summaryJson = JSON.parse(cleaned);
        } catch {
          summaryJson = { note: content.slice(0, 2000) };
        }

        await db
          .insert(schema.meetingSummaries)
          .values({
            meetingId,
            summaryJson,
            organizationId: crmUser.organizationId,
          })
          .onConflictDoUpdate({
            target: schema.meetingSummaries.meetingId,
            set: { summaryJson, createdAt: new Date() },
          });

        await db
          .update(schema.meetings)
          .set({
            status: "completed",
            title: summaryJson.title?.slice(0, 100) ?? summaryJson.note?.slice(0, 60) ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.meetings.id, meetingId));

        // Fire-and-forget: embed transcript chunks + summary for RAG
        embedMeetingTranscript(db, env, crmUser, meetingId).catch(() => {});

        return c.json({ ok: true, summary: summaryJson });
      }
    } catch (err) {
      console.error("[meetings] LLM summarization failed:", err);
    }

    // Mark completed even if summarization fails — still embed transcript chunks
    await db
      .update(schema.meetings)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(schema.meetings.id, meetingId));

    // Even without a summary, embed the raw transcript chunks
    embedMeetingTranscript(db, env, crmUser, meetingId).catch(() => {});

    return c.json({ ok: true, summary: null });
  });

  // DELETE /api/meetings/:id
  app.delete("/:id", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    // Delete embeddings before meeting (FK cascade removes transcript rows)
    await deleteMeetingEmbeddings(db, crmUser.organizationId!, meetingId);

    await db
      .delete(schema.meetings)
      .where(
        and(
          eq(schema.meetings.id, meetingId),
          eq(schema.meetings.organizationId, crmUser.organizationId!),
        ),
      );

    return c.json({ ok: true });
  });

  return app;
}

import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
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

  // GET /api/meetings/by-record — Get meetings linked to a specific record
  app.get("/by-record", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const contactId = c.req.query("contactId")
      ? parseInt(c.req.query("contactId")!, 10)
      : undefined;

    if (!contactId) return c.json([]);

    const conditions = [
      eq(schema.meetingLinks.organizationId, crmUser.organizationId!),
    ];
    conditions.push(eq(schema.meetingLinks.contactId, contactId));

    const linkedMeetingIds = await db
      .select({ meetingId: schema.meetingLinks.meetingId })
      .from(schema.meetingLinks)
      .where(and(...conditions));

    if (linkedMeetingIds.length === 0) return c.json([]);

    const ids = linkedMeetingIds.map((l) => l.meetingId);
    const meetings = await db
      .select()
      .from(schema.meetings)
      .where(
        sql`${schema.meetings.id} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(desc(schema.meetings.startedAt));

    // Also fetch summaries for each meeting
    const summaries = await db
      .select()
      .from(schema.meetingSummaries)
      .where(
        sql`${schema.meetingSummaries.meetingId} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const summaryMap = new Map(summaries.map((s) => [s.meetingId, s]));

    return c.json(
      meetings.map((m) => ({ ...m, summary: summaryMap.get(m.id) ?? null })),
    );
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

    // Fetch links
    const links = await db
      .select()
      .from(schema.meetingLinks)
      .where(
        and(
          eq(schema.meetingLinks.meetingId, meetingId),
          eq(schema.meetingLinks.organizationId, crmUser.organizationId!),
        ),
      );

    const contactIds = links
      .filter((l) => l.contactId)
      .map((l) => l.contactId!);

    const linkedContacts =
      contactIds.length > 0
        ? await db
            .select({
              id: schema.contacts.id,
              firstName: schema.contacts.firstName,
              lastName: schema.contacts.lastName,
            })
            .from(schema.contacts)
            .where(
              sql`${schema.contacts.id} IN (${sql.join(
                contactIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
        : [];

    const meetingLinks = {
      contacts: linkedContacts.map((c) => ({
        id: c.id,
        name:
          [c.firstName, c.lastName].filter(Boolean).join(" ") ||
          `Contact #${c.id}`,
      })),
    };

    return c.json({
      ...meeting,
      transcripts,
      summary: summary ?? null,
      links: meetingLinks,
    });
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

    const bodyKeys = Object.keys(body);
    console.warn(
      `[MEETING:WS:HN] transcript-upload meetingId=${meetingId} bodyKeys=${bodyKeys.join(",")} segmentCount=${body.segments?.length ?? 0} textLength=${body.text?.length ?? 0} t=${Date.now()}`,
    );

    // Support both structured segments and plain text
    if (body.segments && body.segments.length > 0) {
      console.warn(
        `[MEETING:WS:HN] transcript-insert-structured meetingId=${meetingId} segmentCount=${body.segments.length} t=${Date.now()}`,
      );
      await db.insert(schema.meetingTranscripts).values(
        body.segments.map((seg) => ({
          meetingId,
          speaker: seg.speaker ?? null,
          text: seg.text ?? null,
          timestampMs: seg.timestampMs ?? null,
          organizationId: crmUser.organizationId,
        })),
      );
      console.warn(
        `[MEETING:WS:HN] transcript-insert-success meetingId=${meetingId} segmentCount=${body.segments.length} t=${Date.now()}`,
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
      console.warn(
        `[MEETING:WS:HN] transcript-parsed-text meetingId=${meetingId} parsedSegments=${segments.length} t=${Date.now()}`,
      );
      if (segments.length > 0) {
        await db.insert(schema.meetingTranscripts).values(segments);
      }
      console.warn(
        `[MEETING:WS:HN] transcript-insert-success meetingId=${meetingId} segmentCount=${segments.length} t=${Date.now()}`,
      );
    } else {
      console.warn(
        `[MEETING:WS:HN] transcript-empty meetingId=${meetingId} t=${Date.now()}`,
      );
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

    console.warn(
      `[MEETING:WS:HN] transcript-status-updated meetingId=${meetingId} status=processing duration=${duration} t=${Date.now()}`,
    );
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

    console.warn(
      `[MEETING:WS:HN] process-start meetingId=${meetingId} t=${Date.now()}`,
    );

    // Get transcript text
    const transcripts = await db
      .select()
      .from(schema.meetingTranscripts)
      .where(eq(schema.meetingTranscripts.meetingId, meetingId))
      .orderBy(schema.meetingTranscripts.timestampMs);

    console.warn(
      `[MEETING:WS:HN] process-transcripts-fetched meetingId=${meetingId} segmentCount=${transcripts.length} t=${Date.now()}`,
    );

    const transcriptText = transcripts
      .map((t) => (t.speaker ? `${t.speaker}: ${t.text}` : t.text))
      .join("\n");

    console.warn(
      `[MEETING:WS:HN] process-transcript-text meetingId=${meetingId} textLength=${transcriptText.length} truncatedLength=${Math.min(transcriptText.length, 12000)} t=${Date.now()}`,
    );

    if (!transcriptText.trim()) {
      console.warn(
        `[MEETING:WS:HN] process-empty-transcript meetingId=${meetingId} t=${Date.now()}`,
      );
      await db
        .update(schema.meetings)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(schema.meetings.id, meetingId));
      return c.json({ ok: true, summary: null });
    }

    // Resolve AI config for LLM call
    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) {
      console.warn(
        `[MEETING:WS:HN] process-no-ai-config meetingId=${meetingId} t=${Date.now()}`,
      );
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
      console.warn(
        `[MEETING:WS:HN] process-llm-start meetingId=${meetingId} t=${Date.now()}`,
      );

      // Build user message, prioritizing user notes if present
      let userMessage = "";
      if (meeting.notes?.trim()) {
        userMessage += `USER'S MEETING NOTES (prioritize these topics in the summary):\n${meeting.notes.trim()}\n\n---\n\n`;
      }
      userMessage += `TRANSCRIPT:\n${transcriptText.slice(0, 12000)}`;

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
- "decisions": an array of key decisions made (omit if none)
- "actionItems": an array of action items or tasks assigned (omit if none)
- "followUps": an array of follow-up items or next steps (omit if none)

If the user provided meeting notes, prioritize those topics in the summary and ensure the decisions/action items reflect what the user highlighted.

Return ONLY valid JSON, no markdown fences.`,
            },
            {
              role: "user",
              content: userMessage,
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
          decisions?: string[];
          actionItems?: string[];
          followUps?: string[];
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

        console.warn(
          `[MEETING:WS:HN] process-llm-success meetingId=${meetingId} summaryTitle="${summaryJson.title?.slice(0, 50) ?? "none"}" t=${Date.now()}`,
        );

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
            title:
              summaryJson.title?.slice(0, 100) ??
              summaryJson.note?.slice(0, 60) ??
              null,
            updatedAt: new Date(),
          })
          .where(eq(schema.meetings.id, meetingId));

        console.warn(
          `[MEETING:WS:HN] process-status-updated meetingId=${meetingId} status=completed t=${Date.now()}`,
        );

        // Fire-and-forget: embed transcript chunks + summary for RAG
        embedMeetingTranscript(db, env, crmUser, meetingId).catch(() => {});

        return c.json({ ok: true, summary: summaryJson });
      } else {
        console.warn(
          `[MEETING:WS:HN] process-llm-error meetingId=${meetingId} status=${res.status} t=${Date.now()}`,
        );
      }
    } catch (err) {
      console.warn(
        `[MEETING:WS:HN] process-llm-exception meetingId=${meetingId} error=${err instanceof Error ? err.message : String(err)} t=${Date.now()}`,
      );
    }

    // Mark completed even if summarization fails — still embed transcript chunks
    console.warn(
      `[MEETING:WS:HN] process-status-updated meetingId=${meetingId} status=completed reason=fallback t=${Date.now()}`,
    );
    await db
      .update(schema.meetings)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(schema.meetings.id, meetingId));

    // Even without a summary, embed the raw transcript chunks
    embedMeetingTranscript(db, env, crmUser, meetingId).catch(() => {});

    return c.json({ ok: true, summary: null });
  });

  // PATCH /api/meetings/:id/notes — Save meeting notes
  app.patch("/:id/notes", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    const body = await c.req.json<{ notes: string }>();

    const [updated] = await db
      .update(schema.meetings)
      .set({ notes: body.notes, updatedAt: new Date() })
      .where(
        and(
          eq(schema.meetings.id, meetingId),
          eq(schema.meetings.organizationId, crmUser.organizationId!),
        ),
      )
      .returning();

    if (!updated) return c.json({ error: "Meeting not found" }, 404);
    return c.json({ ok: true });
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

  // GET /api/meetings/:id/links — Get links for a meeting with resolved names
  app.get("/:id/links", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    const links = await db
      .select()
      .from(schema.meetingLinks)
      .where(
        and(
          eq(schema.meetingLinks.meetingId, meetingId),
          eq(schema.meetingLinks.organizationId, crmUser.organizationId!),
        ),
      );

    // Resolve contact names
    const contactIds = links
      .filter((l) => l.contactId)
      .map((l) => l.contactId!);

    const contacts =
      contactIds.length > 0
        ? await db
            .select({
              id: schema.contacts.id,
              firstName: schema.contacts.firstName,
              lastName: schema.contacts.lastName,
            })
            .from(schema.contacts)
            .where(
              sql`${schema.contacts.id} IN (${sql.join(
                contactIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
        : [];

    return c.json({
      contacts: contacts.map((c) => ({
        id: c.id,
        name:
          [c.firstName, c.lastName].filter(Boolean).join(" ") ||
          `Contact #${c.id}`,
      })),
    });
  });

  // POST /api/meetings/:id/links — Create a link between a meeting and a contact/company/deal
  app.post("/:id/links", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    // Verify meeting belongs to org
    const [meeting] = await db
      .select({ id: schema.meetings.id })
      .from(schema.meetings)
      .where(
        and(
          eq(schema.meetings.id, meetingId),
          eq(schema.meetings.organizationId, crmUser.organizationId!),
        ),
      )
      .limit(1);
    if (!meeting) return c.json({ error: "Meeting not found" }, 404);

    const body = await c.req.json<{ contactId?: number }>();

    if (!body.contactId) return c.json({ error: "contactId is required" }, 400);

    // Delete any existing contact link for this meeting (replace semantics — one contact per meeting)
    await db
      .delete(schema.meetingLinks)
      .where(
        and(
          eq(schema.meetingLinks.meetingId, meetingId),
          eq(schema.meetingLinks.organizationId, crmUser.organizationId!),
          sql`${schema.meetingLinks.contactId} IS NOT NULL`,
        ),
      );

    await db
      .insert(schema.meetingLinks)
      .values({
        meetingId,
        organizationId: crmUser.organizationId!,
        contactId: body.contactId,
      })
      .onConflictDoNothing();

    return c.json({ ok: true });
  });

  // DELETE /api/meetings/:id/links — Remove a contact link
  app.delete("/:id/links", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    const body = await c.req.json<{ contactId?: number }>();

    if (body.contactId) {
      await db
        .delete(schema.meetingLinks)
        .where(
          and(
            eq(schema.meetingLinks.meetingId, meetingId),
            eq(schema.meetingLinks.contactId, body.contactId),
            eq(schema.meetingLinks.organizationId, crmUser.organizationId!),
          ),
        );
    }

    return c.json({ ok: true });
  });

  // POST /api/meetings/:id/action-items-reviewed — Mark action items as reviewed
  app.post("/:id/action-items-reviewed", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser) return c.json({ error: "Unauthorized" }, 401);

    const meetingId = parseInt(c.req.param("id"), 10);
    if (isNaN(meetingId)) return c.json({ error: "Invalid ID" }, 400);

    const [summary] = await db
      .select()
      .from(schema.meetingSummaries)
      .where(
        and(
          eq(schema.meetingSummaries.meetingId, meetingId),
          eq(schema.meetingSummaries.organizationId, crmUser.organizationId!),
        ),
      )
      .limit(1);

    if (!summary) return c.json({ error: "Summary not found" }, 404);

    const updatedJson = { ...(summary.summaryJson ?? {}), _reviewed: true };
    await db
      .update(schema.meetingSummaries)
      .set({ summaryJson: updatedJson })
      .where(eq(schema.meetingSummaries.id, summary.id));

    return c.json({ ok: true });
  });

  return app;
}

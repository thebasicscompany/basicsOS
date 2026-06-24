// Company-context contribution tools (F2 keystone). The point of custom apps isn't
// just UI — it's that whatever a company builds (a daily-status app, a messaging
// app replacing Teams, a CRM-adjacent tool) FEEDS the shared company context the
// hermes agent reasons over. An app calls `context.remember` to record a fact; we
// store a human-readable row in `app_memory` AND embed it into `context_embeddings`
// (entity_type "app_memory"), so the agent's existing `memory.recall_context`
// surfaces it in chat/automations. `context.search` / `context.recent` read it back
// for the app's own views. Org-scoped; writes attributed to the acting user + app.

import { and, desc, eq, gte, lte, ilike, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { BrokerTool, ToolCallContext } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import { PERMISSIONS } from "@/lib/rbac.js";
import * as schema from "@/db/schema/index.js";
import { upsertEntityEmbedding } from "@/lib/embeddings.js";
import { recallContext } from "@/mcp-broker/data.js";

function objSchema(props: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return { type: "object", properties: props, required, additionalProperties: false };
}

function clampK(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 10;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

/** The contributing app slug (from the app/app-agent path), or "agent" for chat. */
function sourceSlug(ctx: ToolCallContext): string {
  const slug = ctx.meta?.appSlug;
  return typeof slug === "string" && slug.length > 0 ? slug : "agent";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human + machine readable date, e.g. "June 20, 2026 (2026-06-20)", so the
 *  attribution baked into a context chunk matches both natural-language date
 *  questions ("on June 20") and exact ISO references. */
function formatWhen(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} (${iso})`;
}

/** Resolve a crm user's display name (first+last, falling back to email). */
async function authorName(db: Db, crmUserId: number): Promise<string> {
  const [u] = await db
    .select({
      first: schema.crmUsers.firstName,
      last: schema.crmUsers.lastName,
      email: schema.crmUsers.email,
    })
    .from(schema.crmUsers)
    .where(eq(schema.crmUsers.id, crmUserId))
    .limit(1);
  if (!u) return `user ${crmUserId}`;
  const full = `${u.first ?? ""} ${u.last ?? ""}`.trim();
  return full || u.email || `user ${crmUserId}`;
}

export function buildContextTools(db: Db, env: Env): BrokerTool[] {
  return [
    {
      name: "context.remember",
      description:
        "Save a fact/update into the COMPANY CONTEXT so the AI agent (and everyone) can recall it later — e.g. a status update, a message, a decision. The text is embedded and becomes part of the shared knowledge the agent reasons over. Org-wide.",
      inputSchema: objSchema(
        {
          text: { type: "string", description: "the fact/update to remember (a sentence or short paragraph)" },
          title: { type: "string", description: "optional short label (e.g. \"Ada's status — 2026-06-22\")" },
        },
        ["text"],
      ),
      meta: { source: "memory", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const text = String(args.text ?? "").trim();
        if (!text) throw new BrokerError("VALIDATION", "`text` cannot be empty.");
        if (text.length > 8000) throw new BrokerError("VALIDATION", "`text` is too long (max 8000 chars).");
        const title = args.title ? String(args.title).slice(0, 256) : null;
        const crmUserId = ctx.crmUserId as number; // writes require a user (handleRpc gate)
        const appSlug = sourceSlug(ctx);

        const [row] = await db
          .insert(schema.appMemory)
          .values({ organizationId: ctx.orgId, crmUserId, appSlug, title, text })
          .returning();
        if (!row) throw new BrokerError("UPSTREAM", "Failed to store the memory.");

        // Embed + index so memory.recall_context surfaces it. We bake WHO + WHEN +
        // which app into the chunk so the agent can answer attributed/temporal
        // questions ("what was Ada doing on June 20?") — the recall returns this
        // exact text, and the embedding now matches the person + date. Best-effort:
        // a failed embedding leaves the row recallable by context.recent.
        const who = await authorName(db, crmUserId);
        const when = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string);
        const appLabel = appSlug !== "agent" ? ` · via ${appSlug}` : "";
        const chunkText = `[${who} · ${formatWhen(when)}${appLabel}] ${title ? title + ": " : ""}${text}`;
        await upsertEntityEmbedding(
          db,
          env.BASICSOS_API_URL,
          env.SERVER_BASICS_API_KEY ?? "",
          crmUserId,
          "app_memory",
          row.id,
          chunkText,
        );

        return { remembered: { id: row.id, title, author: who, source: appSlug } };
      },
    },
    {
      name: "context.search",
      description:
        "Search the COMPANY CONTEXT (CRM records, notes, AND app-contributed updates like statuses/messages) by meaning. Returns the most relevant chunks.",
      inputSchema: objSchema(
        {
          query: { type: "string", description: "what to search for" },
          k: { type: "integer", description: "max results (1-20, default 5)" },
        },
        ["query"],
      ),
      meta: { source: "memory", writes: false },
      handle: async (args, ctx) =>
        recallContext(db, env, ctx.orgId, String(args.query ?? ""), Math.min(20, clampK(args.k))),
    },
    {
      name: "context.recent",
      description:
        "List app-contributed context entries (statuses, messages, notes), newest first. FILTER by `author` (a teammate's name or email), and/or a date range `since`/`until` (a day like '2026-06-21' or a range). USE THIS for questions like 'what did <person> do on <date>?' or 'what did I do on the 21st?' — pass author + since/until for that day. Each result has author + date. If it returns an empty list, there is NO matching entry — say so plainly, do NOT invent one.",
      inputSchema: objSchema(
        {
          app: { type: "string", description: "app slug to filter to (agent only; apps are always scoped to themselves)" },
          author: { type: "string", description: "filter to ONE teammate by name or email (e.g. 'Alice' or 'alice@co.com'); omit for everyone" },
          since: { type: "string", description: "only entries on/after this date (ISO 'YYYY-MM-DD' or full datetime)" },
          until: { type: "string", description: "only entries on/before this DAY (ISO 'YYYY-MM-DD'); for a single day pass the same value as since" },
          k: { type: "integer", description: "max entries (1-50, default 10)" },
        },
        [],
      ),
      meta: { source: "memory", writes: false },
      handle: async (args, ctx) => {
        const k = clampK(args.k);
        // An app sees ONLY its own entries (isolation): force the filter to the
        // calling app's slug, ignoring any client-supplied `app`. The agent (no
        // appSlug in meta) may filter by `app` or omit it to see all org entries.
        const callerApp = typeof ctx.meta?.appSlug === "string" ? ctx.meta.appSlug : null;
        const appFilter = callerApp ?? (args.app ? String(args.app) : null);
        const clauses = [eq(schema.appMemory.organizationId, ctx.orgId)];
        if (appFilter) clauses.push(eq(schema.appMemory.appSlug, appFilter));

        // Author filter — resolve a name/email to that teammate's id(s).
        const authorQ = typeof args.author === "string" ? args.author.trim() : "";
        if (authorQ) {
          const like = `%${authorQ}%`;
          const users = await db
            .select({ id: schema.crmUsers.id })
            .from(schema.crmUsers)
            .where(
              and(
                eq(schema.crmUsers.organizationId, ctx.orgId),
                or(
                  ilike(schema.crmUsers.firstName, like),
                  ilike(schema.crmUsers.lastName, like),
                  ilike(schema.crmUsers.email, like),
                  ilike(sql`${schema.crmUsers.firstName} || ' ' || ${schema.crmUsers.lastName}`, like),
                ),
              ),
            );
          if (users.length === 0)
            return { results: [], note: `No teammate matches "${authorQ}". Ask which person, or confirm the name.` };
          clauses.push(inArray(schema.appMemory.crmUserId, users.map((u) => u.id)));
        }

        // Date range — date-only strings bound the whole UTC day.
        const dayStart = (s: string) => new Date(`${s}T00:00:00.000Z`);
        const dayEnd = (s: string) => new Date(`${s}T23:59:59.999Z`);
        const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
        const sinceStr = typeof args.since === "string" ? args.since.trim() : "";
        const untilStr = typeof args.until === "string" ? args.until.trim() : "";
        if (sinceStr) {
          const d = isDateOnly(sinceStr) ? dayStart(sinceStr) : new Date(sinceStr);
          if (!Number.isNaN(d.getTime())) clauses.push(gte(schema.appMemory.createdAt, d));
        }
        if (untilStr) {
          const d = isDateOnly(untilStr) ? dayEnd(untilStr) : new Date(untilStr);
          if (!Number.isNaN(d.getTime())) clauses.push(lte(schema.appMemory.createdAt, d));
        }

        const where = and(...clauses);
        const rows = await db
          .select({
            id: schema.appMemory.id,
            app: schema.appMemory.appSlug,
            title: schema.appMemory.title,
            text: schema.appMemory.text,
            createdAt: schema.appMemory.createdAt,
            authorFirst: schema.crmUsers.firstName,
            authorLast: schema.crmUsers.lastName,
            authorEmail: schema.crmUsers.email,
          })
          .from(schema.appMemory)
          .leftJoin(schema.crmUsers, eq(schema.appMemory.crmUserId, schema.crmUsers.id))
          .where(where)
          .orderBy(desc(schema.appMemory.createdAt))
          .limit(k);
        // Surface WHO + WHEN so app views + the agent can attribute each entry.
        const results = rows.map((r) => ({
          id: r.id,
          app: r.app,
          title: r.title,
          text: r.text,
          author: `${r.authorFirst ?? ""} ${r.authorLast ?? ""}`.trim() || r.authorEmail || null,
          date: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        }));
        if (results.length === 0)
          return { results: [], note: "No matching entries for that person/date — there is nothing to report." };
        return { results };
      },
    },
  ];
}

// Hermes-backed chat route. Replaces the old in-process planToolWorkflow brain
// (gateway-chat.ts) with the per-company hermes agent: a BasicsOS thread maps to
// a hermes session, hermes reads CRM/memory through the MCP Broker, and we stream
// its reply back in the Vercel AI SDK v1 data-stream format the chat UI already
// consumes. Threads/messages persist in ai_threads/ai_messages exactly as before,
// so history survives a refresh. See BUILD_PLAN_HERMES.md M3.

import { Hono } from "hono";
import type { Db } from "@/db/client.js";
import type { createAuth } from "@/auth.js";
import type { Env } from "@/env.js";
import { authMiddleware } from "@/middleware/auth.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { logger } from "@/lib/logger.js";
import { ensureThread, persistMessage } from "@/routes/gateway-chat/storage.js";
import { sdkPart, requestSchema } from "@/routes/gateway-chat/protocol.js";
import { buildSessionKey, streamHermesText, HermesError, type HermesAttachment } from "@/lib/hermes/client.js";
import * as schema from "@/db/schema/index.js";
import { eq, or, isNull, asc } from "drizzle-orm";

/** A live list of THIS org's CRM objects (built-in + custom), appended to the
 * agent's system prompt so it routes record ops to the right object instead of
 * mapping a custom name (e.g. "vendors") onto a built-in (companies). */
async function buildObjectsHint(db: Db, orgId: string, userText: string): Promise<string> {
  try {
    const objs = await db
      .select({
        slug: schema.objectConfig.slug,
        singular: schema.objectConfig.singularName,
        plural: schema.objectConfig.pluralName,
        table: schema.objectConfig.tableName,
      })
      .from(schema.objectConfig)
      .where(
        or(eq(schema.objectConfig.organizationId, orgId), isNull(schema.objectConfig.organizationId)),
      )
      .orderBy(asc(schema.objectConfig.position), asc(schema.objectConfig.id));
    if (!objs.length) return "";
    // Reference the tools by the names the AGENT actually sees: the broker MCP
    // server is mounted as "broker", so object.{slug}.{op} is exposed to the model
    // as mcp_broker_object_{slug}_{op}. Naming the real tool prevents the "no such
    // tool object.vendors.search" confusion.
    const t = (slug: string, op: string) => `mcp_broker_object_${slug}_${op}`;
    const mapping = objs
      .map((o) => `  • "${o.singular}" / "${o.plural}" → ${t(o.slug, "search")}, ${t(o.slug, "create")}, ${t(o.slug, "update")}, ${t(o.slug, "delete")}`)
      .join("\n");

    // Per-message targeting: if the user named exactly one object (by singular or
    // plural), put a SHARP directive at the top naming the exact tools — this is
    // what makes "add a vendor" hit vendors instead of leads/companies.
    const lc = ` ${userText.toLowerCase()} `;
    const named = objs.filter(
      (o) =>
        lc.includes(` ${o.singular.toLowerCase()} `) ||
        lc.includes(` ${o.singular.toLowerCase()}s `) ||
        lc.includes(` ${o.plural.toLowerCase()} `),
    );
    const directive =
      named.length === 1
        ? [
            `>>> The user is referring to the "${named[0].plural}" object (slug "${named[0].slug}"). For THIS request operate ONLY on that object:`,
            `    • to ADD: mcp_broker_object_create with { object: "${named[0].slug}", fields: { name: "…", …other fields } }`,
            `    • to LIST/COUNT: mcp_broker_object_search with { object: "${named[0].slug}" } and NO query`,
            `    • to UPDATE/DELETE: mcp_broker_object_update / mcp_broker_object_delete with { object: "${named[0].slug}", id, … }`,
            `    Do NOT use companies, leads, or any other object for this — that is a hard error. "${named[0].plural}" is its own object.`,
            "",
          ].join("\n")
        : "";

    return [
      directive,
      "## CRM objects — each has its OWN tools (NOT interchangeable: a vendor is not a lead/company)",
      mapping,
      "",
      "### Generic tools that work for ANY object by slug (PREFER these for custom objects and for any object you JUST created — per-object tools can lag):",
      "  • create: mcp_broker_object_create { object, fields:{name,…} } · bulk/CSV: mcp_broker_object_create_many { object, records:[…] }",
      "  • read: mcp_broker_object_search { object } (no query = list all) · update: mcp_broker_object_update { object, id, fields } · delete: mcp_broker_object_delete { object, id }",
      "After a write, trust the tool's returned row as the source of truth — never claim success without a successful tool result.",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

/** Surface the org's custom API connectors so the agent AUTONOMOUSLY reaches for
 *  the right one on a matching request — it won't think to call connector.list
 *  unless it knows connectors exist. Mirrors buildObjectsHint. */
async function buildConnectorsHint(db: Db, orgId: string): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(schema.connectors)
      .where(eq(schema.connectors.organizationId, orgId))
      .orderBy(asc(schema.connectors.name));
    if (!rows.length) return "";
    const lines = rows.map(
      (r) =>
        `  • "${r.name}" (slug: ${r.slug}) — ${r.baseUrl}${r.description ? ` — ${r.description}` : ""}`,
    );
    return [
      "## Connected external APIs — USE THESE when a request matches one (do NOT web-search, guess, or say you can't):",
      ...lines,
      'To call one, use mcp_broker_connector_request with { connector: "<slug>", method, path, query?, body? } — the API key is injected for you server-side. Read the description to build the right path/params.',
    ].join("\n");
  } catch {
    return "";
  }
}

/** Extract text from PDF (unpdf) + Office docx/xlsx/pptx (officeparser) uploads,
 *  server-side, so the agent reads them like any text file. */
async function resolveDocs(attachments: HermesAttachment[]): Promise<HermesAttachment[]> {
  return Promise.all(
    attachments.map(async (a) => {
      if (a.kind !== "pdf" && a.kind !== "office") return a;
      try {
        const b64 = a.content.includes(",") ? a.content.slice(a.content.indexOf(",") + 1) : a.content;
        const buf = Buffer.from(b64, "base64");
        let text: string;
        if (a.kind === "pdf") {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const pdf = await getDocumentProxy(new Uint8Array(buf));
          const r = await extractText(pdf, { mergePages: true });
          text = Array.isArray(r.text) ? r.text.join("\n") : r.text;
        } else {
          const { OfficeParser } = await import("officeparser");
          const ast = await OfficeParser.parseOffice(buf);
          text = ast.toText();
        }
        const joined = (text ?? "").trim();
        return joined
          ? { ...a, content: joined.slice(0, 200_000) }
          : { ...a, kind: "unsupported" as const, content: "" };
      } catch {
        return { ...a, kind: "unsupported" as const, content: "" };
      }
    }),
  );
}

/** Validate/cap attachments from the request body (defensive — client-supplied). */
function sanitizeAttachments(raw: unknown): HermesAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: HermesAttachment[] = [];
  for (const a of raw.slice(0, 6)) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const kind =
      o.kind === "image" || o.kind === "text" || o.kind === "pdf" || o.kind === "office" || o.kind === "unsupported"
        ? o.kind
        : null;
    if (!kind) continue;
    const content = typeof o.content === "string" ? o.content.slice(0, 8_000_000) : "";
    out.push({
      name: typeof o.name === "string" ? o.name.slice(0, 200) : "file",
      mediaType: typeof o.mediaType === "string" ? o.mediaType.slice(0, 100) : "application/octet-stream",
      kind,
      content,
    });
  }
  return out;
}
import { drainNeedsConnections } from "@/lib/pending-connections.js";
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type BetterAuthInstance = ReturnType<typeof createAuth>;

/** "slack" -> "Slack" (good enough for a Connect button label). */
const prettyApp = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Current files in a thread's artifact dir (names only; [] if none/no dir). */
function listThreadFiles(env: Env, threadId: string): string[] {
  const root = env.HERMES_ARTIFACTS_DIR;
  if (!root) return [];
  try {
    const dir = join(root, threadId);
    return readdirSync(dir).filter((n) => {
      if (n.startsWith(".")) return false;
      try {
        return statSync(join(dir, n)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Download chips for files the agent generated THIS turn = files now present in
 * the thread's artifact dir that weren't there before the turn. A snapshot diff
 * (not mtime) — robust to container/host clock skew. Per-thread dirs keep
 * concurrent users isolated.
 */
function artifactChips(env: Env, threadId: string, before: Set<string>): string {
  const fresh = listThreadFiles(env, threadId).filter((n) => !before.has(n));
  if (!fresh.length) return "";
  return (
    "\n\n" +
    fresh
      .map((n) => `[file:${n}](/api/files/${encodeURIComponent(threadId)}/${encodeURIComponent(n)})`)
      .join("\n")
  );
}

/** System context for a record/object-SCOPED chat (a per-record chat tab). The
 * broker already restricts the toolset to this object (scope: session thread);
 * this tells the agent it's working on one record so it reads/updates THAT id. */
function buildScopeContext(object: string, recordId: number | null): string {
  const t = (op: string) => `mcp_broker_object_${object}_${op}`;
  if (recordId != null) {
    return [
      `## You are in a SCOPED chat for ONE record: the "${object}" record with id ${recordId}.`,
      `Everything in this conversation is about THIS record only. Use these tools and only these:`,
      `  • view it: ${t("get")} with { id: ${recordId} }`,
      `  • change it: ${t("update")} with { id: ${recordId}, ...fields }`,
      `  • (it lives in the "${object}" object). You do NOT have access to other objects or records here.`,
      `When the user says "this", "it", or "the record", they mean record ${recordId} in "${object}".`,
    ].join("\n");
  }
  const field = "mcp_broker_custom_field_create";
  return [
    `## You are the AI assistant for the "${object}" GRID (the ${object} object). Everything the user asks — and any CSV/table they paste or attach — is about ${object}.`,
    `ALWAYS operate on the "${object}" object via these generic, slug-based tools (they work reliably even for a just-created object — NEVER companies/leads/contacts):`,
    `  • list / search / count: mcp_broker_object_search with { object: "${object}" } and NO query (empty = list ALL)`,
    `  • add one: mcp_broker_object_create with { object: "${object}", fields: { name: "…", …other fields } }`,
    `  • add MANY (bulk / CSV import): mcp_broker_object_create_many with { object: "${object}", records: [ {…}, … ] }`,
    `  • update / delete: mcp_broker_object_update / mcp_broker_object_delete with { object: "${object}", id, … }`,
    `  • add a COLUMN: ${field} with { resource: "${object}", name, fieldType } — create any column the data needs BEFORE importing values into it`,
    `When the user gives a CSV or pasted table: read it, create any MISSING columns as fields on "${object}", then import EVERY row with mcp_broker_object_create_many. Confirm how many rows you imported.`,
    `NEVER claim you added/updated/deleted anything unless the tool returned a successful result — if a call fails, say so.`,
  ].join("\n");
}

const log = logger.child({ component: "agent-chat" });

/** Pull the latest user message text out of the AI-SDK messages array. */
function latestUserText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i] as { role?: string; content?: unknown; parts?: Array<{ type?: string; text?: string }> };
    if (m?.role !== "user") continue;
    if (typeof m.content === "string" && m.content.trim()) return m.content;
    if (Array.isArray(m.parts)) {
      const text = m.parts
        .filter((p) => p?.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("");
      if (text.trim()) return text;
    }
  }
  return "";
}

export function createAgentChatRoutes(db: Db, auth: BetterAuthInstance, env: Env) {
  const app = new Hono();

  app.post("/", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }

    const userText = latestUserText(parsed.data.messages);
    // Uploaded files ride in the request body (not the AI-SDK message schema).
    const attachments = await resolveDocs(sanitizeAttachments((body as { attachments?: unknown }).attachments));
    if (!userText && !attachments.length) return c.json({ error: "No user message" }, 400);

    const titleBasis = userText || (attachments.length ? `Uploaded ${attachments.map((a) => a.name).join(", ")}` : "");
    const threadId = await ensureThread(db, crmUser, parsed.data.threadId, parsed.data.channel, titleBasis);
    await persistMessage(
      db,
      threadId,
      "user",
      attachments.length ? `${userText}${userText ? "\n\n" : ""}[attached: ${attachments.map((a) => a.name).join(", ")}]` : userText,
    );

    // Optional record/object SCOPE from a per-record chat tab. A `scope:{obj}:…`
    // session thread makes the broker restrict the toolset to that one object
    // (deterministic — the agent can't touch other objects), and we tell the
    // agent which record it's on.
    const rawScope = (body as { scope?: { object?: unknown; recordId?: unknown } }).scope;
    const scopeObject =
      rawScope && typeof rawScope.object === "string" && /^[a-z0-9_]+$/.test(rawScope.object)
        ? rawScope.object
        : null;
    const scopeRecordId =
      rawScope && rawScope.recordId != null && Number.isFinite(Number(rawScope.recordId))
        ? Number(rawScope.recordId)
        : null;

    // Hard-restrict the toolset ONLY for a single-record chat (the agent can't
    // touch anything but that record). A GRID chat (object, no record) keeps the
    // FULL toolset — it needs custom_field.create for new columns, file tools for
    // CSVs, etc. — and relies on a strong focus directive + the smart model.
    const hardScope = scopeObject != null && scopeRecordId != null;
    const sessionKey = hardScope
      ? buildSessionKey(crmUser.id, `scope:${scopeObject}:${scopeRecordId}:${threadId}`)
      : buildSessionKey(crmUser.id, threadId);
    const encoder = new TextEncoder();
    let assistantText = "";
    // Pre-create the thread's artifact dir (verified writable by the container
    // uid over the bind mount) so the agent's binary-file code can save straight
    // into the EXACT existing path. Text files go through file.save (server-side).
    if (env.HERMES_ARTIFACTS_DIR) {
      try {
        mkdirSync(join(env.HERMES_ARTIFACTS_DIR, threadId), { recursive: true });
      } catch {
        /* best-effort */
      }
    }
    const filesBefore = new Set(listThreadFiles(env, threadId)); // snapshot for the artifact diff
    // Scoped chat → a record/object directive; otherwise the org-wide routing hint.
    const baseContext = scopeObject
      ? buildScopeContext(scopeObject, scopeRecordId)
      : await buildObjectsHint(db, crmUser.organizationId, userText);
    const connectorsHint = await buildConnectorsHint(db, crmUser.organizationId);
    // Current-user identity so "I"/"me"/"my" resolve to a specific person — the
    // agent must filter context/records by THIS user for "what did I do?".
    const [meRow] = await db
      .select({ f: schema.crmUsers.firstName, l: schema.crmUsers.lastName, e: schema.crmUsers.email })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, crmUser.id))
      .limit(1);
    const meName = `${meRow?.f ?? ""} ${meRow?.l ?? ""}`.trim() || meRow?.e || `user ${crmUser.id}`;
    const identityHint = `## The current user is ${meName}${meRow?.e ? ` (${meRow.e})` : ""}. When they say "I", "me", or "my", they mean ${meName} — filter context and records to THIS person (e.g. pass author "${meName}" to context.recent). For "what did <someone else> do", pass that person's name as author.`;
    const extraContext = [identityHint, baseContext, connectorsHint].filter(Boolean).join("\n\n");

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of streamHermesText({
            env,
            sessionKey,
            message: userText,
            attachments,
            extraSystemContext: extraContext,
            signal: c.req.raw.signal,
            // Surface skills/tools the agent uses as ordered message annotations (8:)
            // so the chat UI can render a live activity timeline. kind:"write" marks a
            // skill being authored (skill_manage) vs "use" for reads/other tools.
            onToolEvent: (e) => {
              controller.enqueue(
                encoder.encode(
                  sdkPart("8", [
                    {
                      type: "tool",
                      tool: e.tool,
                      label: e.label,
                      emoji: e.emoji,
                      id: e.toolCallId,
                      status: e.status,
                      kind: e.tool === "skill_manage" ? "write" : "use",
                    },
                  ]),
                ),
              );
            },
          })) {
            assistantText += delta;
            controller.enqueue(encoder.encode(sdkPart("0", delta)));
          }
          // Render a Connect card for every app that hit NEEDS_CONNECTION this
          // turn (deterministic; handles multiple) — the client turns each
          // Composio authUrl link into a Connect button.
          const pending = drainNeedsConnections(sessionKey);
          if (pending.length) {
            const cards =
              "\n\n" + pending.map((p) => `[Connect ${prettyApp(p.app)}](${p.authUrl})`).join("\n\n");
            controller.enqueue(encoder.encode(sdkPart("0", cards)));
            assistantText += cards;
          }
          // Offer any files the agent generated this turn as downloads.
          const chips = artifactChips(env, threadId, filesBefore);
          if (chips) {
            controller.enqueue(encoder.encode(sdkPart("0", chips)));
            assistantText += chips;
          }
          if (assistantText.trim()) {
            await persistMessage(db, threadId, "assistant", assistantText);
            controller.enqueue(encoder.encode(sdkPart("d", { finishReason: "stop" })));
          } else {
            // hermes returned 200 but produced no text/tools/files this turn —
            // almost always a failed model call (gateway unreachable or missing a
            // provider/API key). Surface a clear error instead of a silent "stop"
            // that leaves the UI stuck on an empty "thinking" reply.
            log.warn({ threadId, sessionKey }, "agent-chat: empty hermes turn — surfacing model-call failure");
            controller.enqueue(
              encoder.encode(
                sdkPart("3", "No response from the model — check the BasicsOS gateway and your Basics API key, then try again."),
              ),
            );
            controller.enqueue(encoder.encode(sdkPart("d", { finishReason: "error" })));
          }
        } catch (err) {
          log.error({ err, threadId }, "agent-chat stream failed");
          // Persist any partial reply so the thread isn't left dangling.
          if (assistantText.trim()) {
            await persistMessage(db, threadId, "assistant", assistantText).catch(() => {});
          }
          const msg =
            err instanceof HermesError
              ? `The agent is unavailable right now (hermes ${err.status}).`
              : "The agent hit an error.";
          controller.enqueue(encoder.encode(sdkPart("3", msg)));
          controller.enqueue(encoder.encode(sdkPart("d", { finishReason: "error" })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
        "Cache-Control": "no-cache",
        "X-Thread-Id": threadId,
        "X-Tools-Used": "",
        "Access-Control-Expose-Headers": "X-Thread-Id, X-Tools-Used",
      },
    });
  });

  return app;
}

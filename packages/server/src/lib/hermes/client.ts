// basics-agent — thin client for this company's hermes sidecar.
//
// Our backend drives hermes over its built-in OpenAI-compatible HTTP API server
// (bearer API_SERVER_KEY). Each BasicsOS chat thread maps to a hermes session via
// the session key, so hermes holds the conversational memory and reaches CRM/
// memory tools through the MCP Broker. See docs/PLATFORM…md §5.4 + BUILD_PLAN M3.

import type { Env } from "@/env.js";

/**
 * The hermes session key for a (user, thread). hermes caches one agent per key
 * and persists its session, so the same key continues the same conversation.
 *   agent:main:basicsos:dm:{userId}:{threadId}
 */
export function buildSessionKey(userId: string | number, threadId: string | number): string {
  return `agent:main:basicsos:dm:${userId}:${threadId}`;
}

export interface HermesAttachment {
  name: string;
  mediaType: string;
  kind: "image" | "text" | "unsupported";
  content: string; // image: data URL; text: file text; unsupported: ""
}

export interface HermesTurnOptions {
  env: Env;
  sessionKey: string;
  /** the new user message; prior turns are recalled by hermes via the session key */
  message: string;
  /** files the user uploaded this turn (images -> vision; text -> inlined). */
  attachments?: HermesAttachment[];
  signal?: AbortSignal;
}

/** OpenAI-style user content: a plain string, or parts (text + image_url). */
type UserContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

/** Fold uploaded attachments into the user turn: inline text files, attach images. */
function buildUserContent(message: string, attachments?: HermesAttachment[]): UserContent {
  if (!attachments?.length) return message;
  let text = message;
  for (const a of attachments) {
    if (a.kind === "text") text += `\n\n--- Attached file: ${a.name} ---\n${a.content}`;
    else if (a.kind === "unsupported") text += `\n\n[The user attached "${a.name}" (${a.mediaType}); you can't read this file type yet — tell them so.]`;
  }
  const images = attachments.filter((a) => a.kind === "image" && a.content);
  if (!images.length) return text;
  return [
    { type: "text", text },
    ...images.map((a) => ({ type: "image_url" as const, image_url: { url: a.content } })),
  ];
}

/**
 * BasicsOS persona + behavior, injected as a `role:"system"` message — hermes
 * layers it on top of its core prompt (per-request ephemeral system prompt).
 * Gives the agent its identity, current date, capability awareness, and the
 * connection/email conventions (so it acts instead of asking, and the in-chat
 * Connect card mechanism works reliably).
 */
function buildSystemPrompt(artifactDir: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are the BasicsOS assistant — an AI agent inside BasicsOS, a company's all-in-one internal operating system (their workspace for CRM, meetings, tasks & notes, automations, and connected apps). Today's date is ${today}.`,
    `You can read & write the CRM (contacts, companies, deals, tasks, notes), read meeting transcripts & summaries, search the web (web.search), run code, generate files, send email from BasicsOS (email.send), act in the user's connected apps (connection.execute — e.g. Gmail, Slack), and create/edit the user's automations (automation.create, automation.update, automation.list).`,
    `When a task needs an external app, attempt it directly (connection.execute) or set it up (connection.connect) — do NOT ask the user to connect first, and do NOT paste any URLs. If the app isn't connected, briefly name which app(s) you need; the user is shown a Connect button automatically.`,
    `Use email.send to email the user a summary or notification ("email me ..."); use the Gmail/Outlook connection to email other people as the user.`,
    `Produce a downloadable FILE when the user asks you to make / create / build / write up / put together / export / send a report, summary, overview, brief, analysis, document, doc, deck, presentation, slides, spreadsheet, csv, or pdf — infer this from natural language; they will NOT say "downloadable file". (Answer in chat, with no file, for quick questions like "what are my deals", "how many…", "show me…".) For TEXT files (markdown .md, csv, txt, json, html) ALWAYS call the file.save tool with {filename, content} (do NOT write text files with code). For BINARY files (docx, pptx, xlsx, images) generate them with code (python-docx, python-pptx, openpyxl are installed) and save to the FULL ABSOLUTE path in the existing dir "${artifactDir}", e.g. prs.save("${artifactDir}/pipeline.pptx") — never a bare/relative filename. The file is offered as a download automatically; just say what you made — never paste file paths or base64. For a quick question, just answer in chat (no file).`,
    `Format content for readability: put tabular or per-record data (e.g. a list of deals/contacts with fields) in a markdown TABLE with a header row, NOT nested bullet lists. Use headings and short prose otherwise.`,
    `Be concise, accurate, and professional. Use the user's real CRM data — never invent records.`,
  ].join(" ");
}

/** The agent-visible (container) artifacts dir for a session = /opt/artifacts/<threadId>. */
function artifactDirFor(sessionKey: string): string {
  const threadId = sessionKey.split(":").pop() || "default";
  return `/opt/artifacts/${threadId}`;
}

function hermesHeaders(env: Env, sessionKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Authorization: `Bearer ${env.HERMES_API_SERVER_KEY ?? ""}`,
    "X-Hermes-Session-Key": sessionKey,
  };
}

/**
 * Stream assistant text deltas for one turn. hermes returns OpenAI-style SSE
 * (`data: {choices:[{delta:{content}}]}` … `data: [DONE]`); we yield the content
 * deltas. Throws on a non-2xx / bodyless response.
 */
export async function* streamHermesText(opts: HermesTurnOptions): AsyncGenerator<string> {
  const { env, sessionKey, message, attachments, signal } = opts;
  const res = await fetch(`${env.HERMES_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: hermesHeaders(env, sessionKey),
    body: JSON.stringify({
      model: "hermes-agent",
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(artifactDirFor(sessionKey)) },
        { role: "user", content: buildUserContent(message, attachments) },
      ],
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new HermesError(res.status, detail.slice(0, 500));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // ignore blank lines / event: frames
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string };
        };
        if (json.error) throw new HermesError(502, json.error.message ?? "hermes stream error");
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) yield delta;
      } catch (err) {
        if (err instanceof HermesError) throw err;
        // ignore non-JSON keepalive / partial frames
      }
    }
  }
}

/** Collect a full (non-streamed) completion. */
export async function hermesComplete(opts: HermesTurnOptions): Promise<string> {
  let out = "";
  for await (const delta of streamHermesText(opts)) out += delta;
  return out;
}

export class HermesError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HermesError";
    this.status = status;
  }
}

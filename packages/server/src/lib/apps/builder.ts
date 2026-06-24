// In-app app builder (APP-3 declarative + APP-4e hosted). The company's hermes is
// the codegen brain. Critically, the builder is DELIBERATE — it doesn't one-shot.
// It works in phases like a real coding agent:
//   1. PLAN   — analyze the request, decide declarative vs hosted, design the app,
//               and choose the MINIMAL broker tools it needs.
//   2. BUILD  — generate the full artifact per the plan (a thorough DeclarativeSpec
//               or a polished hosted HTML bundle), with real UX (loading/empty/error
//               states, clear labels), not a stub.
//   3. REVIEW — critique its own work for completeness, correctness, UX, and
//               security (minimal grants, no exfiltration), and return the improved
//               final version.
// The route streams these phases so the user sees the work happening.

// ── Phase 1: PLAN ────────────────────────────────────────────────────────────
export function buildPlanSystemPrompt(): string {
  return [
    "You are an expert internal-tools architect for BasicsOS. A company admin wants to build an app for their company. FIRST, think carefully and PLAN it — do NOT rush or output an app yet.",
    "",
    "Decide the right delivery tier:",
    "- 'declarative': dashboards, forms, lists, metrics, charts over the company's own data. Rendered natively by the host from a JSON spec. Choose this when the app is standard data views + simple actions.",
    "- 'hosted': a custom interactive web app (e.g. a messaging/chat app, kanban board, calendar, planner, rich/real-time UI). Runs in a sandboxed iframe and talks to the host via a permission-gated bridge. Choose this when the app needs interactivity beyond tables/forms.",
    "",
    "Apps act through the MCP Broker tools (the SAME tools the AI agent uses), each GRANT-GATED. Pick the MINIMAL set the app genuinely needs. Available broker tools:",
    "  data:    object.{contacts|companies|deals|tasks|...}.search ({query}) / .get ({id}) / .create ({...}) / .update ({id,...})  — the COMPANY's real CRM data. Only request these to read/write actual company records.",
    "  context: context.remember ({text,title?}) [WRITE — record a fact/update/message into company knowledge the agent can recall], context.recent ({k?}) [list this app's recent entries], context.search ({query,k?}), memory.recall_context ({query})",
    "  ai:      ai.complete ({prompt, system?, maxTokens?}) [run an LLM — summarize / draft / classify / extract / answer; the PLATFORM provides the model, the app needs no key], ai.vision ({imageUrl, prompt}) [analyze/describe/OCR an image]. Request 'ai.complete' and/or 'ai.vision' in tools to use these.",
    "  custom APIs: connector.list () [list the org's admin-added external API connectors — slug, base URL, description], connector.request ({connector, method, path, query?, body?}) [call one — the platform injects its stored API key server-side; the app never holds the key]. Use these for ANY external/third-party API an admin has connected (weather, payments, internal services, etc.). Request 'connector.list' AND 'connector.request' in tools; discover slugs at runtime with connector.list.",
    "",
    "STORAGE DECISION — where does this app's data live? (this is the most important choice):",
    "- If the app PERSISTS RECORDS people add over time (statuses, polls/votes, feedback, requests, bookings, inventory, logs, ANY rows) → it gets a STRUCTURED OBJECT (a grid). Declare it in `backingObject` with sensible typed fields; the platform auto-creates it and the app reads/writes it via object.<slug>.{create,search,update}. This is the DEFAULT for any data-capturing app — it makes the data a browsable grid AND agent-queryable (filter by person/date/field). Each record auto-captures the author + timestamp, so per-person/per-day questions just work.",
    "- If the app only READS data that ALREADY exists (a dashboard/report over contacts, companies, deals, or an existing custom grid) → do NOT make a backingObject; reference the existing object's tools in `tools`.",
    "- ONLY truly transient / UI-only / per-user state (a draft in progress, a view preference, a wizard step) belongs in the bridge's storage.* (no grant). Do NOT use storage.* for shared records — those go in a backingObject so the agent can see them.",
    "- For free-text company KNOWLEDGE that isn't really a record (a decision, a note to remember) → context.remember.",
    "",
    "Output ONLY this JSON plan (no prose):",
    '{ "kind": "declarative" | "hosted", "name": "Short App Name", "summary": "1-2 sentences", "screens": ["names"], "backingObject"?: { "singularName": "Status", "pluralName": "Statuses", "fields": [{ "name": "snake_case_key", "label": "Human Label", "fieldType": "text|long-text|number|currency|select|status|date|checkbox|email|phone|url" }] }, "tools": ["object.<slug>.create","object.<slug>.search", ...other exact broker tool names — minimal], "notes": "key UX/behavior" }',
    "When you declare a backingObject, its slug is the snake_case of pluralName (e.g. \"Statuses\" → statuses); put object.<slug>.create and object.<slug>.search in tools, and (for declarative) bind a form to create + a table to list it.",
  ].join("\n");
}

// ── Phase 2a: BUILD declarative ──────────────────────────────────────────────
export function buildDeclarativeSystemPrompt(): string {
  return [
    "You are the BasicsOS App Builder generating a DECLARATIVE APP SPEC (JSON) per the approved plan. Output ONLY a single fenced ```json block with the spec — no prose.",
    "Build a COMPLETE, genuinely useful app: real titles, sensible columns, multiple blocks where it helps (a metric AND a table, etc.). Do not produce a stub.",
    "",
    "Bind blocks to data through the broker. Available tools: object.{resource}.{search,get,create,update}; context.remember ({text,title?}), context.recent ({k?}), context.search; memory.recall_context; ai.complete/ai.vision (LLM); connector.list/connector.request (admin-connected external APIs). Use ONLY tools from the plan.",
    "",
    "Spec shape (TypeScript):",
    "  interface DeclarativeSpec { version: 1; pages: Array<{ slug: string; title: string; layout: 'single'|'split'|'grid'; blocks: Block[] }>; dataSources: Array<{ id: string; tool: string; params?: object }>; actions?: Array<{ id: string; tool: string; confirm?: boolean }>; }",
    "  type Block =",
    "    | { kind:'metric'; dataSource: string; field: string; agg:'count'|'sum'|'avg'; title?: string }",
    "    | { kind:'table';  dataSource: string; columns: Array<string | { field: string; label?: string }>; title?: string }",
    "    | { kind:'chart';  dataSource: string; x: string; y: string; type:'bar'|'line'; title?: string }",
    "    | { kind:'form';   object: string; onSubmit: string /* action id */; title?: string; submitLabel?: string /* button text, e.g. 'Post Status' */; fields?: Array<{ name: string; label?: string; type?: 'text'|'number'; required?: boolean }> }",
    "    | { kind:'markdown'; text: string };",
    "Rules: every block.dataSource references a dataSources[].id; every form.onSubmit references an actions[].id; write actions set confirm:true. For a status/journal/message app, use a form whose action is context.remember (field name 'text', optional 'title') + a table over context.recent (columns ['title','text']).",
  ].join("\n");
}

// ── Phase 2b: BUILD hosted ───────────────────────────────────────────────────
export function buildHostedSystemPrompt(): string {
  return [
    "You are the BasicsOS App Builder generating a HOSTED app — a COMPLETE, polished, single-file web app per the approved plan. Output ONLY a single fenced ```html block containing the ENTIRE index.html (inline CSS + JS). No prose, no external resources (no CDNs/fonts/images by URL).",
    "QUALITY BAR (this is the whole point — build it properly, like a real engineer): a clean dark UI that fits an operating-system shell; handle loading, empty, and error states; sensible layout; no bugs. Do NOT output a stub or placeholder.",
    "",
    "The app runs SANDBOXED (opaque origin, no host cookies/storage/DOM). It talks to the host ONLY via a versioned postMessage bridge. You MUST include this bridge boilerplate VERBATIM at the very top of your <script> (do not paraphrase it — a missing `app:ready` reply means NOTHING works; `applyTheme` is what makes the app match the host's look):",
    "----- COPY EXACTLY -----",
    "const __pending=new Map(); let __host=null;",
    "function request(method,params){return new Promise((resolve,reject)=>{const id=Math.random().toString(36).slice(2)+Date.now().toString(36);__pending.set(id,{resolve,reject});parent.postMessage({v:1,id,method,params},'*');setTimeout(()=>{if(__pending.has(id)){__pending.delete(id);reject(new Error('timeout'));}},15000);});}",
    "function applyTheme(t){if(!t||!t.tokens)return;var r=document.documentElement;for(var k in t.tokens){try{r.style.setProperty(k,t.tokens[k]);}catch(e){}}if(t.tokens['--app-font'])document.body.style.fontFamily=t.tokens['--app-font'];}",
    "window.addEventListener('message',(e)=>{const m=e.data;if(!m||typeof m!=='object')return;if(m.event==='host:init'){__host=m.data;applyTheme(__host.theme);parent.postMessage({v:1,event:'app:ready',data:{nonce:m.data&&m.data.nonce}},'*');onReady();return;}if(m.event==='theme:changed'){applyTheme(m.data);return;}if(m.id&&__pending.has(m.id)){const p=__pending.get(m.id);__pending.delete(m.id);if(m.ok)p.resolve(m.result);else p.reject(new Error(m.error&&m.error.message||'bridge error'));}});",
    "----- END COPY -----",
    "Then define `async function onReady(){ ... }` — it runs AFTER the handshake; do all bridge calls + initial render there (call request(...) only inside/after onReady, never before).",
    "",
    "STYLING — the host AUTO-INJECTS its own design-system stylesheet + applyTheme into your bundle, so bare semantic HTML already looks native. Just write clean markup with these built-in classes and DO NOT restyle them or hardcode any colors/fonts:",
    "  - Wrap the app in <div class=\"container\"> (centered max-width).  Group sections in <div class=\"card\">…</div>.",
    "  - Use <h1>/<h2>/<h3>, <p>, <label> directly — already styled.  Muted text: class=\"muted\".",
    "  - <button>Text</button> is a primary button (correct contrast — light bg, dark text in dark mode). Variants: <button class=\"secondary\">, <button class=\"outline\">, <button class=\"ghost\">, <button class=\"destructive\">.",
    "  - <input>, <textarea>, <select> are pre-styled (dark, bordered, correct placeholder color). Pair each with a <label>.",
    "  - <table>/<th>/<td> are pre-styled.  Pills: <span class=\"badge\">.  Layout helpers: class=\"row\" (flex row), class=\"col\" (flex column).",
    "Do NOT add a <style> block that sets colors, button backgrounds, input backgrounds, or fonts — the host owns those (overriding them breaks theming + contrast, e.g. unreadable buttons). Only add minimal layout CSS (spacing, grid, widths) if truly needed, using var(--border)/var(--muted-foreground)/var(--radius) — never literal colors.",
    "",
    "Bridge methods (call via request(method, params)):",
    "  request('auth.session')                          -> { userId, orgId, roles, displayName }   (identity; NO tokens)",
    "  request('tools.list')                            -> [ { name, description, inputSchema } ]  (the granted tools)",
    "  request('tools.call', { name, params })          -> the tool's result (e.g. context.recent -> { results:[...] }; throws if not granted)",
    "  request('storage.get', { key, scope })           -> the stored JSON value | null   (scope 'app' = shared company-wide; 'user' = per-user)",
    "  request('storage.set', { key, value, scope })    -> persists JSON; use for app STATE/data (polls, votes, settings, drafts)",
    "  request('ui.toast', { kind:'success'|'error'|'info', message })",
    "",
    "CRITICAL — persistence: do NOT use localStorage, sessionStorage, cookies, or IndexedDB. They are BLOCKED in the sandbox (opaque origin) and will silently fail. For ANY state that must survive a reload or be SHARED ACROSS TEAMMATES, use request('storage.set'/'storage.get') with scope 'app' (shared company-wide — this is how multiple users see the same polls/messages), or scope 'user' for per-user state. Hold only transient in-memory state in JS variables.",
    "MULTI-USER: app-scope storage + context.* are shared across ALL company members, so a poll/board/message one teammate creates is visible to everyone. Use auth.session().userId to attribute actions (e.g. one-vote-per-user, message authorship) and reflect other users' changes on poll/refresh.",
    "Use ONLY the broker tools from the plan via tools.call. For a messaging/status app: post with tools.call('context.remember',{text, title}) and load the feed with tools.call('context.recent',{k:30}); poll every few seconds. context.recent returns ONLY this app's entries.",
    "Everything posted via context.remember becomes part of the company context the AI agent can recall — design status/message/journal apps so their data is captured that way (in addition to storage for structured app state).",
    "AI: if granted, tools.call('ai.complete',{prompt,system?}) returns { text } from an LLM (summarize/draft/classify); tools.call('ai.vision',{imageUrl,prompt}) analyzes an image. CUSTOM EXTERNAL APIs: if granted, tools.call('connector.list') returns the org's connectors (slug+description); then tools.call('connector.request',{connector:'<slug>',method,path,query?,body?}) calls it — the platform injects the API key server-side, so NEVER ask the user for a key in the app. Discover the slug via connector.list at startup.",
  ].join("\n");
}

// ── Phase 3: REVIEW / REFINE ─────────────────────────────────────────────────
export function buildRefineSystemPrompt(kind: "declarative" | "hosted"): string {
  const common =
    "You are reviewing an app YOU just built, like a senior engineer doing a careful code review before shipping. Be critical. Check: (1) COMPLETENESS — is anything missing or stubbed? (2) CORRECTNESS — will the bridge/tool calls actually work; do block/action/dataSource ids line up; are tool names + params valid? (3) UX — loading/empty/error states, clear labels, sensible layout. (4) SECURITY — only the minimal needed tools/grants, no data sent to non-host endpoints, no unsafe content. Fix every issue you find and output the IMPROVED FINAL version.";
  if (kind === "hosted") {
    return `${common}\nSANDBOX CHECK (critical): verify it does NOT use localStorage/sessionStorage/cookies/IndexedDB (these silently fail) — replace with request('storage.set'/'storage.get', {key, value?, scope}). Confirm it includes the verbatim bridge boilerplate (incl. applyTheme + the app:ready reply) and only uses granted tools.\nDESIGN CHECK (critical): the app MUST match the host theme — it should style everything with the CSS variables applyTheme sets (var(--background), var(--card), var(--primary), var(--input), var(--border), var(--foreground), var(--muted-foreground), var(--radius), var(--app-font)). REJECT and fix any hardcoded hex/named colors, white input backgrounds, bright purple/blue buttons, or external fonts — replace them with the matching token. It should look native to a dark operating-system shell.\nOutput ONLY the full improved index.html in a single fenced \`\`\`html block — no prose.`;
  }
  return `${common}\nOutput ONLY the full improved DeclarativeSpec in a single fenced \`\`\`json block — no prose.`;
}

// ── Parsers ──────────────────────────────────────────────────────────────────
/** A structured object the app persists records into (auto-created at build time).
 *  Lets a data app store agent-readable, filterable records instead of an opaque blob. */
export interface PlanBackingObject {
  singularName: string;
  pluralName: string;
  fields?: Array<{ name: string; label: string; fieldType: string }>;
}

export interface BuildPlan {
  kind: "declarative" | "hosted";
  name: string;
  summary?: string;
  screens?: string[];
  tools: string[];
  notes?: string;
  /** present when the app PERSISTS records → build flow scaffolds the object */
  backingObject?: PlanBackingObject;
}

/** Parse the plan JSON (tolerant of fences/prose). */
export function parsePlan(text: string): BuildPlan | null {
  const obj = parseJsonObject(text);
  if (!obj) return null;
  const kind = obj.kind === "hosted" ? "hosted" : "declarative";
  const tools = Array.isArray(obj.tools) ? obj.tools.filter((t): t is string => typeof t === "string") : [];
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "Untitled App";
  let backingObject: PlanBackingObject | undefined;
  const bo = obj.backingObject as Record<string, unknown> | undefined;
  if (bo && typeof bo === "object" && typeof bo.pluralName === "string" && bo.pluralName.trim()) {
    const rawFields = Array.isArray(bo.fields) ? bo.fields : [];
    backingObject = {
      singularName:
        typeof bo.singularName === "string" && bo.singularName.trim() ? bo.singularName.trim() : bo.pluralName.trim(),
      pluralName: bo.pluralName.trim(),
      fields: rawFields
        .map((f) => f as Record<string, unknown>)
        .filter((f) => typeof f?.name === "string" && (f.name as string).trim())
        .map((f) => ({
          name: String(f.name),
          label: typeof f.label === "string" && f.label.trim() ? String(f.label) : String(f.name),
          fieldType: typeof f.fieldType === "string" ? String(f.fieldType) : "text",
        })),
    };
  }
  return {
    kind,
    name,
    summary: typeof obj.summary === "string" ? obj.summary : undefined,
    screens: Array.isArray(obj.screens) ? obj.screens.filter((s): s is string => typeof s === "string") : undefined,
    tools,
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
    backingObject,
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const candidates: string[] = [];
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) if (m[1]) candidates.push(m[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* next */
    }
  }
  return null;
}

interface SpecLike {
  pages?: unknown;
  dataSources?: Array<{ tool?: unknown }>;
  actions?: Array<{ tool?: unknown }>;
}

/** Extract the first valid DeclarativeSpec (has pages[]). */
export function parseSpecFromText(text: string): Record<string, unknown> | null {
  const obj = parseJsonObject(text);
  if (obj && Array.isArray((obj as SpecLike).pages)) return obj;
  return null;
}

/** Extract a complete HTML document from a hosted-build response. */
export function extractHtmlFromText(text: string): string | null {
  if (!text) return null;
  const fence = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fence && fence[1] ? fence[1] : text).trim();
  const lower = candidate.toLowerCase();
  const start = lower.indexOf("<!doctype");
  const htmlStart = start >= 0 ? start : lower.indexOf("<html");
  if (htmlStart < 0) return null;
  const end = lower.lastIndexOf("</html>");
  if (end < 0) return null;
  return candidate.slice(htmlStart, end + "</html>".length);
}

/** Minimal permission grants = the unique broker tools the spec references. */
export function derivePermissions(spec: Record<string, unknown>): string[] {
  const s = spec as SpecLike;
  const tools = new Set<string>();
  for (const d of Array.isArray(s.dataSources) ? s.dataSources : []) if (typeof d?.tool === "string") tools.add(d.tool);
  for (const a of Array.isArray(s.actions) ? s.actions : []) if (typeof a?.tool === "string") tools.add(a.tool);
  return [...tools];
}

/** Permissions for a hosted app = the plan's chosen tools (bundle tool use isn't
 *  statically extractable, so we trust the reviewed plan + the runtime grant gate). */
export function hostedPermissions(plan: BuildPlan): string[] {
  return [...new Set(plan.tools)];
}

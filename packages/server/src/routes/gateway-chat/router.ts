import { z } from "zod";

export type RouterConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRoutingDecision = {
  mode: "direct" | "crm_context" | "tool_call";
  reply?: string;
  shouldGenerateTitle: boolean;
};

const routingDecisionSchema = z.object({
  mode: z.enum(["direct", "crm_context", "tool_call"]),
  reply: z.string().optional(),
  shouldGenerateTitle: z.boolean().optional(),
});

function compactLine(text: string, maxLen = 220): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 3).trimEnd()}...`;
}

function buildConversationSnippet(
  messages: RouterConversationMessage[],
  maxMessages = 6,
): string {
  const recent = messages.filter((message) => message.content.trim()).slice(-maxMessages);
  if (recent.length === 0) return "None";
  return recent
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${compactLine(message.content)}`)
    .join("\n");
}

function parseStructuredResponse(text: string): ChatRoutingDecision | null {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() || trimmed;
  try {
    const parsed = JSON.parse(candidate);
    const validated = routingDecisionSchema.safeParse(parsed);
    if (!validated.success) return null;
    return {
      mode: validated.data.mode,
      reply: validated.data.reply?.trim() || undefined,
      shouldGenerateTitle: validated.data.shouldGenerateTitle ?? validated.data.mode !== "direct",
    };
  } catch {
    return null;
  }
}

function detectFastPath(queryText: string): ChatRoutingDecision | null {
  const trimmed = queryText.trim();
  const lower = trimmed.toLowerCase();
  if (!lower) return null;

  if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)[!. ]*$/i.test(trimmed)) {
    return {
      mode: "direct",
      reply: "Hi! How can I help?",
      shouldGenerateTitle: false,
    };
  }

  if (/^(thanks|thank you|thx|nice|cool|great)[!. ]*$/i.test(trimmed)) {
    return {
      mode: "direct",
      reply: "Anytime.",
      shouldGenerateTitle: false,
    };
  }

  const hasEntity = /\b(contact|contacts|person|people|lead|leads|company|companies|organization|organizations|deal|deals|opportunity|opportunities|task|tasks|todo|todos|note|notes)\b/.test(lower);
  const obviousToolQuery =
    hasEntity &&
    (
      /\b(latest|newest|most recent|recent|last|list|show|find|search|lookup)\b/.test(lower) ||
      /\b(create|add|make|update|edit|rename|change|complete|mark)\b/.test(lower)
    );

  // Enrichment intent
  const hasEnrichment = /\b(enrich|research)\b/.test(lower) && hasEntity;
  // Delete intent
  const hasDelete = /\b(delete|remove|trash)\b/.test(lower) && hasEntity;
  // Web search intent
  const hasWebSearch = /\b(search the web|google|look up online|research online)\b/.test(lower);
  // Report intent
  const hasReport = /\b(report|chart|graph|breakdown|pipeline summary|analytics)\b/.test(lower);
  // View management intent
  const hasViewMgmt = /\b(create a view|make a view|filtered view|set up a view)\b/.test(lower);
  // Automation intent
  const hasAutomation = /\b(automate|create an automation|when .* then)\b/.test(lower);
  // Browse intent
  const hasBrowse = /\b(browse|visit|scrape|extract from)\b/.test(lower) && /\b(url|page|website|site)\b/.test(lower);

  if (hasEnrichment || hasDelete || hasWebSearch || hasReport || hasViewMgmt || hasAutomation || hasBrowse) {
    return { mode: "tool_call", shouldGenerateTitle: true };
  }

  if (obviousToolQuery) {
    return {
      mode: "tool_call",
      shouldGenerateTitle: true,
    };
  }

  return null;
}

export async function routeChatRequest(args: {
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
  queryText: string;
  recentConversation: RouterConversationMessage[];
}): Promise<ChatRoutingDecision | null> {
  const fastPath = detectFastPath(args.queryText);
  if (fastPath) return fastPath;

  const prompt = [
    "You are the first-pass router for the BasicsOS CRM assistant.",
    "Return ONLY JSON. No prose, no markdown.",
    'Schema: {"mode":"direct|crm_context|tool_call","reply":"optional direct reply","shouldGenerateTitle":true}',
    "Decide the cheapest correct path for the NEXT assistant step.",
    "Modes:",
    '- "direct" = answer immediately without CRM summary, embeddings, or tools.',
    '- "crm_context" = needs CRM context/retrieval, but not record-changing tools.',
    '- "tool_call" = needs tools to search/create/update/list CRM records or notes/tasks.',
    "Rules:",
    '- Use "direct" for greetings, thanks, small talk, writing help, brainstorming, generic product questions, and normal conversation that does not require org-specific CRM data.',
    '- Use "crm_context" for org-specific read questions like summaries, recent items, pipeline status, hot contacts, or questions that depend on CRM facts but not mutations. Also use for questions about past meetings or calls (e.g. "what did we decide?", "who said we\'d follow up?") so we can retrieve meeting context.',
    '- Use "tool_call" for anything that should search specific records, list records for an entity, or create/update/complete/add records, tasks, or notes. Use for questions that mix a specific record with meeting/call context (e.g. "what did we decide about Acme?") so we retrieve both CRM and meeting context.',
    '- Use "tool_call" when the user refers to a specific record by name, partial name, description, relationship, or prior context and the assistant needs to identify that record before answering.',
    '- Use recent conversation to resolve pronouns like "it", "that company", or "do that again".',
    '- If mode is "direct", include a short natural-language reply in "reply".',
    '- If mode is not "direct", omit "reply".',
    '- Set "shouldGenerateTitle" to false only for trivial direct exchanges like greetings, thanks, or goodbyes. Otherwise set it to true.',
    "",
    `Recent conversation:\n${buildConversationSnippet(args.recentConversation)}`,
    `User message: ${args.queryText}`,
  ].join("\n");

  const res = await fetch(`${args.gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: args.gatewayHeaders,
    body: JSON.stringify({
      model: "basics-chat-smart",
      messages: [{ role: "user", content: prompt }],
      stream: false,
      max_tokens: 140,
    }),
  });

  if (!res.ok) {
    await res.text().catch(() => {});
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return parseStructuredResponse(json.choices?.[0]?.message?.content ?? "");
}

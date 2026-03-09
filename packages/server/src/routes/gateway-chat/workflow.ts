import { z } from "zod";

const TOOL_NAMES = [
  "search_contacts",
  "get_contact",
  "create_contact",
  "update_contact",
  "search_companies",
  "get_company",
  "create_company",
  "update_company",
  "search_deals",
  "get_deal",
  "create_deal",
  "update_deal",
  "search_tasks",
  "list_tasks",
  "create_task",
  "complete_task",
  "list_notes",
  "create_note",
  "add_note",
] as const;

const LOOKUP_TOOLS = new Set([
  "search_contacts",
  "get_contact",
  "search_companies",
  "get_company",
  "search_deals",
  "get_deal",
  "search_tasks",
]);

const toolNameSchema = z.enum(TOOL_NAMES);

const workflowStepSchema = z.object({
  tool: toolNameSchema,
  args: z.record(z.unknown()).default({}),
  deferred: z.boolean().default(false),
});

const workflowPlanSchema = z.object({
  mode: z.enum(["none", "single_tool", "multi_tool"]),
  steps: z.array(workflowStepSchema).max(8).default([]),
});

const resolvedStepSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("tool"),
    tool: toolNameSchema,
    args: z.record(z.unknown()),
  }),
  z.object({
    mode: z.literal("blocked"),
    message: z.string().min(1),
  }),
]);

type WorkflowStep = {
  tool: (typeof TOOL_NAMES)[number];
  args: Record<string, unknown>;
  deferred: boolean;
};

export type WorkflowPlan = {
  mode: "none" | "single_tool" | "multi_tool";
  steps: WorkflowStep[];
};

export type ResolvedWorkflowStep =
  | {
      mode: "tool";
      tool: (typeof TOOL_NAMES)[number];
      args: Record<string, unknown>;
    }
  | { mode: "blocked"; message: string };

type LookupCandidate = {
  id: number;
  name: string;
};

function extractStructuredText(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

function parseJsonWithSchema<T>(text: string, schema: z.ZodType<T>): T | null {
  const candidate = extractStructuredText(text);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    const validated = schema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export function shouldPlanToolWorkflow(queryText: string): boolean {
  const lower = queryText.toLowerCase();
  const isUpdate = /\b(update|rename|change|edit|set)\b/.test(lower);
  const isTask = /\b(task|reminder|follow-up|follow up|todo)\b/.test(lower);
  const isNote = /\bnote\b/.test(lower);
  const isCreateContact =
    /\b(create|add|make)\b/.test(lower) &&
    /\b(contact|person|lead)\b/.test(lower) &&
    /\bcompany|companies|organization\b/.test(lower);
  const isCreateDeal =
    /\b(create|add|make)\b/.test(lower) &&
    /\b(deal|opportunity|deals|opportunities)\b/.test(lower) &&
    /\bcompany|companies|organization\b/.test(lower);

  return (
    isUpdate ||
    (isTask && /\bcontact|contacts|person|people|lead|leads\b/.test(lower)) ||
    (isNote &&
      /\bcontact|contacts|person|people|lead|leads|deal|deals|opportunity|opportunities\b/.test(
        lower,
      )) ||
    isCreateContact ||
    isCreateDeal
  );
}

export function isLookupTool(toolName: string): boolean {
  return LOOKUP_TOOLS.has(toolName);
}

export function isLookupFailure(result: unknown): boolean {
  if (typeof result !== "string") return false;
  return /^(No .* found\.?|Not found\.?|Error:)/i.test(result.trim());
}

function cleanLookupQuery(text: string): string {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.?!]+$/g, "")
    .trim();
}

function inferLookupQueryFromUserRequest(
  userQuery: string,
  lookupTool: string,
): string | undefined {
  const lower = userQuery.toLowerCase();
  const entityWord =
    lookupTool === "search_companies"
      ? "company"
      : lookupTool === "search_contacts"
        ? "(?:contact|person|lead)"
        : lookupTool === "search_deals"
          ? "(?:deal|opportunity)"
          : lookupTool === "search_tasks"
            ? "(?:task|todo|reminder|follow-up)"
            : null;
  if (!entityWord) return undefined;

  const betweenEntityAndTo = new RegExp(
    `\\b${entityWord}\\b\\s+(.+?)\\s+\\bto\\b`,
    "i",
  ).exec(userQuery);
  if (betweenEntityAndTo?.[1]) {
    const cleaned = cleanLookupQuery(betweenEntityAndTo[1]);
    if (cleaned) return cleaned;
  }

  if (/\b(update|rename|change|edit|set)\b/.test(lower)) {
    const ofEntity = new RegExp(
      `\\bof\\s+${entityWord}\\b\\s+(.+?)\\s+\\bto\\b`,
      "i",
    ).exec(userQuery);
    if (ofEntity?.[1]) {
      const cleaned = cleanLookupQuery(ofEntity[1]);
      if (cleaned) return cleaned;
    }
  }

  return undefined;
}

function normalizeLookupStepArgs(
  userQuery: string,
  tool: string,
  rawArgs: Record<string, unknown>,
): Record<string, unknown> {
  if (!isLookupTool(tool)) return rawArgs;

  const explicitQuery =
    typeof rawArgs.query === "string"
      ? cleanLookupQuery(rawArgs.query)
      : undefined;
  const inferredQuery = inferLookupQueryFromUserRequest(userQuery, tool);
  const query = inferredQuery || explicitQuery;

  return query ? { ...rawArgs, query } : rawArgs;
}

function extractLookupCandidates(result: string): LookupCandidate[] {
  const candidates: LookupCandidate[] = [];
  const wikiMatches = result.matchAll(
    /\[\[[a-z][a-z0-9-]*\/(\d+)\|([^\]]+)\]\]/gi,
  );
  for (const match of wikiMatches) {
    const id = Number(match[1]);
    const name = match[2]?.trim();
    if (Number.isFinite(id) && name) {
      candidates.push({ id, name });
    }
  }
  return candidates;
}

function normalizeResolvedArgs(
  expectedTool: string,
  rawArgs: Record<string, unknown>,
  candidates: LookupCandidate[],
): Record<string, unknown> {
  const args = { ...rawArgs };
  const first = candidates[0];
  if (!first) return args;

  if (expectedTool === "update_company" || expectedTool === "get_company") {
    if (args.id === undefined && args.company_name === undefined) {
      args.id = first.id;
    }
  }
  if (expectedTool === "update_contact" || expectedTool === "get_contact") {
    if (args.id === undefined && args.contact_name === undefined) {
      args.id = first.id;
    }
  }
  if (expectedTool === "update_deal" || expectedTool === "get_deal") {
    if (args.id === undefined && args.deal_name === undefined) {
      args.id = first.id;
    }
  }

  return args;
}

export async function planToolWorkflow(args: {
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
  model: string;
  queryText: string;
}): Promise<WorkflowPlan | null> {
  const prompt = [
    "You are a CRM tool workflow planner.",
    "Return ONLY JSON. No prose, no markdown.",
    'Schema: {"mode":"none|single_tool|multi_tool","steps":[{"tool":"tool_name","args":{},"deferred":false}]}',
    "Rules:",
    "- Use multi_tool when the request needs more than one tool call.",
    "- Steps must be in execution order.",
    "- If a step depends on a prior lookup result for id or exact record name, set deferred=true on that step.",
    "- Do not invent ids.",
    "- Keep search queries narrow and based only on the CURRENT/original record being referenced.",
    "- For rename requests like 'rename company alpha to beta', search for 'alpha', not 'beta' and not the whole sentence.",
    "- For requests with 'and also', search only for the record reference, not the later requested changes.",
    "- Include any write fields you already know in step args, even when deferred=true.",
    "- Include every requested action from the user. Do not stop after the first successful action.",
    "- Non-deferred steps should include complete args and should be executable immediately.",
    "- Valid tools: " + TOOL_NAMES.join(", "),
    "Example:",
    "User: update the name of company about toching to touching company",
    'JSON: {"mode":"multi_tool","steps":[{"tool":"search_companies","args":{"query":"about toching"}},{"tool":"update_company","args":{"name":"touching company"},"deferred":true}]}',
    "User: update the name of company about toching to touching company and also change the description to not touching people",
    'JSON: {"mode":"multi_tool","steps":[{"tool":"search_companies","args":{"query":"about toching"}},{"tool":"update_company","args":{"name":"touching company","description":"not touching people"},"deferred":true}]}',
    "User: update the name of company about toching to touching company and also change the description to not touching people also create a new company called speakl",
    'JSON: {"mode":"multi_tool","steps":[{"tool":"search_companies","args":{"query":"about toching"}},{"tool":"update_company","args":{"name":"touching company","description":"not touching people"},"deferred":true},{"tool":"create_company","args":{"name":"speekl"}}]}',
    "",
    `User request: ${args.queryText}`,
  ].join("\n");

  const res = await fetch(`${args.gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: args.gatewayHeaders,
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    await res.text().catch(() => {});
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const rawPlan = parseJsonWithSchema(text, workflowPlanSchema);
  if (!rawPlan) return null;
  const plan: WorkflowPlan = {
    mode: rawPlan.mode,
    steps: (rawPlan.steps ?? []).map((step) => ({
      tool: step.tool,
      args: normalizeLookupStepArgs(args.queryText, step.tool, step.args ?? {}),
      deferred: step.deferred ?? false,
    })),
  };
  if (plan.mode === "multi_tool" && plan.steps.length >= 1) {
    return plan;
  }
  return plan.mode === "single_tool" || plan.mode === "none" ? plan : null;
}

export async function resolveDeferredToolStep(args: {
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
  model: string;
  queryText: string;
  expectedTool: string;
  plannedArgs?: Record<string, unknown>;
  lookupTool: string;
  lookupResult: string;
}): Promise<ResolvedWorkflowStep | null> {
  const prompt = [
    "You are a CRM tool-call resolver.",
    "A lookup step has already been executed.",
    "Return ONLY JSON. No prose, no markdown.",
    'If you can produce the next tool call, return: {"mode":"tool","tool":"tool_name","args":{}}',
    'If the request is blocked, return: {"mode":"blocked","message":"short explanation"}',
    "Rules:",
    `- The next tool MUST be ${args.expectedTool}.`,
    "- Reuse ids or exact names from the lookup result.",
    "- For update/get tools, include the record identifier in args. Prefer id from the lookup result.",
    "- Apply all requested updates from the original user request.",
    "- Preserve any planned args that are already correct.",
    "- Do not do another search.",
    "",
    `Original user request: ${args.queryText}`,
    `Required tool: ${args.expectedTool}`,
    `Planned args: ${JSON.stringify(args.plannedArgs ?? {})}`,
    `Lookup tool: ${args.lookupTool}`,
    `Lookup result: ${args.lookupResult}`,
    `Candidates: ${JSON.stringify(extractLookupCandidates(args.lookupResult))}`,
  ].join("\n");

  const res = await fetch(`${args.gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: args.gatewayHeaders,
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    await res.text().catch(() => {});
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const rawResolved = parseJsonWithSchema(text, resolvedStepSchema);
  if (!rawResolved) return null;
  const resolved: ResolvedWorkflowStep =
    rawResolved.mode === "tool"
      ? {
          mode: "tool",
          tool: rawResolved.tool,
          args: normalizeResolvedArgs(
            args.expectedTool,
            rawResolved.args ?? {},
            extractLookupCandidates(args.lookupResult),
          ),
        }
      : { mode: "blocked", message: rawResolved.message };
  if (resolved.mode === "tool" && resolved.tool !== args.expectedTool) {
    return null;
  }
  return resolved;
}

import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { buildCrmSummary, retrieveDualContext } from "@/lib/context.js";
import {
  resolveOrgAiConfig,
  buildGatewayHeaders,
} from "@/lib/org-ai-config.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { linkifyRecordNames } from "@/lib/linkify-records.js";
import {
  deriveToolAnswer,
  BASE_SYSTEM_PROMPT,
  OPENAI_TOOL_DEFS,
  buildRecentConversationContext,
  finalizeAssistantText,
  requestSchema,
  sdkPart,
  toOpenAIMessages,
} from "@/routes/gateway-chat/protocol.js";
import {
  ensureThread,
  getThreadMessages,
  persistMessage,
  updateThreadTitle,
  touchThread,
} from "@/routes/gateway-chat/storage.js";
import { executeValidatedTool } from "@/routes/gateway-chat/tools.js";
import {
  isLookupFailure,
  isLookupTool,
  planToolWorkflow,
  resolveDeferredToolStep,
  shouldPlanToolWorkflow,
} from "@/routes/gateway-chat/workflow.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type GatewayToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type SanitizedGatewayToolCalls = {
  toolCalls: GatewayToolCall[];
  invalidToolNames: string[];
};

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 16_000;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOOL_ARGUMENTS_CHARS = 4_000;
const VALID_GATEWAY_TOOL_NAMES: ReadonlySet<string> = new Set(
  OPENAI_TOOL_DEFS.map((definition) => definition.function.name),
);

const WIKI_TOKEN_RE = /\[\[([a-z][a-z0-9-]*)\/(\d+)\|([^\]]+)\]\]/g;

function stripTokens(text: string): string {
  return text.replace(
    WIKI_TOKEN_RE,
    (_m, _slug: string, id: string, name: string) => `${name} (id: ${id})`,
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function toolCallSignature(
  name: string,
  args: Record<string, unknown>,
): string {
  return `${name}:${stableStringify(args)}`;
}

function truncateText(text: string, maxChars = MAX_MESSAGE_CHARS): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

function sanitizeConversationMessages(
  messages: ConversationMessage[],
): ConversationMessage[] {
  const recent = messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: truncateText(message.content),
    }))
    .slice(-MAX_HISTORY_MESSAGES);

  const kept: ConversationMessage[] = [];
  let totalChars = 0;
  for (let index = recent.length - 1; index >= 0; index--) {
    const message = recent[index]!;
    if (
      totalChars + message.content.length > MAX_HISTORY_CHARS &&
      kept.length > 0
    ) {
      break;
    }
    kept.push(message);
    totalChars += message.content.length;
  }

  return kept.reverse();
}

function sanitizeGatewayToolCalls(value: unknown): SanitizedGatewayToolCalls {
  if (!Array.isArray(value)) {
    return { toolCalls: [], invalidToolNames: [] };
  }

  const invalidToolNames = new Set<string>();
  const toolCalls = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const toolCall = entry as Record<string, unknown>;
    const fn =
      toolCall.function && typeof toolCall.function === "object"
        ? (toolCall.function as Record<string, unknown>)
        : null;
    if (typeof toolCall.id !== "string" || typeof fn?.name !== "string") {
      return [];
    }
    if (!VALID_GATEWAY_TOOL_NAMES.has(fn.name)) {
      invalidToolNames.add(fn.name);
      return [];
    }
    return [
      {
        id: toolCall.id,
        type: "function" as const,
        function: {
          name: fn.name,
          arguments:
            typeof fn.arguments === "string"
              ? truncateText(fn.arguments, MAX_TOOL_ARGUMENTS_CHARS)
              : "{}",
        },
      },
    ];
  });

  return {
    toolCalls,
    invalidToolNames: [...invalidToolNames],
  };
}

function buildInvalidToolRetryMessage(invalidToolNames: string[]): string {
  return [
    `Invalid tool call(s): ${invalidToolNames.join(", ")}.`,
    "Never invent tool names.",
    `Use only these tools: ${[...VALID_GATEWAY_TOOL_NAMES].join(", ")}.`,
    "If you need to list or search companies, use `search_companies`.",
  ].join(" ");
}

function sanitizeAssistantGatewayMessage(
  aiMessage: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const message: Record<string, unknown> = { role: "assistant" };
  const content = aiMessage?.content;
  if (typeof content === "string") {
    message.content = truncateText(content);
  } else if (content == null) {
    message.content = null;
  } else {
    message.content = truncateText(JSON.stringify(content));
  }

  const { toolCalls } = sanitizeGatewayToolCalls(aiMessage?.tool_calls);
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  const googleExtra =
    aiMessage?.extra_content &&
    typeof aiMessage.extra_content === "object" &&
    (aiMessage.extra_content as Record<string, unknown>).google &&
    typeof (aiMessage.extra_content as Record<string, unknown>).google ===
      "object"
      ? ((aiMessage.extra_content as Record<string, unknown>).google as Record<
          string,
          unknown
        >)
      : null;
  const thoughtSignature = googleExtra?.thought_signature;
  if (typeof thoughtSignature === "string" && thoughtSignature.trim()) {
    message.extra_content = {
      google: {
        thought_signature: truncateText(
          thoughtSignature,
          MAX_TOOL_ARGUMENTS_CHARS,
        ),
      },
    };
  }

  return message;
}

type WorkflowHints = {
  planText: string;
  nextHintByTool: Record<string, string>;
};

function inferWorkflowHints(queryText: string): WorkflowHints {
  const trimmed = queryText.trim();
  const lower = trimmed.toLowerCase();
  const nextHintByTool: Record<string, string> = {};
  const planLines = [
    "## Multi-step workflow execution",
    "You currently support multi-step tool workflows.",
    "Before replying, identify every tool call required by the user's request and complete them in order.",
    "If a lookup is only preparation for another action, do not stop after the lookup.",
    "Only reply after all required tool calls are complete, or after a required next step is genuinely blocked.",
  ];

  const isUpdate = /\b(update|rename|change|edit|set)\b/.test(lower);
  const isTask = /\b(task|reminder|follow-up|follow up|todo)\b/.test(lower);
  const isNote = /\bnote\b/.test(lower);
  const isCreateContact =
    /\b(create|add|make)\b/.test(lower) &&
    /\b(contact|person|lead)\b/.test(lower);
  const isCreateDeal =
    /\b(create|add|make)\b/.test(lower) &&
    /\b(deal|opportunity|deals|opportunities)\b/.test(lower);

  const entity = /\bcompany|companies|organization\b/.test(lower)
    ? { label: "company", searchTool: "search_companies" }
    : /\bcontact|contacts|person|people|lead|leads\b/.test(lower)
      ? { label: "contact", searchTool: "search_contacts" }
      : /\bdeal|deals|opportunity|opportunities\b/.test(lower)
        ? { label: "deal", searchTool: "search_deals" }
        : null;

  if (isUpdate && entity) {
    const updateTool = `update_${entity.label}`;
    planLines.push(
      `For this request, the required sequence is: identify the ${entity.label} with \`${entity.searchTool}\` if needed, then call \`${updateTool}\`, then confirm the completed change.`,
      `Apply the requested changes from the user's original request exactly: "${trimmed}".`,
    );
    nextHintByTool[entity.searchTool] =
      `Next required step for this request: call \`${updateTool}\` now using the matching ${entity.label} id or exact ${entity.label} name from the lookup result. Apply the requested change from the user's original request exactly: "${trimmed}". Do not reply yet.`;
  }

  if (isTask && /\bcontact|contacts|person|people|lead|leads\b/.test(lower)) {
    planLines.push(
      "For task requests about a person/contact, the usual sequence is: identify the contact first if needed, then call `create_task`, then confirm the task was created.",
    );
    nextHintByTool.search_contacts = `Next required step for this request: call \`create_task\` now using the matching contact id or exact contact name from the lookup result. Apply the user's original request exactly: "${trimmed}". Do not reply yet.`;
  }

  if (isNote && /\bdeal|deals|opportunity|opportunities\b/.test(lower)) {
    planLines.push(
      "For note requests about a deal, the usual sequence is: identify the deal first if needed, then call `add_note`, then confirm the note was added.",
    );
    nextHintByTool.search_deals = `Next required step for this request: call \`add_note\` now using the matching deal id or exact deal name from the lookup result. Apply the user's original request exactly: "${trimmed}". Do not reply yet.`;
  } else if (
    isNote &&
    /\bcontact|contacts|person|people|lead|leads\b/.test(lower)
  ) {
    planLines.push(
      "For note requests about a contact, the usual sequence is: identify the contact first if needed, then call `add_note`, then confirm the note was added.",
    );
    nextHintByTool.search_contacts = `Next required step for this request: call \`add_note\` now using the matching contact id or exact contact name from the lookup result. Apply the user's original request exactly: "${trimmed}". Do not reply yet.`;
  }

  if (isCreateContact && /\bcompany|companies|organization\b/.test(lower)) {
    planLines.push(
      "When creating a contact linked to a company, identify the company first if needed, then call `create_contact` with the company id/name, then confirm the contact was created.",
    );
    nextHintByTool.search_companies = `Next required step for this request: call \`create_contact\` now using the matching company id or exact company name from the lookup result. Apply the user's original request exactly: "${trimmed}". Do not reply yet.`;
  }

  if (isCreateDeal && /\bcompany|companies|organization\b/.test(lower)) {
    planLines.push(
      "When creating a deal linked to a company, identify the company first if needed, then call `create_deal` with the company id/name, then confirm the deal was created.",
    );
    nextHintByTool.search_companies = `Next required step for this request: call \`create_deal\` now using the matching company id or exact company name from the lookup result. Apply the user's original request exactly: "${trimmed}". Do not reply yet.`;
  }

  return { planText: planLines.join("\n"), nextHintByTool };
}

function duplicateToolMessage(name: string, nextStepHint?: string): string {
  if (name.startsWith("search_") || name.startsWith("get_")) {
    return nextStepHint
      ? `Skipped duplicate ${name} call — that lookup already ran in this request. Reuse the earlier result and continue to the next action instead of searching again.\n\n${nextStepHint}`
      : `Skipped duplicate ${name} call — that lookup already ran in this request. Reuse the earlier result and continue to the next action instead of searching again.`;
  }
  return `Skipped duplicate ${name} call — it already ran in this request. Continue from the prior tool result instead of repeating it.`;
}

function buildToolChatContent(
  name: string,
  raw: string,
  nextStepHint?: string,
): string {
  const stripped = stripTokens(raw);
  if (name.startsWith("search_") || name.startsWith("get_")) {
    const nextStepBlock = nextStepHint ? `\n\n${nextStepHint}` : "";
    return `${stripped}\n\nTool guidance: This lookup already produced the candidate records above. Reuse those exact names or IDs for the next tool call. Do not call this same lookup again in this request.${nextStepBlock}`;
  }
  if (name.startsWith("create_") || name.startsWith("update_")) {
    return `${stripped}\n\nTool guidance: The write action is complete. Respond to the user, or only call another tool if the user clearly asked for another action in the same message.`;
  }
  return stripped;
}

async function synthesizeFinalAnswer(args: {
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
  queryText: string;
  toolOutputs: Array<{ name: string; result: unknown }>;
}): Promise<string> {
  const deterministic = deriveToolAnswer(args.queryText, args.toolOutputs);
  if (deterministic) return deterministic;

  if (args.toolOutputs.length === 0) {
    return "I could not complete that request.";
  }

  const toolSummary = args.toolOutputs
    .slice(0, 6)
    .map((output, index) => {
      const result =
        typeof output.result === "string"
          ? stripTokens(output.result)
          : JSON.stringify(output.result);
      return `${index + 1}. ${output.name}\n${result}`;
    })
    .join("\n\n");

  const res = await fetch(`${args.gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: args.gatewayHeaders,
    body: JSON.stringify({
      model: "basics-chat-smart",
      messages: [
        {
          role: "system",
          content:
            "Answer the user's original CRM request using only the tool results provided. Do not mention tools, tool names, raw JSON, or fallback text. If a lookup answered the question, give a full, detailed answer — use paragraphs when appropriate. If a write succeeded, confirm the completed action. If the results are insufficient, explain what's missing.",
        },
        {
          role: "user",
          content: `User request: ${args.queryText}\n\nTool results:\n${toolSummary}`,
        },
      ],
      stream: false,
      max_tokens: 800,
    }),
  });
  if (!res.ok) {
    await res.text().catch(() => {});
    return "I couldn't produce a final answer from the available results.";
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return (
    finalizeAssistantText(json.choices?.[0]?.message?.content ?? "", []) ||
    "I couldn't produce a final answer from the available results."
  );
}

export function createGatewayChatRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
) {
  const app = new Hono();

  /** Create a new thread and return immediately. Client navigates to chat, then appends message. */
  app.post("/start", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const orgAi = await resolveOrgAiConfig(c, db, env);
    if (!orgAi.ok) return orgAi.response;
    const { crmUser } = orgAi.data;
    if (!crmUser.organizationId)
      return c.json({ error: "Organization not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const channel =
      typeof body === "object" &&
      body !== null &&
      "channel" in body &&
      body.channel === "voice"
        ? "voice"
        : typeof body === "object" &&
            body !== null &&
            "channel" in body &&
            body.channel === "automation"
          ? "automation"
          : "chat";

    const threadId = await ensureThread(db, crmUser, undefined, channel);
    return c.json({ threadId }, 200);
  });

  app.post("/", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const orgAi = await resolveOrgAiConfig(c, db, env);
    if (!orgAi.ok) return orgAi.response;
    const { crmUser, aiConfig } = orgAi.data;
    const gatewayHeaders = buildGatewayHeaders(aiConfig);
    if (!crmUser.organizationId)
      return c.json({ error: "Organization not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        400,
      );
    }

    const uiMessages = parsed.data.messages;
    const openAIMessages = toOpenAIMessages(uiMessages);
    const lastUser = [...openAIMessages]
      .reverse()
      .find((m) => m.role === "user") as
      | { role: "user"; content: string }
      | undefined;
    const queryText = lastUser?.content?.trim() ?? "";
    if (!queryText) return c.json({ error: "No user message found" }, 400);

    const threadId = await ensureThread(
      db,
      crmUser,
      parsed.data.threadId,
      parsed.data.channel,
    );
    const storedHistory = parsed.data.threadId?.trim()
      ? await getThreadMessages(db, threadId, crmUser.id)
      : null;
    await persistMessage(db, threadId, "user", queryText);

    // Auto-title thread: immediate fallback, then async smart title via LLM
    if (!parsed.data.threadId?.trim()) {
      const fallback =
        queryText.length > 80 ? queryText.slice(0, 77) + "..." : queryText;
      await updateThreadTitle(db, threadId, fallback);

      // Fire-and-forget: generate a 2-4 word summary title
      generateSmartTitle(
        db,
        threadId,
        queryText,
        gatewayHeaders,
        env.BASICSOS_API_URL,
      ).catch(() => {});
    }

    const priorConversationMessages = sanitizeConversationMessages(
      storedHistory
        ? storedHistory
            .filter((message) => (message.content ?? "").trim())
            .map((message) => ({
              role: message.role as "user" | "assistant",
              content: message.content ?? "",
            }))
        : openAIMessages
            .slice(0, -1)
            .filter(
              (
                message,
              ): message is { role: "user" | "assistant"; content: string } =>
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim().length > 0,
            )
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
    );

    const [crmSummary, { crmContext, meetingContext }] = await Promise.all([
      buildCrmSummary(db, crmUser.organizationId),
      retrieveDualContext(
        db,
        env.BASICSOS_API_URL,
        gatewayHeaders,
        crmUser.organizationId,
        queryText,
        crmUser.id,
      ),
    ]);

    let systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## Your CRM\n${crmSummary}`;
    if (crmContext) systemPrompt += `\n\n## Relevant context\n${crmContext}`;
    if (meetingContext) systemPrompt += `\n\n## Meeting context\n${meetingContext}`;
    const recentConversationContext = buildRecentConversationContext([
      ...priorConversationMessages,
      { role: "user", content: queryText },
    ]);
    if (recentConversationContext) {
      systemPrompt += `\n\n${recentConversationContext}`;
    }
    const workflowHints = inferWorkflowHints(queryText);
    systemPrompt += `\n\n${workflowHints.planText}`;

    // Use a loose type so gateway-specific fields (e.g. Gemini thought_signature)
    // are preserved when echoing assistant messages back to the API.
    const chatMessages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...priorConversationMessages,
      { role: "user", content: queryText },
    ];
    const usedTools = new Set<string>();
    let finalContent = "";
    const latestToolOutputs: Array<{ name: string; result: unknown }> = [];
    const calledOnceTool = new Set<string>();
    const executedToolSignatures = new Set<string>();
    const ONCE_ONLY_TOOLS = new Set([
      "create_contact",
      "create_company",
      "create_deal",
    ]);

    if (!finalContent && shouldPlanToolWorkflow(queryText)) {
      const plannedWorkflow = await planToolWorkflow({
        gatewayUrl: env.BASICSOS_API_URL,
        gatewayHeaders,
        model: "basics-chat-smart",
        queryText,
      });
      if (
        plannedWorkflow?.mode === "multi_tool" &&
        plannedWorkflow.steps.length > 0
      ) {
        let lastLookupContext: {
          tool: string;
          result: string;
          failed: boolean;
        } | null = null;

        for (const step of plannedWorkflow.steps) {
          let toolName = step.tool;
          let toolArgs = step.args ?? {};

          if (step.deferred) {
            if (!lastLookupContext || lastLookupContext.failed) {
              continue;
            }
            const resolvedStep = await resolveDeferredToolStep({
              gatewayUrl: env.BASICSOS_API_URL,
              gatewayHeaders,
              model: "basics-chat-smart",
              queryText,
              expectedTool: step.tool,
              plannedArgs: step.args ?? {},
              lookupTool: lastLookupContext.tool,
              lookupResult: lastLookupContext.result,
            });
            if (resolvedStep?.mode === "blocked") {
              finalContent = resolvedStep.message;
              break;
            }
            if (!resolvedStep || resolvedStep.mode !== "tool") {
              continue;
            }
            toolName = resolvedStep.tool;
            toolArgs = resolvedStep.args ?? {};
          }

          const signature = toolCallSignature(toolName, toolArgs);
          if (executedToolSignatures.has(signature)) {
            continue;
          }
          executedToolSignatures.add(signature);

          const result = await executeValidatedTool(
            db,
            crmUser.id,
            crmUser.organizationId,
            toolName,
            toolArgs,
            {
              gatewayUrl: env.BASICSOS_API_URL,
              gatewayHeaders,
              crmUserId: crmUser.id,
            },
          );
          usedTools.add(toolName);
          latestToolOutputs.push({ name: toolName, result });
          await persistMessage(db, threadId, "tool", JSON.stringify(result), {
            toolName,
            toolArgs,
            toolResult: result,
          });

          if (isLookupTool(toolName)) {
            const lookupRaw =
              typeof result === "string" ? result : JSON.stringify(result);
            lastLookupContext = {
              tool: toolName,
              result: lookupRaw,
              failed: isLookupFailure(result),
            };
          }
        }

        if (!finalContent && latestToolOutputs.length > 0) {
          finalContent = await synthesizeFinalAnswer({
            gatewayUrl: env.BASICSOS_API_URL,
            gatewayHeaders,
            queryText,
            toolOutputs: latestToolOutputs,
          });
        }
      }
    }

    const MAX_TOOL_ROUNDS = 5;
    for (let i = 0; i < MAX_TOOL_ROUNDS && !finalContent; i++) {
      const isLastRound = i === MAX_TOOL_ROUNDS - 1;

      let res: Response;
      try {
        res = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
          method: "POST",
          headers: gatewayHeaders,
          body: JSON.stringify({
            model: "basics-chat-smart",
            messages: chatMessages,
            ...(isLastRound
              ? {}
              : { tools: OPENAI_TOOL_DEFS, tool_choice: "auto" }),
            stream: false,
          }),
        });
      } catch (err) {
        console.error("[gateway-chat] fetch error:", err);
        return c.json({ error: "Failed to reach AI gateway" }, 502);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("[gateway-chat] gateway error:", res.status, errText);
        if (latestToolOutputs.length > 0) {
          finalContent = await synthesizeFinalAnswer({
            gatewayUrl: env.BASICSOS_API_URL,
            gatewayHeaders,
            queryText,
            toolOutputs: latestToolOutputs,
          });
          break;
        }
        return c.json(
          {
            error: `Gateway error ${res.status}`,
            details: errText.slice(0, 400),
          },
          502,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: Record<string, unknown> }>;
      };

      const aiMessage = json.choices?.[0]?.message;
      const { toolCalls, invalidToolNames } = sanitizeGatewayToolCalls(
        aiMessage?.tool_calls,
      );

      if (toolCalls.length === 0 && invalidToolNames.length === 0) {
        if (latestToolOutputs.length > 0) {
          finalContent = await synthesizeFinalAnswer({
            gatewayUrl: env.BASICSOS_API_URL,
            gatewayHeaders,
            queryText,
            toolOutputs: latestToolOutputs,
          });
        } else {
          finalContent = finalizeAssistantText(
            String(aiMessage?.content ?? ""),
          );
        }
        break;
      }

      // Push the FULL message from the gateway so gateway-specific fields
      // (e.g. Gemini thought_signature under extra_content.google) are
      // included in the next request for proper multi-turn tool calling.
      chatMessages.push(sanitizeAssistantGatewayMessage(aiMessage));
      if (invalidToolNames.length > 0) {
        chatMessages.push({
          role: "system",
          content: buildInvalidToolRetryMessage(invalidToolNames),
        });
      }
      if (toolCalls.length === 0) {
        continue;
      }

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }

        if (
          ONCE_ONLY_TOOLS.has(tc.function.name) &&
          calledOnceTool.has(tc.function.name)
        ) {
          const skipped = `Skipped duplicate ${tc.function.name} call — record was already created.`;
          chatMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: skipped,
          });
          continue;
        }
        if (ONCE_ONLY_TOOLS.has(tc.function.name)) {
          calledOnceTool.add(tc.function.name);
        }

        const nextStepHint = workflowHints.nextHintByTool[tc.function.name];
        const signature = toolCallSignature(tc.function.name, args);
        if (executedToolSignatures.has(signature)) {
          chatMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: duplicateToolMessage(tc.function.name, nextStepHint),
          });
          continue;
        }
        executedToolSignatures.add(signature);

        const result = await executeValidatedTool(
          db,
          crmUser.id,
          crmUser.organizationId,
          tc.function.name,
          args,
          {
            gatewayUrl: env.BASICSOS_API_URL,
            gatewayHeaders,
            crmUserId: crmUser.id,
          },
        );
        usedTools.add(tc.function.name);
        latestToolOutputs.push({ name: tc.function.name, result });
        await persistMessage(db, threadId, "tool", JSON.stringify(result), {
          toolName: tc.function.name,
          toolArgs: args,
          toolResult: result,
        });

        const raw =
          typeof result === "string" ? result : JSON.stringify(result);
        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: buildToolChatContent(tc.function.name, raw, nextStepHint),
        });
      }
    }

    if (!finalContent)
      finalContent =
        latestToolOutputs.length > 0
          ? await synthesizeFinalAnswer({
              gatewayUrl: env.BASICSOS_API_URL,
              gatewayHeaders,
              queryText,
              toolOutputs: latestToolOutputs,
            })
          : "I could not complete that request. Please try again.";
    if (latestToolOutputs.length > 0) {
      finalContent = await synthesizeFinalAnswer({
        gatewayUrl: env.BASICSOS_API_URL,
        gatewayHeaders,
        queryText,
        toolOutputs: latestToolOutputs,
      });
    } else {
      finalContent = finalizeAssistantText(finalContent);
    }
    finalContent = await linkifyRecordNames(
      db,
      crmUser.organizationId,
      finalContent,
    );
    await persistMessage(db, threadId, "assistant", finalContent);
    await touchThread(db, threadId);

    const encoder = new TextEncoder();
    const parts = finalContent.match(/[\s\S]{1,140}/g) ?? [finalContent];
    const outStream = new ReadableStream({
      start(controller) {
        for (const part of parts)
          controller.enqueue(encoder.encode(sdkPart("0", part)));
        controller.enqueue(
          encoder.encode(sdkPart("d", { finishReason: "stop" })),
        );
        controller.close();
      },
    });

    return new Response(outStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
        "Cache-Control": "no-cache",
        "X-Thread-Id": threadId,
        "X-Tools-Used": Array.from(usedTools).join(","),
        "Access-Control-Expose-Headers": "X-Thread-Id, X-Tools-Used",
      },
    });
  });

  return app;
}

async function generateSmartTitle(
  db: Db,
  threadId: string,
  queryText: string,
  gatewayHeaders: Record<string, string>,
  gatewayUrl: string,
): Promise<void> {
  const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: gatewayHeaders,
    body: JSON.stringify({
      model: "basics-chat-smart",
      messages: [
        {
          role: "user",
          content: `Summarize this conversation topic in 2-4 words. Reply with ONLY the title, no quotes or punctuation.\n\nUser: ${queryText.slice(0, 500)}`,
        },
      ],
      stream: false,
      max_tokens: 20,
    }),
  });

  if (!res.ok) return;

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const title = json.choices?.[0]?.message?.content?.trim();
  if (title && title.length > 0 && title.length <= 80) {
    await updateThreadTitle(db, threadId, title);
  }
}

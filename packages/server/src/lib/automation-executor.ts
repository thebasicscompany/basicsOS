import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { WorkflowDefinition } from "@/lib/automation-engine.js";
import { topologicalSort } from "@basics-os/shared";
import { executeEmail } from "@/lib/automation-actions/email.js";
import { executeAI } from "@/lib/automation-actions/ai-task.js";
import { executeWebSearch } from "@/lib/automation-actions/web-search.js";
import { executeCrmAction } from "@/lib/automation-actions/crm-action.js";
import { executeSlack } from "@/lib/automation-actions/slack.js";
import { executeGmailRead } from "@/lib/automation-actions/gmail-read.js";
import { executeGmailSend } from "@/lib/automation-actions/gmail-send.js";
import { buildSessionKey, hermesComplete } from "@/lib/hermes/client.js";
import { sendNotification } from "@/routes/notifications.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";
import { writeUsageLogSafe } from "@/lib/usage-log.js";
import * as schema from "@/db/schema/index.js";

type CrmUserRow = { id: number; organizationId?: string | null; userId?: string };

async function resolveApiKeyForOrg(
  db: Db,
  env: Env,
  organizationId: string | null | undefined,
): Promise<string> {
  if (organizationId) {
    const [orgConfig] = await db
      .select()
      .from(schema.orgAiConfig)
      .where(eq(schema.orgAiConfig.organizationId, organizationId))
      .limit(1);
    if (orgConfig?.apiKeyEnc) {
      const decrypted = decryptApiKey(orgConfig.apiKeyEnc);
      if (decrypted) return decrypted;
    }
  }
  if (env.SERVER_BASICS_API_KEY) return env.SERVER_BASICS_API_KEY;
  if (env.SERVER_BYOK_API_KEY) return env.SERVER_BYOK_API_KEY;
  return "";
}

export async function executeWorkflow(
  workflowDef: WorkflowDefinition,
  triggerData: Record<string, unknown>,
  crmUser: CrmUserRow,
  db: Db,
  env: Env,
  ruleId?: number,
): Promise<Record<string, unknown>> {
  const { nodes, edges } = workflowDef;

  if (!nodes?.length) return { trigger_data: triggerData };

  const order = topologicalSort(
    nodes.map((n) => n.id),
    edges ?? []
  );

  const context: Record<string, unknown> = {
    trigger_data: triggerData,
    crm_user_id: crmUser.id,
  };

  const apiKey = await resolveApiKeyForOrg(db, env, crmUser.organizationId);

  // Resolve Better Auth userId for per-user gateway connections
  let betterAuthUserId: string = crmUser.userId ?? "";
  if (!betterAuthUserId) {
    const [row] = await db
      .select({ userId: schema.crmUsers.userId })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, crmUser.id))
      .limit(1);
    if (!row) throw new Error(`CRM user ${crmUser.id} not found`);
    betterAuthUserId = row.userId;
  }

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const data = resolveTemplates(node.data, context);

    switch (node.type) {
      case "trigger_event":
      case "trigger_schedule":
        // Trigger nodes just initialize context
        break;

      case "action_email": {
        await executeEmail(data, context, apiKey, env);
        if (crmUser.organizationId) {
          writeUsageLogSafe(db, {
            organizationId: crmUser.organizationId,
            crmUserId: crmUser.id,
            feature: "automation_email",
          });
        }
        break;
      }

      case "action_ai": {
        const aiResult = await executeAI(data, context, apiKey, env);
        context.ai_result = aiResult.result;
        if (crmUser.organizationId) {
          writeUsageLogSafe(db, {
            organizationId: crmUser.organizationId,
            crmUserId: crmUser.id,
            feature: "automation_ai",
            model: aiResult.usage.model,
            inputTokens: aiResult.usage.inputTokens,
            outputTokens: aiResult.usage.outputTokens,
          });
        }
        break;
      }

      case "action_web_search": {
        const results = await executeWebSearch(data, context, env, apiKey);
        context.web_results = results;
        break;
      }

      case "action_crm": {
        const crmResult = await executeCrmAction(data, context, db, crmUser.id);
        context.crm_result = crmResult.crm_result;
        break;
      }

      case "action_slack": {
        const slackResult = await executeSlack(data, context, apiKey, env, betterAuthUserId);
        context.slack_result = slackResult;
        break;
      }

      case "action_gmail_read": {
        const gmailRead = await executeGmailRead(data, context, apiKey, env, betterAuthUserId);
        context.gmail_messages = gmailRead.gmail_messages;
        break;
      }

      case "action_gmail_send":
        await executeGmailSend(data, context, apiKey, env, betterAuthUserId);
        break;

      case "action_notify_user": {
        const title = resolveString((data.title as string) ?? "", context);
        const body = resolveString((data.body as string) ?? "", context);
        const ctxStr = resolveString((data.context as string) ?? "", context);
        const orgId = crmUser.organizationId ?? "";
        if (orgId && betterAuthUserId) {
          sendNotification(orgId, betterAuthUserId, {
            title: title || "Notification",
            body: body || "",
            context: ctxStr || undefined,
            actions: [
              { id: "respond_in_chat", label: "Respond in chat", url: ctxStr || undefined },
              { id: "dismiss", label: "Dismiss" },
            ],
          });
        }
        context.notify_result = { sent: true };
        break;
      }

      case "action_ai_agent": {
        // M6: the agentic step runs through hermes + the MCP Broker, acting AS the
        // automation's owner. The session key carries the user identity (forwarded
        // to the Broker via the _meta passthrough), so the step has the full
        // per-user tool surface + connections — RBAC enforced at the Broker.
        // Replaces the old in-process ai-agent.ts (its private CRM tools).
        const prompt =
          (typeof data.prompt === "string" && data.prompt) ||
          (typeof data.instruction === "string" && data.instruction) ||
          (typeof data.task === "string" && data.task) ||
          "";
        if (!prompt.trim()) {
          context.ai_agent_result = { error: "agentic step has no prompt" };
          break;
        }
        const sessionKey = buildSessionKey(crmUser.id, `automation-${ruleId ?? "adhoc"}`);
        const text = await hermesComplete({ env, sessionKey, message: prompt });
        context.ai_agent_result = text;
        if (crmUser.organizationId) {
          writeUsageLogSafe(db, {
            organizationId: crmUser.organizationId,
            crmUserId: crmUser.id,
            feature: "automation_ai_agent",
          });
        }
        break;
      }

      default:
        console.warn(`[automation-executor] unknown node type: ${node.type}`);
    }
  }

  return context;
}

function resolveTemplates(
  data: Record<string, unknown>,
  context: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      result[key] = resolveString(value, context);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = resolveTemplates(value as Record<string, unknown>, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function resolveString(str: string, context: Record<string, unknown>): string {
  return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, varPath) => {
    const parts = varPath.split(".");
    let val: unknown = context;
    for (const part of parts) {
      if (val && typeof val === "object") {
        val = (val as Record<string, unknown>)[part];
      } else {
        val = undefined;
        break;
      }
    }
    if (val === undefined) return `{{${varPath}}}`;
    if (typeof val === "string") return val;
    return JSON.stringify(val);
  });
}

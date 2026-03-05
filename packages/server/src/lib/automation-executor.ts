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
import { executeAIAgent } from "@/lib/automation-actions/ai-agent.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";
import { writeUsageLogSafe } from "@/lib/usage-log.js";
import * as schema from "@/db/schema/index.js";

type CrmUserRow = { id: number; organizationId?: string | null };

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
        const slackResult = await executeSlack(data, context, apiKey, env);
        context.slack_result = slackResult;
        break;
      }

      case "action_gmail_read": {
        const gmailRead = await executeGmailRead(data, context, apiKey, env);
        context.gmail_messages = gmailRead.gmail_messages;
        break;
      }

      case "action_gmail_send":
        await executeGmailSend(data, context, apiKey, env);
        break;

      case "action_ai_agent": {
        const agentResult = await executeAIAgent(data, context, db, crmUser.id, apiKey, env);
        context.ai_agent_result = agentResult.ai_agent_result;
        if (crmUser.organizationId) {
          writeUsageLogSafe(db, {
            organizationId: crmUser.organizationId,
            crmUserId: crmUser.id,
            feature: "automation_ai_agent",
            model: agentResult.usage.model,
            inputTokens: agentResult.usage.inputTokens,
            outputTokens: agentResult.usage.outputTokens,
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

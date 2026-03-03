import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { WorkflowDefinition } from "./automation-engine.js";
import { topologicalSort } from "@basics-os/shared";
import { executeEmail } from "./automation-actions/email.js";
import { executeAI } from "./automation-actions/ai-task.js";
import { executeWebSearch } from "./automation-actions/web-search.js";
import { executeCrmAction } from "./automation-actions/crm-action.js";
import { executeSlack } from "./automation-actions/slack.js";
import { executeGmailRead } from "./automation-actions/gmail-read.js";
import { executeGmailSend } from "./automation-actions/gmail-send.js";
import { executeAIAgent } from "./automation-actions/ai-agent.js";

type SalesRow = { id: number; basicsApiKey?: string | null };

export async function executeWorkflow(
  workflowDef: WorkflowDefinition,
  triggerData: Record<string, unknown>,
  sales: SalesRow,
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
    sales_id: sales.id,
  };

  const apiKey = sales.basicsApiKey ?? "";

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const data = resolveTemplates(node.data, context);

    switch (node.type) {
      case "trigger_event":
      case "trigger_schedule":
        // Trigger nodes just initialize context
        break;

      case "action_email":
        await executeEmail(data, context, apiKey, env);
        break;

      case "action_ai": {
        const result = await executeAI(data, context, apiKey, env);
        context.ai_result = result;
        break;
      }

      case "action_web_search": {
        const results = await executeWebSearch(data, context, env, apiKey);
        context.web_results = results;
        break;
      }

      case "action_crm": {
        const crmResult = await executeCrmAction(data, context, db, sales.id);
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
        const agentResult = await executeAIAgent(data, context, db, sales.id, apiKey, env);
        context.ai_agent_result = agentResult.ai_agent_result;
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

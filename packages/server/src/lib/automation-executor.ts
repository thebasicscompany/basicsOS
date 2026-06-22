import { eq } from "drizzle-orm";
import { readdirSync, statSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
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

/** Files currently in an automation's artifact dir (names only). */
function listArtifacts(env: Env, ruleKey: string): string[] {
  if (!env.HERMES_ARTIFACTS_DIR) return [];
  try {
    const dir = join(env.HERMES_ARTIFACTS_DIR, `automation-${ruleKey}`);
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

/** Remove a per-run artifact dir after its files have been delivered. */
function cleanupArtifacts(env: Env, ruleKey: string): void {
  if (!env.HERMES_ARTIFACTS_DIR) return;
  try {
    rmSync(join(env.HERMES_ARTIFACTS_DIR, `automation-${ruleKey}`), { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

/**
 * Run-artifact delivery: an automation runs headless, so any file its agent
 * generates (file.save / code) has no in-app download surface like chat does.
 * After the agentic step, email the OWNER the files the run just produced
 * (snapshot diff), as attachments, so reports/exports actually reach them.
 */
async function deliverRunArtifacts(
  db: Db,
  env: Env,
  apiKey: string,
  crmUserId: number,
  ruleKey: string,
  before: Set<string>,
): Promise<void> {
  if (!env.HERMES_ARTIFACTS_DIR || !apiKey) return;
  const fresh = listArtifacts(env, ruleKey).filter((n) => !before.has(n));
  if (!fresh.length) return;

  const [owner] = await db
    .select({ email: schema.crmUsers.email })
    .from(schema.crmUsers)
    .where(eq(schema.crmUsers.id, crmUserId))
    .limit(1);
  const to = owner?.email;
  if (!to) return;

  const dir = join(env.HERMES_ARTIFACTS_DIR, `automation-${ruleKey}`);
  const attachments: Array<{ filename: string; content: string }> = [];
  let total = 0;
  for (const filename of fresh.slice(0, 10)) {
    try {
      const buf = readFileSync(join(dir, filename));
      if (buf.length > 8_000_000) continue; // skip oversized single file
      total += buf.length;
      if (total > 20_000_000) break; // cap total payload
      attachments.push({ filename, content: buf.toString("base64") });
    } catch {
      /* skip unreadable */
    }
  }
  if (!attachments.length) return;

  const names = attachments.map((a) => a.filename).join(", ");
  console.warn(`[artifact-delivery] emailing ${attachments.length} file(s) (${names}) to ${to} for automation ${ruleKey}`);
  const res = await fetch(`${env.BASICSOS_API_URL}/v1/email/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      to,
      subject: `Your automation generated ${attachments.length} file${attachments.length > 1 ? "s" : ""}`,
      content: `Your scheduled automation produced ${names}. The file${attachments.length > 1 ? "s are" : " is"} attached.`,
      attachments,
    }),
  }).catch((e) => {
    console.warn(`[artifact-delivery] send failed: ${e}`);
    return null;
  });
  if (res && !res.ok) console.warn(`[artifact-delivery] send returned ${res.status}`);
}

export async function executeWorkflow(
  workflowDef: WorkflowDefinition,
  triggerData: Record<string, unknown>,
  crmUser: CrmUserRow,
  db: Db,
  env: Env,
  ruleId?: number,
  runId?: number,
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
        // Each run gets a FRESH session (per-run key) so the agent never carries
        // memory across firings — no "I already did that" skips, no context bloat.
        const runKey = runId != null ? `${ruleId ?? "adhoc"}-${runId}` : String(ruleId ?? "adhoc");
        const sessionKey = buildSessionKey(crmUser.id, `automation-${runKey}`);
        const text = await hermesComplete({ env, sessionKey, message: prompt });
        context.ai_agent_result = text;
        // The per-run artifact dir starts empty, so every file is new. Deliver them
        // to the owner (headless runs have no download surface), then clean up the
        // dir so disk doesn't grow. Best-effort — never fail the run on these.
        await deliverRunArtifacts(db, env, apiKey, crmUser.id, runKey, new Set()).catch(() => {});
        cleanupArtifacts(env, runKey);
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

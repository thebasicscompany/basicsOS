import type { DbConnection } from "@basicsos/db";
import { createTaskAction } from "./create-task.action.js";
import { callWebhookAction } from "./call-webhook.action.js";
import { runAiPromptAction } from "./run-ai-prompt.action.js";
import { updateCrmAction } from "./update-crm.action.js";

export type ActionContext = {
  tenantId: string;
  triggerPayload: unknown;
  /** The user ID from the triggering event, if available. Used as task creator, etc. */
  triggerUserId: string | undefined;
  db: DbConnection;
};

export type ActionResult = {
  type: string;
  status: "success" | "failed";
  output: unknown;
  error?: string;
  durationMs: number;
};

export type ActionHandler = (config: unknown, ctx: ActionContext) => Promise<Omit<ActionResult, "type" | "durationMs">>;

const stubAction =
  (name: string): ActionHandler =>
  async (_config, _ctx) => ({
    status: "success",
    output: { note: `${name} is not yet configured — requires external service setup` },
  });

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  create_task: createTaskAction,
  call_webhook: callWebhookAction,
  run_ai_prompt: runAiPromptAction,
  update_crm: updateCrmAction,
  send_email: stubAction("send_email"), // stub — needs email service (Resend/SendGrid)
  post_slack: stubAction("post_slack"), // stub — needs Hub Slack OAuth token
};

/**
 * Execute a single action from an automation's actionChain.
 * Records timing and wraps errors so the chain executor can always get a result.
 */
export const executeAction = async (
  action: { type: string; config: unknown },
  ctx: ActionContext,
): Promise<ActionResult> => {
  const handler = ACTION_HANDLERS[action.type];
  if (!handler) {
    return {
      type: action.type,
      status: "failed",
      output: null,
      error: `Unknown action type: ${action.type}`,
      durationMs: 0,
    };
  }

  const start = Date.now();
  try {
    const result = await handler(action.config, ctx);
    return { ...result, type: action.type, durationMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      type: action.type,
      status: "failed",
      output: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
};

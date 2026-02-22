import { createTaskPrimitive } from "./create-task.primitive";
import { callWebhookPrimitive } from "./call-webhook.primitive";
import { runAiPromptPrimitive } from "./run-ai-prompt.primitive";

export type { ActionConfig, ActionPrimitive } from "./types";

export const ACTION_PRIMITIVES = [
  createTaskPrimitive,
  callWebhookPrimitive,
  runAiPromptPrimitive,
];

export const getActionPrimitive = (type: string) =>
  ACTION_PRIMITIVES.find((p) => p.type === type);

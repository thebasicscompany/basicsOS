import { z } from "zod";
import { chatCompletion } from "../../lib/llm-client.js";
import type { ActionHandler } from "./index.js";

const configSchema = z.object({
  /** Prompt template. Use {{field.nested}} placeholders — they are interpolated from the trigger payload. */
  prompt: z.string().min(1),
  /** Optional system context. Defaults to a summary of the trigger payload. */
  systemContext: z.string().optional(),
});

/**
 * Replace {{field.path}} placeholders with values from the trigger payload.
 * Unknown paths are replaced with an empty string.
 */
const interpolate = (template: string, data: unknown): string =>
  template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    const value = path
      .split(".")
      .reduce(
        (obj: unknown, key: string) =>
          obj != null && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined,
        data,
      );
    return value != null ? String(value) : "";
  });

export const runAiPromptAction: ActionHandler = async (config, ctx) => {
  const { prompt, systemContext } = configSchema.parse(config);

  const userMessage = interpolate(prompt, ctx.triggerPayload);
  const system =
    systemContext ??
    `You are an automation assistant. The following event just occurred:\n${JSON.stringify(ctx.triggerPayload, null, 2)}\n\nRespond concisely and directly.`;

  const response = await chatCompletion(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    },
    { tenantId: ctx.tenantId, featureName: "automation-ai-prompt" },
  );

  return { status: "success", output: { result: response.content } };
};

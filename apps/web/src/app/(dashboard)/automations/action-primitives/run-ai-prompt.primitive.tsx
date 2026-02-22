"use client";

import { Label, Textarea, Sparkles } from "@basicsos/ui";
import type { ActionConfig, ActionPrimitive } from "./types";

const Form = ({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }): JSX.Element => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <Label htmlFor="ai-prompt">Prompt</Label>
      <Textarea
        id="ai-prompt"
        placeholder="e.g. Summarize the deal {{deal.name}} and suggest next steps."
        rows={4}
        value={(config.prompt as string) ?? ""}
        onChange={(e) => onChange({ ...config, prompt: e.target.value })}
      />
      <p className="text-xs text-stone-400">Use {"{{field}}"} to insert event data into the prompt.</p>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="ai-system">System Context (optional)</Label>
      <Textarea
        id="ai-system"
        placeholder="You are a helpful assistant for…"
        rows={2}
        value={(config.systemContext as string) ?? ""}
        onChange={(e) => onChange({ ...config, systemContext: e.target.value })}
      />
    </div>
  </div>
);

export const runAiPromptPrimitive: ActionPrimitive = {
  type: "run_ai_prompt",
  label: "Run AI Prompt",
  description: "Send a prompt to the AI and capture the response",
  Icon: Sparkles,
  color: "bg-violet-50 text-violet-600",
  defaultConfig: { prompt: "", systemContext: "" },
  Form,
  summary: (config) => {
    const prompt = ((config.prompt as string) ?? "").trim();
    return prompt.length > 50 ? prompt.slice(0, 50) + "…" : prompt || "(no prompt)";
  },
};

"use client";

import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Textarea, CheckSquare } from "@basicsos/ui";
import type { ActionConfig, ActionPrimitive } from "./types";

const Form = ({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }): JSX.Element => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <Label htmlFor="ct-title">Task Title</Label>
      <Input
        id="ct-title"
        placeholder="e.g. Follow up with {{contact.name}}"
        value={(config.title as string) ?? ""}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
      />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="ct-priority">Priority</Label>
      <Select
        value={(config.priority as string) ?? "medium"}
        onValueChange={(v) => onChange({ ...config, priority: v })}
      >
        <SelectTrigger id="ct-priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="ct-desc">Description (optional)</Label>
      <Textarea
        id="ct-desc"
        placeholder="Add context for this task…"
        rows={2}
        value={(config.description as string) ?? ""}
        onChange={(e) => onChange({ ...config, description: e.target.value })}
      />
    </div>
  </div>
);

export const createTaskPrimitive: ActionPrimitive = {
  type: "create_task",
  label: "Create Task",
  description: "Add a task to the task manager",
  Icon: CheckSquare,
  color: "bg-emerald-50 text-emerald-600",
  defaultConfig: { title: "", priority: "medium", description: "" },
  Form,
  summary: (config) => `Create task: ${(config.title as string)?.trim() || "(untitled)"}`,
};

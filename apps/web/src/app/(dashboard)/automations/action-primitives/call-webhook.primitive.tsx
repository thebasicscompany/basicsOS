"use client";

import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Switch, Globe } from "@basicsos/ui";
import type { ActionConfig, ActionPrimitive } from "./types";

const Form = ({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }): JSX.Element => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <Label htmlFor="cw-url">Webhook URL</Label>
      <Input
        id="cw-url"
        placeholder="https://hooks.example.com/trigger"
        value={(config.url as string) ?? ""}
        onChange={(e) => onChange({ ...config, url: e.target.value })}
      />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="cw-method">HTTP Method</Label>
      <Select
        value={(config.method as string) ?? "POST"}
        onValueChange={(v) => onChange({ ...config, method: v })}
      >
        <SelectTrigger id="cw-method">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="GET">GET</SelectItem>
          <SelectItem value="POST">POST</SelectItem>
          <SelectItem value="PUT">PUT</SelectItem>
          <SelectItem value="PATCH">PATCH</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="flex items-center gap-3">
      <Switch
        id="cw-payload"
        checked={(config.includePayload as boolean) ?? true}
        onCheckedChange={(v) => onChange({ ...config, includePayload: v })}
      />
      <Label htmlFor="cw-payload" className="cursor-pointer">Include event payload in request body</Label>
    </div>
  </div>
);

export const callWebhookPrimitive: ActionPrimitive = {
  type: "call_webhook",
  label: "Call Webhook",
  description: "Send an HTTP request to any URL",
  Icon: Globe,
  color: "bg-blue-50 text-blue-600",
  defaultConfig: { url: "", method: "POST", includePayload: true },
  Form,
  summary: (config) => {
    const method = (config.method as string) ?? "POST";
    const url = (config.url as string)?.trim() || "…";
    return `${method} ${url}`;
  },
};

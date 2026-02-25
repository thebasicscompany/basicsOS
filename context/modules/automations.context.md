# Automations

Automations let you trigger chains of actions in response to business events — no code required. They're created via natural language or a manual form, and results are visible in the automations UI. A **visual flow editor** at `/automations/[id]/flow` lets you build the same automation as a trigger → action chain on a canvas.

---

## Flow graph persistence and adapter

- **DB:** `automations` has optional `flow_nodes` and `flow_edges` (JSONB). When present, they store the React Flow graph (nodes/edges) from the visual editor.
- **Execution:** The executor still uses `triggerConfig` and `actionChain` only. It does not read the graph.
- **Adapter (save):** When the flow editor saves, it sends `flowNodes` and `flowEdges` to `automations.update`. The API runs `flowToAutomation(nodes, edges)` (from `@basicsos/shared`) to derive `triggerConfig` and `actionChain`, then writes both the graph and the derived fields. So the graph is the source of truth in the UI and DB; execution stays unchanged.
- **Adapter (load):** If an automation has `flow_nodes`/`flow_edges`, the flow page uses them. Otherwise it builds initial nodes/edges from `triggerConfig` + `actionChain` with `flowFromAutomation` so older automations open in the visual editor.

---

## How It Works

```
Business event occurs (task created, deal won, etc.)
        ↓
EventBus emits event with payload
        ↓
automation-listener checks all enabled automations for this tenant
  → matches triggerConfig.eventType against event.type
  → evaluates any conditions against the event payload
  → if matched: enqueues BullMQ job
        ↓
automation-executor worker runs the action chain sequentially
  → fail-fast: stops on first failed action
  → stores per-action results in automationRuns.result (JSONB)
        ↓
Run visible in /automations/[id] with status, duration, error
```

Key files:
- `packages/api/src/events/subscribers/automation-listener.ts` — event matching + condition evaluation
- `packages/api/src/workers/automation-executor.worker.ts` — job runner
- `packages/api/src/workers/automation-actions/` — one file per action type
- `packages/api/src/routers/automations.ts` — tRPC CRUD + AI parsing procedures

---

## Triggers

Every trigger corresponds to an event type emitted by the tRPC routers. The payload listed below is what's available to conditions and `{{placeholder}}` interpolation in `run_ai_prompt`.

| Event Type | Emitted When | Payload Fields |
|---|---|---|
| `task.created` | A task is created | `taskId` |
| `task.completed` | A task is marked done | `taskId` |
| `task.assigned` | A task's assignee changes | `taskId`, `assigneeId` |
| `crm.deal.stage_changed` | A deal moves to any stage | `dealId`, `fromStage`, `toStage` |
| `crm.deal.won` | A deal reaches Won stage | `dealId` |
| `crm.deal.lost` | A deal reaches Lost stage | `dealId` |
| `crm.contact.created` | A CRM contact is created | `contactId` |
| `meeting.ended` | A meeting is marked ended | `meetingId` |
| `meeting.summary.generated` | AI summary is ready | `meetingId` |
| `document.created` | A knowledge base doc is created | `documentId` |

---

## Conditions

Conditions filter which events actually trigger the automation. All conditions must pass (AND logic). If no conditions are set, every matching event triggers.

| Operator | Meaning | Example |
|---|---|---|
| `eq` | Equals | `toStage eq won` |
| `neq` | Not equals | `priority neq low` |
| `gt` | Greater than (numeric) | `amount gt 10000` |
| `lt` | Less than (numeric) | `amount lt 500` |
| `contains` | String includes | `title contains urgent` |

Field paths support dot notation for nested payload values: `deal.stage`, `contact.email`.

---

## Actions

Actions execute sequentially. If one fails, the chain halts and the run is marked `failed`.

### `create_task` — fully implemented

Creates a task in the task manager.

```json
{
  "type": "create_task",
  "config": {
    "title": "Follow up with {{contact.name}}",
    "description": "Auto-created from automation",
    "assigneeId": "user-uuid-optional",
    "priority": "medium"
  }
}
```

- `title` — required. Supports `{{field}}` placeholders.
- `description` — optional string.
- `assigneeId` — optional UUID. Falls back to first tenant user if omitted.
- `priority` — `"low" | "medium" | "high" | "urgent"`. Defaults to `"medium"`.

---

### `call_webhook` — fully implemented

Sends an HTTP request to an external URL. SSRF-protected: only HTTPS to public IPs is allowed.

```json
{
  "type": "call_webhook",
  "config": {
    "url": "https://hooks.example.com/notify",
    "method": "POST",
    "headers": { "X-Secret": "token" },
    "includePayload": true
  }
}
```

- `url` — required HTTPS URL. Private/loopback IPs are blocked.
- `method` — `"GET" | "POST" | "PUT" | "PATCH"`. Defaults to `"POST"`.
- `headers` — optional key-value headers merged with `Content-Type: application/json`.
- `includePayload` — if true (default), sends the trigger event payload as the request body.
- Timeout: 10 seconds.

---

### `run_ai_prompt` — fully implemented

Runs an AI prompt with access to the trigger event context. Useful for summaries, classifications, drafting messages, etc.

```json
{
  "type": "run_ai_prompt",
  "config": {
    "prompt": "Write a brief follow-up email for a deal won with {{deal.companyName}}",
    "systemContext": "You are a sales assistant. Be concise and professional."
  }
}
```

- `prompt` — required. Supports `{{field.path}}` placeholders interpolated from the trigger payload.
- `systemContext` — optional. Defaults to a JSON summary of the trigger payload.
- Output stored in `actionResults[n].output.result` in the run record.

---

### `update_crm` — not yet implemented

Returns a `failed` result with a clear error message so run history accurately reflects that no CRM record was changed. Implement when the CRM deal update path is finalized.

---

### `send_email` — stub (needs email service)

Currently a no-op stub. Requires connecting an email provider (Resend, SendGrid, etc.) and storing SMTP/API config per tenant. Returns success with a note.

---

### `post_slack` — stub (needs OAuth)

Currently a no-op stub. Requires Hub Slack OAuth to be connected for the tenant. Returns success with a note.

---

## AI-Powered Creation

Two-step flow from the "Describe it" tab in the UI:

**Step 1 — Parse:** `automations.parseFromDescription`
- Sends the natural language description to the LLM
- Returns a structured `{ name, triggerConfig, actionChain }` spec — no DB write
- User sees a preview of the parsed trigger and actions

**Step 2 — Save:** `automations.createFromParsed`
- User confirms the preview
- Saves the spec to the database

Example prompts that work well:
- *"When a deal is won, create a task to send the contract and call our webhook"*
- *"When a meeting ends, run an AI prompt to summarize next steps"*
- *"When a contact is created, call our CRM sync webhook"*

---

## Run History

Every execution is recorded in `automationRuns`:

| Field | Description |
|---|---|
| `status` | `running → completed \| failed` |
| `startedAt` / `completedAt` | Timestamps for duration |
| `result` | JSONB: `{ actionsExecuted, actionResults[], executionTimeMs, triggerPayload }` |
| `error` | Error message from the first failed action, if any |

`actionResults` is an array of per-action outcomes:
```json
[
  { "type": "create_task", "status": "success", "output": { "taskId": "...", "title": "..." }, "durationMs": 42 },
  { "type": "call_webhook", "status": "failed", "error": "HTTP 503", "durationMs": 10001 }
]
```

---

## Adding a New Trigger

1. Emit the event from the relevant tRPC router:
   ```ts
   EventBus.emit(createEvent({ type: "my.new.event", tenantId, payload: { ... } }));
   ```
2. Add the event schema to `packages/shared/src/types/events.ts` and the `BasicsOSEventSchema` union.
3. Add it to `TRIGGER_EVENT_TYPES` in `CreateAutomationDialog.tsx` so it appears in the UI dropdown.
4. Add it to the prompt in `buildParsePrompt()` in `automations.ts` so the AI knows about it.

---

## Adding a New Action

1. Create `packages/api/src/workers/automation-actions/my-action.action.ts`:
   ```ts
   import { z } from "zod";
   import type { ActionHandler } from "./index.js";

   const configSchema = z.object({ ... });

   export const myAction: ActionHandler = async (config, ctx) => {
     const { ... } = configSchema.parse(config);
     // do work
     return { status: "success", output: { ... } };
   };
   ```
2. Register it in `packages/api/src/workers/automation-actions/index.ts`:
   ```ts
   import { myAction } from "./my-action.action.js";
   const ACTION_HANDLERS = { ..., my_action: myAction };
   ```
3. Add `"my_action"` to the `actionSchema` enum in `packages/shared/src/validators/automations.ts`.
4. Add a label and icon to `ACTION_TYPE_LABELS` in `CreateAutomationDialog.tsx` and `ACTION_META` in `[id]/page.tsx`.
5. Add it to the `buildParsePrompt()` in `automations.ts` so AI creation knows to use it.

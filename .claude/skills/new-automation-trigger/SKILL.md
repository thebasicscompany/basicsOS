# Skill: Add a New Automation Trigger

## When to Use
Making a new event type trigger automations (so users can set up "when X happens, do Y").

## Step 1: Define the Event Type

Add to `packages/shared/src/types/events.ts`:
```ts
export const myModuleActionEvent = baseEventSchema.extend({
  type: z.literal("my_module.action_taken"),
  payload: z.object({
    itemId: z.string().uuid(),
    previousValue: z.string().optional(),
    newValue: z.string(),
  }),
});

// Add to the discriminated union at the bottom of the file:
export const Basics OSEventSchema = z.discriminatedUnion("type", [
  ...,
  myModuleActionEvent,   // add here
]);
```

## Step 2: Emit the Event in the Router

```ts
// In packages/api/src/routers/my-module.ts
EventBus.emit(createEvent({
  type: "my_module.action_taken",
  tenantId: ctx.tenantId,
  userId: ctx.userId,
  payload: {
    itemId: updated.id,
    previousValue: existing.field,
    newValue: input.field,
  },
}));
```

## Step 3: Register in Automation Listener

The automation listener in `packages/api/src/events/subscribers/automation-listener.ts`
automatically picks up all events via `EventBus.onAny()`. No changes needed — it will
match automations where `triggerConfig.eventType === "my_module.action_taken"`.

## Step 4: Update UI (Optional)

If you want the event to appear in the automation builder dropdown, add it to the list
in `packages/shared/src/types/events.ts` (the `Basics OSEventSchema.options` drives the UI).

## Step 5: Test

```ts
it("emits my_module.action_taken when action is taken", async () => {
  const handler = vi.fn();
  EventBus.on("my_module.action_taken", handler);
  await caller(ctx).myAction({ id: MY_ID, field: "new-value" });
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "my_module.action_taken",
      tenantId: TENANT_ID,
      payload: { itemId: MY_ID, newValue: "new-value" },
    }),
  );
});
```

## Event Naming Convention

`module_name.action_past_tense`:
- `crm.deal.stage_changed`
- `task.completed`
- `meeting.transcript.finalized`
- `ai_employee.approval_needed`

## Checklist
- [ ] Event schema added to `events.ts` with correct payload shape
- [ ] Event schema added to `Basics OSEventSchema` discriminated union
- [ ] `EventBus.emit()` call added to the router mutation
- [ ] Test verifies event is emitted with correct payload
- [ ] Event name follows `module.action_past_tense` convention

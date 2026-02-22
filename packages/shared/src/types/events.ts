import { z } from "zod";

export const baseEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  createdAt: z.date(),
});

// Document events
export const documentCreatedEvent = baseEventSchema.extend({
  type: z.literal("document.created"),
  payload: z.object({ documentId: z.string().uuid() }),
});

export const documentUpdatedEvent = baseEventSchema.extend({
  type: z.literal("document.updated"),
  payload: z.object({ documentId: z.string().uuid() }),
});

// CRM events
export const crmDealStageChangedEvent = baseEventSchema.extend({
  type: z.literal("crm.deal.stage_changed"),
  payload: z.object({ dealId: z.string().uuid(), fromStage: z.string(), toStage: z.string() }),
});

export const crmDealWonEvent = baseEventSchema.extend({
  type: z.literal("crm.deal.won"),
  payload: z.object({ dealId: z.string().uuid(), value: z.string() }),
});

export const crmDealLostEvent = baseEventSchema.extend({
  type: z.literal("crm.deal.lost"),
  payload: z.object({ dealId: z.string().uuid() }),
});

export const crmContactCreatedEvent = baseEventSchema.extend({
  type: z.literal("crm.contact.created"),
  payload: z.object({ contactId: z.string().uuid() }),
});

export const crmActivityLoggedEvent = baseEventSchema.extend({
  type: z.literal("crm.activity.logged"),
  payload: z.object({ activityId: z.string().uuid(), dealId: z.string().uuid() }),
});

// Meeting events
export const meetingStartedEvent = baseEventSchema.extend({
  type: z.literal("meeting.started"),
  payload: z.object({ meetingId: z.string().uuid() }),
});

export const meetingEndedEvent = baseEventSchema.extend({
  type: z.literal("meeting.ended"),
  payload: z.object({ meetingId: z.string().uuid() }),
});

export const meetingTranscriptFinalizedEvent = baseEventSchema.extend({
  type: z.literal("meeting.transcript.finalized"),
  payload: z.object({ meetingId: z.string().uuid() }),
});

export const meetingSummaryGeneratedEvent = baseEventSchema.extend({
  type: z.literal("meeting.summary.generated"),
  payload: z.object({ meetingId: z.string().uuid(), summaryId: z.string().uuid() }),
});

// Task events
export const taskCreatedEvent = baseEventSchema.extend({
  type: z.literal("task.created"),
  payload: z.object({ taskId: z.string().uuid() }),
});

export const taskCompletedEvent = baseEventSchema.extend({
  type: z.literal("task.completed"),
  payload: z.object({ taskId: z.string().uuid() }),
});

export const taskAssignedEvent = baseEventSchema.extend({
  type: z.literal("task.assigned"),
  payload: z.object({ taskId: z.string().uuid(), assigneeId: z.string().uuid() }),
});

// Automation events
export const automationTriggeredEvent = baseEventSchema.extend({
  type: z.literal("automation.triggered"),
  payload: z.object({ automationId: z.string().uuid(), runId: z.string().uuid() }),
});

export const automationCompletedEvent = baseEventSchema.extend({
  type: z.literal("automation.completed"),
  payload: z.object({ automationId: z.string().uuid(), runId: z.string().uuid() }),
});

export const automationFailedEvent = baseEventSchema.extend({
  type: z.literal("automation.failed"),
  payload: z.object({
    automationId: z.string().uuid(),
    runId: z.string().uuid(),
    error: z.string(),
  }),
});

// Automation lifecycle events (creation)
export const automationCreatedEvent = baseEventSchema.extend({
  type: z.literal("automation.created"),
  payload: z.object({ automationId: z.string().uuid() }),
});

// AI employee events
export const aiEmployeeStartedEvent = baseEventSchema.extend({
  type: z.literal("ai_employee.started"),
  payload: z.object({ jobId: z.string().uuid() }),
});

export const aiEmployeeCompletedEvent = baseEventSchema.extend({
  type: z.literal("ai_employee.completed"),
  payload: z.object({ jobId: z.string().uuid() }),
});

export const aiEmployeeApprovalNeededEvent = baseEventSchema.extend({
  type: z.literal("ai_employee.approval_needed"),
  payload: z.object({ jobId: z.string().uuid(), outputId: z.string().uuid() }),
});

export const aiEmployeeKilledEvent = baseEventSchema.extend({
  type: z.literal("ai_employee.killed"),
  payload: z.object({ jobId: z.string().uuid() }),
});

// Union of all events
export const BasicsOSEventSchema = z.discriminatedUnion("type", [
  documentCreatedEvent,
  documentUpdatedEvent,
  crmDealStageChangedEvent,
  crmDealWonEvent,
  crmDealLostEvent,
  crmContactCreatedEvent,
  crmActivityLoggedEvent,
  meetingStartedEvent,
  meetingEndedEvent,
  meetingTranscriptFinalizedEvent,
  meetingSummaryGeneratedEvent,
  taskCreatedEvent,
  taskCompletedEvent,
  taskAssignedEvent,
  automationCreatedEvent,
  automationTriggeredEvent,
  automationCompletedEvent,
  automationFailedEvent,
  aiEmployeeStartedEvent,
  aiEmployeeCompletedEvent,
  aiEmployeeApprovalNeededEvent,
  aiEmployeeKilledEvent,
]);

export type BasicsOSEvent = z.infer<typeof BasicsOSEventSchema>;
export type BasicsOSEventType = BasicsOSEvent["type"];

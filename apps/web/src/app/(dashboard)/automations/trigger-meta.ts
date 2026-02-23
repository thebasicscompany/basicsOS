/** Shared metadata for automation trigger event types. */

export type TriggerMeta = {
  label: string;
  group: string;
};

export const TRIGGER_META: Record<string, TriggerMeta> = {
  // CRM
  "crm.deal.stage_changed": { label: "Deal Stage Changed", group: "CRM" },
  "crm.deal.won":           { label: "Deal Won",           group: "CRM" },
  "crm.deal.lost":          { label: "Deal Lost",          group: "CRM" },
  "crm.contact.created":    { label: "Contact Created",    group: "CRM" },
  "crm.company.created":    { label: "Company Created",    group: "CRM" },
  // Tasks
  "task.created":   { label: "Task Created",   group: "Tasks" },
  "task.completed": { label: "Task Completed", group: "Tasks" },
  "task.assigned":  { label: "Task Assigned",  group: "Tasks" },
  // Meetings
  "meeting.ended":             { label: "Meeting Ended",        group: "Meetings" },
  "meeting.summary.generated": { label: "Meeting Summary Ready", group: "Meetings" },
  // Documents
  "document.created": { label: "Document Created", group: "Documents" },
};

/** Returns a human-readable label for an event type, falling back to the raw type string. */
export const getTriggerLabel = (eventType: string): string =>
  TRIGGER_META[eventType]?.label ?? eventType;

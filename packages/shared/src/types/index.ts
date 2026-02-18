export type UserRole = "admin" | "member" | "viewer";
export * from "./events.js";
export * from "./module.js";
export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type AutomationActionType =
  | "send_email"
  | "update_crm"
  | "create_task"
  | "call_webhook"
  | "run_ai_prompt"
  | "post_slack";

import type { Node } from "@xyflow/react";
import { WorkflowEdge } from "basics-os/src/components/ai-elements/edge";
import {
  BlankTriggerNode,
  BlankActionNode,
  TriggerEventNode,
  TriggerScheduleNode,
  EmailActionNode,
  AIActionNode,
  WebSearchActionNode,
  CrmActionNode,
  SlackActionNode,
  AIAgentNode,
  GmailReadNode,
  GmailSendNode,
} from "./nodes";

export type WorkflowNode = Node<Record<string, unknown>, string>;

export const NODE_TYPES = {
  trigger: BlankTriggerNode,
  action: BlankActionNode,
  trigger_event: TriggerEventNode,
  trigger_schedule: TriggerScheduleNode,
  action_email: EmailActionNode,
  action_ai: AIActionNode,
  action_web_search: WebSearchActionNode,
  action_crm: CrmActionNode,
  action_slack: SlackActionNode,
  action_ai_agent: AIAgentNode,
  action_gmail_read: GmailReadNode,
  action_gmail_send: GmailSendNode,
};

export function newId() {
  return crypto.randomUUID().slice(0, 8);
}

export const edgeTypes = { animated: WorkflowEdge.Animated };

import { EventBus } from "../bus.js";
import type {
  taskCompletedEvent,
  meetingSummaryGeneratedEvent,
  aiEmployeeApprovalNeededEvent,
} from "@basicsos/shared";
import { z } from "zod";
import { taskCompletedEvent as taskCompletedSchema } from "@basicsos/shared";

export const registerNotificationDispatcher = (): void => {
  EventBus.on("task.completed", (event) => {
    // TypeScript now knows event.payload.taskId exists
    console.warn(`[notifications] task.completed: taskId=${event.payload.taskId}`);
  });

  EventBus.on("meeting.summary.generated", (event) => {
    console.warn(`[notifications] meeting.summary.generated: meetingId=${event.payload.meetingId}`);
  });

  EventBus.on("ai_employee.approval_needed", (event) => {
    console.warn(`[notifications] ai_employee.approval_needed: jobId=${event.payload.jobId}`);
  });
};

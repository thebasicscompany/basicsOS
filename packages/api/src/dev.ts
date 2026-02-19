import { createApp } from "./server.js";
import { registerAuditLogger } from "./events/subscribers/audit-logger.js";
import {
  startMeetingProcessorWorker,
  registerMeetingProcessorListener,
} from "./workers/meeting-processor.worker.js";
import { startNotificationWorker } from "./workers/notification.worker.js";
import { registerAiEmployeeWorker } from "./workers/ai-employee.worker.js";
import { startAutomationExecutorWorker } from "./workers/automation-executor.worker.js";

const port = Number(process.env["PORT"] ?? "3001");

// Register event subscribers before starting the server
registerAuditLogger();
registerMeetingProcessorListener();
startMeetingProcessorWorker();
startNotificationWorker();
registerAiEmployeeWorker();
startAutomationExecutorWorker();

const app = createApp();

// Bun's native HTTP server — accepts the standard Web Fetch handler directly.
Bun.serve({ fetch: app.fetch, port });
console.warn(`Basics OS API server running on http://localhost:${port}`);

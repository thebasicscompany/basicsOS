import { eq } from "drizzle-orm";
import { db, aiEmployeeJobs, aiEmployeeOutputs } from "@basicsos/db";
import { EventBus } from "../events/bus.js";
import { chatCompletion } from "../lib/llm-client.js";
import { sendNotification } from "./notification.worker.js";

const SYSTEM_PROMPT = `You are an AI employee executing a task on behalf of a company team.
Your output should be clear, structured, and actionable.
Respond with your work product directly — no preambles or meta-commentary.
If you produce multiple distinct outputs (e.g. a draft document + a summary), separate them with "---".`;

const runJob = async (jobId: string, tenantId: string): Promise<void> => {
  // 1. Mark as running
  const [job] = await db
    .update(aiEmployeeJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(aiEmployeeJobs.id, jobId))
    .returning();

  if (!job) {
    console.error(`[ai-employee-worker] Job not found: ${jobId}`);
    return;
  }

  try {
    // 2. Execute via LLM
    const response = await chatCompletion(
      {
        model: "claude-sonnet-4-6",
        messages: [
          { role: "user", content: job.instructions },
        ],
      },
      { tenantId, featureName: "ai_employee" },
    );

    // 3. Write output — requiresApproval so a human reviews before acting
    await db.insert(aiEmployeeOutputs).values({
      jobId,
      type: "text",
      content: response.content,
      requiresApproval: true,
    });

    // 4. Move to awaiting_approval (human-in-the-loop gate)
    await db
      .update(aiEmployeeJobs)
      .set({ status: "awaiting_approval", completedAt: new Date() })
      .where(eq(aiEmployeeJobs.id, jobId));

    // 5. Notify the job creator
    sendNotification({
      tenantId,
      userId: job.createdBy,
      type: "ai_employee.output_ready",
      title: "AI employee completed a task",
      body: job.title,
    });

    console.info(`[ai-employee-worker] Job ${jobId} awaiting approval`);
  } catch (err: unknown) {
    console.error(`[ai-employee-worker] Job ${jobId} failed:`, err);

    await db
      .update(aiEmployeeJobs)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(aiEmployeeJobs.id, jobId));

    // Notify creator of failure
    sendNotification({
      tenantId,
      userId: job.createdBy,
      type: "ai_employee.failed",
      title: "AI employee task failed",
      body: job.title,
    });
  }
};

/**
 * Subscribe to ai_employee.started events and execute the job.
 * Called once at server startup from dev.ts.
 */
export const registerAiEmployeeWorker = (): void => {
  EventBus.on("ai_employee.started", (event) => {
    const { jobId } = event.payload as { jobId: string };
    void runJob(jobId, event.tenantId);
  });

  console.info("[ai-employee-worker] Listening for ai_employee.started events");
};

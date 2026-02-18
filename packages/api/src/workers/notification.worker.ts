import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";

type NotificationJob = {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
};

export const notificationQueue = getQueue(QUEUE_NAMES.NOTIFICATION);

export const startNotificationWorker = () =>
  createWorker<NotificationJob>(QUEUE_NAMES.NOTIFICATION, async (job) => {
    const { userId, title, tenantId } = job.data;
    // Full implementation in Task 10 (web-portal-shell)
    console.warn(`[notifications] Sending to user:${userId} tenant:${tenantId}: ${title}`);
  });

import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";
import { db, pushTokens, notifications } from "@basicsos/db";
import { and, eq } from "drizzle-orm";

export type NotificationJob = {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  sound?: "default";
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushResponse = {
  data: ExpoPushTicket[];
};

/**
 * Send push notifications via Expo Push Notification Service.
 * Silently ignores invalid/expired tokens (DeviceNotRegistered).
 */
const sendExpoPushNotifications = async (
  messages: ExpoPushMessage[],
): Promise<void> => {
  if (messages.length === 0) return;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.error("[notification-worker] Expo API error:", res.status, await res.text());
      return;
    }

    const result = await res.json() as ExpoPushResponse;
    for (const ticket of result.data) {
      if (ticket.status === "error") {
        // DeviceNotRegistered means the token is stale — clean it up
        if (ticket.details?.error === "DeviceNotRegistered") {
          const staleToken = messages.find((_, i) => result.data[i] === ticket)?.to;
          if (staleToken) {
            await db
              .delete(pushTokens)
              .where(eq(pushTokens.token, staleToken))
              .catch(() => undefined);
            console.warn(`[notification-worker] Removed stale push token: ${staleToken.slice(0, 20)}...`);
          }
        } else {
          console.error("[notification-worker] Push ticket error:", ticket.message);
        }
      }
    }
  } catch (err: unknown) {
    console.error("[notification-worker] Failed to send push notifications:", err);
  }
};

const processJob = async (job: { data: NotificationJob }): Promise<void> => {
  const { tenantId, userId, type, title, body, actionUrl } = job.data;

  // 1. Persist the notification in the DB (for in-app notification center)
  await db
    .insert(notifications)
    .values({
      tenantId,
      userId,
      type,
      title,
      body: body ?? null,
      actionUrl: actionUrl ?? null,
    })
    .catch((err: unknown) => {
      console.error("[notification-worker] Failed to persist notification:", err);
    });

  // 2. Send to mobile via Expo Push API
  const tokenRows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.tenantId, tenantId)));

  if (tokenRows.length === 0) return;

  const messages: ExpoPushMessage[] = tokenRows
    .filter((r) => r.token.startsWith("ExponentPushToken[") || r.token.startsWith("ExpoPushToken["))
    .map((r) => ({
      to: r.token,
      title,
      ...(body ? { body } : {}),
      sound: "default" as const,
      ...(actionUrl ? { data: { url: actionUrl } } : {}),
    }));

  await sendExpoPushNotifications(messages);
};

export const notificationQueue = getQueue(QUEUE_NAMES.NOTIFICATION);

export const startNotificationWorker = () =>
  createWorker<NotificationJob>(QUEUE_NAMES.NOTIFICATION, processJob);

/**
 * Convenience helper: enqueue a push notification for a user.
 * Called from other workers / event handlers.
 */
export const sendNotification = (job: NotificationJob): void => {
  notificationQueue.add("notify", job).catch((err: unknown) => {
    console.error("[notification-worker] Failed to enqueue notification:", err);
  });
};

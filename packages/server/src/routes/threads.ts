import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import {
  listThreads,
  getThreadMessages,
} from "@/routes/gateway-chat/storage.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createThreadsRoutes(
  db: Db,
  auth: BetterAuthInstance,
  _env: Env,
) {
  const app = new Hono();

  app.use("*", authMiddleware(auth, db));

  app.get("/", async (c) => {
    const session = c.get("session") as { user?: { id?: string } } | undefined;
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const crmUserRows = await db
      .select({ id: schema.crmUsers.id })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    const crmUser = crmUserRows[0];
    if (!crmUser) return c.json({ error: "User not found" }, 404);

    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const channel = c.req.query("channel") || undefined;
    const threads = await listThreads(db, crmUser.id, {
      limit: Math.min(limit, 100),
      channel,
    });
    return c.json(threads);
  });

  app.get("/:id/messages", async (c) => {
    const session = c.get("session") as { user?: { id?: string } } | undefined;
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const crmUserRows = await db
      .select({ id: schema.crmUsers.id })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    const crmUser = crmUserRows[0];
    if (!crmUser) return c.json({ error: "User not found" }, 404);

    const threadId = c.req.param("id");
    const messages = await getThreadMessages(db, threadId, crmUser.id);
    if (messages === null) return c.json({ error: "Thread not found" }, 404);

    return c.json(messages);
  });

  return app;
}

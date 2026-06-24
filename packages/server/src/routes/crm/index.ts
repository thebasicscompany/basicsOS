import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { createMergeContactsHandler } from "@/routes/crm/handlers/merge-contacts.js";
import { createListHandler } from "@/routes/crm/handlers/list.js";
import { createGetOneHandler } from "@/routes/crm/handlers/get-one.js";
import { createCreateHandler } from "@/routes/crm/handlers/create.js";
import { createBulkCreateHandler } from "@/routes/crm/handlers/bulk-create.js";
import { createUpdateHandler } from "@/routes/crm/handlers/update.js";
import { createDeleteHandler } from "@/routes/crm/handlers/delete.js";
import { createRestoreHandler } from "@/routes/crm/handlers/restore.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createCrmRoutes(db: Db, auth: BetterAuthInstance, env: Env) {
  const app = new Hono();

  app.use("*", authMiddleware(auth, db));

  app.post("/merge_contacts", createMergeContactsHandler(db));
  app.get("/:resource", createListHandler(db));
  app.get("/:resource/:id", createGetOneHandler(db));
  app.post("/:resource/bulk", createBulkCreateHandler(db, env));
  app.post("/:resource", createCreateHandler(db, env));
  app.post("/:resource/:id/restore", createRestoreHandler(db));
  app.put("/:resource/:id", createUpdateHandler(db, env));
  app.delete("/:resource/:id", createDeleteHandler(db));

  return app;
}

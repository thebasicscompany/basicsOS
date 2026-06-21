// Serves files the agent generated into the per-thread artifacts dir
// (HERMES_ARTIFACTS_DIR/<threadId>/, bind-mounted from hermes /opt/artifacts).
// Auth-scoped: a user can only download files from a thread they own.

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { authMiddleware } from "@/middleware/auth.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import * as schema from "@/db/schema/index.js";

type Auth = ReturnType<typeof createAuth>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTENT_TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function createFilesRoutes(db: Db, auth: Auth, env: Env) {
  const app = new Hono();

  app.get("/:threadId/:filename", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const root = env.HERMES_ARTIFACTS_DIR;
    if (!root) return c.json({ error: "File storage is not configured." }, 503);

    const threadId = c.req.param("threadId");
    const filename = basename(c.req.param("filename")); // strip any path-traversal
    if (!UUID_RE.test(threadId)) return c.json({ error: "Not found" }, 404);
    if (!filename || filename.startsWith(".") || filename.includes("/") || filename.includes("\\")) {
      return c.json({ error: "Not found" }, 404);
    }

    // Ownership: the thread must belong to the requesting user.
    const [thread] = await db
      .select({ id: schema.aiThreads.id })
      .from(schema.aiThreads)
      .where(and(eq(schema.aiThreads.id, threadId), eq(schema.aiThreads.crmUserId, authz.crmUser.id)))
      .limit(1);
    if (!thread) return c.json({ error: "Not found" }, 404);

    const path = join(root, threadId, filename);
    let data: Buffer;
    try {
      if (!statSync(path).isFile()) return c.json({ error: "Not found" }, 404);
      data = readFileSync(path);
    } catch {
      return c.json({ error: "Not found" }, 404);
    }

    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename.replace(/["\r\n]/g, "")}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "private, no-store",
      },
    });
  });

  return app;
}

// Local hosted-app bundle server (APP-4d, no Railway/GitHub). Serves a hosted
// app's static bundle from <HOSTED_APPS_DIR>/{slug}/ at /hosted/{slug}/*, with
// framing-permissive headers so the shell can embed it in the sandboxed iframe
// (the global security middleware sets X-Frame-Options: DENY, which we override
// here for hosted bundles only). The bundle still runs at an OPAQUE origin inside
// the sandbox, so this is safe; the bridge is the only host channel.
//
// This is the LOCAL deploy target — `manage-hosting` would publish the bundle into
// HOSTED_APPS_DIR (or, in prod, an S3/static bucket). No signed-client build, ever.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, extname, resolve, sep } from "node:path";
import { Hono } from "hono";
import type { Env } from "@/env.js";
import { logger } from "@/lib/logger.js";

const log = logger.child({ component: "hosted-apps" });

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

export function hostedAppsDir(env: Env): string {
  return resolve(env.HOSTED_APPS_DIR ?? "./hosted-apps");
}

export function createHostedAppsRoutes(env: Env) {
  const app = new Hono();
  const baseDir = hostedAppsDir(env);

  // Allow the shell origins to frame hosted bundles (dev: vite + electron null).
  const frameAncestors = ["'self'", ...env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)];

  app.get("/:slug/*", (c) => {
    const slug = c.req.param("slug");
    if (!/^[a-z0-9-]+$/i.test(slug)) return c.text("Bad slug", 400);

    // Path under the app's dir, defaulting to index.html. normalize + containment
    // check defeats path traversal (../, absolute, backslash).
    const rest = c.req.path.replace(new RegExp(`^/hosted/${slug}/?`), "") || "index.html";
    const appRoot = join(baseDir, slug);
    const target = normalize(join(appRoot, rest));
    if (target !== appRoot && !target.startsWith(appRoot + sep)) {
      return c.text("Forbidden", 403);
    }
    let filePath = target;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      // SPA fallback to the app's index.html.
      filePath = join(appRoot, "index.html");
      if (!existsSync(filePath)) return c.text("Not found", 404);
    }

    let body: Buffer;
    try {
      body = readFileSync(filePath);
    } catch (err) {
      log.error({ err, filePath }, "failed to read hosted bundle file");
      return c.text("Not found", 404);
    }

    // Framing-permissive overrides (the bundle is embedded sandboxed by the shell
    // via the iframe `sandbox` attribute, which gives it an opaque origin). We only
    // need to allow the shell to FRAME it here.
    c.header("X-Frame-Options", ""); // clear the global DENY for hosted bundles
    c.header("Content-Security-Policy", `frame-ancestors ${frameAncestors.join(" ")}`);
    c.header("Content-Type", CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream");
    c.header("Cache-Control", "no-cache");
    return c.body(body);
  });

  return app;
}

// Local hosted-app deploy helpers (APP-4d/4e, no Railway/GitHub). Writes a hosted
// app's bundle into HOSTED_APPS_DIR/{slug}/ (served by routes/hosted-apps.ts) and
// computes its public entryUrl/origin. To move to S3/CDN later, swap writeHostedBundle
// for an upload and point HOSTED_PUBLIC_ORIGIN at the bucket — nothing else changes.

import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Env } from "@/env.js";
import { injectHostBaseStyles } from "@/lib/apps/host-app-base.js";

export function hostedAppsBaseDir(env: Env): string {
  return resolve(env.HOSTED_APPS_DIR ?? "./hosted-apps");
}

export function hostedPublicOrigin(env: Env): string {
  return env.HOSTED_PUBLIC_ORIGIN ?? "http://localhost:3001";
}

export function hostedEntryUrl(env: Env, slug: string): string {
  return `${hostedPublicOrigin(env)}/hosted/${slug}/index.html`;
}

/** Build the HostedSpec for a locally-deployed bundle. */
export function buildHostedSpec(env: Env, slug: string, requiredScopes: string[]) {
  return {
    entryUrl: hostedEntryUrl(env, slug),
    origin: hostedPublicOrigin(env),
    requiredScopes,
  };
}

/** Write a hosted app's single-file bundle. Creates the dir if needed.
 * Auto-injects the host base stylesheet so the app looks native to the shell. */
export function writeHostedBundle(env: Env, slug: string, html: string): void {
  const dir = join(hostedAppsBaseDir(env), slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), injectHostBaseStyles(html), "utf8");
}

/** Read a hosted app's current bundle (for iterative editing), or null if absent. */
export function readHostedBundle(env: Env, slug: string): string | null {
  try {
    return readFileSync(join(hostedAppsBaseDir(env), slug, "index.html"), "utf8");
  } catch {
    return null;
  }
}

/** Remove a hosted app's bundle dir (on delete). Best-effort. */
export function deleteHostedBundle(env: Env, slug: string): void {
  try {
    rmSync(join(hostedAppsBaseDir(env), slug), { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

// App publish scan (APP-3). Before an app flips to `active` we vet its spec,
// fail-closed. For a declarative app the artifact is pure JSON config (no code),
// so the gate is: structural validity + no unsafe markdown + tools referenced are
// within the granted permissions. When the gateway is reachable we ALSO run the
// existing AI release-scan over the spec (the same vetting path used for client
// releases — contract C.8); otherwise the static gate stands. Hosted-app bundle
// scanning (real code) is APP-4f and is gateway-authoritative.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Env } from "@/env.js";
import { logger } from "@/lib/logger.js";
import { matchesGrant } from "@/mcp-broker/app-grants.js";

const log = logger.child({ component: "app-scan" });

export type ScanRisk = "low" | "medium" | "high";

export interface AppScanResult {
  risk: ScanRisk;
  allowed: boolean;
  reasons: string[];
  summary: string;
  source: "static" | "gateway";
}

// Defense-in-depth: the markdown block renders as preformatted TEXT (not HTML), so
// this isn't an XSS vector today, but reject script-ish content anyway so a future
// richer renderer can't be exploited by a generated/3rd-party spec.
const DANGEROUS_MARKDOWN = /<script|<iframe|javascript:|on\w+\s*=|data:text\/html/i;

interface SpecLike {
  pages?: Array<{ blocks?: Array<Record<string, unknown>> }>;
  dataSources?: Array<{ tool?: unknown }>;
  actions?: Array<{ tool?: unknown }>;
}

/** Tool names referenced by a declarative spec's dataSources + actions. */
function referencedTools(spec: SpecLike): string[] {
  const tools: string[] = [];
  for (const d of spec.dataSources ?? []) if (typeof d?.tool === "string") tools.push(d.tool);
  for (const a of spec.actions ?? []) if (typeof a?.tool === "string") tools.push(a.tool);
  return tools;
}

/** Static, fail-closed checks for a declarative spec. */
export function staticDeclarativeChecks(
  spec: unknown,
  permissions: unknown,
): { critical: string[]; warnings: string[] } {
  const critical: string[] = [];
  const warnings: string[] = [];

  if (!spec || typeof spec !== "object" || !Array.isArray((spec as SpecLike).pages)) {
    critical.push("Spec is not a valid declarative spec (missing pages[]).");
    return { critical, warnings };
  }
  const s = spec as SpecLike;

  for (const page of s.pages ?? []) {
    for (const block of page.blocks ?? []) {
      if (
        block?.kind === "markdown" &&
        typeof block.text === "string" &&
        DANGEROUS_MARKDOWN.test(block.text)
      ) {
        critical.push("A markdown block contains potentially unsafe HTML/script.");
      }
    }
  }

  const grants = Array.isArray(permissions)
    ? (permissions.filter((p) => typeof p === "string") as string[])
    : [];
  if (grants.includes("*")) {
    warnings.push("App requests the wildcard '*' permission (all tools).");
  }
  for (const tool of referencedTools(s)) {
    if (!matchesGrant(tool, grants)) {
      warnings.push(`Spec references tool "${tool}" that isn't in the granted permissions.`);
    }
  }

  return { critical, warnings };
}

/**
 * Validate a HostedSpec on create/update (fail-closed). entryUrl must be an
 * absolute https:// URL (or http://localhost for dev), origin must equal the
 * entryUrl's origin, and relative/data:/javascript:/blob: URLs are rejected — the
 * entryUrl loads directly as the sandboxed iframe src, so a bad value is a real
 * surface. requiredScopes, if present, must be string[].
 */
export function validateHostedSpec(spec: unknown): { ok: true } | { ok: false; error: string } {
  if (!spec || typeof spec !== "object") return { ok: false, error: "Hosted spec must be an object." };
  const s = spec as { entryUrl?: unknown; origin?: unknown; requiredScopes?: unknown };
  if (typeof s.entryUrl !== "string" || s.entryUrl.length === 0) {
    return { ok: false, error: "Hosted spec requires an entryUrl." };
  }
  let url: URL;
  try {
    url = new URL(s.entryUrl);
  } catch {
    return { ok: false, error: "entryUrl must be an absolute URL." };
  }
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    return { ok: false, error: "entryUrl must be https:// (http://localhost allowed in dev)." };
  }
  if (typeof s.origin !== "string" || s.origin.length === 0) {
    return { ok: false, error: "Hosted spec requires an origin." };
  }
  let originUrl: URL;
  try {
    originUrl = new URL(s.origin);
  } catch {
    return { ok: false, error: "origin must be an absolute origin." };
  }
  if (originUrl.origin !== url.origin) {
    return { ok: false, error: "origin must match the entryUrl origin." };
  }
  if (s.requiredScopes !== undefined && !Array.isArray(s.requiredScopes)) {
    return { ok: false, error: "requiredScopes must be an array." };
  }
  return { ok: true };
}

export interface ScanInput {
  name: string;
  spec: unknown;
  permissions: unknown;
}

/** Scan a declarative spec; gates the draft→active transition. */
export async function scanDeclarativeSpec(env: Env, input: ScanInput): Promise<AppScanResult> {
  const { critical, warnings } = staticDeclarativeChecks(input.spec, input.permissions);
  if (critical.length) {
    return {
      risk: "high",
      allowed: false,
      reasons: [...critical, ...warnings],
      summary: "Static checks failed.",
      source: "static",
    };
  }

  // Best-effort AI scan via the gateway (authoritative when reachable).
  if (env.SERVER_BASICS_API_KEY) {
    try {
      return await callGatewayScan(env, env.SERVER_BASICS_API_KEY, "declarative", input);
    } catch (err) {
      log.warn({ err }, "gateway app scan unreachable; using static result");
    }
  }

  return {
    risk: "low",
    allowed: true,
    reasons: warnings,
    summary: "Static checks passed.",
    source: "static",
  };
}

// Patterns that should never appear in a published bundle (hard-coded secrets).
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

/**
 * Scan a HOSTED app before activation (fail-closed). The bundle runs in an opaque-
 * origin sandbox (no host access) and the bridge gates every tool call to the app's
 * grants, so the gate is: a valid HostedSpec + no hard-coded secrets in the local
 * bundle + (best-effort) the gateway AI scan. Bundle code that needs review (eval,
 * obfuscation) is the AI scan's job. Local hosting only — no Railway/GitHub.
 */
export async function scanHostedApp(
  env: Env,
  slug: string,
  input: ScanInput,
): Promise<AppScanResult> {
  const v = validateHostedSpec(input.spec);
  if (!v.ok) {
    return { risk: "high", allowed: false, reasons: [v.error], summary: "Invalid hosted spec.", source: "static" };
  }

  const reasons: string[] = [];
  const dir = join(resolve(env.HOSTED_APPS_DIR ?? "./hosted-apps"), slug);
  const indexPath = join(dir, "index.html");
  let bundle: string | null = null;
  if (existsSync(indexPath)) {
    bundle = readFileSync(indexPath, "utf8");
    for (const p of SECRET_PATTERNS) {
      if (p.test(bundle)) {
        return {
          risk: "high",
          allowed: false,
          reasons: ["The bundle appears to contain a hard-coded secret/API key."],
          summary: "Static bundle checks failed.",
          source: "static",
        };
      }
    }
  } else {
    reasons.push("No local bundle found at the hosted path (entryUrl must be reachable).");
  }

  // Gateway AI scan over the actual bundle (authoritative when reachable).
  if (env.SERVER_BASICS_API_KEY) {
    try {
      return await callGatewayScan(env, env.SERVER_BASICS_API_KEY, "hosted", input, bundle);
    } catch (err) {
      log.warn({ err }, "gateway hosted scan unreachable; using static result");
    }
  }
  return { risk: "low", allowed: true, reasons, summary: "Hosted spec validated; static checks passed.", source: "static" };
}

async function callGatewayScan(
  env: Env,
  apiKey: string,
  kind: "declarative" | "hosted",
  input: ScanInput,
  bundle?: string | null,
): Promise<AppScanResult> {
  const res = await fetch(`${env.BASICSOS_API_URL}/v1/apps/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      kind,
      name: input.name,
      spec: input.spec,
      permissions: input.permissions,
      ...(bundle ? { bundle } : {}),
    }),
  });
  if (!res.ok) throw new Error(`gateway scan failed: ${res.status}`);
  const data = (await res.json()) as Partial<AppScanResult>;
  // Fail-closed on a malformed gateway response.
  const risk: ScanRisk = data.risk === "low" || data.risk === "medium" || data.risk === "high" ? data.risk : "high";
  return {
    risk,
    allowed: risk === "low" && data.allowed !== false,
    reasons: Array.isArray(data.reasons) ? data.reasons : [],
    summary: typeof data.summary === "string" ? data.summary : "",
    source: "gateway",
  };
}

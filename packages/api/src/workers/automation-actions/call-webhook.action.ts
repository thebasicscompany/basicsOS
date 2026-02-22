import { z } from "zod";
import type { ActionHandler } from "./index.js";

const configSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  headers: z.record(z.string()).optional(),
  includePayload: z.boolean().default(true),
});

/**
 * Block SSRF: reject non-HTTPS schemes and RFC-1918 / loopback / link-local ranges.
 * Throws an error if the URL is not safe to fetch from the server.
 */
const assertSafeUrl = (rawUrl: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  const host = parsed.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || // link-local (AWS metadata etc.)
    /^::1$/.test(host) || // IPv6 loopback
    /^fc00:/i.test(host) || // IPv6 unique local
    /^fe80:/i.test(host); // IPv6 link-local

  if (blocked) {
    throw new Error("Webhook URL cannot target internal network addresses");
  }
};

export const callWebhookAction: ActionHandler = async (config, ctx) => {
  const { url, method, headers, includePayload } = configSchema.parse(config);

  assertSafeUrl(url);

  const body = includePayload && method !== "GET" ? JSON.stringify(ctx.triggerPayload) : undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", output: null, error: `Webhook request failed: ${message}` };
  }

  const output = { httpStatus: response.status, url };

  if (!response.ok) {
    return { status: "failed", output, error: `Webhook returned HTTP ${response.status}` };
  }

  return { status: "success", output };
};

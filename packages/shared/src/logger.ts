import pino from "pino";

/**
 * Creates a Pino logger.
 *
 * Pino writes newline-delimited JSON to stdout — no transports, no worker
 * threads, fully Bun-compatible.  Pipe through `pino-pretty` locally if you
 * want human-readable output:
 *
 *   bun --filter @basicsos/api dev | bunx pino-pretty
 */
export const createLogger = (module?: string): pino.Logger => {
  const isDev = process.env["NODE_ENV"] !== "production";
  const isTest = process.env["NODE_ENV"] === "test";

  return pino({
    level: (process.env["LOG_LEVEL"] as pino.Level | undefined) ?? (isDev ? "debug" : "info"),
    enabled: !isTest,
    base: {
      service: process.env["SERVICE_NAME"] ?? "basicsos",
      env: process.env["NODE_ENV"] ?? "development",
      ...(module !== undefined && { module }),
    },
  });
};

export const logger = createLogger();

export type { Logger } from "pino";

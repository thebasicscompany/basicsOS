import pino from "pino";

/**
 * Creates a Pino logger instance with sensible defaults.
 * Pino is the industry standard for structured logging in Node.js.
 *
 * In development:
 * - Uses pretty printing for readability
 * - Default level: "debug"
 *
 * In production:
 * - Uses JSON output for structured logging
 * - Default level: "info"
 */
export function createLogger(module?: string): pino.Logger {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const isTest = process.env.NODE_ENV === "test";

  // Allow LOG_LEVEL env var to override default
  const level =
    (process.env.LOG_LEVEL as pino.Level | undefined) ?? (isDevelopment ? "debug" : "info");
  const pretty = isDevelopment && !isTest;

  const base = {
    service: process.env.SERVICE_NAME ?? "basicsos",
    env: process.env.NODE_ENV ?? "development",
    ...(module && { module }),
  };

  const pinoOptions: pino.LoggerOptions = {
    level,
    base,
    ...(pretty && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,service,env",
          singleLine: false,
        },
      },
    }),
  };

  return pino(pinoOptions);
}

/**
 * Default logger instance.
 */
export const logger = createLogger();

// Re-export Pino types for convenience
export type { Logger } from "pino";

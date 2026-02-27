// ---------------------------------------------------------------------------
// Desktop logger — structured logging with production-safe debug silencing
// ---------------------------------------------------------------------------

export type DesktopLogger = {
  /** Trace-level logging — silenced in production. */
  debug: (...args: unknown[]) => void;
  /** Lifecycle events — always logged. */
  info: (...args: unknown[]) => void;
  /** Recoverable issues — always logged. */
  warn: (...args: unknown[]) => void;
  /** Failures — always logged. */
  error: (...args: unknown[]) => void;
};

const IS_PRODUCTION =
  typeof process !== "undefined"
    ? process.env["NODE_ENV"] === "production"
    : false;

/**
 * Create a tagged logger for a specific module.
 *
 * Usage:
 *   const log = createDesktopLogger("meeting-recorder");
 *   log.debug("Starting recording for", meetingId);
 *   log.info("WebSocket connected");
 *   log.warn("Mic track ended unexpectedly");
 *   log.error("Failed to start recording:", err);
 */
export const createDesktopLogger = (tag: string): DesktopLogger => {
  const prefix = `[${tag}]`;

  return {
    debug: IS_PRODUCTION
      ? () => {}
      : (...args: unknown[]) => console.log(prefix, ...args),
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
};

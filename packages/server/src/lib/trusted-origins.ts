const ELECTRON_RENDERER_ORIGINS = new Set(["null", "file://"]);

/** Origins that are always trusted regardless of ALLOWED_ORIGINS env var.
 *  basicsos.com hosts the auth pages that submit credentials to client servers. */
const ALWAYS_TRUSTED_ORIGINS = new Set(["https://basicsos.com"]);

export function isElectronUserAgent(userAgent: string | undefined | null): boolean {
  return /\bElectron\//i.test(userAgent ?? "");
}

export function isTrustedOrigin(
  origin: string | undefined | null,
  allowedOrigins: Set<string>,
  userAgent?: string | null,
): boolean {
  // Electron with no Origin header (e.g. some runtimes) — treat as trusted "null"
  if (!origin) return isElectronUserAgent(userAgent);

  // Always-trusted origins (e.g. basicsos.com hosted auth pages)
  if (ALWAYS_TRUSTED_ORIGINS.has(origin)) return true;

  if (allowedOrigins.has(origin)) return true;

  // Installed Electron apps make cross-origin requests from a file-based renderer.
  if (ELECTRON_RENDERER_ORIGINS.has(origin) && isElectronUserAgent(userAgent)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}

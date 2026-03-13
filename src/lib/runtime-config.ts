/**
 * Returns the API base URL for the current runtime.
 *
 * Priority order:
 *  1. window.__runtimeApiUrl__ — injected synchronously by the Electron preload
 *     from the main process, which reads userData/org-config.json.  This value
 *     is persisted across auto-updates so every org keeps its own URL.
 *  2. import.meta.env.VITE_API_URL — baked in at build time (used in web / dev).
 *  3. Empty string fallback (relative URLs, dev proxy).
 */
export function getRuntimeApiUrl(): string {
  if (typeof window !== "undefined" && window.__runtimeApiUrl__) {
    return window.__runtimeApiUrl__;
  }
  return import.meta.env.VITE_API_URL ?? "";
}

// The App SDK host↔app bridge protocol (APP-4b), implementing CONTRACTS Part B.3/B.4.
//
// A hosted app runs in a sandboxed iframe at an OPAQUE origin (sandbox="allow-scripts"
// only — no allow-same-origin). It therefore cannot read the host's cookies, storage,
// or DOM. The ONLY channel between app and host is this versioned postMessage protocol.
//
// SECURITY MODEL (read before changing anything here):
//  - Frame authentication is by WINDOW IDENTITY, not origin string. A sandboxed
//    opaque-origin frame posts with event.origin === "null", so origin alone can't
//    distinguish frames. The host honors a message ONLY if event.source === the exact
//    iframe.contentWindow it embedded (an unspoofable object reference), AND the origin
//    is "null" (the expected opaque value) or the app's registered origin.
//  - A handshake nonce gates everything: the host ignores all requests until the app
//    replies app:ready echoing a host-chosen random nonce. A navigated-away or injected
//    frame can't produce the nonce, so it can't issue calls.
//  - The bridge NEVER carries secrets. auth.session returns identity only (no tokens);
//    tools.* run server-side gated to the app's grants + the user's RBAC.

export const BRIDGE_VERSION = 1 as const;
/** Bumped on backward-incompatible host capability changes (contract B.8). */
export const HOST_API_VERSION = "1.0.0";

export interface BridgeRequest {
  v: typeof BRIDGE_VERSION;
  id: string;
  method: string;
  params?: unknown;
}

export type BridgeResponse =
  | { v: typeof BRIDGE_VERSION; id: string; ok: true; result: unknown }
  | { v: typeof BRIDGE_VERSION; id: string; ok: false; error: { code: string; message: string } };

export interface BridgeEvent {
  v: typeof BRIDGE_VERSION;
  event: string;
  data: unknown;
}

/**
 * host -> app, the first frame; the app must reply app:ready { nonce }.
 *
 * SECURITY: host:init carries NO identity. A sandboxed app can navigate its own
 * frame to an attacker origin, whose onLoad would re-fire and re-broadcast init via
 * targetOrigin "*". So identity (user, roles) and grantedPermissions are delivered
 * ONLY in reply to an app-initiated `auth.session` / `tools.list`, which the app
 * can only call AFTER completing the nonce handshake — proving the ORIGINAL app
 * document is still resident (the host never re-handshakes a navigated frame).
 */
export interface HostInitData {
  appId: string;
  appVersion: string;
  hostApiVersion: string;
  nonce: string;
  theme: ThemeTokens;
}

export interface ThemeTokens {
  mode: "light" | "dark";
  /** a few CSS custom properties the app can mirror; extend as needed */
  tokens: Record<string, string>;
}

/** The complete method surface (contract B.4). */
export const BRIDGE_METHODS = [
  "tools.list",
  "tools.call",
  "auth.session",
  "nav.go",
  "nav.openRecord",
  "ui.toast",
  "ui.confirm",
  "theme.get",
  "storage.get",
  "storage.set",
  "agent.invoke",
] as const;
export type BridgeMethod = (typeof BRIDGE_METHODS)[number];

/** host -> app event names. */
export const HOST_EVENTS = {
  init: "host:init",
  themeChanged: "theme:changed",
  navigated: "navigated",
  dataInvalidated: "data:invalidated",
  visibilityShown: "visibility:shown",
  visibilityHidden: "visibility:hidden",
} as const;

export type BridgeErrorCode =
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "NOT_READY"
  | "UNKNOWN_METHOD"
  | "UPSTREAM";

// ── Validation helpers (pure, unit-tested) ───────────────────────────────────

/** A bridge request must have v===1, a string id, and a known method. */
export function isValidBridgeRequest(msg: unknown): msg is BridgeRequest {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return (
    m.v === BRIDGE_VERSION &&
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.method === "string"
  );
}

/**
 * Is this inbound message's origin acceptable for the sandboxed app frame?
 * Sandboxed opaque frames post origin "null"; a non-sandboxed app would post its
 * registered origin. Anything else is rejected.
 */
export function isAcceptableOrigin(origin: string, registeredOrigin: string): boolean {
  if (origin === "null") return true; // expected from an opaque-origin sandbox
  try {
    return new URL(origin).origin === new URL(registeredOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * Validate a nav path from an app: must be an app-internal absolute path
 * ("/something"), never protocol-relative ("//evil.com") or an absolute URL — so
 * an app can't drive the host to an external/open-redirect target.
 */
export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false; // protocol-relative → external
  if (/^\/\\/.test(path)) return false; // "/\" backslash trick
  return true;
}

/** App apps may not navigate the host into the builder or another app's internals. */
export function sanitizeNavPath(path: unknown): string | null {
  return isSafeInternalPath(path) ? path : null;
}

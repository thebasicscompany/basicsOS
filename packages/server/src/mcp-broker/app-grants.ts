// Grant matching for the app-facing broker path (APP-0) and app-originated agent
// turns (APP-4b). An app's `app_config.permissions` lists broker tool-name globs the
// app may call. The grant set is the trust boundary between an app and the full
// broker surface, ON TOP of the per-user RBAC the broker already enforces — so an
// app can never exceed BOTH its grants AND the acting user's permissions.
//
// Matching forms (segment-aware — a SECURITY fix, see app-broker.test.ts):
//   "*"               — any tool
//   "object.deals.search" — an exact tool name
//   "object.deals.*"  — a SEGMENT-boundary prefix glob (the part before "*" must
//                       end with "."), so it matches object.deals.<x> but NOT a
//                       sibling like object.deals_archive.delete.
// A bare non-dotted "name*" is intentionally NOT honored as a prefix (it would
// over-match siblings); write "name.*" for a child glob, or the exact name.
// See docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md B.4 / C.6.

// Tools an app may NEVER call via the app path or an app-originated agent turn,
// even if an admin lists them in app_config.permissions. These confer DEFERRED or
// full-agent execution that escapes the per-app grant sandbox:
//   - the ENTIRE automation.* family — creating/updating OR firing (run_now) /
//     enabling (set_enabled) an automation runs its agent step LATER on a
//     non-app thread with the owner's FULL toolset + RBAC, outside appGrants.
//   - connection.connect — starts an OAuth as the user.
// (connection.execute IS allowed: an app acting in the user's connected apps,
// bounded by the user's RBAC, is by design.) These remain available to the user's
// own chat agent — just not to apps.
const APP_TOOL_DENY_PREFIXES = ["automation."];
const APP_TOOL_DENY_EXACT: ReadonlySet<string> = new Set(["connection.connect"]);

/** True iff this tool is categorically forbidden to apps (regardless of grants). */
export function isDenylistedForApps(toolName: string): boolean {
  if (APP_TOOL_DENY_EXACT.has(toolName)) return true;
  return APP_TOOL_DENY_PREFIXES.some((p) => toolName.startsWith(p));
}

/** True iff `toolName` is permitted by at least one grant glob (segment-aware). */
export function matchesGrant(toolName: string, grants: readonly string[]): boolean {
  for (const raw of grants) {
    if (typeof raw !== "string" || raw.length === 0) continue;
    const g = raw.trim();
    if (g === "*") return true;
    if (g === toolName) return true;
    // Segment-boundary prefix glob: only "<prefix>.*" (the char before "*" is ".").
    if (g.endsWith(".*")) {
      const base = g.slice(0, -1); // keeps the trailing "." → "object.deals."
      if (toolName.startsWith(base)) return true;
    }
  }
  return false;
}

/** Grant check for the APP path: granted AND not categorically denied to apps. */
export function isAppToolAllowed(toolName: string, grants: readonly string[]): boolean {
  if (isDenylistedForApps(toolName)) return false;
  return matchesGrant(toolName, grants);
}

/** Filter a tool list to those an app is allowed to call (for `tools/list`). */
export function filterGrantedTools<T extends { name: string }>(
  tools: T[],
  grants: readonly string[],
): T[] {
  return tools.filter((t) => isAppToolAllowed(t.name, grants));
}

/** Coerce a raw `app_config.permissions` jsonb value into a string[] of grants. */
export function normalizeGrants(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((g): g is string => typeof g === "string" && g.length > 0);
}

import { describe, expect, it } from "vitest";
import {
  filterGrantedTools,
  isAppToolAllowed,
  matchesGrant,
  normalizeGrants,
} from "@/mcp-broker/app-grants.js";
import {
  handleRpc,
  type BrokerDeps,
  type BrokerTool,
  type ToolCallContext,
} from "@/mcp-broker/protocol.js";

// ── Grant matching ───────────────────────────────────────────────────────────
describe("matchesGrant", () => {
  it("matches an exact tool name", () => {
    expect(matchesGrant("object.deals.search", ["object.deals.search"])).toBe(true);
    expect(matchesGrant("object.deals.get", ["object.deals.search"])).toBe(false);
  });

  it("matches a segment-boundary '.*' glob", () => {
    expect(matchesGrant("object.deals.search", ["object.deals.*"])).toBe(true);
    expect(matchesGrant("object.deals.create", ["object.deals.*"])).toBe(true);
    // The bare parent (no child segment) is NOT matched by "object.deals.*".
    expect(matchesGrant("object.deals", ["object.deals.*"])).toBe(false);
    // A broader prefix.
    expect(matchesGrant("object.deals.search", ["object.*"])).toBe(true);
    expect(matchesGrant("memory.recall_context", ["object.*"])).toBe(false);
  });

  it("does NOT over-match siblings via a non-dotted glob (segment-boundary fix)", () => {
    // "object.deals*" must NOT leak into object.deals_archive.* or object.deals.*
    expect(matchesGrant("object.deals_archive.delete", ["object.deals*"])).toBe(false);
    expect(matchesGrant("object.deals.delete", ["object.deal*"])).toBe(false);
    // The correct dotted form is precise.
    expect(matchesGrant("object.deals_archive.delete", ["object.deals.*"])).toBe(false);
  });

  it("matches the global wildcard", () => {
    expect(matchesGrant("anything.at.all", ["*"])).toBe(true);
  });

  it("denies when no grant matches and ignores junk entries", () => {
    expect(matchesGrant("object.deals.search", [])).toBe(false);
    expect(matchesGrant("object.deals.search", ["memory.*", "object.contacts.*"])).toBe(false);
    // junk entries are skipped, not crashed on
    expect(matchesGrant("object.deals.search", ["", "object.deals.search"])).toBe(true);
  });
});

describe("isAppToolAllowed (app denylist)", () => {
  it("denies the ENTIRE automation.* family even when granted (e.g. via '*')", () => {
    for (const t of [
      "automation.create",
      "automation.update",
      "automation.delete",
      "automation.run_now",
      "automation.set_enabled",
      "automation.list",
    ]) {
      expect(isAppToolAllowed(t, ["*"])).toBe(false);
      expect(isAppToolAllowed(t, ["automation.*"])).toBe(false);
    }
  });
  it("denies connection.connect but ALLOWS connection.execute (acting as the user is by design)", () => {
    expect(isAppToolAllowed("connection.connect", ["*"])).toBe(false);
    expect(isAppToolAllowed("connection.execute", ["connection.execute"])).toBe(true);
  });
  it("allows a granted, non-denylisted tool", () => {
    expect(isAppToolAllowed("object.deals.search", ["object.deals.*"])).toBe(true);
    expect(isAppToolAllowed("object.deals.search", [])).toBe(false);
  });
});

describe("filterGrantedTools / normalizeGrants", () => {
  const tools = [
    { name: "object.deals.search" },
    { name: "object.deals.create" },
    { name: "object.contacts.search" },
    { name: "memory.recall_context" },
  ];

  it("filters a tool list to granted tools", () => {
    expect(filterGrantedTools(tools, ["object.deals.*"]).map((t) => t.name)).toEqual([
      "object.deals.search",
      "object.deals.create",
    ]);
  });

  it("normalizes a raw jsonb permissions value to a string[]", () => {
    expect(normalizeGrants(["a", "b"])).toEqual(["a", "b"]);
    expect(normalizeGrants(["a", 1, null, "", "b"])).toEqual(["a", "b"]);
    expect(normalizeGrants(null)).toEqual([]);
    expect(normalizeGrants("not-an-array")).toEqual([]);
  });
});

// ── handleRpc app-path gating ────────────────────────────────────────────────
// Fake tool set: two reads + one write (RBAC-gated).
function fakeTools(): BrokerTool[] {
  return [
    {
      name: "object.deals.search",
      description: "search deals",
      inputSchema: {},
      meta: { source: "native", writes: false },
      handle: async () => ({ results: ["deal-1"] }),
    },
    {
      name: "object.contacts.search",
      description: "search contacts",
      inputSchema: {},
      meta: { source: "native", writes: false },
      handle: async () => ({ results: ["contact-1"] }),
    },
    {
      name: "object.tasks.create",
      description: "create a task",
      inputSchema: {},
      meta: { source: "native", writes: true },
      requires: "records.write",
      handle: async () => ({ created: { id: 1 } }),
    },
    {
      name: "automation.create",
      description: "create an automation",
      inputSchema: {},
      meta: { source: "native", writes: true },
      handle: async () => ({ created: { id: 9 } }),
    },
  ];
}

function appDeps(grants: string[], ctx: ToolCallContext): BrokerDeps {
  const tools = fakeTools();
  // The app path sets ctx.appGrants → per-call gating in handleRpc applies.
  const gatedCtx: ToolCallContext = { ...ctx, appGrants: grants };
  return {
    getTools: async () => tools,
    resolveContext: async () => gatedCtx,
    filterTools: (ts) => filterGrantedTools(ts, grants),
  };
}

function userCtx(perms: string[], crmUserId: number | null = 7): ToolCallContext {
  const permissions = new Set(perms);
  return {
    orgId: "org-1",
    crmUserId,
    sessionKey: null,
    permissions,
    can: (p) => permissions.has("*") || permissions.has(p),
    meta: null,
    appGrants: null,
  };
}

/** Pull the JSON payload out of an MCP CallToolResult's text content. */
function parseCall(result: unknown): { isError: boolean; payload: unknown } {
  const r = result as { content?: { text?: string }[]; isError?: boolean };
  const text = r.content?.[0]?.text ?? "null";
  return { isError: Boolean(r.isError), payload: JSON.parse(text) };
}

describe("handleRpc — app-facing grant gating", () => {
  it("tools/list returns only the granted subset", async () => {
    const deps = appDeps(["object.deals.*"], userCtx(["records.read"]));
    const res = await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, deps);
    const names = (res?.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toEqual(["object.deals.search"]);
  });

  it("tools/call on a granted tool succeeds", async () => {
    const deps = appDeps(["object.deals.*"], userCtx(["records.read"]));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "object.deals.search", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(false);
    expect(payload).toEqual({ results: ["deal-1"] });
  });

  it("tools/call on an existing-but-ungranted tool returns FORBIDDEN (not NOT_FOUND)", async () => {
    const deps = appDeps(["object.deals.*"], userCtx(["records.read"]));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "object.contacts.search", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(true);
    expect((payload as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("tools/call on a nonexistent tool returns NOT_FOUND", async () => {
    const deps = appDeps(["*"], userCtx(["records.read"]));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "no.such.tool", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(true);
    expect((payload as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("RBAC still applies after the grant gate: granted write without permission is FORBIDDEN", async () => {
    // Granted the write tool, but the acting user lacks records.write.
    const deps = appDeps(["object.tasks.create"], userCtx(["records.read"]));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "object.tasks.create", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(true);
    expect((payload as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("a granted write by a permitted user succeeds", async () => {
    const deps = appDeps(["object.tasks.create"], userCtx(["records.write"]));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "object.tasks.create", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(false);
    expect(payload).toEqual({ created: { id: 1 } });
  });

  it("a denylisted tool is FORBIDDEN to an app even with the '*' grant", async () => {
    // App granted everything, user is admin — but automation.create is on the app
    // denylist (it would escape the grant sandbox via deferred execution).
    const deps = appDeps(["*"], userCtx(["*"]));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "automation.create", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(true);
    expect((payload as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("a granted write by an unidentified caller (crmUserId null) is FORBIDDEN", async () => {
    const deps = appDeps(["object.tasks.create"], userCtx(["*"], null));
    const res = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "object.tasks.create", arguments: {} } },
      deps,
    );
    const { isError, payload } = parseCall(res?.result);
    expect(isError).toBe(true);
    expect((payload as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });
});

describe("handleRpc — hermes path is unaffected by app hooks", () => {
  it("tools/list returns the full set when no filterTools hook is set", async () => {
    const tools = fakeTools();
    const deps: BrokerDeps = {
      getTools: async () => tools,
      resolveContext: async () => userCtx(["*"]),
    };
    const res = await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, deps);
    const names = (res?.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toEqual([
      "object.deals.search",
      "object.contacts.search",
      "object.tasks.create",
      "automation.create",
    ]);
  });
});

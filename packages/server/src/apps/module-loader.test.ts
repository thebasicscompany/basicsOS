import { describe, expect, it } from "vitest";
import { loadModule, appToolsFor } from "@/apps/module-loader.js";
import { assertAppScopedSql, appTablePrefix, ScopedDbError } from "@/apps/scoped-db.js";
import { helloModule } from "@/apps/samples/hello-module.js";
import type { AppContext } from "@/apps/module-types.js";
import type { ToolCallContext } from "@/mcp-broker/protocol.js";

const ctx: ToolCallContext = {
  orgId: "org-1",
  crmUserId: 7,
  sessionKey: null,
  permissions: new Set(),
  can: () => false,
  meta: null,
  appGrants: [],
};

const fakeAppContext = (): AppContext => ({
  tenantId: "org-1",
  db: { tenantId: "org-1", query: async () => [] },
  gateway: { fetch: async () => new Response("{}") },
  broker: { call: async () => ({}) },
  secrets: { get: async () => null, set: async () => {} },
  logger: { info() {}, warn() {}, error() {} },
});

describe("loadModule", () => {
  it("namespaces a module's tool as app.{slug}.{name} and exposes its route", () => {
    const loaded = loadModule(helloModule, () => fakeAppContext());
    expect(loaded.slug).toBe("hello");
    expect(loaded.tools.map((t) => t.name)).toEqual(["app.hello.greet"]);
    expect(loaded.tools[0].meta.source).toBe("app");
    expect([...loaded.routes.keys()]).toContain("GET /ping");
    expect(appToolsFor([loaded]).map((t) => t.name)).toEqual(["app.hello.greet"]);
  });

  it("runs the namespaced tool against the AppContext", async () => {
    const loaded = loadModule(helloModule, () => fakeAppContext());
    const result = (await loaded.tools[0].handle({ name: "Ada" }, ctx)) as { message: string; by: string };
    expect(result.message).toBe("Hello Ada!");
    expect(result.by).toBe("7");
  });
});

describe("ScopedDb guard (assertAppScopedSql)", () => {
  const slug = "hello";
  it("allows queries on the app's own namespaced tables", () => {
    expect(() => assertAppScopedSql(`SELECT * FROM ${appTablePrefix(slug)}widgets`, slug)).not.toThrow();
    expect(() => assertAppScopedSql("SELECT * FROM app_hello_widgets WHERE id = $1", slug)).not.toThrow();
  });

  it("DENIES reads of core tables", () => {
    expect(() => assertAppScopedSql("SELECT * FROM crm_users", slug)).toThrow(ScopedDbError);
    expect(() => assertAppScopedSql("SELECT * FROM contacts", slug)).toThrow(ScopedDbError);
    expect(() => assertAppScopedSql("SELECT * FROM app_config", slug)).toThrow(ScopedDbError);
    expect(() => assertAppScopedSql('SELECT * FROM "public"."crm_users"', slug)).toThrow(ScopedDbError);
  });

  it("DENIES tables outside the app's namespace (another app's tables)", () => {
    expect(() => assertAppScopedSql("SELECT * FROM app_other_secrets", slug)).toThrow(ScopedDbError);
  });

  it("DENIES multi-statement smuggling and tableless queries", () => {
    expect(() =>
      assertAppScopedSql("SELECT * FROM app_hello_x; DROP TABLE crm_users", slug),
    ).toThrow(ScopedDbError);
    expect(() => assertAppScopedSql("SELECT 1", slug)).toThrow(ScopedDbError);
  });

  it("is not fooled by a core table name inside a string literal", () => {
    // 'crm_users' appears only as a string value, not a real table reference.
    expect(() =>
      assertAppScopedSql("SELECT * FROM app_hello_logs WHERE note = 'crm_users'", slug),
    ).not.toThrow();
  });
});

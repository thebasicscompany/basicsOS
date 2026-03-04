import { beforeEach, describe, expect, it, vi } from "vitest";
import { createViewRoutes } from "./views.js";
import { createObjectConfigRoutes } from "./object-config.js";
import { createCustomFieldRoutes } from "./custom-fields.js";

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: () => async (c: any, next: () => Promise<void>) => {
    c.set("session", { user: { id: "user-1" } });
    await next();
  },
}));

vi.mock("../lib/rbac.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rbac.js")>();
  return {
    ...actual,
    requirePermission: vi.fn().mockResolvedValue({
      ok: true,
      crmUser: { id: 11, organizationId: "org-1" },
      permissions: new Set(["*"]),
    }),
  };
});

function makeDbWithSelectQueue(queue: unknown[][]) {
  let i = 0;
  const nextResult = () => Promise.resolve((queue[i++] ?? []) as any);

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => nextResult()),
      })),
    })),
  }));

  const insertValues = vi.fn(() => Promise.resolve(undefined));
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    db: {
      select,
      insert,
    } as any,
    spies: {
      insertValues,
    },
  };
}

describe("tenancy boundaries", () => {
  beforeEach(async () => {
    const { requirePermission } = await import("../lib/rbac.js");
    vi.mocked(requirePermission).mockClear();
  });

  it("denies access to view columns when view ownership/org check fails", async () => {
    const { db } = makeDbWithSelectQueue([
      [{ id: 11, organizationId: "org-1" }], // crm user lookup
      [], // ownership check for target view
    ]);

    const app = createViewRoutes(db, {} as any);
    const res = await app.request("http://localhost/view/view-foreign/columns");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "View not found" });
  });

  it("writes favorites with crm user organization scope", async () => {
    const { db, spies } = makeDbWithSelectQueue([
      [{ id: 11, organizationId: "org-1", userId: "user-1" }], // crm user lookup
      [], // existing favorite check
    ]);

    const app = createObjectConfigRoutes(db, {} as any, {} as any);
    const res = await app.request("http://localhost/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectSlug: "contacts", recordId: 42 }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ favorited: true });
    expect(spies.insertValues).toHaveBeenCalledTimes(1);
    const calls = spies.insertValues.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const payload = calls[0][0] as Record<string, unknown>;
    expect(payload.crmUserId).toBe(11);
    expect(payload.organizationId).toBe("org-1");
    expect(payload.objectSlug).toBe("contacts");
    expect(payload.recordId).toBe(42);
  });

  it("writes custom field definitions with organization scope", async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: 9 }]);
    const insertValues = vi.fn(() => ({ returning: insertReturning }));
    const db = {
      insert: vi.fn(() => ({ values: insertValues })),
      select: vi.fn(),
      delete: vi.fn(),
    } as any;
    const app = createCustomFieldRoutes(db, {} as any);

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: "contacts",
        name: "Lead Score",
        label: "Lead Score",
        fieldType: "number",
      }),
    });

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledTimes(1);
    const calls = insertValues.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const payload = calls[0][0] as Record<string, unknown>;
    expect(payload.organizationId).toBe("org-1");
    expect(payload.name).toBe("lead_score");
  });
});

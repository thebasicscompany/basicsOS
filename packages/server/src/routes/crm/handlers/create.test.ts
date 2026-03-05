import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCreateHandler } from "@/routes/crm/handlers/create.js";
import { PERMISSIONS } from "@/lib/rbac.js";

vi.mock("../../../lib/rbac.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/rbac.js")>();
  return {
    ...actual,
    requirePermission: vi.fn(),
  };
});

vi.mock("../../../lib/automation-engine.js", () => ({
  fireEvent: vi.fn().mockResolvedValue(undefined),
  reloadRule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/embeddings.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/embeddings.js")>();
  return {
    ...actual,
    upsertEntityEmbedding: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../../lib/api-key-crypto.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/api-key-crypto.js")>();
  return {
    ...actual,
    resolveStoredApiKey: vi.fn().mockReturnValue(null),
  };
});

async function getRequirePermissionMock() {
  const mod = await import("../../../lib/rbac.js");
  return vi.mocked(mod.requirePermission);
}

function makeContext(
  params: Record<string, string>,
  payload: Record<string, unknown>,
  userId = "user-1",
) {
  return {
    req: {
      param: (key: string) => params[key] ?? "",
      json: async () => payload,
    },
    get: (key: string) => {
      if (key === "session") return { user: { id: userId } };
      return undefined;
    },
    json: (body: unknown, status = 200) => ({ status, body }),
  };
}

function makeDb({
  crmUser,
  insertReturning = [{ id: 1 }],
}: {
  crmUser: { id: number; organizationId: string; userId?: string };
  insertReturning?: Array<Record<string, unknown>>;
}) {
  const selectLimit = vi.fn().mockResolvedValue([crmUser]);
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const insertValues = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue(insertReturning),
  }));
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

describe("createCreateHandler security boundaries", () => {
  const crmUser = { id: 11, organizationId: "org-1", userId: "user-1" };

  beforeEach(async () => {
    const requirePermissionMock = await getRequirePermissionMock();
    requirePermissionMock.mockReset();
  });

  it("blocks create when user lacks recordsWrite permission", async () => {
    const requirePermissionMock = await getRequirePermissionMock();
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: { status: 403, body: { error: "Forbidden" } } as any,
    });
    const { db } = makeDb({ crmUser });
    const handler = createCreateHandler(db, {
      BASICSOS_API_URL: "http://localhost",
    } as any);
    const c = makeContext(
      { resource: "contacts" },
      { first_name: "Ava", last_name: "Lee" },
    );

    const res = await handler(c as any);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("rejects unknown writable fields via strict schema validation", async () => {
    const requirePermissionMock = await getRequirePermissionMock();
    requirePermissionMock.mockResolvedValue({
      ok: true,
      crmUser,
      permissions: new Set([PERMISSIONS.recordsWrite]),
    } as any);
    const { db } = makeDb({ crmUser });
    const handler = createCreateHandler(db, {
      BASICSOS_API_URL: "http://localhost",
    } as any);
    const c = makeContext(
      { resource: "contacts" },
      { first_name: "Ava", unexpected_field: "x" },
    );

    const res = await handler(c as any);

    expect(res.status).toBe(400);
    expect((res.body as { error?: string }).error).toContain("Invalid");
  });

  it("injects crmUserId and organizationId from server-side identity", async () => {
    const authCrmUser = { id: 77, organizationId: "org-secure", userId: "user-1" };
    const requirePermissionMock = await getRequirePermissionMock();
    requirePermissionMock.mockResolvedValue({
      ok: true,
      crmUser: authCrmUser,
      permissions: new Set([PERMISSIONS.recordsWrite]),
    } as any);
    const { db, spies } = makeDb({
      crmUser: authCrmUser,
      insertReturning: [{ id: 101, firstName: "Ava" }],
    });
    const handler = createCreateHandler(db, {
      BASICSOS_API_URL: "http://localhost",
    } as any);
    const c = makeContext(
      { resource: "contacts" },
      { first_name: "Ava", last_name: "Lee" },
    );

    const res = await handler(c as any);

    expect(res.status).toBe(201);
    const calls = spies.insertValues.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const insertedArg = calls[0][0] as Record<string, unknown>;
    expect(insertedArg.crmUserId).toBe(77);
    expect(insertedArg.organizationId).toBe("org-secure");
    expect(insertedArg.firstName).toBe("Ava");
  });
});

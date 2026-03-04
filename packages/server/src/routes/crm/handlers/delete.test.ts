import { describe, expect, it, vi, beforeEach } from "vitest";
import { createDeleteHandler } from "./delete.js";
import { PERMISSIONS } from "../../../lib/rbac.js";

vi.mock("../../../lib/rbac.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/rbac.js")>();
  return {
    ...actual,
    getPermissionSetForUser: vi.fn(),
  };
});

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLogSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/automation-engine.js", () => ({
  fireEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/embeddings.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/embeddings.js")>();
  return {
    ...actual,
    deleteEntityEmbedding: vi.fn().mockResolvedValue(undefined),
  };
});

async function getPermissionMock() {
  const mod = await import("../../../lib/rbac.js");
  return vi.mocked(mod.getPermissionSetForUser);
}

function makeContext(
  params: Record<string, string>,
  userId = "user-1"
): {
  req: { param: (key: string) => string };
  get: (key: string) => unknown;
  json: (body: unknown, status?: number) => { status: number; body: unknown };
} {
  return {
    req: {
      param: (key: string) => params[key] ?? "",
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
  deleteReturning = [],
  updateReturning = [],
}: {
  crmUser: { id: number; organizationId: string; userId?: string };
  deleteReturning?: unknown[];
  updateReturning?: unknown[];
}) {
  const selectLimit = vi.fn().mockResolvedValue([crmUser]);
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const deleteReturningFn = vi.fn().mockResolvedValue(deleteReturning);
  const deleteWhere = vi.fn(() => ({ returning: deleteReturningFn }));
  const del = vi.fn(() => ({ where: deleteWhere }));

  const updateReturningFn = vi.fn().mockResolvedValue(updateReturning);
  const updateWhere = vi.fn(() => ({ returning: updateReturningFn }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  return {
    db: {
      select,
      delete: del,
      update,
    } as any,
    spies: {
      deleteWhere,
      updateWhere,
      updateSet,
    },
  };
}

describe("createDeleteHandler security boundaries", () => {
  beforeEach(async () => {
    const permissionMock = await getPermissionMock();
    permissionMock.mockReset();
  });

  it("blocks non-admin hard delete for non-deal resources", async () => {
    const permissionMock = await getPermissionMock();
    permissionMock.mockResolvedValue(new Set([PERMISSIONS.recordsArchive]));
    const { db } = makeDb({
      crmUser: { id: 11, organizationId: "org-1", userId: "user-1" },
    });
    const handler = createDeleteHandler(db);
    const c = makeContext({ resource: "contacts", id: "12" });

    const res = await handler(c as any);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("archives deals for users with archive permission but no hard-delete permission", async () => {
    const permissionMock = await getPermissionMock();
    permissionMock.mockResolvedValue(new Set([PERMISSIONS.recordsArchive]));
    const { db, spies } = makeDb({
      crmUser: { id: 11, organizationId: "org-1", userId: "user-1" },
      updateReturning: [{ id: 33, archivedAt: new Date().toISOString() }],
    });
    const handler = createDeleteHandler(db);
    const c = makeContext({ resource: "deals", id: "33" });

    const res = await handler(c as any);

    expect(res.status).toBe(200);
    expect((res.body as any).archived).toBe(true);
    expect(spies.updateSet).toHaveBeenCalledTimes(1);
  });

  it("allows hard delete for users with recordsDeleteHard permission", async () => {
    const permissionMock = await getPermissionMock();
    permissionMock.mockResolvedValue(new Set([PERMISSIONS.recordsDeleteHard]));
    const { db } = makeDb({
      crmUser: { id: 11, organizationId: "org-1", userId: "user-1" },
      deleteReturning: [{ id: 44 }],
    });
    const handler = createDeleteHandler(db);
    const c = makeContext({ resource: "contacts", id: "44" });

    const res = await handler(c as any);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 44 });
  });

  it("returns not found when target record is outside scoped query", async () => {
    const permissionMock = await getPermissionMock();
    permissionMock.mockResolvedValue(new Set([PERMISSIONS.recordsDeleteHard]));
    const { db } = makeDb({
      crmUser: { id: 11, organizationId: "org-1", userId: "user-1" },
      deleteReturning: [],
    });
    const handler = createDeleteHandler(db);
    const c = makeContext({ resource: "deals", id: "999" });

    const res = await handler(c as any);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

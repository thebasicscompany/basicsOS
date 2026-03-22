import { describe, expect, it, vi } from "vitest";
import { createAuthRoutes } from "@/routes/auth.js";

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: () => async (c: unknown, next: () => Promise<void>) => {
    (c as { set: (k: string, v: unknown) => void }).set("session", {
      user: { id: "user-1" },
      session: { token: "tok-1", id: "sid-1" },
    });
    await next();
  },
}));

vi.mock("../lib/rbac.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rbac.js")>();
  return {
    ...actual,
    getPermissionSetForUser: vi.fn().mockResolvedValue(new Set(["*"])),
    requirePermission: vi.fn().mockResolvedValue({
      ok: true,
      crmUser: { id: 11, organizationId: "org-1" },
      permissions: new Set(["*"]),
    }),
  };
});

function makeDbForAuth(selectQueue: unknown[][]) {
  let i = 0;
  const nextResult = () => Promise.resolve((selectQueue[i++] ?? []) as never);
  const limitFn = vi.fn(() => nextResult());
  const chain = {
    limit: limitFn,
    orderBy: vi.fn(function (this: typeof chain) {
      return this;
    }),
    where: vi.fn(function (this: typeof chain) {
      return { limit: limitFn, orderBy: () => this };
    }),
  };
  const fromFn = vi.fn(() => chain);

  const insertReturning = vi.fn(() => Promise.resolve([]));
  const insertValues = vi.fn(() => ({ returning: insertReturning }));

  return {
    select: vi.fn(() => ({ from: fromFn })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })),
    insertReturning,
  } as const;
}

describe("auth route decomposition", () => {
  it("GET /init returns initialized: false when no organizations exist", async () => {
    const db = makeDbForAuth([[]]);

    const app = createAuthRoutes(db as never, {} as never, {} as never);
    const res = await app.request("http://localhost/init");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ initialized: false });
  });

  it("GET /init returns initialized: true when organizations exist", async () => {
    const db = makeDbForAuth([[{ id: "org-1", name: "Acme" }]]);

    const app = createAuthRoutes(db as never, {} as never, {} as never);
    const res = await app.request("http://localhost/init");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ initialized: true, orgName: "Acme" });
  });

  it("GET /gateway-token returns token when session exists", async () => {
    const db = makeDbForAuth([]);

    const app = createAuthRoutes(db as never, {} as never, {} as never);
    const res = await app.request("http://localhost/gateway-token");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ token: "tok-1" });
  });

  it("GET /me returns profile when crm user exists", async () => {
    const crmUser = {
      id: 42,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      avatar: null,
      basicsApiKeyEnc: null,
      basicsApiKey: null,
    };
    const db = makeDbForAuth([[crmUser]]); // crm user lookup (getPermissionSetForUser is mocked)

    const app = createAuthRoutes(db as never, {} as never, {} as never);
    const res = await app.request("http://localhost/me");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.firstName).toBe("Jane");
    expect(body.lastName).toBe("Doe");
    expect(body.email).toBe("jane@example.com");
    expect(body.fullName).toBe("Jane Doe");
  });

  it("GET /me returns 404 when crm user not found", async () => {
    const db = makeDbForAuth([
      [], // crm user lookup - empty
    ]);

    const app = createAuthRoutes(db as never, {} as never, {} as never);
    const res = await app.request("http://localhost/me");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "User not found in CRM" });
  });

  it("GET /organization returns org when user has organization", async () => {
    const crmUser = { id: 11, organizationId: "org-1", userId: "user-1" };
    const org = { id: "org-1", name: "Acme Corp", logo: null };

    const db = makeDbForAuth([
      [crmUser], // crm user lookup
      [org], // org lookup
    ]);

    const app = createAuthRoutes(db as never, {} as never, {} as never);
    const res = await app.request("http://localhost/organization");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "org-1", name: "Acme Corp", logo: null });
  });
});

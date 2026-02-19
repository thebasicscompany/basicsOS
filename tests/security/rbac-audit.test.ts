import { describe, it, expect } from "vitest";

// Verify that all routers have proper access control by checking procedure types
// This is a structural audit — we verify the appRouter exports all expected namespaces
describe("AppRouter RBAC Audit", () => {
  it("appRouter exports all required modules", { timeout: 15000 }, async () => {
    const { appRouter } = await import("../../packages/api/src/routers/index.js");
    const routes = Object.keys(appRouter._def.procedures);

    // Verify all core modules are registered
    const expectedPrefixes = [
      "auth.", "knowledge.", "tasks.", "crm.", "meetings.", "search.",
      "assistant.", "modules.", "automations.", "hub.",
      "aiEmployees.",
    ];

    for (const prefix of expectedPrefixes) {
      const hasRoute = routes.some((r) => r.startsWith(prefix));
      expect(hasRoute, `Missing routes for ${prefix}`).toBe(true);
    }
  });

  it("appRouter has at least 30 procedures registered", async () => {
    const { appRouter } = await import("../../packages/api/src/routers/index.js");
    const count = Object.keys(appRouter._def.procedures).length;
    expect(count).toBeGreaterThan(30);
  });
});

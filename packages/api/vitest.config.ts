import { defineConfig } from "vitest/config";

// Vitest requires default export — framework exception to named-export rule.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      // Provide stub env vars so DB/auth modules load without crashing in unit tests.
      // No real connection is made — tests mock the db and auth objects.
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_stub",
      BETTER_AUTH_SECRET: "test-secret-stub-for-unit-tests-only",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});

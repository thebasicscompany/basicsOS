import { defineConfig } from "vitest/config";

// Vitest requires default export — framework exception to named-export rule.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      BETTER_AUTH_SECRET: "test-secret",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});

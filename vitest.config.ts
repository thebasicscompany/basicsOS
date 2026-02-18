import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Vitest requires default export — framework exception to named-export rule.
export default defineConfig({
  resolve: {
    alias: {
      "@basicsos/shared": resolve(__dirname, "packages/shared/dist/index.js"),
      "@basicsos/db": resolve(__dirname, "packages/db/dist/index.js"),
      "@basicsos/auth": resolve(__dirname, "packages/auth/dist/index.js"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_stub",
      BETTER_AUTH_SECRET: "test-secret-stub",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});

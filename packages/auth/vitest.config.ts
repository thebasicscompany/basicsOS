import { defineConfig } from "vitest/config";

// Vitest requires default export — framework exception to named-export rule.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config";

// Vitest requires a default export for config files — framework exception to named-export rule.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

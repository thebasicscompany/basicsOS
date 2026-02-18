import { defineConfig } from "drizzle-kit";

// Drizzle config requires default export — framework exception to named-export rule.
export default defineConfig({
  schema: "./dist/schema/index.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? (() => { throw new Error("DATABASE_URL is required"); })(),
  },
});

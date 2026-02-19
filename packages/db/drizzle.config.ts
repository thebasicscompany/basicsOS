import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import path from "path";

// drizzle-kit runs from packages/db/ — load root .env explicitly.
// Try repo root (../../.env from packages/db) then fallback to cwd.
config({ path: path.resolve(__dirname, "../../.env") });
config({ path: path.resolve(process.cwd(), ".env") });

// Drizzle config requires default export — framework exception to named-export rule.
export default defineConfig({
  schema: "./dist/schema/index.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? (() => { throw new Error("DATABASE_URL is required — create a .env file at the repo root"); })(),
  },
});

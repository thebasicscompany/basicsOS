import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "path";

// Load root .env so server routes (auth, webhooks, OAuth) can reach the DB.
// Next.js loads apps/web/.env.local with highest priority, which can mask the
// real DATABASE_URL. Loading the root .env first with override:true fixes this.
// We parse it manually to avoid dotenv's DOTENV_KEY vault mode triggering a
// warning when that key happens to be present in the file.
const rootEnvPath = path.resolve(process.cwd(), "../../.env");
const parsed = config({ path: rootEnvPath, override: true }).parsed ?? {};
// Remove vault key so subsequent dotenv calls don't enter vault mode
delete parsed["DOTENV_KEY"];

// Warn on missing client-side env vars that would silently break tRPC calls.
const requiredClientEnvVars = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"];
for (const key of requiredClientEnvVars) {
  if (!process.env[key]) {
    console.warn(`[next.config] WARNING: ${key} is not set — tRPC calls will fail.`);
  }
}

const nextConfig: NextConfig = {
  // Compile workspace packages from source so Next.js handles source maps
  // correctly and UI changes don't require a separate dist rebuild.
  transpilePackages: ["@basicsos/ui", "@basicsos/shared", "@basicsos/auth", "@basicsos/db"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

// Next.js requires a default export for next.config.ts — framework exception to named-export rule.
export default nextConfig;

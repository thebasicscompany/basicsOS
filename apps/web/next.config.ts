import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "path";

// Load root .env so server routes (auth, webhooks, OAuth) can reach the DB.
// Next.js loads apps/web/.env.local with highest priority, which can mask the
// real DATABASE_URL. Loading the root .env first with override:true fixes this.
config({ path: path.resolve(process.cwd(), "../../.env"), override: true });

// Warn on missing client-side env vars that would silently break tRPC calls.
const requiredClientEnvVars = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"];
for (const key of requiredClientEnvVars) {
  if (!process.env[key]) {
    console.warn(`[next.config] WARNING: ${key} is not set — tRPC calls will fail.`);
  }
}

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "lucide-react"],
  },
};

// Next.js requires a default export for next.config.ts — framework exception to named-export rule.
export default nextConfig;

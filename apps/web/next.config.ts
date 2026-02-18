import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@basicsos/ui", "@basicsos/shared", "@basicsos/api"],
};

// Next.js requires a default export for next.config.ts — framework exception to named-export rule.
export default nextConfig;

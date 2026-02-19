import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@basicsos/ui", "@basicsos/shared"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

// Next.js requires a default export for next.config.ts — framework exception to named-export rule.
export default nextConfig;

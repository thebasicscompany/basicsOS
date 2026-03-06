import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import createHtmlPlugin from "vite-plugin-simple-html";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/assistant": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      open: process.env.NODE_ENV !== "CI",
      filename: "./dist/stats.html",
    }),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `src/main.tsx`,
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  define:
    process.env.NODE_ENV === "production" && process.env.VITE_SUPABASE_URL
      ? {
          "import.meta.env.VITE_IS_DEMO": JSON.stringify(
            process.env.VITE_IS_DEMO,
          ),
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            process.env.VITE_SUPABASE_URL,
          ),
          "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SB_PUBLISHABLE_KEY,
          ),
          "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(
            process.env.VITE_INBOUND_EMAIL,
          ),
        }
      : undefined,
  base: "./",
  optimizeDeps: {
    exclude: ["@basics-os/hub", "parse5"],
    esbuildOptions: {
      loader: {
        ".csv": "text",
      },
    },
  },
  esbuild: {
    keepNames: true,
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "react-router-dom",
      "@tanstack/react-query",
    ],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "basics-os/src": path.resolve(__dirname, "./src"),
      "@ai-sdk/provider-utils": path.resolve(
        __dirname,
        "node_modules/.pnpm/@ai-sdk+provider-utils@2.2.8_zod@3.25.76/node_modules/@ai-sdk/provider-utils",
      ),
      entities: path.resolve(
        __dirname,
        "node_modules/.pnpm/entities@6.0.1/node_modules/entities",
      ),
    },
  },
});

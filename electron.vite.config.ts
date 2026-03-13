import path from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode ?? "production", process.cwd(), "");
  const builtInApiUrl = env["VITE_API_URL"] ?? "http://localhost:3001";

  return {
    main: {
      define: {
        // Bake the API URL into the main process bundle so proxy-overlay-request
        // uses the correct remote URL in packaged builds (where runtime env vars
        // from .env are not available).
        'process.env["VITE_API_URL"]': JSON.stringify(builtInApiUrl),
      },
      resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
      },
      build: {
        rollupOptions: {
          external: ["screencapturekit-audio-capture"],
        },
      },
    },
    // Preload must be CommonJS: Electron's sandbox runs it in a context that doesn't support ESM.
    // @electron-toolkit/preload must be bundled (not externalized) because the sandboxed
    // preload context has no access to node_modules at runtime.
    preload: {
      plugins: [
        externalizeDepsPlugin({ exclude: ["@electron-toolkit/preload"] }),
      ],
      resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
      },
      build: {
        rollupOptions: {
          output: {
            format: "cjs",
            entryFileNames: "[name].cjs",
          },
        },
      },
    },
    renderer: {
      publicDir: path.resolve(__dirname, "public"),
      base: "./",
      define: {
        "import.meta.env.VITE_IS_ELECTRON": JSON.stringify("true"),
        // Bake the API URL into the renderer bundle so packaged builds have a
        // working default. In per-org installers the main process will override
        // this at runtime via userData/org-config.json (persisted across updates).
        "import.meta.env.VITE_API_URL": JSON.stringify(builtInApiUrl),
      },
      build: {
        rollupOptions: {
          input: {
            index: path.resolve(__dirname, "src/renderer/index.html"),
            overlay: path.resolve(__dirname, "src/renderer/overlay.html"),
          },
        },
      },
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "src"),
          "@renderer": path.resolve(__dirname, "src/renderer/src"),
          "basics-os/src": path.resolve(__dirname, "src"),
          // Force the frontend to use the 2.x provider-utils that @ai-sdk/react
          // needs, not the 4.x one hoisted by the server's @ai-sdk/openai.
          "@ai-sdk/provider-utils": path.resolve(
            __dirname,
            "node_modules/.pnpm/@ai-sdk+provider-utils@2.2.8_zod@3.25.76/node_modules/@ai-sdk/provider-utils",
          ),
        },
      },
      plugins: [react(), tailwindcss()],
      server: {
        proxy: {
          "/api": { target: "http://localhost:3001", changeOrigin: true },
          "/assistant": { target: "http://localhost:3001", changeOrigin: true },
          "/v1": { target: "http://localhost:3001", changeOrigin: true },
          "/stream": { target: "http://localhost:3001", changeOrigin: true },
        },
      },
    },
  };
});

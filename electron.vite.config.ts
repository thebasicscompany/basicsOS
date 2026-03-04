import path from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
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
});

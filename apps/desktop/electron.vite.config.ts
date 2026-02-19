import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// eslint-disable-next-line import/no-default-export -- electron-vite requires default export
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ["electron-updater"],
      },
    },
    resolve: {
      alias: {
        "@main": resolve("src/main"),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        external: ["@electron-toolkit/preload"],
      },
    },
    resolve: {
      alias: {
        "@preload": resolve("src/preload"),
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
  },
});

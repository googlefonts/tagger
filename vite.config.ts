import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import vue2 from "@vitejs/plugin-vue2";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/tagger/",
  plugins: [
    vue2(),
    legacy({
      targets: ["ie >= 11"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
  ],
  server: {
    proxy: {
      "/api/fonts-metadata": {
        target: "https://fonts.sandbox.google.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fonts-metadata/, "/metadata/fonts"),
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      vue: "vue/dist/vue.esm.js",
    },
  },
});

import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import vue2 from "@vitejs/plugin-vue2";

// https://vitejs.dev/config/
// VITE_SCRIPTS=1 builds the script tagging variant, served under /tagger/scripts/
const scriptTagging = process.env.VITE_SCRIPTS === "1";

export default defineConfig({
  base: scriptTagging ? "/tagger/scripts/" : "/tagger/",
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

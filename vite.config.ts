import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import prerenderStaticPlugin from "./vite-plugin-prerender-static";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    prerenderStaticPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es", // ✅ modern module format (required)
    rollupOptions: {
      output: {
        manualChunks: undefined, // prevents code-splitting inside worker
      },
    },
  },
});

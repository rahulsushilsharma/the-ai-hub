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
    prerenderStaticPlugin({
      routes: [
        {
          path: "/",
          tags: {
            title: "Home",
            description: "Home page",
            keywords: "home page",
            image: "",
            url: "",
            author: "Rahul Sharma",
          },
        },
        {
          path: "/chat",
          tags: {
            title: "Chat",
            description: "Chat page",
            keywords: "chat page",
            image: "",
            url: "",
            author: "Rahul Sharma",
          },
        },
        {
          path: "/tts-demo",
          tags: {
            title: "TTS Demo",
            description: "TTS Demo page",
            keywords: "tts demo page",
            image: "",
            url: "",
            author: "Rahul Sharma",
          },
        },
        {
          path: "/huggingface-chat",
          tags: {
            title: "Huggingface Chat",
            description: "Huggingface Chat page",
            keywords: "huggingface chat page",
            image: "",
            url: "",
            author: "Rahul Sharma",
          },
        },
        {
          path: "/bg-remover",
          tags: {
            title: "Background Remover",
            description: "Background Remover page",
            keywords: "background remover page",
            image: "",
            url: "",
            author: "Rahul Sharma",
          },
        },
      ],
    }),
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

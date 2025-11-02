import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import prerenderStaticPlugin from "./vite-plugin-prerender-static";
export const seoConfig = {
  routes: [
    {
      path: "/",
      tags: {
        title: "Rahul Sharma | AI Developer & Full-Stack Engineer",
        description:
          "Official website of Rahul Sharma — AI and Full-Stack Developer specializing in GenAI, React, and Python. Explore projects, demos, and tools built for modern developers.",
        keywords:
          "Rahul Sharma, AI Developer, Full Stack Engineer, GenAI, React, Python, portfolio, web development",
        image: "https://rahulsharma.ai/assets/og-image.png",
        url: "https://rahulsharma.ai/",
        author: "Rahul Sharma",
        ampUrl: "https://rahulsharma.ai/amp",
        canonical: "https://rahulsharma.ai/",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Rahul Sharma",
          description:
            "Official portfolio of Rahul Sharma — showcasing AI and full-stack development projects.",
          url: "https://rahulsharma.ai/",
        },
      },
    },
    {
      path: "/chat",
      tags: {
        title: "AI Chat | Rahul Sharma",
        description:
          "Chat with Rahul Sharma’s custom AI assistant powered by local LLMs and modern web technologies.",
        keywords:
          "AI chat, chatbot, Rahul Sharma, interactive assistant, local LLM, GenAI demo",
        image: "https://rahulsharma.ai/assets/chat-og.png",
        url: "https://rahulsharma.ai/chat",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/chat",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "AI Chat",
          description:
            "A local AI chat interface built by Rahul Sharma using open-source LLMs.",
          applicationCategory: "Chatbot",
          url: "https://rahulsharma.ai/chat",
        },
      },
    },
    {
      path: "/tts-demo",
      tags: {
        title: "TTS Demo | Rahul Sharma",
        description:
          "Try Rahul Sharma’s Text-to-Speech demo — generate realistic speech locally using ONNX and WebGPU.",
        keywords:
          "text to speech, tts demo, AI voice, ONNX, WebGPU, Rahul Sharma",
        image: "https://rahulsharma.ai/assets/tts-og.png",
        url: "https://rahulsharma.ai/tts-demo",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/tts-demo",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "TTS Demo",
          description:
            "A browser-based Text-to-Speech demo built by Rahul Sharma using ONNX Runtime and WebGPU.",
          applicationCategory: "SpeechSynthesis",
          operatingSystem: "Web",
          url: "https://rahulsharma.ai/tts-demo",
        },
      },
    },
    {
      path: "/huggingface-chat",
      tags: {
        title: "Hugging Face Chat | Rahul Sharma",
        description:
          "Interact with Hugging Face models directly through a sleek chat interface designed by Rahul Sharma.",
        keywords:
          "Hugging Face, AI chat, transformers, LLM, NLP, Rahul Sharma, GenAI",
        image: "https://rahulsharma.ai/assets/hf-chat-og.png",
        url: "https://rahulsharma.ai/huggingface-chat",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/huggingface-chat",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Hugging Face Chat",
          description:
            "Chat interface built for Hugging Face models by Rahul Sharma.",
          applicationCategory: "Chatbot",
          url: "https://rahulsharma.ai/huggingface-chat",
        },
      },
    },
    {
      path: "/bg-remover",
      tags: {
        title: "AI Background Remover | Rahul Sharma",
        description:
          "Remove image backgrounds instantly using Rahul Sharma’s AI-powered background remover tool — runs fully in the browser.",
        keywords:
          "background remover, AI tools, image processing, Rahul Sharma, webgpu, fast remove background",
        image: "https://rahulsharma.ai/assets/bg-remover-og.png",
        url: "https://rahulsharma.ai/bg-remover",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/bg-remover",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AI Background Remover",
          description:
            "An in-browser AI background removal tool built by Rahul Sharma using modern web tech.",
          applicationCategory: "ImageEditing",
          operatingSystem: "Web",
          url: "https://rahulsharma.ai/bg-remover",
        },
      },
    },
  ],
};

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
      routes: seoConfig.routes,
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

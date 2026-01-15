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
          "Exploring the frontier of GenAI and WebGPU. Check out my latest AI tools and full-stack projects.",
        // Social Media Specific Tags
        ogTitle: "Rahul Sharma | AI & Full-Stack Portfolio",
        ogDescription:
          "Building the future of the web with Generative AI and React. See my live demos 🚀",
        twitterCard: "summary_large_image",
        twitterSite: "@yourusername", // Replace with your actual handle
        twitterTitle: "Rahul Sharma | AI Developer",
        twitterDescription:
          "Full-stack engineer specializing in GenAI, Python, and high-performance web apps.",
        image: "https://rahulsharma.ai/assets/og-home.png",
        url: "https://rahulsharma.ai/",
      },
    },
    {
      path: "/chat",
      tags: {
        title: "Private AI Chat | Local LLM Demo",
        description:
          "Chat with an AI that never leaves your browser. Privacy-first GenAI powered by local LLMs.",
        ogTitle: "Secure, Local AI Chatting 🤖",
        ogDescription:
          "No servers, no tracking. Just you and the AI, running 100% locally in your browser.",
        twitterCard: "summary_large_image",
        twitterTitle: "Try My Private Local AI Chat",
        twitterDescription:
          "Experience the power of LLMs running entirely in your browser. Privacy by design.",
        image: "https://rahulsharma.ai/assets/chat-og.png",
        url: "https://rahulsharma.ai/chat",
      },
    },
    {
      path: "/tts-demo",
      tags: {
        title: "WebGPU Text-to-Speech | Real-time AI Voice",
        description:
          "High-quality neural voice synthesis directly in your browser using WebGPU and ONNX.",
        ogTitle: "Neural TTS in the Browser 🎙️",
        ogDescription:
          "Generating realistic speech instantly using WebGPU. Try the demo!",
        twitterCard: "summary_large_image",
        twitterTitle: "Real-time AI Voice (WebGPU)",
        twitterDescription:
          "Neural Text-to-Speech that runs locally. No cloud latency, just instant voice.",
        image: "https://rahulsharma.ai/assets/tts-og.png",
        url: "https://rahulsharma.ai/tts-demo",
      },
    },
    {
      path: "/huggingface-chat",
      tags: {
        title: "Hugging Face Chat | Test Open Source Models",
        description:
          "A sleek UI to interact with any Hugging Face model. Seamless LLM testing and interaction.",
        ogTitle: "Hugging Face Model Explorer ✨",
        ogDescription:
          "Test the latest open-source LLMs through a custom-built chat interface.",
        twitterCard: "summary_large_image",
        twitterTitle: "Hugging Face Chat Interface",
        twitterDescription:
          "Interact with the best of open-source AI in one clean dashboard.",
        image: "https://rahulsharma.ai/assets/hf-chat-og.png",
        url: "https://rahulsharma.ai/huggingface-chat",
      },
    },
    {
      path: "/bg-remover",
      tags: {
        title: "AI Background Remover | Fast & Free",
        description:
          "Instantly remove image backgrounds in your browser. No sign-up, no cost, 100% private.",
        ogTitle: "One-Click AI Background Remover 🖼️",
        ogDescription:
          "Need a clean cutout? Remove backgrounds instantly without uploading to a server.",
        twitterCard: "summary_large_image",
        twitterTitle: "Free AI Background Remover",
        twitterDescription:
          "High-quality image cutouts in seconds, powered by browser-based AI.",
        image: "https://rahulsharma.ai/assets/bg-remover-og.png",
        url: "https://rahulsharma.ai/bg-remover",
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

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
        title: "Rahul Sharma | Generative AI Specialist & Full-Stack Engineer",
        description:
          "Portfolio of Rahul Sharma, an AI Developer building high-performance GenAI applications, React interfaces, and Python backends. Explore cutting-edge AI demos and developer tools.",
        keywords:
          "Rahul Sharma, AI Engineer, Full Stack Developer, Generative AI Specialist, React Developer, Python AI, LLM Integration, WebGPU AI",
        image: "https://rahulsharma.ai/assets/og-image.png",
        url: "https://rahulsharma.ai/",
        author: "Rahul Sharma",
        ampUrl: "https://rahulsharma.ai/amp",
        canonical: "https://rahulsharma.ai/",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "Person", // Changed to Person to build personal brand authority
          name: "Rahul Sharma",
          jobTitle: "AI Developer & Full-Stack Engineer",
          url: "https://rahulsharma.ai/",
          description:
            "Specializing in GenAI, React, and Python to build modern, scalable web applications.",
          sameAs: [
            "https://github.com/rahulsharma", // Add your social links here
            "https://linkedin.com/in/rahulsharma",
          ],
        },
      },
    },
    {
      path: "/chat",
      tags: {
        title: "Private Local AI Chat Demo | Rahul Sharma",
        description:
          "Experience a private, secure AI Chat powered by local LLMs. No data leaves your browser. Fast, interactive GenAI built with modern web technologies.",
        keywords:
          "Local LLM chat, private AI, browser-based AI, Rahul Sharma, Llama 3 web demo, secure chatbot",
        image: "https://rahulsharma.ai/assets/chat-og.png",
        url: "https://rahulsharma.ai/chat",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/chat",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Local AI Chat",
          description:
            "A privacy-focused local AI chat interface using open-source LLMs.",
          applicationCategory: "CommunicationApplication",
          operatingSystem: "Web Browser",
          url: "https://rahulsharma.ai/chat",
        },
      },
    },
    {
      path: "/tts-demo",
      tags: {
        title: "Real-time Text-to-Speech (TTS) | WebGPU & ONNX Demo",
        description:
          "Convert text to realistic speech instantly in your browser. Utilizing WebGPU and ONNX Runtime for high-speed, local neural voice synthesis.",
        keywords:
          "Text to Speech demo, WebGPU TTS, ONNX Runtime AI, browser speech synthesis, Rahul Sharma AI",
        image: "https://rahulsharma.ai/assets/tts-og.png",
        url: "https://rahulsharma.ai/tts-demo",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/tts-demo",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "WebGPU Text-to-Speech",
          description:
            "High-performance browser-based TTS using ONNX and WebGPU acceleration.",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Web",
          url: "https://rahulsharma.ai/tts-demo",
        },
      },
    },
    {
      path: "/huggingface-chat",
      tags: {
        title: "Hugging Face Model Explorer | Interactive AI Chat",
        description:
          "Test and interact with the latest Hugging Face LLMs and Transformers through a custom-built, high-performance chat interface.",
        keywords:
          "Hugging Face API, LLM explorer, Transformers web UI, Rahul Sharma, AI model testing",
        image: "https://rahulsharma.ai/assets/hf-chat-og.png",
        url: "https://rahulsharma.ai/huggingface-chat",
        author: "Rahul Sharma",
        canonical: "https://rahulsharma.ai/huggingface-chat",
        robots: "index, follow",
        schema: {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Hugging Face Chat Interface",
          description:
            "A specialized UI for interacting with Hugging Face Inference APIs.",
          applicationCategory: "DeveloperApplication",
          url: "https://rahulsharma.ai/huggingface-chat",
        },
      },
    },
    {
      path: "/bg-remover",
      tags: {
        title: "Free AI Background Remover | Instant & Local",
        description:
          "Remove image backgrounds for free with one click. 100% private, browser-based processing with no server uploads required.",
        keywords:
          "free background remover, AI image tool, remove bg locally, WebGPU image processing, Rahul Sharma",
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
            "An in-browser background removal tool using machine learning.",
          applicationCategory: "PhotoEditor",
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

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import prerenderStaticPlugin from "vite-plugin-prerender-static";
export const seoConfig = {
  routes: [
    {
      path: "/",
      tags: {
        title: "Rahul Sharma | AI Developer & Full-Stack Engineer",
        description:
          "Exploring the frontier of GenAI and WebGPU. Check out my latest AI tools and full-stack projects.",

        ogTitle: "Rahul Sharma | AI & Full-Stack Portfolio",
        ogDescription:
          "Building the future of the web with Generative AI and React. See my live demos 🚀",

        twitterCard: "summary_large_image",
        twitterSite: "@rahulsharma0_0",
        twitterTitle: "Rahul Sharma | AI Developer",
        twitterDescription:
          "Full-stack engineer specializing in GenAI, Python, and high-performance web apps.",

        image: "https://ai.rahulsharma.app/assets/web-app-manifest-192x192.png",
        url: "https://ai.rahulsharma.app/",

        keywords:
          "Rahul Sharma, AI Developer, GenAI, WebGPU, Full-Stack Engineer, React, Portfolio",

        schema: {
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Rahul Sharma",
          url: "https://ai.rahulsharma.app/",
          jobTitle: "AI Developer & Full-Stack Engineer",
          sameAs: ["https://github.com/rahulsushilsharma"],
        },
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

        image: "https://ai.rahulsharma.app/assets/web-app-manifest-192x192.png",
        url: "https://ai.rahulsharma.app/chat",

        keywords:
          "Local LLM, Private AI Chat, Browser AI, GenAI, WebGPU, Privacy First AI",

        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Private AI Chat",
          applicationCategory: "DeveloperTool",
          operatingSystem: "Web",
          url: "https://ai.rahulsharma.app/chat",
        },
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

        image: "https://ai.rahulsharma.app/assets/web-app-manifest-192x192.png",
        url: "https://ai.rahulsharma.app/tts-demo",

        keywords:
          "Text to Speech, WebGPU TTS, Neural Voice, Browser AI, ONNX, AI Voice",

        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "WebGPU Text-to-Speech",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Web",
          url: "https://ai.rahulsharma.app/tts-demo",
        },
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

        image: "https://ai.rahulsharma.app/assets/web-app-manifest-192x192.png",
        url: "https://ai.rahulsharma.app/huggingface-chat",

        keywords:
          "Hugging Face, Open Source LLM, AI Chat, Model Testing, Transformers",

        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Hugging Face Chat",
          applicationCategory: "DeveloperTool",
          operatingSystem: "Web",
          url: "https://ai.rahulsharma.app/huggingface-chat",
        },
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

        image: "https://ai.rahulsharma.app/assets/web-app-manifest-192x192.png",
        url: "https://ai.rahulsharma.app/bg-remover",

        keywords:
          "AI Background Remover, Image Cutout, Browser AI, Free Background Removal",

        schema: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AI Background Remover",
          applicationCategory: "DesignApplication",
          operatingSystem: "Web",
          url: "https://ai.rahulsharma.app/bg-remover",
        },
      },
    },

    ...(
      [
        ["/tts-supertonic", "Supertonic Streaming TTS | Fast In-Browser Voice", "Streaming neural text-to-speech with Supertonic, running locally in your browser on WebGPU.", "Streaming Text-to-Speech, Supertonic, WebGPU TTS, Browser AI, ONNX", "MultimediaApplication"],
        ["/agate", "Agate | In-Browser AI Image Generation", "Agate generates images with a diffusion model running locally in your browser. No server, no uploads.", "Agate, AI Image Generation, Diffusion, WebGPU, Browser AI", "MultimediaApplication"],
        ["/microgpt", "microGPT | Train a GPT in Your Browser", "Train a tiny GPT from scratch and generate names, entirely in your browser tab. No server, no GPU.", "microGPT, Train GPT in browser, Transformer, JavaScript, Browser AI", "EducationalApplication"],
        ["/privacy", "Privacy | The AI Hub", "Everything on The AI Hub runs locally in your browser. Read how your data is handled.", "Privacy, Local AI, Browser AI", "WebPage"],
      ] as const
    ).map(([path, title, description, keywords, type]) => ({
      path,
      tags: {
        title,
        description,
        ogTitle: title,
        ogDescription: description,
        twitterCard: "summary_large_image",
        twitterTitle: title,
        twitterDescription: description,
        image: "https://ai.rahulsharma.app/assets/web-app-manifest-192x192.png",
        url: `https://ai.rahulsharma.app${path}`,
        keywords,
        schema: {
          "@context": "https://schema.org",
          "@type": type === "WebPage" ? "WebPage" : "SoftwareApplication",
          name: title,
          ...(type !== "WebPage" && { applicationCategory: type, operatingSystem: "Web" }),
          url: `https://ai.rahulsharma.app${path}`,
        },
      },
    })),
  ],
};

function normalizeTags(tags: { title: string; description: string; ogTitle?: string; ogDescription?: string; url: string; image: string; keywords: string; schema: Record<string, unknown> }) {
  return {
    title: tags.ogTitle ?? tags.title,
    description: tags.ogDescription ?? tags.description,
    url: tags.url,
    image: tags.image,
    keywords: tags.keywords,
    schema: tags.schema,
  };
}

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
      routes: seoConfig.routes.map((route) => ({
        ...route,
        tags:
          typeof route.tags === "string"
            ? route.tags
            : normalizeTags(route.tags),
      })),

      render: (route) => {
        return `<p>Pre-rendered content for ${route.path}</p>`;
      },
      headTags: "",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // dev: pre-bundling moves the ort loader away from its .wasm files, so the wasm URL returns index.html
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  worker: {
    format: "es", // ✅ modern module format (required)
    rollupOptions: {
      output: {
        manualChunks: undefined, // prevents code-splitting inside worker
      },
    },
  },
});

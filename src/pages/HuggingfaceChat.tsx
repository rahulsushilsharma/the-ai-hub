"use client";

import Footer from "@/components/Footer";
import { MarkdownView } from "@/components/MarkdownView";
import { GithubButton, NodeButton } from "@/components/RepoButtons";
import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

export default function HuggingfaceChat() {
  const [docs, setDocs] = useState<string>("");

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/rahulsushilsharma/huggingface-chat/refs/heads/main/README.md")
      .then((res) => res.text())
      .then(setDocs);
  }, []);

  return (
    <div className="pt-16 md:pt-24 min-h-screen relative overflow-x-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 blur-[80px] md:blur-3xl rounded-full" />
      </div>

      <div className="container max-w-2xl mx-auto px-4 pb-16">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-primary/20 mb-4">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            <span className="bg-gradient-to-br from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Hugging Face Chat
            </span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Interface for interacting with Hugging Face models via Transformers.js — fully in-browser.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {["Transformers.js", "Pre-trained Models", "Chat Interface", "Local"].map((f) => (
              <span
                key={f}
                className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full bg-muted/60 backdrop-blur border border-border/50"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Docs card */}
        <div className="group relative rounded-2xl border bg-background/60 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 hover:shadow-2xl hover:border-primary/40">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="relative">
            <h2 className="text-xl font-semibold mb-4">Documentation</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <GithubButton url="https://github.com/rahulsushilsharma/huggingface-chat" />
              <NodeButton url="https://www.npmjs.com/package/huggingface-chat" />
            </div>
            <MarkdownView docs={docs} />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

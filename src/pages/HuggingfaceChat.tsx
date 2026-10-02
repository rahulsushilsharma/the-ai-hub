"use client";

import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
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
      <PageGlow />

      <div className="container max-w-2xl mx-auto px-4 pb-16">
        <PageHeader icon={Bot} title="Hugging Face chat" blurb="Chat with Hugging Face models through Transformers.js, fully in-browser." tags={["Transformers.js", "Pre-trained models", "Chat interface", "Local"]} />

        {/* Docs card */}
        <div className="group relative rounded-xl border bg-card p-5 md:p-6 transition-all duration-300 hover:border-primary/40">
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

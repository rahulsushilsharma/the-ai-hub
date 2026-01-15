"use client";

import { MarkdownView } from "@/components/MarkdownView";
import { GithubButton, NodeButton } from "@/components/RepoButtons";
import { useEffect, useState } from "react";
export default function HuggingfaceChat() {
  const [docs, setDocs] = useState<string>("");

  useEffect(() => {
    const response = fetch(
      "https://raw.githubusercontent.com/rahulsushilsharma/huggingface-chat/refs/heads/main/README.md"
    );
    const text = response.then((res) => res.text());
    text.then((data) => {
      setDocs(data);
    });
  }, []);

  return (
    <main className="container max-w-2xl mx-auto py-10 px-4 pt-20">
      <div>
        <h2 className="text-xl font-semibold mt-10 mb-4">Documentation</h2>
        <div>
          <GithubButton url="https://github.com/rahulsushilsharma/huggingface-chat" />
        </div>
        <div>
          <NodeButton url="https://www.npmjs.com/package/huggingface-chat" />
        </div>
        <MarkdownView docs={docs} />
      </div>
    </main>
  );
}

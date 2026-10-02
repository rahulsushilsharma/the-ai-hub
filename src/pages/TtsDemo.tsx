"use client";

import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
import { MarkdownView } from "@/components/MarkdownView";
import { GithubButton, NodeButton } from "@/components/RepoButtons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, Mic, Rocket, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TtsWorker from "../workers/tts.ts?worker";

const statusConfig = {
  ready: { label: "Ready to load", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  loading: { label: "Loading model...", color: "text-secondary-foreground", dot: "bg-secondary animate-pulse" },
  streaming: { label: "Generating audio...", color: "text-secondary-foreground", dot: "bg-secondary animate-pulse" },
  done: { label: "Model loaded", color: "text-primary", dot: "bg-primary" },
};

export default function TtsDemo() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<"ready" | "loading" | "streaming" | "done">("ready");
  const [docs, setDocs] = useState<string>("");
  const worker = useRef<Worker | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/rahulsushilsharma/tts-pipelines/refs/heads/main/readme.md")
      .then((res) => res.text())
      .then(setDocs);

    if (!worker.current) worker.current = new TtsWorker();

    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.type) {
        case "error": console.error(e.data.message); break;
        case "stream": setLoading("streaming"); break;
        case "model:loaded": setLoading("done"); break;
        case "model:error": console.error(e.data.message); setLoading("ready"); break;
        case "done":
          setLoading("done");
          setAudioUrl(URL.createObjectURL(e.data.audio));
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);
    return () => worker.current?.removeEventListener("message", onMessageReceived);
  }, []);

  const loadModel = () => {
    worker.current?.postMessage({ type: "init" });
    setLoading("loading");
  };

  const generateAudio = () => {
    worker.current?.postMessage({ type: "clear" });
    worker.current?.postMessage({ type: "message", message: input });
  };

  const status = statusConfig[loading];

  return (
    <div className="pt-16 md:pt-24 min-h-screen relative overflow-x-hidden">
      <PageGlow />

      <div className="container max-w-2xl mx-auto px-4 pb-16">
        <PageHeader icon={Mic} title="Text to speech" blurb="Browser-based TTS via ONNX Runtime and WebGPU. No server, no latency." tags={["Real-time synthesis", "WebGPU", "ONNX Runtime", "Local"]} />

        {/* Main card */}
        <div className="group relative rounded-xl border bg-card p-5 md:p-6 transition-all duration-300 hover:border-primary/40 mb-6">

          <div className="relative space-y-5">
            {/* Status */}
            <div role="status" className="flex items-center justify-center gap-2">
              <span aria-hidden="true" className={`w-2 h-2 rounded-full ${status.dot}`} />
              <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
            </div>

            {/* Load model */}
            <div className="flex justify-center">
              <Button
                onClick={loadModel}
                disabled={loading === "loading" || loading === "streaming"}
                className="flex items-center gap-2"
              >
                {loading === "loading" ? (
                  <><Loader2 className="animate-spin w-4 h-4" /> Loading...</>
                ) : (
                  <><Rocket className="w-4 h-4" /> {loading === "ready" ? "Load model" : "Reload model"}</>
                )}
              </Button>
            </div>

            {/* Text input */}
            <div className="space-y-2">
              <label htmlFor="tts-input" className="text-sm font-medium text-foreground">Your text</label>
              <Textarea
                id="tts-input"
                placeholder="Type something you'd like to hear..."
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading !== "done"}
                className="border-border/50 bg-muted/30 resize-none"
              />
              <Button
                className="w-full flex items-center justify-center gap-2"
                onClick={generateAudio}
                disabled={loading !== "done" || !input.trim()}
              >
                <Volume2 className="w-4 h-4" /> Generate speech
              </Button>
            </div>

            {/* Audio player */}
            {audioUrl && (
              <div className="border-t border-border/50 pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5 text-primary">
                  <CheckCircle className="w-4 h-4" /> Preview
                </h4>
                <audio controls src={audioUrl} className="w-full rounded-lg" />
              </div>
            )}
          </div>
        </div>

        {/* Docs card */}
        <div className="group relative rounded-xl border bg-card p-5 md:p-6 transition-all duration-300 hover:border-primary/20">
          <div className="relative">
            <h2 className="text-xl font-semibold mb-4">Documentation</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <GithubButton url="https://github.com/rahulsushilsharma/tts-pipelines" />
              <NodeButton url="https://www.npmjs.com/package/tts-pipelines" />
            </div>
            <MarkdownView docs={docs} />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

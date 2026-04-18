"use client";

import Footer from "@/components/Footer";
import { MarkdownView } from "@/components/MarkdownView";
import { GithubButton, NodeButton } from "@/components/RepoButtons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, Mic, Rocket, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TtsWorker from "../workers/tts.ts?worker";

const statusConfig = {
  ready: { label: "Ready to load", color: "text-green-400", dot: "bg-green-400" },
  loading: { label: "Loading model...", color: "text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
  streaming: { label: "Generating audio...", color: "text-blue-400", dot: "bg-blue-400 animate-pulse" },
  done: { label: "Model loaded", color: "text-emerald-400", dot: "bg-emerald-400" },
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
      {/* Ambient glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 blur-[80px] md:blur-3xl rounded-full" />
      </div>

      <div className="container max-w-2xl mx-auto px-4 pb-16">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-primary/20 mb-4">
            <Mic className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            <span className="bg-gradient-to-br from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Text to Speech
            </span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Browser-based TTS via ONNX Runtime and WebGPU. No server, no latency.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {["Real-time Synthesis", "WebGPU", "ONNX Runtime", "Local"].map((f) => (
              <span
                key={f}
                className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full bg-muted/60 backdrop-blur border border-border/50"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Main card */}
        <div className="group relative rounded-2xl border bg-background/60 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 hover:shadow-2xl hover:border-primary/40 mb-6">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          <div className="relative space-y-5">
            {/* Status */}
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
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
                  <><Rocket className="w-4 h-4" /> {loading === "ready" ? "Load Model" : "Reload Model"}</>
                )}
              </Button>
            </div>

            {/* Text input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Your text</label>
              <Textarea
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
                <Volume2 className="w-4 h-4" /> Generate Speech
              </Button>
            </div>

            {/* Audio player */}
            {audioUrl && (
              <div className="border-t border-border/50 pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Preview
                </h4>
                <audio controls src={audioUrl} className="w-full rounded-lg" />
              </div>
            )}
          </div>
        </div>

        {/* Docs card */}
        <div className="group relative rounded-2xl border bg-background/60 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 hover:border-primary/20">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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

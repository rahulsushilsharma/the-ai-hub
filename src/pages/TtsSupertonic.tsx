"use client";

import Footer from "@/components/Footer";
import ModelLoading from "@/components/ModelLoading";
import PageHeader, { PageGlow } from "@/components/PageHeader";
import SettingsPanel, { type Field } from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useStoredSettings } from "@/hooks/use-stored-settings";
import { useStreamingAudio } from "@/hooks/use-streaming-audio";
import { hasWebGPU, loadEmbedding, loadPipeline, streamTTS, toWav, VOICES, type Voice } from "@/lib/supertonic";
import type { ProgressInfo } from "@huggingface/transformers";
import { Check, Download, Loader2, Pause, Play, Square, Volume2, X, Zap } from "lucide-react";
import { useRef, useState } from "react";

const DEFAULTS = { voice: "Female", quality: 5, speed: 1 };
const MIN_CHARS = 10;

const EXAMPLES: Record<string, string | string[]> = {
  Quote: '"It is not death that a man should fear, but he should fear never beginning to live."',
  Paragraph:
    "The concept of artificial intelligence has captivated human imagination for decades. From early science fiction to modern practical applications, AI has evolved from a dream into a tangible reality that shapes our daily lives.",
  Random: [
    "The startup secured $5.2M in venture capital, a huge leap from their initial $450K seed round.",
    "The train delay was announced at 4:45 PM on Wed, Apr 3, 2024 due to track maintenance.",
    "You can reach the hotel front desk at (212) 555-0142 ext. 402 anytime.",
    "Our drone battery lasts 2.3h when flying at 30kph with full camera payload.",
    "The recipe calls for 250g of flour, 150ml of milk, and 2 large eggs.",
    "Her favorite painting is Starry Night by Vincent van Gogh, created in 1889.",
    "The symphony orchestra will perform Beethoven's 9th Symphony this Saturday at 7 PM.",
  ],
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

export default function TtsSupertonic() {
  const [cfg, setCfg, resetCfg] = useStoredSettings("tts-supertonic-settings", DEFAULTS);
  const [text, setText] = useState("Introducing Supertonic: blazingly fast text-to-speech running 100% locally in your browser.");
  const [tab, setTab] = useState("Freeform");
  const [phase, setPhase] = useState<"idle" | "loading" | "generating">("idle");
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [genPct, setGenPct] = useState(0);
  const [stats, setStats] = useState<{ first: number | null; chars: number; rtf: number } | null>(null);
  const [error, setError] = useState("");
  const stopRef = useRef(false);
  const audio = useStreamingAudio();

  const busy = phase !== "idle";
  const canGenerate = text.length >= MIN_CHARS && !busy;

  const generate = async () => {
    setError("");
    stopRef.current = false;
    setStats(null);
    setGenPct(0);
    try {
      setPhase("loading");
      const [tts, emb] = await Promise.all([loadPipeline(setProgress), loadEmbedding(cfg.voice as Voice)]);
      setPhase("generating");
      await audio.start();
      const t0 = performance.now();
      let first: number | null = null;
      let chars = 0;
      let seconds = 0;
      for await (const r of streamTTS(text, tts, emb, cfg.quality, cfg.speed)) {
        if (stopRef.current) break;
        const elapsed = (performance.now() - t0) / 1000;
        first ??= elapsed;
        audio.push(r.audio, r.sampleRate);
        chars += r.chars;
        seconds += r.audio.length / r.sampleRate;
        setGenPct((r.index / r.total) * 100);
        setStats({ first, chars: chars / elapsed, rtf: elapsed / seconds });
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      audio.finish();
      setPhase("idle");
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(toWav(audio.chunks.current, audio.sampleRate.current));
    a.download = "speech.wav";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pickExample = (k: string) => {
    setTab(k);
    const v = EXAMPLES[k];
    setText(Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);
  };

  const fields: Field[] = [
    { key: "voice", type: "select", label: "Voice", options: Object.keys(VOICES).map((v) => ({ value: v, label: v })) },
    { key: "quality", type: "slider", label: "Quality", min: 1, max: 50, step: 1, hint: "Inference steps. Higher is cleaner but slower." },
    { key: "speed", type: "slider", label: "Speed", min: 0.8, max: 1.2, step: 0.01 },
  ];

  const hasAudio = audio.total > 0;

  return (
    <div className="pt-16 md:pt-24 min-h-screen relative overflow-x-hidden">
      <PageGlow />
      <div className="container max-w-5xl mx-auto px-4 pb-16">
        <PageHeader icon={Zap} title="Supertonic TTS" blurb="Fast, streaming speech generated 100% in your browser on WebGPU." tags={["Streaming", "WebGPU", "Transformers.js", "Local"]} />

        {!hasWebGPU() && (
          <p role="alert" className="mb-6 rounded-xl border border-destructive/40 bg-card p-4 text-sm">
            This model needs WebGPU, which your browser doesn't expose. Try a recent Chrome or Edge.
          </p>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid md:grid-cols-2 md:divide-x">
            {/* Text */}
            <div className="p-5 md:p-6 flex flex-col gap-3 min-h-[360px]">
              <label htmlFor="st-text" className="text-sm font-semibold">Text</label>
              <Textarea
                id="st-text"
                value={text}
                onChange={(e) => (setText(e.target.value), setTab("Freeform"))}
                spellCheck={false}
                placeholder="Type something you'd like to hear..."
                className="flex-1 resize-none border-border/50 bg-muted/30 text-base leading-relaxed"
              />
              <div className="flex items-center justify-end gap-1.5 font-mono text-xs text-muted-foreground">
                {text.length} chars
                {text.length >= MIN_CHARS ? <Check className="w-3.5 h-3.5 text-primary" aria-label="long enough" /> : <X className="w-3.5 h-3.5 text-destructive" aria-label={`needs at least ${MIN_CHARS} characters`} />}
              </div>
              <div className="flex gap-4 overflow-x-auto border-t pt-3 text-sm" role="group" aria-label="Examples">
                {["Freeform", ...Object.keys(EXAMPLES)].map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={tab === k}
                    onClick={() => (k === "Freeform" ? setTab(k) : pickExample(k))}
                    className={`whitespace-nowrap min-h-9 border-b-2 transition-colors ${tab === k ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Speech */}
            <div className="p-5 md:p-6 flex flex-col gap-5 border-t md:border-t-0">
              <SettingsPanel title="Speech" fields={fields} values={cfg} onChange={setCfg} onReset={resetCfg} disabled={busy} />
              <div className="space-y-2">
                {phase === "generating" ? (
                  <Button variant="outline" className="w-full gap-2" onClick={() => (stopRef.current = true)}>
                    <Square className="w-4 h-4" /> Stop
                  </Button>
                ) : (
                  <Button className="w-full gap-2" onClick={generate} disabled={!canGenerate || !hasWebGPU()}>
                    {phase === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading model...</> : <><Volume2 className="w-4 h-4" /> Generate speech</>}
                  </Button>
                )}
                {phase === "generating" && <Progress value={genPct} className="h-1.5" aria-label="Generation progress" />}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </div>
            </div>
          </div>

          {/* Result */}
          {hasAudio && (
            <div className="border-t p-4 md:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Button size="icon" variant="outline" onClick={audio.toggle} aria-label={audio.playing ? "Pause" : "Play"}>
                  {audio.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  aria-label="Seek"
                  className="flex-1 accent-primary"
                  value={audio.total ? (audio.current / audio.total) * 1000 : 0}
                  onChange={(e) => audio.seek(Number(e.target.value) / 1000)}
                />
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmt(audio.current)} / {fmt(audio.total)}</span>
                <Button size="icon" variant="outline" onClick={download} disabled={phase === "generating"} aria-label="Download WAV">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              {stats && (
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ["First audio", stats.first ? `${stats.first.toFixed(2)}s` : "-"],
                    ["Chars/sec", stats.chars.toFixed(1)],
                    ["Real-time factor", stats.rtf.toFixed(3)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-muted/30 py-2">
                      <dd className="font-mono text-sm tabular-nums">{v}</dd>
                      <dt className="text-muted-foreground">{k}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
      <ModelLoading progress={progress} open={phase === "loading" && !!progress} onOpenChange={() => {}} />
      <Footer />
    </div>
  );
}

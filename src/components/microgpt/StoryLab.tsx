import { ArchMap, FlowMap } from "@/components/microgpt/StoryViz";
import { BOS } from "@/components/microgpt/viz";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { StoryMeta } from "@/lib/microgpt/story";
import { cn } from "@/lib/utils";
import type { Entry, Inspect } from "@/workers/story";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const BASE = "/microgpt/tinystories";
const show = (t: string) => t.replace(/\n/g, "⏎").replace(/ /g, "␣");
const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

function Card({ title, lead, children, className }: { title: string; lead?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border bg-card p-4", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {lead && <p className="mt-1 text-xs text-muted-foreground">{lead}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Bar({ label, p, hue = "--primary" }: { label: string; p: number; hue?: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="w-24 shrink-0 truncate text-right">{show(label)}</span>
      <span className="relative h-3.5 flex-1 rounded-sm bg-muted/50">
        <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${p * 100}%`, background: `var(${hue})` }} />
      </span>
      <span className="w-12 text-right text-muted-foreground">{pct(p)}</span>
    </div>
  );
}

export default function StoryLab() {
  const worker = useRef<Worker | null>(null);
  const runId = useRef(0);
  const [meta, setMeta] = useState<StoryMeta | null>(null);
  const [stories, setStories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [tokText, setTokText] = useState("Once upon a time, a happy dragon ate spaghetti.");
  const [pieces, setPieces] = useState<{ id: number; text: string }[]>([]);
  const [prompt, setPrompt] = useState("Once upon a time");
  const [temp, setTemp] = useState(0.8);
  const [untrained, setUntrained] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState(-1); // -1 = average of all heads
  const [insp, setInsp] = useState<Inspect | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../../workers/story.ts", import.meta.url), { type: "module" });
    w.onmessage = ({ data: { type, payload } }) => {
      if (type === "ready") { setMeta(payload.meta); setStories(payload.stories); }
      else if (type === "error") setError(payload);
      else if (type === "tokens") setPieces(payload);
      else if (type === "entry" && payload.run === runId.current) setEntries((e) => [...e, payload.entry]);
      else if (type === "done" && payload.run === runId.current) setRunning(false);
      else if (type === "inspect") setInsp(payload);
    };
    w.postMessage({ type: "load", payload: { base: BASE } });
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (!meta) return;
    const id = setTimeout(() => worker.current?.postMessage({ type: "tokenize", payload: { text: tokText } }), 150);
    return () => clearTimeout(id);
  }, [tokText, meta]);

  const generate = () => {
    const run = ++runId.current; // entries still in flight from an older run are ignored
    worker.current?.postMessage({ type: "generate", payload: { run, prompt, temp, topK: 40, max: 160, untrained } });
    setEntries([]); setSel(null); setRunning(true);
  };
  const pick = (i: number) => { setSel(i); worker.current?.postMessage({ type: "inspect", payload: { index: i } }); };
  const stop = () => { worker.current?.postMessage({ type: "stop" }); runId.current++; setRunning(false); };

  if (error)
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        The story model could not load ({error}). Its files are made by <code>scripts/tinystories/convert.py</code>.
      </p>
    );
  if (!meta)
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Downloading the model…</p>;

  const c = meta.config;
  const e = sel != null ? entries[sel] : null;
  const d = insp && insp.index === sel ? insp : null; // details arrive a moment after the click
  // position 0 is the start token, position j is entries[j - 1]
  const ctxTokens = e ? [BOS, ...entries.slice(0, sel!).map((x) => x.text)] : [];
  const weights = d
    ? (head >= 0 ? Array.from(d.attn[layer][head]) : Array.from(d.attn[layer][0], (_, j) => d.attn[layer].reduce((s, h) => s + h[j], 0) / c.n_head))
    : [];
  const wMax = Math.max(1e-6, ...weights);

  return (
    <div className="space-y-10">
      <div className="rounded-lg border bg-card p-5 text-sm leading-relaxed">
        <p>
          A real, pretrained language model from Microsoft Research: the same design as GPT-2, about {Math.round(124e6 / meta.params)} times smaller
          than the smallest GPT-2. {meta.params.toLocaleString()} numbers in {c.n_layer} layers, trained on {meta.source.stories.toLocaleString()} short children’s stories to continue them one token at a time.
        </p>
        <p className="mt-3 text-muted-foreground">
          Its published weights are running in this tab, in plain JavaScript you can read. Nothing is faked: every number below comes from the model as it runs.
        </p>
      </div>

      {/* 1 DATA */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">1. What it read</h2>
        <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
          {meta.source.stories.toLocaleString()} stories from the{" "}
          <a className="underline" href="https://arxiv.org/abs/2305.07759">TinyStories</a> dataset: stories written to use only words a 3–4 year old knows.
          That narrow world is why a model this small can write real sentences.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="A story like the ones it read" lead={`From the same dataset’s held-out set, so the model never saw this one. ${stories.length} of them here.`}>
            <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{stories[storyIdx % stories.length]}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setStoryIdx((i) => i + 1 + Math.floor(Math.random() * 20))}>Another story</Button>
          </Card>
          <Card title="Text becomes tokens" lead={`It doesn’t read letters. GPT-2’s tokenizer splits text into ${c.vocab.toLocaleString()} common pieces. Type anything:`}>
            <Textarea rows={2} value={tokText} onChange={(ev) => setTokText(ev.target.value)} className="font-mono text-sm" aria-label="Text to tokenize" />
            <div className="mt-3 flex flex-wrap gap-1">
              {pieces.map((t, i) => (
                <span key={i} className={cn("rounded border px-1 font-mono text-xs", i % 2 ? "bg-muted/60" : "bg-primary/10")}>
                  {show(t.text)}<sub className="ml-0.5 text-muted-foreground">{t.id}</sub>
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{tokText.length} characters → {pieces.length} tokens. Common words are one token; rare ones get split.</p>
          </Card>
        </div>
      </section>

      {/* 2 ARCHITECTURE */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">2. How it’s built</h2>
        <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
          The real layout of this model, with the real sizes. Every prediction runs once through this whole stack, top to bottom.
        </p>
        <ArchMap meta={meta} />
      </section>

      {/* 3 GENERATE */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">3. Write with it</h2>
        <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
          Give it a beginning. It scores all {c.vocab.toLocaleString()} tokens, picks one, adds it to the text, and repeats.
          Darker tokens surprised it more. Click any token to see what the model was thinking right before it.
        </p>
        <div className="grid gap-4 rounded-md border bg-card p-4 md:grid-cols-[1fr_14rem]">
          <div className="space-y-2">
            <Label htmlFor="story-prompt">Beginning</Label>
            <Textarea id="story-prompt" rows={2} value={prompt} onChange={(ev) => setPrompt(ev.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {meta.prompts.map((p) => <Button key={p} size="sm" variant="ghost" onClick={() => setPrompt(p)}>{p}…</Button>)}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex justify-between"><span>Temperature</span><span className="font-mono">{temp.toFixed(1)}</span></Label>
              <Slider min={0.1} max={1.5} step={0.1} value={[temp]} onValueChange={([v]) => setTemp(v)} />
              <p className="text-xs text-muted-foreground">Low: safe, repetitive. High: surprising, then nonsense.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={untrained} onChange={(ev) => setUntrained(ev.target.checked)} />
              Untrained (random numbers)
            </label>
            <div className="flex gap-2">
              <Button onClick={generate} disabled={!prompt.trim()}>{running && <Loader2 className="animate-spin" />}Generate</Button>
              <Button variant="outline" onClick={stop} disabled={!running}>Stop</Button>
            </div>
          </div>
        </div>
        {entries.length > 0 && (
          <div className="rounded-md border bg-card p-4 text-base leading-loose whitespace-pre-wrap">
            {entries.map((x, i) => (
              <button key={i} type="button" onClick={() => pick(i)} title={`${pct(x.p)} likely`}
                className={cn("rounded-sm transition-colors hover:outline hover:outline-1 hover:outline-primary", x.prompt && "underline decoration-dotted underline-offset-4", sel === i && "outline outline-2 outline-primary")}
                style={{ background: `color-mix(in oklab, var(--mg-out) ${Math.round(Math.min(1, -Math.log(Math.max(x.p, 1e-6)) / 8) * 70)}%, transparent)` }}>
                {x.text}
              </button>
            ))}
            {running && <Loader2 className="ml-1 inline size-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </section>

      {/* 4 INSIDE */}
      {e && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">4. Inside one prediction</h2>
          <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
            The moment just before “<b className="text-foreground">{show(e.text)}</b>” {e.prompt ? "(from your beginning)" : "was written"}. The model gave it {pct(e.p)}.
          </p>
          <Card title="What it considered" lead="Its 10 most likely next tokens, out of all of them.">
            <div className="max-w-xl space-y-1">{e.top.map((t, i) => <Bar key={i} label={t.text} p={t.p} hue={t.text === e.text ? "--mg-out" : "--primary"} />)}</div>
          </Card>
          <Card title="How the numbers flowed" lead={`The ${c.n_embd} numbers for “${show(ctxTokens.at(-1) ?? "")}”, block by block, on their way to this prediction.`}>
            {d ? <FlowMap d={d} token={ctxTokens.at(-1) ?? ""} layer={layer} setLayer={setLayer} /> : <p className="text-xs text-muted-foreground">Working…</p>}
          </Card>
          <Card title="Where it looked" lead={`Attention in block ${layer + 1}: how much each earlier token was used. Each block has ${c.n_head} heads, and each learns to look for something different.`}>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <div className="flex items-center gap-1" role="group" aria-label="Block">
                <span className="text-muted-foreground">Block</span>
                {Array.from({ length: c.n_layer }, (_, l) => <Button key={l} size="sm" variant={layer === l ? "default" : "outline"} className="h-7 px-2" onClick={() => setLayer(l)}>{l + 1}</Button>)}
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Head">
                <span className="text-muted-foreground">Head</span>
                <Button size="sm" variant={head < 0 ? "default" : "outline"} className="h-7 px-2" onClick={() => setHead(-1)}>all</Button>
                {Array.from({ length: c.n_head }, (_, h) => <Button key={h} size="sm" variant={head === h ? "default" : "outline"} className="h-7 px-2" onClick={() => setHead(h)}>{h + 1}</Button>)}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-0.5 font-mono text-sm leading-relaxed">
              {ctxTokens.map((t, j) => (
                <span key={j} title={pct(weights[j] ?? 0)} className="rounded-sm px-0.5"
                  style={{ background: `color-mix(in oklab, var(--mg-attn) ${Math.round(((weights[j] ?? 0) / wMax) * 85)}%, transparent)` }}>
                  {show(t)}
                </span>
              ))}
            </div>
          </Card>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        <a className="underline" href={meta.source.url}>{meta.source.repo}</a> ({meta.source.arch}, from the <a className="underline" href={meta.source.paper}>TinyStories paper</a>):{" "}
        {meta.params.toLocaleString()} parameters · {c.n_layer} layers · {c.n_head} heads · {c.n_embd} dims · context {c.ctx} tokens · vocabulary {c.vocab.toLocaleString()}.
        Converted by <code>scripts/tinystories/convert.py</code>; <code>scripts/check-story.ts</code> checks that this page computes the same numbers as the original.
      </p>
    </div>
  );
}

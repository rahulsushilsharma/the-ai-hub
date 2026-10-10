import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
import {
  ArchDiagram, BOS, Heatmap, LossChart, ProbBars, Scatter,
  type ArchCfg, type Point, type RunLine,
} from "@/components/microgpt/viz";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { pca2 } from "@/lib/microgpt/pca";
import { cn } from "@/lib/utils";
import { Brain, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- constants ---------- */

const ANIMALS = "cat dog fox owl bat rat hen cow pig ant bee yak emu elk ape eel cod ram gnu lion bear wolf deer duck frog toad newt crab seal mole mule goat lamb hawk crow dove swan kiwi lynx puma orca tuna carp bass tiger zebra horse mouse sheep camel koala panda otter bison llama eagle raven finch moose cobra gecko shark whale squid snail".split(" ").join("\n");

const DATASETS = {
  names: { label: "Baby names", note: "32,000 first names. The classic.", url: "/microgpt/names.txt" },
  animals: { label: "Animals", note: "Only 70 words. Watch it memorise.", text: ANIMALS },
  custom: { label: "Your own", note: "One example per line.", text: "" },
} as const;
type DataKey = keyof typeof DATASETS;

const PRESETS: { label: string; hint: string; arch: ArchCfg; lr: number }[] = [
  { label: "Default", hint: "16 dims, 4 heads, 1 layer", arch: { nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 16 }, lr: 0.01 },
  { label: "Tiny brain", hint: "4 dims, 1 head", arch: { nEmbd: 4, nHead: 1, nLayer: 1, blockSize: 16 }, lr: 0.01 },
  { label: "Wide", hint: "32 dims", arch: { nEmbd: 32, nHead: 4, nLayer: 1, blockSize: 16 }, lr: 0.01 },
  { label: "Deep", hint: "3 layers", arch: { nEmbd: 16, nHead: 4, nLayer: 3, blockSize: 16 }, lr: 0.01 },
  { label: "Short memory", hint: "context of 3", arch: { nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 4 }, lr: 0.01 },
  { label: "LR too high", hint: "learning rate 0.1", arch: { nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 16 }, lr: 0.1 },
];

const RUN_COLORS = ["#e07a5f", "#3d9970", "#b36bd1", "#d4a017", "#2a9bb5", "#c0577d"];

type Checkpoint = { step: number; samples: string[] };
type Last = { step: number; loss: number; lr: number; doc: string; tokens: number[]; posLosses: number[] };
type Run = { id: string; label: string; params: number; points: Point[]; finalLoss: number; samples: string[]; color: string; data: string };
type Row = { logits: number[]; attention: number[][][] };

const divisors = (n: number) => [1, 2, 4, 8].filter((h) => n % h === 0);
const softmax = (logits: number[], t: number) => {
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp((l - m) / t));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};
const pick = (probs: number[]) => {
  let r = Math.random();
  for (let i = 0; i < probs.length; i++) if ((r -= probs[i]) <= 0) return i;
  return probs.length - 1;
};

/* ---------- small UI pieces ---------- */

function Section({ n, title, lead, children }: { n: number; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-8" aria-labelledby={`s${n}`}>
      <div>
        <p className="font-mono text-xs text-primary">STEP {n}</p>
        <h2 id={`s${n}`} className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "muted" | "primary" }) {
  return (
    <span className={cn("inline-flex min-w-7 items-center justify-center rounded border px-1.5 py-0.5 font-mono text-sm",
      tone === "primary" && "border-primary/40 bg-primary/10", tone === "muted" && "bg-muted/50 text-muted-foreground")}>
      {children}
    </span>
  );
}

function Stepper({ label, value, set, min, max, step = 1, disabled, hint }: {
  label: string; value: number; set: (v: number) => void; min: number; max: number; step?: number; disabled?: boolean; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex justify-between"><span>{label}</span><span className="font-mono text-primary">{value}</span></Label>
      <Slider min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={([v]) => set(v)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ---------- page ---------- */

export default function Microgpt() {
  const worker = useRef<Worker | null>(null);
  const namesCache = useRef<string>("");
  const inspectId = useRef(0);

  // configuration
  const [dataKey, setDataKey] = useState<DataKey>("names");
  const [custom, setCustom] = useState("alice\nbob\ncharlie\ndiana\nedward\nfiona");
  const [text, setText] = useState("");
  const [arch, setArch] = useState<ArchCfg>(PRESETS[0].arch);
  const [lr, setLr] = useState(0.01);
  const [steps, setSteps] = useState(500);
  const [sel, setSel] = useState<"tok" | "pos" | "norm" | "attn" | "mlp" | "head">("attn");

  // model + run state
  const [chars, setChars] = useState<string[]>([]);
  const [numParams, setNumParams] = useState(0);
  const [ready, setReady] = useState(false);
  const [training, setTraining] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [last, setLast] = useState<Last | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [embeds, setEmbeds] = useState<{ char: string; embedding: number[] }[]>([]);

  // inference
  const [prefix, setPrefix] = useState("");
  const [temp, setTemp] = useState(0.8);
  const [rows, setRows] = useState<Row[]>([]);
  const [layer, setLayer] = useState(0);
  const [batch, setBatch] = useState<string[]>([]);
  const [exampleIdx, setExampleIdx] = useState(0);

  const docs = useMemo(() => text.split("\n").map((l) => l.trim()).filter(Boolean), [text]);
  const vocab = useMemo(() => [...new Set(docs.join(""))].sort(), [docs]);
  const V = vocab.length + 1;
  const baseline = Math.log(V);
  const labels = useMemo(() => [...chars, BOS], [chars]);
  const stale = ready && chars.join("") !== vocab.join("");

  // keep latest values readable inside the worker callback
  const live = useRef({ points, numParams, arch, dataKey });
  live.current = { points, numParams, arch, dataKey };

  /* load dataset text */
  useEffect(() => {
    let off = false;
    const d = DATASETS[dataKey];
    if (dataKey === "custom") return setText(custom), undefined;
    if ("text" in d) return setText(d.text), undefined;
    if (namesCache.current) return setText(namesCache.current), undefined;
    fetch(d.url).then((r) => r.text()).then((t) => { namesCache.current = t; if (!off) setText(t); });
    return () => { off = true; };
  }, [dataKey, custom]);

  /* worker */
  useEffect(() => {
    const w = new Worker(new URL("../workers/microgpt.ts", import.meta.url), { type: "module" });
    w.onmessage = ({ data: { type, payload } }) => {
      if (type === "ready") {
        setChars(payload.chars); setNumParams(payload.numParams); setReady(true);
        w.postMessage({ type: "embeddings" });
      } else if (type === "steps") {
        setPoints((p) => [...p, ...payload.batch]);
        if (payload.last) setLast(payload.last);
      } else if (type === "checkpoint") {
        setCheckpoints((c) => [...c, payload]);
        w.postMessage({ type: "embeddings" });
      } else if (type === "done") setTraining(false);
      else if (type === "inspect") { if (payload.id === inspectId.current) setRows(payload.rows); }
      else if (type === "embeddings") setEmbeds(payload);
      else if (type === "samples") setBatch(payload);
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  /* (re)build the model whenever data or architecture changes; the previous run is kept for comparison */
  useEffect(() => {
    if (docs.length < 3) return;
    const id = setTimeout(() => {
      const { points: pts, numParams: np, arch: a, dataKey: dk } = live.current;
      if (pts.length > 0) {
        const tail = pts.slice(-20);
        setRuns((rs) => [
          ...rs,
          {
            id: `r${Date.now()}`,
            label: `${a.nEmbd}d · ${a.nHead}h · ${a.nLayer}L · ctx ${a.blockSize}`,
            params: np,
            points: pts,
            finalLoss: tail.reduce((s, p) => s + p.loss, 0) / tail.length,
            samples: [],
            color: RUN_COLORS[rs.length % RUN_COLORS.length],
            data: DATASETS[dk].label,
          },
        ]);
      }
      setPoints([]); setLast(null); setCheckpoints([]); setBatch([]); setTraining(false); setReady(false);
      worker.current?.postMessage({ type: "init", payload: { text, options: { ...arch, learningRate: lr, numSteps: steps } } });
    }, 350);
    return () => clearTimeout(id);
    // learning rate / steps are applied at train time, not build time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, arch]);

  /* ask the model what it predicts for the current prefix */
  const prefixIds = useMemo(
    () => [chars.length, ...[...prefix].map((c) => chars.indexOf(c)).filter((i) => i >= 0)].slice(0, arch.blockSize),
    [prefix, chars, arch.blockSize],
  );
  const lastCheckpoint = checkpoints.length ? checkpoints[checkpoints.length - 1].step : -1;
  useEffect(() => {
    if (!ready) return;
    inspectId.current++;
    worker.current?.postMessage({ type: "inspect", payload: { id: inspectId.current, tokens: prefixIds } });
  }, [ready, prefixIds, lastCheckpoint, training]);

  const probs = useMemo(() => (rows.length ? softmax(rows[rows.length - 1].logits, temp) : []), [rows, temp]);
  const tokenLabels = prefixIds.map((i) => labels[i] ?? "?");
  const lastRow = rows[rows.length - 1];
  const heads = lastRow?.attention[0]?.length ?? 0;
  const layerIdx = Math.min(layer, arch.nLayer - 1);

  const pts2d = useMemo(() => {
    if (embeds.length < 3) return [];
    const xy = pca2(embeds.map((e) => e.embedding));
    return embeds.map((e, i) => ({ x: xy[i][0], y: xy[i][1], label: e.char === "<BOS>" ? BOS : e.char, hot: "aeiouy".includes(e.char) }));
  }, [embeds]);

  const train = () => {
    setTraining(true);
    worker.current?.postMessage({ type: "train", payload: { steps, lr, checkpointEvery: Math.max(10, Math.round(steps / 5)) } });
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => { setArch(p.arch); setLr(p.lr); };
  const setArchField = (k: keyof ArchCfg, v: number) =>
    setArch((a) => {
      const next = { ...a, [k]: v };
      if (next.nEmbd % next.nHead !== 0) next.nHead = Math.max(...divisors(next.nEmbd).filter((h) => h <= a.nHead));
      return next;
    });

  const example = docs[exampleIdx % Math.max(1, docs.length)] ?? "";
  const exTokens = [BOS, ...example, BOS];
  const trainedSteps = points.length ? points[points.length - 1].step : 0;
  const curLabel = `${arch.nEmbd}d · ${arch.nHead}h · ${arch.nLayer}L · ctx ${arch.blockSize}`;
  const lines: RunLine[] = [
    ...runs.map((r) => ({ id: r.id, label: r.label, color: r.color, points: r.points })),
    { id: "live", label: `${curLabel} (current)`, color: "var(--primary)", points, live: true },
  ];
  const lossNow = last?.loss;

  return (
    <div className="relative min-h-screen overflow-x-hidden pt-16 md:pt-24">
      <PageGlow />
      <div className="container mx-auto max-w-4xl space-y-10 px-4">
        <PageHeader
          icon={Brain}
          title="Build a GPT"
          blurb="A hands-on lab: see how a language model is built, trained and used, then change it and watch what happens."
          tags={["Learn", "Pure JS", "No GPU", "Runs in your tab"]}
        />

        <div className="rounded-lg border bg-card p-5 text-sm leading-relaxed">
          <p>
            <b>What is this?</b> A GPT is a <b>next-character predictor</b>. Show it <Chip>e</Chip><Chip>m</Chip><Chip>m</Chip> and
            it should say <Chip tone="primary">a</Chip>. ChatGPT works the same way, just with billions of parameters and word
            pieces instead of letters. Here you build a miniature one, about 4,000 parameters, that learns to invent names.
          </p>
          <ol className="mt-3 grid gap-2 font-mono text-xs text-muted-foreground sm:grid-cols-5">
            {["Data", "Architecture", "Train", "Use it", "Compare"].map((s, i) => (
              <li key={s}><span className="text-primary">{i + 1}</span> {s}</li>
            ))}
          </ol>
          <p className="mt-3 text-muted-foreground">
            Everything runs on your CPU in this tab. Each multiplication is tracked by a hand-written autograd engine,
            so nothing is hidden inside a library.
          </p>
        </div>

        {/* 1 DATA */}
        <Section n={1} title="Data: what it learns from" lead="A model only knows what it is shown. It reads examples one at a time and learns which character tends to follow which.">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(DATASETS) as DataKey[]).map((k) => (
              <button key={k} type="button" disabled={training} onClick={() => setDataKey(k)} aria-pressed={dataKey === k}
                className={cn("rounded-md border p-3 text-left transition-colors disabled:opacity-50", dataKey === k ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40")}>
                <span className="block font-medium">{DATASETS[k].label}</span>
                <span className="text-xs text-muted-foreground">{DATASETS[k].note}</span>
              </button>
            ))}
          </div>
          {dataKey === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="custom">Training text, one example per line (at least 3)</Label>
              <Textarea id="custom" rows={6} value={custom} disabled={training} onChange={(e) => setCustom(e.target.value)} className="font-mono" />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border bg-card p-4">
              <h3 className="text-sm font-semibold">Tokenizer: text → numbers</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Models work on numbers. Each distinct character gets an id; ⏎ marks the start and end of an example.
                {" "}{docs.length.toLocaleString()} examples, {V} tokens in the vocabulary.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {vocab.slice(0, 60).map((c, i) => (
                  <span key={c} className="rounded border px-1 font-mono text-xs"><span>{c === " " ? "␣" : c}</span><sub className="text-muted-foreground">{i}</sub></span>
                ))}
                <span className="rounded border border-primary/40 px-1 font-mono text-xs">{BOS}<sub className="text-muted-foreground">{vocab.length}</sub></span>
              </div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">One example becomes many lessons</h3>
                <Button size="sm" variant="ghost" onClick={() => setExampleIdx((i) => i + 1)}>Another</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">At every position, the model sees everything so far and must guess the next token.</p>
              <ul className="mt-3 space-y-1 font-mono text-sm">
                {exTokens.slice(0, -1).slice(0, 8).map((_, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="flex gap-0.5">{exTokens.slice(0, i + 1).map((t, j) => <Chip key={j} tone="muted">{t}</Chip>)}</span>
                    <span className="text-muted-foreground">→</span>
                    <Chip tone="primary">{exTokens[i + 1]}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 2 ARCHITECTURE */}
        <Section n={2} title="Architecture: the shape of the brain" lead="This is a decoder-only transformer, the same recipe as GPT. Click any block to see what it does, then change the sizes and watch the parameter count move.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="outline" disabled={training} onClick={() => applyPreset(p)} title={p.hint}>{p.label}</Button>
            ))}
          </div>
          <div className="grid gap-5 rounded-md border bg-card p-4 sm:grid-cols-2">
            <Stepper label="Embedding size" value={arch.nEmbd} min={4} max={64} step={4} disabled={training} set={(v) => setArchField("nEmbd", v)}
              hint="How many numbers describe each character. Bigger can hold more nuance." />
            <Stepper label="Attention heads" value={arch.nHead} min={1} max={8} disabled={training}
              set={(v) => { const d = divisors(arch.nEmbd); setArchField("nHead", d.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))); }}
              hint="Parallel look-ups. Must divide the embedding size." />
            <Stepper label="Layers" value={arch.nLayer} min={1} max={4} disabled={training} set={(v) => setArchField("nLayer", v)}
              hint="How many attention + MLP blocks are stacked." />
            <Stepper label="Context length" value={arch.blockSize} min={2} max={32} disabled={training} set={(v) => setArchField("blockSize", v)}
              hint="How many characters back it can see." />
          </div>
          <ArchDiagram cfg={arch} V={V} sel={sel} onSel={setSel} />
          <p className="text-xs text-muted-foreground">Changing any size builds a fresh, untrained model. Your previous run is kept in step 5 for comparison.</p>
        </Section>

        {/* 3 TRAIN */}
        <Section n={3} title="Train: learning from mistakes" lead="Each step: show one example, measure how surprised the model is (the loss), work out which parameters caused the error (backpropagation), and nudge them a little (Adam optimiser). Loss going down means it is learning.">
          <div className="grid gap-5 rounded-md border bg-card p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex justify-between"><span>Learning rate</span><span className="font-mono text-primary">{lr}</span></Label>
              <Slider min={0.001} max={0.1} step={0.001} value={[lr]} disabled={training} onValueChange={([v]) => setLr(v)} />
              <p className="text-xs text-muted-foreground">Size of each nudge. Too small learns slowly; too big overshoots and the loss bounces or explodes.</p>
            </div>
            <div className="space-y-2">
              <Label>Steps to train</Label>
              <div className="flex gap-1.5">
                {[100, 500, 1000, 2000].map((s) => (
                  <Button key={s} size="sm" variant={steps === s ? "default" : "outline"} disabled={training} onClick={() => setSteps(s)}>{s}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">One step = one example. You can train again to continue.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={train} disabled={!ready || training || stale}>
              {(!ready || training) && <Loader2 className="animate-spin" />}
              {!ready ? "Building model…" : training ? `Training… step ${last?.step ?? 0}` : trainedSteps ? `Train ${steps} more steps` : `Train ${steps} steps`}
            </Button>
            <Button variant="outline" disabled={!training} onClick={() => worker.current?.postMessage({ type: "stop" })}>Stop</Button>
            <span className="font-mono text-xs text-muted-foreground">
              {numParams.toLocaleString()} params · step {trainedSteps}{lossNow != null && ` · loss ${lossNow.toFixed(3)}`}
            </span>
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Loss</h3>
              <p className="text-xs text-muted-foreground">lower is better · dashed line is a blind guess</p>
            </div>
            <LossChart runs={lines} baseline={baseline} />
          </div>

          {last && (
            <div className="rounded-md border bg-card p-4">
              <h3 className="text-sm font-semibold">The example it just studied</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Each pair shows the correct next character and how surprised the model was (loss). Dark = surprised.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {last.posLosses.map((l, i) => (
                  <div key={i} className="text-center">
                    <span className="block rounded border px-2 py-1 font-mono text-sm" style={{ background: `color-mix(in oklab, var(--primary) ${Math.min(100, (l / baseline) * 60)}%, transparent)` }}>
                      {labels[last.tokens[i]] ?? "?"}→{labels[last.tokens[i + 1]] ?? "?"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{l.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border bg-card p-4">
            <h3 className="text-sm font-semibold">What it writes as it learns</h3>
            <p className="mt-1 text-xs text-muted-foreground">Names invented at checkpoints during training. Step 0 is a brand-new random model.</p>
            <div className="mt-3 space-y-2">
              {checkpoints.map((c) => (
                <div key={c.step} className="flex items-baseline gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">step {c.step}</span>
                  <span className="flex flex-wrap gap-1.5 font-mono text-sm">
                    {c.samples.map((s, i) => <span key={i} className="rounded bg-muted/60 px-1.5">{s || "∅"}</span>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 4 USE */}
        <Section n={4} title="Inference: using the model" lead="Generating text is just prediction in a loop: ask for the next character, pick one, append it, repeat. Type the start of a name and see exactly what the model believes comes next.">
          <div className="grid gap-5 rounded-md border bg-card p-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prefix">Start of a name (leave empty to start from scratch)</Label>
                <div className="flex gap-2">
                  <input id="prefix" value={prefix} maxLength={arch.blockSize - 1} spellCheck={false}
                    onChange={(e) => setPrefix([...e.target.value].filter((c) => chars.includes(c)).join(""))}
                    className="h-9 flex-1 rounded-md border bg-transparent px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="e.g. ma" />
                  <Button variant="outline" onClick={() => setPrefix("")}>Clear</Button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {tokenLabels.map((t, i) => <Chip key={i} tone={i === 0 ? "muted" : undefined}>{t}</Chip>)}
                  <Chip tone="primary">?</Chip>
                </div>
              </div>
              <Stepper label="Temperature" value={Number(temp.toFixed(1))} min={0.1} max={2} step={0.1} set={setTemp}
                hint="Low: always the safest letter, repetitive. High: adventurous, and eventually gibberish. Watch the bars flatten." />
              <div className="flex flex-wrap gap-2">
                <Button disabled={!probs.length || prefixIds.length >= arch.blockSize}
                  onClick={() => { const i = pick(probs); if (i < chars.length) setPrefix((p) => p + chars[i]); }}>
                  Pick next letter
                </Button>
                <Button variant="outline" disabled={!ready} onClick={() => worker.current?.postMessage({ type: "generate", payload: { count: 12, temperature: temp } })}>
                  Generate 12 names
                </Button>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Probability of the next character</h3>
              {probs.length ? <ProbBars probs={probs} labels={labels} onPick={(i) => i < chars.length && prefixIds.length < arch.blockSize && setPrefix((p) => p + chars[i])} />
                : <p className="text-sm text-muted-foreground">Waiting for the model…</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Click a bar to append it. {BOS} means “the name ends here”. {trainedSteps === 0 && "Untrained: nearly flat, it has no idea yet. Train, then come back."}
              </p>
            </div>
          </div>
          {batch.length > 0 && (
            <div className="rounded-md border bg-card p-4">
              <h3 className="text-sm font-semibold">Generated at temperature {temp.toFixed(1)}</h3>
              <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
                {batch.map((s, i) => <li key={i} className="rounded border px-2 py-1">{s || "∅"}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Inside the model: attention</h3>
              {arch.nLayer > 1 && (
                <div className="flex gap-1">
                  {Array.from({ length: arch.nLayer }, (_, l) => (
                    <Button key={l} size="sm" variant={l === layerIdx ? "default" : "outline"} onClick={() => setLayer(l)}>Layer {l + 1}</Button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Each row is a character asking “which earlier characters should I pay attention to?”. Brighter means more.
              Each head learns its own habit. Compare an untrained model with a trained one.
            </p>
            {tokenLabels.length < 2 && <p className="mt-3 text-sm text-muted-foreground">Type at least one letter above to see attention.</p>}
            <div className="mt-3 flex flex-wrap gap-6">
              {tokenLabels.length >= 2 && Array.from({ length: heads }, (_, h) => (
                <div key={h}>
                  <p className="mb-1 font-mono text-xs text-muted-foreground">head {h + 1}</p>
                  <Heatmap labels={tokenLabels} rows={rows.map((r) => r.attention[layerIdx]?.[h] ?? [])} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-card p-4">
            <h3 className="text-sm font-semibold">Inside the model: what it learned about characters</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Each character's embedding squashed from {arch.nEmbd} numbers down to 2D. Nobody told the model which letters
              are vowels (highlighted), yet after training similar letters often drift together. Untrained, it is random.
            </p>
            <div className="mt-3"><Scatter points={pts2d} /></div>
          </div>
        </Section>

        {/* 5 COMPARE */}
        <Section n={5} title="Compare: tweak, retrain, learn" lead="Every time you change the architecture or data after training, the old run is saved here. Try the presets in step 2 and compare final loss against model size.">
          {runs.length === 0 && trainedSteps === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Train once, then change something in step 2 and train again. Runs will line up here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr><th className="p-3">Run</th><th>Data</th><th>Params</th><th>Steps</th><th>Final loss</th></tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {[...runs, ...(trainedSteps ? [{
                    id: "live", label: `${curLabel} (current)`, params: numParams, points,
                    finalLoss: points.slice(-20).reduce((s, p) => s + p.loss, 0) / Math.max(1, points.slice(-20).length),
                    color: "var(--primary)", data: DATASETS[dataKey].label,
                  } as Run] : [])].map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: r.color }} />{r.label}</td>
                      <td>{r.data}</td>
                      <td>{r.params.toLocaleString()}</td>
                      <td>{r.points.length}</td>
                      <td>{r.finalLoss.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {runs.length > 0 && <Button variant="ghost" size="sm" onClick={() => setRuns([])}>Clear saved runs</Button>}
          <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            <b className="text-foreground">Things to try:</b> train “Tiny brain” and “Wide” on names and compare loss.
            Switch to Animals and train 2,000 steps: loss drops far below the names run because it is memorising 70 words.
            Set the learning rate to 0.1 and watch training go unstable. Set context to 2 and see what it can no longer do.
          </div>
        </Section>

        <p className="border-t pt-6 text-center text-xs text-muted-foreground">
          Core engine by <a className="underline" href="https://github.com/kylemath/microgptJS">kylemath/microgptJS</a> (MIT),
          a JavaScript port of Karpathy’s <a className="underline" href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95">microgpt.py</a>.
        </p>
      </div>
      <Footer />
    </div>
  );
}

import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
import Explainer, { type Trace } from "@/components/microgpt/Explainer";
import StoryLab from "@/components/microgpt/StoryLab";
import {
  ArchDiagram, BOS, LossChart, Scatter,
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
  // Default must match scripts/train-microgpt.ts: that is the model that loads pre-trained
  { label: "Default", hint: "32 dims, 4 heads, 2 layers", arch: { nEmbd: 32, nHead: 4, nLayer: 2, blockSize: 16 }, lr: 0.01 },
  { label: "Tiny brain", hint: "8 dims, 1 head, 1 layer", arch: { nEmbd: 8, nHead: 1, nLayer: 1, blockSize: 16 }, lr: 0.01 },
  { label: "Wide", hint: "64 dims", arch: { nEmbd: 64, nHead: 4, nLayer: 2, blockSize: 16 }, lr: 0.01 },
  { label: "Deep", hint: "4 layers", arch: { nEmbd: 32, nHead: 4, nLayer: 4, blockSize: 16 }, lr: 0.01 },
  { label: "Short memory", hint: "context of 3", arch: { nEmbd: 32, nHead: 4, nLayer: 2, blockSize: 4 }, lr: 0.01 },
  { label: "LR too high", hint: "learning rate 0.1", arch: { nEmbd: 32, nHead: 4, nLayer: 2, blockSize: 16 }, lr: 0.1 },
];
const sameArch = (a: ArchCfg, b: ArchCfg) =>
  a.nEmbd === b.nEmbd && a.nHead === b.nHead && a.nLayer === b.nLayer && a.blockSize === b.blockSize;
type Pretrained = { step: number; loss: number; curve: Point[] };

const RUN_COLORS = ["#e07a5f", "#3d9970", "#b36bd1", "#d4a017", "#2a9bb5", "#c0577d"];

type Checkpoint = { step: number; samples: string[] };
type Last = { step: number; loss: number; lr: number; doc: string; tokens: number[]; posLosses: number[] };
type Run = { id: string; label: string; params: number; points: Point[]; finalLoss: number; samples: string[]; color: string; data: string };

const divisors = (n: number) => [1, 2, 4, 8].filter((h) => n % h === 0);

/* ---------- small UI pieces ---------- */

function Section({ n, title, lead, children }: { n?: number; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-8" aria-labelledby={`s${n ?? title}`}>
      <div>
        <h2 id={`s${n ?? title}`} className="text-2xl font-semibold tracking-tight">
          {n != null && <span className="mr-2 text-muted-foreground">{n}.</span>}{title}
        </h2>
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
      <Label className="flex justify-between"><span>{label}</span><span className="font-mono text-foreground">{value}</span></Label>
      <Slider min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={([v]) => set(v)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ---------- page ---------- */

export default function Microgpt() {
  const worker = useRef<Worker | null>(null);
  const namesCache = useRef<string>("");

  // configuration
  const [dataKey, setDataKey] = useState<DataKey>("names");
  const [custom, setCustom] = useState("alice\nbob\ncharlie\ndiana\nedward\nfiona");
  const [text, setText] = useState("");
  const [arch, setArch] = useState<ArchCfg>(PRESETS[0].arch);
  const [lr, setLr] = useState(0.01);
  const [steps, setSteps] = useState(500);
  const [batchSize, setBatchSize] = useState(8);
  const [pretrained, setPretrained] = useState<Pretrained | null>(null);
  const [scratch, setScratch] = useState(0); // bump to rebuild without the checkpoint
  const usePre = useRef(true);
  const preCache = useRef<unknown>(null);
  const initGen = useRef(0);
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
  const [batch, setBatch] = useState<string[]>([]);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [tab, setTab] = useState<"explain" | "train" | "compare" | "story">("explain");
  const [nameSeed, setNameSeed] = useState(0);
  const [view, setView] = useState<"trained" | "initial">("trained");
  // last finished trace + the tokens it was computed for. Kept while a newer one is in flight,
  // so the map updates in place instead of unmounting; cleared only when the model is rebuilt.
  const [shown, setShown] = useState<{ rows: Trace[]; tokens: number[] } | null>(null);
  const traceId = useRef(0);

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
        setPretrained(payload.pretrained);
        if (payload.pretrained) setPoints(payload.pretrained.curve);
      } else if (type === "steps") {
        setPoints((p) => [...p, ...payload.batch]);
        if (payload.last) setLast(payload.last);
      } else if (type === "checkpoint") {
        setCheckpoints((c) => [...c, payload]);
      } else if (type === "done") setTraining(false);
      else if (type === "trace") { if (payload.id === traceId.current) setShown({ rows: payload.rows, tokens: payload.tokens }); }
      else if (type === "embeddings") setEmbeds(payload);
      else if (type === "samples") setBatch(payload);
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  /* (re)build the model whenever data or architecture changes; the previous run is kept for comparison */
  useEffect(() => {
    if (docs.length < 3) return;
    const id = setTimeout(async () => {
      const { points: pts, numParams: np, arch: a, dataKey: dk } = live.current;
      const my = ++initGen.current;
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
      setPoints([]); setLast(null); setCheckpoints([]); setBatch([]); setTraining(false); setReady(false); setPretrained(null); setShown(null);
      // names + Default preset: start from the shipped checkpoint (scripts/train-microgpt.ts)
      const wantPre = usePre.current;
      usePre.current = true;
      let ck: unknown;
      if (wantPre && dk === "names" && sameArch(arch, PRESETS[0].arch)) {
        ck = preCache.current ??= await fetch("/microgpt/pretrained-names.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (my !== initGen.current) return; // a newer rebuild started while we were fetching
      }
      worker.current?.postMessage({ type: "init", payload: { text, options: { ...arch, learningRate: lr, numSteps: steps }, pretrained: ck ?? undefined } });
    }, 350);
    return () => clearTimeout(id);
    // learning rate / steps are applied at train time, not build time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, arch, scratch]);

  /* ask the model what it predicts for the current prefix */
  const prefixIds = useMemo(
    () => [chars.length, ...[...prefix].map((c) => chars.indexOf(c)).filter((i) => i >= 0)].slice(0, arch.blockSize),
    [prefix, chars, arch.blockSize],
  );
  const lastCheckpoint = checkpoints.length ? checkpoints[checkpoints.length - 1].step : -1;
  const baseline_ = view === "initial" && points.length > 0; // twin only differs once training has run
  useEffect(() => {
    if (!ready || tab !== "explain") return;
    traceId.current++;
    worker.current?.postMessage({ type: "trace", payload: { id: traceId.current, tokens: prefixIds, baseline: baseline_ } });
    worker.current?.postMessage({ type: "embeddings", payload: { baseline: baseline_ } });
  }, [ready, tab, prefixIds, lastCheckpoint, training, baseline_]);
  const examples = useMemo(
    () => [...new Set(docs.slice(0, 8).map((d) => d.slice(0, Math.min(3, Math.max(1, d.length - 1)))))].slice(0, 5),
    [docs],
  );

  const tokenLabels = (shown?.tokens ?? []).map((i) => labels[i] ?? "?");
  const tracePending = !shown || shown.tokens.join() !== prefixIds.join();

  const pts2d = useMemo(() => {
    if (embeds.length < 3) return [];
    const xy = pca2(embeds.map((e) => e.embedding));
    return embeds.map((e, i) => ({ x: xy[i][0], y: xy[i][1], label: e.char === "<BOS>" ? BOS : e.char, hot: "aeiouy".includes(e.char) }));
  }, [embeds]);

  const train = () => {
    setTraining(true);
    worker.current?.postMessage({ type: "train", payload: { steps, lr, batchSize, checkpointEvery: Math.max(10, Math.round(steps / 5)) } });
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
        />

        {(tab === "train" || tab === "compare") && (
          <div className="rounded-lg border bg-card p-5 text-sm leading-relaxed">
            <p>
              A GPT learns one skill: given the letters so far, guess the next one. Show it <Chip>e</Chip><Chip>m</Chip><Chip>m</Chip> and
              a trained model says <Chip tone="primary">a</Chip>. Here you choose what it reads, how big it is and how long it
              studies, then watch the guesses improve.
            </p>
            <p className="mt-3 text-muted-foreground">
              Everything runs on your computer, in this tab. The maths is written out by hand, so nothing is hidden inside a library.
            </p>
          </div>
        )}

        <div role="tablist" aria-label="Mode" className="flex gap-1 rounded-lg border bg-card p-1">
          {([["explain", "Explain"], ["train", "Train"], ["compare", "Compare"], ["story", "Real model"]] as const).map(([k, l]) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>

        {tab === "explain" && (
          <>
            {/* full-bleed: the model map needs the width to fit without sideways scrolling */}
            <div className="relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2">
            <Explainer
              rows={shown?.rows ?? []}
              busy={tracePending}
              labels={tokenLabels}
              vocabLabels={labels}
              arch={arch}
              temp={temp}
              setTemp={setTemp}
              prefix={prefix}
              setPrefix={(p) => setPrefix([...p].filter((c) => chars.includes(c)).join(""))}
              examples={examples}
              trained={trainedSteps}
              canExtend={prefixIds.length < arch.blockSize}
              onGoTrain={() => setTab("train")}
              numParams={numParams}
              nDocs={docs.length}
              viewSwitch={trainedSteps > 0 && (
                <div className="flex items-center gap-1 rounded-lg border bg-card p-1 text-sm" role="group" aria-label="Which model to show">
                  {([["trained", `Trained (${trainedSteps.toLocaleString()} steps)`], ["initial", "Untrained (random)"]] as const).map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
                      className={cn("rounded-md px-3 py-1 transition-colors", view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            />
            <section className="mt-12 space-y-4 border-t pt-8">
              <h2 className="text-2xl font-semibold tracking-tight">What it learned</h2>
              <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">Nobody told the model anything about names. These patterns appeared because they made its guesses better.</p>
              <div className="rounded-md border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">What it read</h3>
                  <Button size="sm" variant="ghost" onClick={() => setNameSeed((s) => s + 1)}>Shuffle</Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Its whole world: {docs.length.toLocaleString()} {DATASETS[dataKey].label.toLowerCase()}, one per line, read over and over. A few of them:
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5 font-mono text-sm">
                  {Array.from({ length: Math.min(24, docs.length) }, (_, i) => docs[(i * 7919 + nameSeed * 104729) % docs.length]).map((d, i) => (
                    <li key={i} className="rounded bg-muted/60 px-1.5">{d}</li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border bg-card p-4">
                  <h3 className="text-sm font-semibold">How it sees each letter</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Each letter’s {arch.nEmbd} numbers, flattened onto a page. Letters the model treats alike end up close together.
                    Vowels are highlighted: after training they tend to cluster, though nobody told it what a vowel is. Untrained, the layout is random.
                  </p>
                  <div className="mt-3"><Scatter points={pts2d} /></div>
                </div>
                <div className="rounded-md border bg-card p-4">
                  <h3 className="text-sm font-semibold">Names it invents</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Whole names written one letter at a time by the {baseline_ ? "untrained" : "trained"} model, at temperature {temp.toFixed(1)}.
                    Most will be new: it learned how names sound, not a list of them.
                  </p>
                  <Button className="mt-3" size="sm" disabled={!ready} onClick={() => worker.current?.postMessage({ type: "generate", payload: { count: 12, temperature: temp, baseline: baseline_ } })}>
                    Generate 12 names
                  </Button>
                  {batch.length > 0 && (
                    <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
                      {batch.map((s, i) => <li key={i} className="rounded border px-2 py-1">{s || "∅"}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </section>
            </div>
          </>
        )}

        {tab === "train" && (<>
        {/* 1 DATA */}
        <Section n={1} title="Pick what it reads" lead="A model only knows what it is shown. It reads one example after another and learns which letters tend to follow which.">
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
              <h3 className="text-sm font-semibold">Letters become ids</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                The model works on numbers, so every distinct letter gets an id. ⏎ marks the start and the end of each example.
                {" "}{docs.length.toLocaleString()} examples, {V} different tokens.
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
              <p className="mt-1 text-xs text-muted-foreground">Every position is a small quiz: here is everything so far, what comes next?</p>
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
        <Section n={2} title="Choose its size" lead="The same recipe as GPT (a decoder-only transformer), at a size you can watch. Click a block to see what it does, then change the sizes and see how many numbers it has to learn.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="outline" disabled={training} onClick={() => applyPreset(p)} title={p.hint}>{p.label}</Button>
            ))}
          </div>
          <div className="grid gap-5 rounded-md border bg-card p-4 sm:grid-cols-2">
            <Stepper label="Embedding size" value={arch.nEmbd} min={4} max={64} step={4} disabled={training} set={(v) => setArchField("nEmbd", v)}
              hint="How many numbers describe each letter. More can hold more detail, but takes longer to learn." />
            <Stepper label="Attention heads" value={arch.nHead} min={1} max={8} disabled={training}
              set={(v) => { const d = divisors(arch.nEmbd); setArchField("nHead", d.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))); }}
              hint="How many separate ways each letter can look back. Must divide the embedding size." />
            <Stepper label="Layers" value={arch.nLayer} min={1} max={4} disabled={training} set={(v) => setArchField("nLayer", v)}
              hint="How many attention + MLP blocks are stacked. Each one refines the last." />
            <Stepper label="Context length" value={arch.blockSize} min={2} max={32} disabled={training} set={(v) => setArchField("blockSize", v)}
              hint="The longest stretch of letters it can read at once." />
          </div>
          <ArchDiagram cfg={arch} V={V} sel={sel} onSel={setSel} />
          <p className="text-xs text-muted-foreground">Changing any size starts a new model from random numbers. Your previous run is saved in Compare.</p>
        </Section>

        {/* 3 TRAIN */}
        <Section n={3} title="Let it practise" lead="Each step it reads a few names, checks how surprised it was by each real next letter (the loss), works out which numbers were to blame (backpropagation), and nudges them a little. Falling loss means it is learning.">
          <div className="grid gap-5 rounded-md border bg-card p-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex justify-between"><span>Learning rate</span><span className="font-mono text-foreground">{lr}</span></Label>
              <Slider min={0.001} max={0.1} step={0.001} value={[lr]} disabled={training} onValueChange={([v]) => setLr(v)} />
              <p className="text-xs text-muted-foreground">How big each nudge is. Too small and it learns slowly; too big and it overshoots, so the loss jumps around.</p>
            </div>
            <div className="space-y-2">
              <Label>Steps to train</Label>
              <div className="flex gap-1.5">
                {[100, 500, 1000, 2000].map((s) => (
                  <Button key={s} size="sm" variant={steps === s ? "default" : "outline"} disabled={training} onClick={() => setSteps(s)}>{s}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">One step reads one batch of names. Train again to keep going.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex justify-between"><span>Batch size</span><span className="font-mono text-foreground">{batchSize}</span></Label>
              <Slider min={1} max={32} step={1} value={[batchSize]} disabled={training} onValueChange={([v]) => setBatchSize(v)} />
              <p className="text-xs text-muted-foreground">How many names it reads per step. More gives steadier learning but slower steps.</p>
            </div>
          </div>
          {pretrained && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3 text-sm">
              <span className="text-muted-foreground">
                This model has already practised on {docs.length.toLocaleString()} names ({pretrained.step.toLocaleString()} steps, loss {pretrained.loss.toFixed(2)}).
                Train it more, or start over from random numbers and watch it learn from nothing.
              </span>
              <Button size="sm" variant="outline" disabled={training} onClick={() => { usePre.current = false; setScratch((n) => n + 1); }}>Start from scratch</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={train} disabled={!ready || training || stale}>
              {(!ready || training) && <Loader2 className="animate-spin" />}
              {!ready ? "Building model…" : training ? `Training… step ${last?.step ?? 0}` : trainedSteps ? `Train ${steps} more steps` : `Train ${steps} steps`}
            </Button>
            <Button variant="outline" disabled={!training} onClick={() => worker.current?.postMessage({ type: "stop" })}>Stop</Button>
            {trainedSteps > 0 && !training && (
              <Button variant="outline" onClick={() => setTab("explain")}>See inside the model</Button>
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {numParams.toLocaleString()} params · step {trainedSteps}{lossNow != null && ` · loss ${lossNow.toFixed(3)}`}
            </span>
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Loss</h3>
              <p className="text-xs text-muted-foreground">Lower is better. The dashed line is a blind guess.</p>
            </div>
            <LossChart runs={lines} baseline={baseline} />
          </div>

          {last && (
            <div className="rounded-md border bg-card p-4">
              <h3 className="text-sm font-semibold">The last name it practised on</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Each pair is one quiz: the letter it saw and the real next letter. Darker means it was more surprised.
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
            <h3 className="text-sm font-semibold">Names it writes as it learns</h3>
            <p className="mt-1 text-xs text-muted-foreground">Samples taken along the way. At step 0 the numbers are random, so it writes gibberish.</p>
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

        </>)}

        {tab === "story" && <StoryLab />}

        {tab === "compare" && (
        <Section title="Compare runs" lead="Each time you change the data or the size after training, the old run is saved here. Lower final loss means better guesses.">
          {(runs.length > 0 || trainedSteps > 0) && (
            <div className="rounded-md border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Loss curves</h3>
              <LossChart runs={lines} baseline={baseline} />
            </div>
          )}
          {runs.length === 0 && trainedSteps === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nothing to compare yet. Train a model, change something in the Train tab, and train again. Both runs will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>{["Run", "Data", "Params", "Steps", "Final loss"].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="font-mono text-xs [&_td]:px-3 [&_td]:py-2.5">
                  {[...runs, ...(trainedSteps ? [{
                    id: "live", label: `${curLabel} (current)`, params: numParams, points,
                    finalLoss: points.slice(-20).reduce((s, p) => s + p.loss, 0) / Math.max(1, points.slice(-20).length),
                    color: "var(--primary)", data: DATASETS[dataKey].label,
                  } as Run] : [])].map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td><span className="mr-2 inline-block size-2 rounded-full" style={{ background: r.color }} />{r.label}</td>
                      <td>{r.data}</td>
                      <td>{r.params.toLocaleString()}</td>
                      <td>{(r.points.at(-1)?.step ?? 0).toLocaleString()}</td>
                      <td>{r.finalLoss.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {runs.length > 0 && <Button variant="ghost" size="sm" onClick={() => setRuns([])}>Clear saved runs</Button>}
          <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            <b className="text-foreground">Things to try.</b> Train “Tiny brain” and “Wide” on names and compare their loss.
            Switch to Animals and train 2,000 steps: the loss falls far below the names run because it memorises 70 words.
            Pick “LR too high” and watch training go unstable. Pick “Short memory” and see what it can no longer do.
          </div>
        </Section>
        )}

        <p className="border-t pt-6 text-center text-xs text-muted-foreground">
          Model based on Karpathy’s <a className="underline" href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95">microgpt.py</a>{" "}
          via <a className="underline" href="https://github.com/kylemath/microgptJS">kylemath/microgptJS</a> (MIT). Names dataset from Karpathy’s makemore.
        </p>
      </div>
      <Footer />
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { animate } from "animejs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFlow } from "@/lib/microgpt/flowStore";
import { LESSONS, type Zone } from "./lessons";
import AttentionStages from "./AttentionStages";
import ModelMap, { type Expand } from "./ModelMap";
import VectorCanvas from "./VectorCanvas";
import Textbook from "./Textbook";
import { BOS, type ArchCfg } from "./viz";

/* ---------- trace types (mirrors MicroGPT.trace) ---------- */

export type LayerTrace = {
  xIn: number[]; norm1: number[]; q: number[]; k: number[]; v: number[];
  heads: { scores: number[]; weights: number[]; out: number[] }[];
  concat: number[]; attnOut: number[]; res1: number[];
  norm2: number[]; mlpPre: number[]; mlpAct: number[]; mlpOut: number[]; res2: number[];
};
export type Trace = {
  tokEmb: number[]; posEmb: number[]; embSum: number[]; x0: number[];
  layers: LayerTrace[]; logits: number[];
};

/* ---------- building blocks ---------- */

const maxAbs = (rows: number[][]) => Math.max(1e-6, ...rows.flatMap((r) => r.map(Math.abs)));

function cellColor(x: number, scale: number) {
  const a = Math.min(1, Math.abs(x) / scale);
  return x >= 0
    ? `color-mix(in oklab, var(--primary) ${(a * 100).toFixed(0)}%, var(--card))`
    : `color-mix(in oklab, var(--foreground) ${(a * 65).toFixed(0)}%, var(--card))`;
}

/** One vector as a row of coloured cells. `hl` outlines a sub-range (one attention head). */
function Strip({ v, scale, hl, width = 112, className, col, row }: {
  v: number[]; scale: number; hl?: [number, number]; width?: number; className?: string;
  col?: number; row?: number; // grid position, used by the data-flow animation
}) {
  return (
    <div data-col={col} data-row={row}
      className={cn("flex h-5 overflow-hidden rounded-sm border transition-[opacity,box-shadow] duration-300", className)} style={{ width }}>
      {v.map((x, i) => (
        <span
          key={i}
          title={`dim ${i}: ${x.toFixed(3)}`}
          className="h-full"
          style={{
            width: `${100 / v.length}%`,
            background: cellColor(x, scale),
            opacity: hl && (i < hl[0] || i >= hl[1]) ? 0.3 : 1,
          }}
        />
      ))}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "primary" | "muted" }) {
  return (
    <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 font-mono text-sm",
      tone === "primary" && "border-primary/50 bg-primary/10", tone === "muted" && "text-muted-foreground")}>
      {children}
    </span>
  );
}

const Op = ({ children }: { children: React.ReactNode }) => (
  <span className="px-1 font-mono text-sm text-muted-foreground" aria-hidden>{children}</span>
);

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
      <h4 className="mb-0.5 font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

/* ---------- attention detail ---------- */

function AttentionDetail({
  layer, rows, labels, arch, head, setHead, focus, setFocus, scale, spot,
}: {
  layer: number; rows: Trace[]; labels: string[]; arch: ArchCfg;
  head: number; setHead: (h: number) => void; focus: number; setFocus: (i: number) => void;
  scale: { qkv: number; res: number; attn: number };
  spot: number | null; // guided tour: which numbered section to emphasise
}) {
  const sec = (n: number) => cn("space-y-3 rounded-md transition-opacity duration-300", spot != null && (spot === n ? "ring-2 ring-primary/60 ring-offset-8 ring-offset-card" : "opacity-30"));
  const [hover, setHover] = useState<[number, number] | null>(null);
  const d = arch.nEmbd / arch.nHead;
  const hl: [number, number] = [head * d, head * d + d];
  const L = rows.map((r) => r.layers[layer]);
  const scores = L.map((l) => l.heads[head].scores);
  const weights = L.map((l) => l.heads[head].weights);
  const row = hover?.[0] ?? focus;
  const hovered = hover ? { i: hover[0], j: hover[1] } : null;
  const fl = L[row];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Attention · layer {layer + 1}</span>
        <span className="text-xs text-muted-foreground">head:</span>
        {Array.from({ length: arch.nHead }, (_, h) => (
          <Button key={h} size="sm" variant={h === head ? "default" : "outline"} onClick={() => setHead(h)}>{h + 1}</Button>
        ))}
      </div>

      {/* Q K V */}
      <div className={sec(1)}>
        <Note title="① Query, Key, Value">
          Every character's vector is multiplied by three learned matrices. The <b>query</b> is what this character is
          looking for, the <b>key</b> is what it offers to others, the <b>value</b> is what it hands over if chosen.
          Head {head + 1} works on dims {hl[0]}–{hl[1] - 1} (bright); the other heads use the dimmed rest.
        </Note>
        <div className="overflow-x-auto">
          <div className="grid w-max grid-cols-[auto_repeat(3,auto)] items-center gap-x-4 gap-y-1">
            <span />
            {([["Query", "--mg-q"], ["Key", "--mg-k"], ["Value", "--mg-v"]] as const).map(([t, c]) => <span key={t} className="text-xs font-semibold" style={{ color: `var(${c})` }}>{t}</span>)}
            {L.map((l, i) => (
              <div key={i} className="contents">
                <span className={cn(i === row && "text-primary")}><Chip tone={i === row ? "primary" : undefined}>{labels[i]}</Chip></span>
                <VectorCanvas v={l.q} scale={scale.qkv} hl={hl} hue="--mg-q" w={112} h={18} />
                <VectorCanvas v={l.k} scale={scale.qkv} hl={hl} hue="--mg-k" w={112} h={18} />
                <VectorCanvas v={l.v} scale={scale.qkv} hl={hl} hue="--mg-v" w={112} h={18} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* scores + weights */}
      <div className={sec(2)}>
        <Note title="② Who should I look at?">
          Compare each query with the keys of every character up to and including itself (dot product, divided by √{d}).
          Higher score = better match. The hatched area is <b>masked</b>: a GPT may never peek at letters that come later.
          Softmax then turns each row into percentages that add up to 100%.
        </Note>
        <AttentionStages L={L} head={head} d={d} hl={hl} labels={labels} row={row} hover={hover} setHover={setHover} setFocus={setFocus} qkvScale={scale.qkv} />
        <p className="min-h-5 font-mono text-xs text-muted-foreground" aria-live="polite">
          {hovered
            ? `q[“${labels[hovered.i]}”] · k[“${labels[hovered.j]}”] / √${d} = ${scores[hovered.i][hovered.j].toFixed(2)}  →  softmax  →  ${(weights[hovered.i][hovered.j] * 100).toFixed(0)}% of “${labels[hovered.i]}”’s attention goes to “${labels[hovered.j]}”`
            : "Hover or tap a cell for the exact calculation. Click a row to follow that character below."}
        </p>
      </div>

      {/* mix values */}
      <div className={sec(3)}>
        <Note title={`③ Mix the values for “${labels[row]}”`}>
          The new vector for “{labels[row]}” is a weighted blend of the value vectors it attended to. Characters with a
          bigger weight contribute more.
        </Note>
        <div className="grid w-max grid-cols-[auto_auto_auto_auto] items-center gap-x-3 gap-y-1">
          {Array.from({ length: row + 1 }, (_, j) => (
            <div key={j} className="contents">
              <Chip>{labels[j]}</Chip>
              <span className="font-mono text-xs text-muted-foreground">× {(weights[row][j] * 100).toFixed(0)}%</span>
              <span className="h-2 rounded-sm bg-primary" style={{ width: `${Math.max(2, weights[row][j] * 120)}px` }} />
              <Strip v={L[j].v.slice(hl[0], hl[1])} scale={scale.qkv} width={Math.max(24, d * 14)} />
            </div>
          ))}
          <span className="font-mono text-xs text-muted-foreground">sum</span>
          <span /><span />
          <Strip v={fl.heads[head].out} scale={scale.qkv} width={Math.max(24, d * 14)} className="ring-1 ring-primary" />
        </div>
      </div>

      {/* concat -> wo -> residual */}
      <div className={sec(4)}>
        <Note title="④ Join heads, project, add back (residual)">
          All {arch.nHead} head outputs are placed side by side, passed through a learned output matrix (Wₒ), and
          <b> added to the vector that came in</b>. That skip path (residual connection) lets information and learning
          signal flow straight through.
        </Note>
        <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
          <div><p className="font-mono text-[10px] text-muted-foreground">heads joined</p><Strip v={fl.concat} scale={scale.qkv} /></div>
          <Op>→ Wₒ →</Op>
          <div><p className="font-mono text-[10px] text-muted-foreground">attention out</p><Strip v={fl.attnOut} scale={scale.res} /></div>
          <Op>+</Op>
          <div><p className="font-mono text-[10px] text-muted-foreground">input</p><Strip v={fl.xIn} scale={scale.res} /></div>
          <Op>=</Op>
          <div><p className="font-mono text-[10px] text-primary">result</p><Strip v={fl.res1} scale={scale.res} className="ring-1 ring-primary" /></div>
        </div>
      </div>
    </div>
  );
}

/* ---------- embedding detail ---------- */

function EmbeddingDetail({ rows, labels, vocabLabels, scale }: {
  rows: Trace[]; labels: string[]; vocabLabels: string[]; scale: { emb: number; pos: number; norm: number };
}) {
  const W = 132;
  return (
    <div className="space-y-4">
      <Note title="Letters become numbers">
        Each letter has an id. The id picks a learned row of numbers (<b>token embedding</b>). A second learned row says
        <b> where</b> the letter sits (<b>position embedding</b>), because attention alone has no sense of order. The two
        are added and rescaled. That vector is what the rest of the model sees.
      </Note>
      <div className="overflow-x-auto">
        <div className="grid w-max grid-cols-[auto_auto_auto_auto_auto_auto_auto] items-center gap-x-3 gap-y-1.5 font-mono text-xs">
          <span /><span className="text-muted-foreground">id</span><span className="text-muted-foreground">letter</span><span />
          <span className="text-muted-foreground">position</span><span /><span className="text-muted-foreground">sum, rescaled</span>
          {rows.map((r, i) => (
            <div key={i} className="contents">
              <span className="text-right text-sm font-semibold">{labels[i]}</span>
              <span className="w-6 text-right text-muted-foreground">{vocabLabels.indexOf(labels[i])}</span>
              <VectorCanvas v={r.tokEmb} scale={scale.emb} hue="--mg-emb" w={W} h={16} title={`token embedding of ${labels[i]}`} />
              <span className="text-muted-foreground">+</span>
              <VectorCanvas v={r.posEmb} scale={scale.pos} w={W} h={16} title={`position ${i}`} />
              <span className="text-muted-foreground">=</span>
              <VectorCanvas v={r.x0} scale={scale.norm} hue="--mg-emb" w={W} h={16} title={`what enters attention for ${labels[i]}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- MLP detail ---------- */

/** One bar per hidden neuron: above the line = fires, below = ReLU switches it off. */
function NeuronBars({ pre }: { pre: number[] }) {
  const m = maxAbs([pre]);
  const H = 56;
  return (
    <svg viewBox={`0 0 ${pre.length * 4} ${H * 2}`} className="h-28 w-full max-w-xl" role="img"
      aria-label={`${pre.filter((a) => a > 0).length} of ${pre.length} hidden neurons fire`} preserveAspectRatio="none">
      <line x1="0" x2={pre.length * 4} y1={H} y2={H} className="stroke-border" />
      {pre.map((a, i) => {
        const h = (Math.abs(a) / m) * (H - 2);
        return (
          <rect key={i} x={i * 4 + 0.5} width="3" y={a > 0 ? H - h : H} height={Math.max(0.5, h)}
            className={a > 0 ? "fill-[var(--mg-mlp)]" : "fill-muted-foreground/40"}>
            <title>{`neuron ${i}: ${a.toFixed(2)}${a > 0 ? " (fires)" : " (zeroed by ReLU)"}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function MlpDetail({ layer, rows, labels, row, scale }: {
  layer: number; rows: Trace[]; labels: string[]; row: number; scale: { res: number; mlp: number };
}) {
  const l = rows[row].layers[layer];
  const active = l.mlpAct.filter((a) => a > 0).length;
  return (
    <div className="space-y-4">
      <span className="text-sm font-semibold">MLP · layer {layer + 1} · for “{labels[row]}”</span>
      <Note title="What happens">
        Each character is processed on its own now. The vector is expanded to 4× wider, ReLU switches every negative
        number to zero (only <b>{active} of {l.mlpAct.length}</b> neurons fire here), then it is squeezed back and added
        to the input again. Attention gathered context; this step digests it.
      </Note>
      <div>
        <p className="font-mono text-[10px] text-muted-foreground">
          {l.mlpPre.length} hidden neurons after W₁: bars above the line fire, bars below are zeroed by ReLU
        </p>
        <NeuronBars pre={l.mlpPre} />
      </div>
      <div className="flex flex-wrap items-end gap-1">
        <div><p className="font-mono text-[10px] text-muted-foreground">normalised in</p><Strip v={l.norm2} scale={scale.res} /></div>
        <Op>→ W₁ → ReLU →</Op>
        <div><p className="font-mono text-[10px] text-muted-foreground">{l.mlpAct.length} neurons</p><Strip v={l.mlpAct} scale={scale.mlp} width={200} /></div>
        <Op>→ W₂ →</Op>
        <div><p className="font-mono text-[10px] text-muted-foreground">MLP out</p><Strip v={l.mlpOut} scale={scale.res} /></div>
        <Op>+</Op>
        <div><p className="font-mono text-[10px] text-muted-foreground">input</p><Strip v={l.res1} scale={scale.res} /></div>
        <Op>=</Op>
        <div><p className="font-mono text-[10px] text-primary">result</p><Strip v={l.res2} scale={scale.res} className="ring-1 ring-primary" /></div>
      </div>
    </div>
  );
}

/* ---------- output + sampling ---------- */

type Mode = "full" | "topk" | "topp";

function softmaxT(logits: number[], t: number) {
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp((l - m) / t));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

function OutputPanel({ logits, finalVec, vocabLabels, labelFor, temp, setTemp, resScale, logitScale, onAppend }: {
  logits: number[]; finalVec: number[]; vocabLabels: string[]; labelFor: string;
  temp: number; setTemp: (t: number) => void; resScale: number; logitScale: number;
  onAppend: (tokenIdx: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("full");
  const [k, setK] = useState(5);
  const [pCut, setPCut] = useState(0.9);
  const [draw, setDraw] = useState<{ r: number; idx: number; done: boolean } | null>(null);
  const marker = useRef<HTMLDivElement>(null);

  const probs = useMemo(() => softmaxT(logits, temp), [logits, temp]);
  const order = useMemo(() => probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]), [probs]);
  const kept = useMemo(() => {
    const keep = new Array<boolean>(probs.length).fill(mode === "full");
    if (mode === "topk") order.slice(0, k).forEach((i) => (keep[i] = true));
    if (mode === "topp") {
      let cum = 0;
      for (const i of order) {
        keep[i] = true;
        cum += probs[i];
        if (cum >= pCut) break; // the token that crosses the threshold is included
      }
    }
    return keep;
  }, [mode, k, pCut, order, probs]);
  const q = useMemo(() => {
    const sum = probs.reduce((s, p, i) => s + (kept[i] ? p : 0), 0) || 1;
    return probs.map((p, i) => (kept[i] ? p / sum : 0));
  }, [probs, kept]);
  const keptOrder = order.filter((i) => kept[i]);

  // any change to the distribution invalidates the last draw
  useEffect(() => setDraw(null), [logits, temp, mode, k, pCut]);

  const spin = () => {
    const r = Math.random();
    let acc = 0, idx = keptOrder[keptOrder.length - 1];
    for (const i of keptOrder) { acc += q[i]; if (r <= acc) { idx = i; break; } }
    setDraw({ r, idx, done: false });
  };
  useEffect(() => {
    if (!draw || draw.done) return;
    const el = marker.current;
    const finish = () => setDraw((d) => (d ? { ...d, done: true } : d));
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (el) el.style.left = `${draw.r * 100}%`;
      finish();
      return;
    }
    const a = animate(el, { left: ["0%", `${draw.r * 100}%`], duration: 1100, ease: "out(3)", onComplete: finish });
    return () => { a.pause(); };
  }, [draw]);

  const shown = order.slice(0, 10);
  const shades = ["var(--primary)", "color-mix(in oklab, var(--primary) 60%, var(--card))"];

  return (
    <div className="rounded-md border bg-card p-4">
      <h3 className="text-sm font-semibold">Output: from scores to the next character (after “{labelFor}”)</h3>
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <div className="space-y-2">
            <p><b className="text-foreground">① Scores.</b> The final vector becomes one score (logit) per character.</p>
            <div className="flex items-center gap-2"><Strip v={finalVec} scale={resScale} /><Op>→</Op><Strip v={logits} scale={logitScale} width={140} /></div>
          </div>
          <div className="space-y-2">
            <p className="flex justify-between gap-2"><span><b className="text-foreground">② Temperature + softmax.</b> Scores ÷ T, then to percentages.</span><span className="font-mono text-primary">T={temp.toFixed(1)}</span></p>
            <Slider min={0.1} max={2} step={0.1} value={[temp]} onValueChange={([v]) => setTemp(v)} aria-label="Temperature" />
            <p className="text-xs">Low T: the favourite takes almost everything. High T: probabilities even out.</p>
          </div>
          <div className="space-y-2">
            <p><b className="text-foreground">③ Filter.</b> Optionally drop unlikely characters, then renormalise.</p>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Sampling filter">
              {([["full", "None"], ["topk", "Top-k"], ["topp", "Top-p"]] as const).map(([m, l]) => (
                <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{l}</Button>
              ))}
            </div>
            {mode === "topk" && (
              <div className="space-y-1">
                <p className="flex justify-between text-xs"><span>Keep only the k most likely</span><span className="font-mono text-primary">k={k}</span></p>
                <Slider min={1} max={Math.max(2, probs.length)} step={1} value={[k]} onValueChange={([v]) => setK(v)} aria-label="Top-k" />
              </div>
            )}
            {mode === "topp" && (
              <div className="space-y-1">
                <p className="flex justify-between text-xs"><span>Keep the smallest set adding up to p</span><span className="font-mono text-primary">p={pCut.toFixed(2)}</span></p>
                <Slider min={0.05} max={1} step={0.05} value={[pCut]} onValueChange={([v]) => setPCut(v)} aria-label="Top-p" />
              </div>
            )}
            <p className="text-xs">{keptOrder.length} of {probs.length} characters can still be picked.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-1 grid grid-cols-[1.5rem_1fr_1fr_1fr] gap-2 font-mono text-[10px] text-muted-foreground">
              <span /><span>① score</span><span>② probability</span><span>③ after filter</span>
            </div>
            <ul className="space-y-1">
              {shown.map((i) => (
                <li key={i} className={cn("grid grid-cols-[1.5rem_1fr_1fr_1fr] items-center gap-2 rounded font-mono text-xs", !kept[i] && "opacity-50", draw?.done && draw.idx === i && "bg-primary/10")}>
                  <span className="text-center text-sm">{vocabLabels[i]}</span>
                  <span className="flex items-center gap-1" title={`score ${logits[i].toFixed(2)}`}>
                    <span className="relative h-3 flex-1 rounded-sm bg-muted/50">
                      <span className={cn("absolute inset-y-0 rounded-sm", logits[i] >= 0 ? "bg-foreground/60" : "bg-foreground/25")}
                        style={logits[i] >= 0 ? { left: "50%", width: `${(logits[i] / logitScale) * 50}%` } : { right: "50%", width: `${(-logits[i] / logitScale) * 50}%` }} />
                    </span>
                    <span className="w-9 text-right text-muted-foreground">{logits[i].toFixed(1)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 flex-1 rounded-sm bg-muted/50"><span className="block h-full rounded-sm bg-primary/50 transition-[width] duration-300" style={{ width: `${probs[i] * 100}%` }} /></span>
                    <span className="w-10 text-right text-muted-foreground">{(probs[i] * 100).toFixed(1)}%</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 flex-1 rounded-sm bg-muted/50"><span className="block h-full rounded-sm bg-primary transition-[width] duration-300" style={{ width: `${q[i] * 100}%` }} /></span>
                    <span className="w-10 text-right">{kept[i] ? `${(q[i] * 100).toFixed(1)}%` : "out"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground"><b className="text-foreground">④ Pick.</b> A random number between 0 and 100% lands in one character’s slice; that character is chosen. Likelier characters own wider slices.</p>
            <div className="relative h-9 rounded-md border bg-muted/30">
              <div className="flex h-full overflow-hidden rounded-md">
                {keptOrder.filter((i) => q[i] > 0.001).map((i, n) => (
                  <div key={i} title={`${vocabLabels[i]} ${(q[i] * 100).toFixed(1)}%`}
                    className={cn("grid h-full place-items-center border-r border-card font-mono text-xs text-primary-foreground", draw?.done && draw.idx === i && "ring-2 ring-inset ring-foreground")}
                    style={{ width: `${q[i] * 100}%`, background: shades[n % 2] }}>
                    {q[i] > 0.04 ? vocabLabels[i] : ""}
                  </div>
                ))}
              </div>
              {draw && (
                <div ref={marker} className="pointer-events-none absolute -top-2 -bottom-2 w-0.5 bg-foreground" style={{ left: "0%" }} aria-hidden>
                  <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-foreground" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={spin}>Spin</Button>
              {draw?.done && (
                <>
                  <span className="font-mono text-sm" aria-live="polite">picked <b>{vocabLabels[draw.idx]}</b> ({(q[draw.idx] * 100).toFixed(0)}% chance)</span>
                  {draw.idx < vocabLabels.length - 1 ? (
                    <Button size="sm" variant="outline" onClick={() => onAppend(draw.idx)}>Append “{vocabLabels[draw.idx]}” and continue</Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">⏎ means the name ends here.</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- main ---------- */

export default function Explainer({
  rows, labels, vocabLabels, arch, temp, setTemp, prefix, setPrefix, examples, trained, canExtend, onGoTrain,
}: {
  rows: Trace[]; labels: string[]; vocabLabels: string[]; arch: ArchCfg;
  temp: number; setTemp: (t: number) => void;
  prefix: string; setPrefix: (p: string) => void; examples: string[];
  trained: number; canExtend: boolean; onGoTrain: () => void;
}) {
  const [open, setOpen] = useState<Expand>(null);
  const [note, setNote] = useState<string | null>(null);
  const [head, setHead] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const [tour, setTour] = useState<number | null>(null);
  const [deep, setDeep] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const flowAnim = useRef<{ pause: () => void } | null>(null);
  const lesson = tour != null ? LESSONS[tour] : null;
  // spotlight: lit zones get a ring, the rest dim. A lesson with no zones dims nothing.
  const zc = (z: Zone) =>
    !lesson || lesson.zones.length === 0 ? "" : lesson.zones.includes(z) ? "ring-2 ring-primary/60" : "opacity-25";

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playFlow = () => {
    flowAnim.current?.pause();
    const cells = canvas.current?.querySelectorAll<HTMLElement>("[data-col]");
    if (!cells?.length || reduced()) return;
    flowAnim.current = animate(cells, {
      opacity: [0.08, 1],
      translateX: [-10, 0],
      duration: 450,
      ease: "out(2)",
      // drop the inline styles so the spotlight's opacity classes apply again
      onComplete: () => cells.forEach((c) => { c.style.opacity = ""; c.style.transform = ""; }),
      // wave: columns left to right, rows slightly staggered
      delay: (el) => {
        const e = el as HTMLElement;
        return Number(e.dataset.col) * 170 + Number(e.dataset.row) * 45;
      },
    });
  };

  // tour step side effects: open the matching detail, scroll it into view, optionally replay the flow
  useEffect(() => {
    if (tour == null) return;
    const l = LESSONS[tour];
    if (l.open) setOpen((o) => ({ layer: Math.min(o?.layer ?? 0, arch.nLayer - 1), kind: l.open! }));
    const id = setTimeout(() => {
      (document.getElementById(`zone-${l.scroll}`) ?? document.getElementById("zone-map"))?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      if (l.flow) { playFlow(); useFlow.getState().replay(); }
    }, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  const T = rows.length;
  const row = Math.min(focus ?? T - 1, T - 1);
  const scale = useMemo(() => {
    const ls = rows.flatMap((r) => r.layers);
    return {
      emb: maxAbs(rows.map((r) => r.tokEmb)),
      pos: maxAbs(rows.map((r) => r.posEmb)),
      norm: maxAbs(rows.map((r) => r.x0)),
      qkv: maxAbs(ls.flatMap((l) => [l.q, l.k, l.v])),
      res: maxAbs(ls.flatMap((l) => [l.res1, l.res2, l.attnOut, l.mlpOut, l.xIn, l.norm2])),
      mlp: maxAbs(ls.flatMap((l) => [l.mlpPre])),
      attn: 1,
      logit: maxAbs(rows.map((r) => r.logits)),
    };
  }, [rows]);

  if (!rows.length) {
    return <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Preparing the model…</p>;
  }

  const last = rows[T - 1];
  const finalVec = (r: Trace) => r.layers[r.layers.length - 1].res2;
  const w = arch.nLayer > 2 ? 80 : 104;
  const top = (r: Trace) => {
    const m = Math.max(...r.logits);
    const e = r.logits.map((l) => Math.exp(l - m));
    const s = e.reduce((a, b) => a + b, 0);
    const i = e.indexOf(Math.max(...e));
    return { ch: vocabLabels[i], p: e[i] / s };
  };

  const generate = () => {
    const p = softmaxT(last.logits, temp);
    let r = Math.random(), idx = p.length - 1;
    for (let i = 0; i < p.length; i++) { r -= p[i]; if (r <= 0) { idx = i; break; } }
    if (idx === vocabLabels.length - 1) setNote(`The model picked ${BOS}: it thinks the name ends here.`);
    else { setNote(null); setPrefix(prefix + vocabLabels[idx]); setFocus(null); }
  };

  const detail = !open ? null
    : open.kind === "attn" ? (
      <AttentionDetail layer={open.layer} rows={rows} labels={labels} arch={arch} head={Math.min(head, arch.nHead - 1)}
        setHead={setHead} focus={row} setFocus={setFocus} scale={scale} spot={lesson?.open === "attn" ? lesson.spot ?? null : null} />
    ) : open.kind === "mlp" ? (
      <MlpDetail layer={open.layer} rows={rows} labels={labels} row={row} scale={scale} />
    ) : open.kind === "emb" ? (
      <EmbeddingDetail rows={rows} labels={labels} vocabLabels={vocabLabels} scale={scale} />
    ) : (
      <OutputPanel logits={last.logits} finalVec={finalVec(last)} vocabLabels={vocabLabels} labelFor={labels[T - 1]}
        temp={temp} setTemp={setTemp} resScale={scale.res} logitScale={scale.logit}
        onAppend={(i) => { setPrefix(prefix + vocabLabels[i]); setFocus(null); }} />
    );

  const Head = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1 font-mono text-[10px] leading-tight text-muted-foreground" style={{ width: w }}>{children}</div>
  );

  return (
    <div className="space-y-8">
      <Textbook tour={tour} setTour={setTour} lessons={LESSONS} arch={arch} onGoTrain={onGoTrain} />

      {/* top bar: input, generate, temperature, textbook */}
      <div id="zone-input" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-card px-4 py-3 transition-opacity duration-300", zc("input"))}>
        <label htmlFor="ex-input" className="text-sm font-medium">Start of a name</label>
        <input id="ex-input" value={prefix} maxLength={arch.blockSize - 1} spellCheck={false} placeholder="e.g. mar"
          onChange={(e) => { setPrefix(e.target.value); setFocus(null); setNote(null); }}
          className="h-9 w-36 rounded-md border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div className="flex flex-wrap gap-1">
          {examples.map((x) => (
            <Button key={x} size="sm" variant="ghost" className="font-mono" onClick={() => { setPrefix(x); setFocus(null); setNote(null); }}>{x}</Button>
          ))}
        </div>
        <Button size="sm" onClick={generate} disabled={!canExtend}>Generate next letter</Button>
        <label className="flex w-44 items-center gap-2 text-xs text-muted-foreground">
          <span>Temperature</span>
          <Slider min={0.1} max={2} step={0.1} value={[temp]} onValueChange={([v]) => setTemp(v)} aria-label="Temperature" />
          <span className="w-6 tabular-nums text-foreground">{temp.toFixed(1)}</span>
        </label>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={() => useFlow.getState().replay()}>Replay</Button>
          <Button size="sm" variant="outline" onClick={() => setTour(tour ?? 0)}>Textbook</Button>
        </div>
      </div>
      {(note || trained === 0 || !canExtend) && (
        <p className="-mt-5 px-1 text-xs text-muted-foreground" aria-live="polite">
          {note ?? (!canExtend ? `Context limit reached (${arch.blockSize} letters).` : <>Untrained: the weights are random, so the patterns mean nothing yet.{" "}
            <button type="button" className="text-primary underline underline-offset-2" onClick={onGoTrain}>Train it</button> and come back.</>)}
        </p>
      )}

      {/* the whole model, details open in place */}
      <div id="zone-map">
        <ModelMap rows={rows} labels={labels} vocabLabels={vocabLabels} arch={arch} temp={temp}
          head={head} setHead={setHead} focus={row} setFocus={setFocus} scale={scale}
          zones={lesson?.zones ?? []} expanded={open} setExpanded={setOpen} detail={detail} />
      </div>

      <button type="button" onClick={() => setDeep((d) => !d)} aria-expanded={deep}
        className="w-full rounded-md border border-dashed px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
        <b className="text-foreground">{deep ? "▾" : "▸"} Deep dive: every number, row by row</b>
        <span className="ml-2 text-xs">Raw vectors for each character at each step.</span>
      </button>

      {/* overview (deep dive) */}
      {deep && (
      <div id="zone-overview" ref={canvas}>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Each row is one character travelling through the model, left to right.</span>
          <Button size="sm" variant="outline" onClick={playFlow}>▶ Play data flow</Button>
          <span className="inline-flex items-center gap-1">
            <i className="inline-block size-3 rounded-sm" style={{ background: cellColor(1, 1) }} /> positive
            <i className="ml-2 inline-block size-3 rounded-sm" style={{ background: cellColor(-1, 1) }} /> negative
            <span className="ml-1">· hover cells for values</span>
          </span>
        </div>
        <div className="overflow-x-auto rounded-md border bg-card p-4">
          <div className="w-max">
            <div className="flex items-end gap-1 pb-1">
              <div className="w-8" />
              <Head>token embedding</Head><span className="w-4" />
              <Head>position embedding</Head><span className="w-4" />
              <Head>sum, normalised</Head>
              {Array.from({ length: arch.nLayer }, (_, l) => (
                <div key={l} className="flex items-end gap-1">
                  <span className="w-4" />
                  <button type="button" onClick={() => setOpen({ layer: l, kind: "attn" })} aria-pressed={open?.layer === l && open.kind === "attn"}
                    className={cn("rounded border px-1.5 py-1 text-[10px] font-semibold leading-tight transition-opacity hover:border-primary", open?.layer === l && open.kind === "attn" ? "border-primary bg-primary/10" : "", zc("attn"))} style={{ width: w }}>
                    Attention {arch.nLayer > 1 ? l + 1 : ""} ▸
                  </button>
                  <span className="w-4" />
                  <button type="button" onClick={() => setOpen({ layer: l, kind: "mlp" })} aria-pressed={open?.layer === l && open.kind === "mlp"}
                    className={cn("rounded border px-1.5 py-1 text-[10px] font-semibold leading-tight transition-opacity hover:border-primary", open?.layer === l && open.kind === "mlp" ? "border-primary bg-primary/10" : "", zc("mlp"))} style={{ width: w }}>
                    MLP {arch.nLayer > 1 ? l + 1 : ""} ▸
                  </button>
                </div>
              ))}
              <span className="w-4" />
              <Head>output scores</Head>
              <span className="pl-2 font-mono text-[10px] text-muted-foreground">predicts</span>
            </div>
            {rows.map((r, i) => (
              <div key={i}
                onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                onClick={() => setFocus(i)}
                className={cn("flex cursor-pointer items-center gap-1 rounded py-0.5", (hot === i || row === i) && "bg-muted/60")}>
                <div className="w-8"><Chip tone={row === i ? "primary" : undefined}>{labels[i]}</Chip></div>
                <Strip v={r.tokEmb} scale={scale.emb} width={w} col={0} row={i} className={zc("tok")} /><Op>+</Op>
                <Strip v={r.posEmb} scale={scale.pos} width={w} col={1} row={i} className={zc("pos")} /><Op>→</Op>
                <Strip v={r.x0} scale={scale.norm} width={w} col={2} row={i} className={zc("sum")} />
                {r.layers.map((l, li) => (
                  <div key={li} className="flex items-center gap-1">
                    <Op>→</Op><Strip v={l.res1} scale={scale.res} width={w} col={3 + 2 * li} row={i} className={zc("attn")} />
                    <Op>→</Op><Strip v={l.res2} scale={scale.res} width={w} col={4 + 2 * li} row={i} className={zc("mlp")} />
                  </div>
                ))}
                <Op>→</Op>
                <Strip v={r.logits} scale={scale.logit} width={w} col={3 + 2 * arch.nLayer} row={i} className={zc("out")} />
                <span data-col={4 + 2 * arch.nLayer} data-row={i} className={cn("w-24 pl-2 font-mono text-xs transition-opacity", zc("out"))}>
                  <b>{top(r).ch}</b> <span className="text-muted-foreground">{(top(r).p * 100).toFixed(0)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Click a row to follow one character. Click “Attention” or “MLP” in the header to open that step.
          Each stage adds to the vector via residual connections; the output scores are one number per possible next character.
        </p>
      </div>
      )}

      <p className="text-xs text-muted-foreground">
        Layout and teaching flow inspired by{" "}
        <a className="underline" href="https://poloclub.github.io/transformer-explainer/">Transformer Explainer</a> (Polo Club, MIT).
        This model differs from GPT-2: characters instead of word pieces, RMSNorm instead of LayerNorm, ReLU instead of GELU, no biases or dropout, and {arch.nEmbd} dims instead of 768. {BOS} = start marker.
      </p>
    </div>
  );
}

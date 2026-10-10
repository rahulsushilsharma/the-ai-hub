import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { BOS, ProbBars, type ArchCfg } from "./viz";

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
function Strip({ v, scale, hl, width = 112, className }: {
  v: number[]; scale: number; hl?: [number, number]; width?: number; className?: string;
}) {
  return (
    <div className={cn("flex h-5 overflow-hidden rounded-sm border", className)} style={{ width }}>
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
  layer, rows, labels, arch, head, setHead, focus, setFocus, scale,
}: {
  layer: number; rows: Trace[]; labels: string[]; arch: ArchCfg;
  head: number; setHead: (h: number) => void; focus: number; setFocus: (i: number) => void;
  scale: { qkv: number; res: number; attn: number };
}) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const T = rows.length;
  const d = arch.nEmbd / arch.nHead;
  const hl: [number, number] = [head * d, head * d + d];
  const L = rows.map((r) => r.layers[layer]);
  const scores = L.map((l) => l.heads[head].scores);
  const weights = L.map((l) => l.heads[head].weights);
  const sMax = maxAbs(scores);
  const row = hover?.[0] ?? focus;
  const hovered = hover ? { i: hover[0], j: hover[1] } : null;
  const fl = L[row];

  const matrix = (kind: "scores" | "weights") => (
    <div className="inline-block">
      <div className="grid gap-px font-mono text-[10px]" style={{ gridTemplateColumns: `auto repeat(${T}, minmax(0, 2.4rem))` }}>
        <span />
        {labels.map((l, j) => <span key={j} className="text-center text-muted-foreground">{l}</span>)}
        {Array.from({ length: T }, (_, i) => (
          <div key={i} className="contents">
            <span className={cn("pr-1 text-right", i === row ? "font-bold text-primary" : "text-muted-foreground")}>{labels[i]}</span>
            {Array.from({ length: T }, (_, j) =>
              j > i ? (
                <span key={j} title="Masked: a character may not look at the future"
                  className="h-7 rounded-[3px] bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--border)_3px,var(--border)_4px)]" />
              ) : (
                <button
                  key={j} type="button"
                  onMouseEnter={() => setHover([i, j])} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover([i, j])} onBlur={() => setHover(null)}
                  onClick={() => setFocus(i)}
                  aria-label={`${labels[i]} looks at ${labels[j]}: score ${scores[i][j].toFixed(2)}, weight ${(weights[i][j] * 100).toFixed(0)}%`}
                  className={cn("grid h-7 place-items-center rounded-[3px] border text-[10px] text-foreground",
                    hovered?.i === i && hovered.j === j ? "border-primary" : "border-transparent")}
                  style={{
                    background: kind === "scores" ? cellColor(scores[i][j], sMax) : `color-mix(in oklab, var(--primary) ${(weights[i][j] * 100).toFixed(0)}%, var(--card))`,
                  }}
                >
                  {kind === "scores" ? scores[i][j].toFixed(1) : Math.round(weights[i][j] * 100)}
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );

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
      <div className="space-y-3">
        <Note title="① Query, Key, Value">
          Every character's vector is multiplied by three learned matrices. The <b>query</b> is what this character is
          looking for, the <b>key</b> is what it offers to others, the <b>value</b> is what it hands over if chosen.
          Head {head + 1} works on dims {hl[0]}–{hl[1] - 1} (bright); the other heads use the dimmed rest.
        </Note>
        <div className="overflow-x-auto">
          <div className="grid w-max grid-cols-[auto_repeat(3,auto)] items-center gap-x-4 gap-y-1">
            <span />
            {["Query", "Key", "Value"].map((t) => <span key={t} className="text-xs font-semibold">{t}</span>)}
            {L.map((l, i) => (
              <div key={i} className="contents">
                <span className={cn(i === row && "text-primary")}><Chip tone={i === row ? "primary" : undefined}>{labels[i]}</Chip></span>
                <Strip v={l.q} scale={scale.qkv} hl={hl} />
                <Strip v={l.k} scale={scale.qkv} hl={hl} />
                <Strip v={l.v} scale={scale.qkv} hl={hl} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* scores + weights */}
      <div className="space-y-3">
        <Note title="② Who should I look at?">
          Compare each query with the keys of every character up to and including itself (dot product, divided by √{d}).
          Higher score = better match. The hatched area is <b>masked</b>: a GPT may never peek at letters that come later.
          Softmax then turns each row into percentages that add up to 100%.
        </Note>
        <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
          <div><p className="mb-1 font-mono text-xs text-muted-foreground">scores (query · key)</p>{matrix("scores")}</div>
          <div><p className="mb-1 font-mono text-xs text-muted-foreground">attention weights (% per row)</p>{matrix("weights")}</div>
        </div>
        <p className="min-h-5 font-mono text-xs text-muted-foreground" aria-live="polite">
          {hovered
            ? `q[“${labels[hovered.i]}”] · k[“${labels[hovered.j]}”] / √${d} = ${scores[hovered.i][hovered.j].toFixed(2)}  →  softmax  →  ${(weights[hovered.i][hovered.j] * 100).toFixed(0)}% of “${labels[hovered.i]}”’s attention goes to “${labels[hovered.j]}”`
            : "Hover or tap a cell for the exact calculation. Click a row to follow that character below."}
        </p>
      </div>

      {/* mix values */}
      <div className="space-y-3">
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
      <div className="space-y-3">
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

/* ---------- MLP detail ---------- */

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
      <div className="flex flex-wrap items-end gap-1">
        <div><p className="font-mono text-[10px] text-muted-foreground">normalised in</p><Strip v={l.norm2} scale={scale.res} /></div>
        <Op>→ W₁ →</Op>
        <div><p className="font-mono text-[10px] text-muted-foreground">{l.mlpPre.length} neurons</p><Strip v={l.mlpPre} scale={scale.mlp} width={220} /></div>
        <Op>ReLU</Op>
        <div><p className="font-mono text-[10px] text-muted-foreground">after ReLU</p><Strip v={l.mlpAct} scale={scale.mlp} width={220} /></div>
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

/* ---------- main ---------- */

export default function Explainer({
  rows, labels, vocabLabels, arch, temp, setTemp, prefix, setPrefix, examples, trained, canExtend, onGoTrain,
}: {
  rows: Trace[]; labels: string[]; vocabLabels: string[]; arch: ArchCfg;
  temp: number; setTemp: (t: number) => void;
  prefix: string; setPrefix: (p: string) => void; examples: string[];
  trained: number; canExtend: boolean; onGoTrain: () => void;
}) {
  const [open, setOpen] = useState<{ layer: number; kind: "attn" | "mlp" } | null>({ layer: 0, kind: "attn" });
  const [head, setHead] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [hot, setHot] = useState<number | null>(null);

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
  const probs = (() => {
    const m = Math.max(...last.logits);
    const e = last.logits.map((l) => Math.exp((l - m) / temp));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  })();
  const w = arch.nLayer > 2 ? 80 : 104;
  const top = (r: Trace) => {
    const m = Math.max(...r.logits);
    const e = r.logits.map((l) => Math.exp(l - m));
    const s = e.reduce((a, b) => a + b, 0);
    const i = e.indexOf(Math.max(...e));
    return { ch: vocabLabels[i], p: e[i] / s };
  };

  const Head = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1 font-mono text-[10px] leading-tight text-muted-foreground" style={{ width: w }}>{children}</div>
  );

  return (
    <div className="space-y-8">
      {/* input */}
      <div className="rounded-md border bg-card p-4">
        <label htmlFor="ex-input" className="text-sm font-semibold">Give the model the start of a name</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input id="ex-input" value={prefix} maxLength={arch.blockSize - 1} spellCheck={false} placeholder="e.g. mar"
            onChange={(e) => { setPrefix(e.target.value); setFocus(null); }}
            className="h-9 w-40 rounded-md border bg-transparent px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {examples.map((x) => (
            <Button key={x} size="sm" variant="outline" onClick={() => { setPrefix(x); setFocus(null); }}>{x}</Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Characters become tokens (⏎ marks the start). The model predicts the next character at <i>every</i> position
          at once; the last one is what it would write next.
          {trained === 0 && (
            <> This model is <b>untrained</b>: random weights, so patterns look meaningless.{" "}
              <button type="button" className="text-primary underline underline-offset-2" onClick={onGoTrain}>Train it</button>, then return to see how the same input changes.</>
          )}
        </p>
        {!canExtend && <p className="mt-1 text-xs text-muted-foreground">Context limit reached ({arch.blockSize} tokens).</p>}
      </div>

      {/* overview */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Each row is one character travelling through the model, left to right.</span>
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
                    className={cn("rounded border px-1.5 py-1 text-[10px] font-semibold leading-tight hover:border-primary", open?.layer === l && open.kind === "attn" ? "border-primary bg-primary/10" : "")} style={{ width: w }}>
                    Attention {arch.nLayer > 1 ? l + 1 : ""} ▸
                  </button>
                  <span className="w-4" />
                  <button type="button" onClick={() => setOpen({ layer: l, kind: "mlp" })} aria-pressed={open?.layer === l && open.kind === "mlp"}
                    className={cn("rounded border px-1.5 py-1 text-[10px] font-semibold leading-tight hover:border-primary", open?.layer === l && open.kind === "mlp" ? "border-primary bg-primary/10" : "")} style={{ width: w }}>
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
                <Strip v={r.tokEmb} scale={scale.emb} width={w} /><Op>+</Op>
                <Strip v={r.posEmb} scale={scale.pos} width={w} /><Op>→</Op>
                <Strip v={r.x0} scale={scale.norm} width={w} />
                {r.layers.map((l, li) => (
                  <div key={li} className="flex items-center gap-1">
                    <Op>→</Op><Strip v={l.res1} scale={scale.res} width={w} />
                    <Op>→</Op><Strip v={l.res2} scale={scale.res} width={w} />
                  </div>
                ))}
                <Op>→</Op>
                <Strip v={r.logits} scale={scale.logit} width={w} />
                <span className="w-24 pl-2 font-mono text-xs">
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

      {/* detail */}
      {open && (
        <div className="rounded-md border bg-card p-4">
          {open.kind === "attn" ? (
            <AttentionDetail layer={open.layer} rows={rows} labels={labels} arch={arch} head={Math.min(head, arch.nHead - 1)}
              setHead={setHead} focus={row} setFocus={setFocus} scale={scale} />
          ) : (
            <MlpDetail layer={open.layer} rows={rows} labels={labels} row={row} scale={scale} />
          )}
        </div>
      )}

      {/* output */}
      <div className="rounded-md border bg-card p-4">
        <h3 className="text-sm font-semibold">Output: scores → probabilities (for the last character “{labels[T - 1]}”)</h3>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              The final vector is turned into one <b>score (logit)</b> per possible next character. Divide the scores by
              the <b>temperature</b> and apply <b>softmax</b> to get probabilities that sum to 100%.
            </p>
            <div className="flex items-center gap-3">
              <Strip v={finalVec(last)} scale={scale.res} />
              <Op>→</Op>
              <Strip v={last.logits} scale={scale.logit} width={140} />
            </div>
            <div className="space-y-2">
              <p className="flex justify-between font-medium text-foreground"><span>Temperature</span><span className="font-mono text-primary">{temp.toFixed(1)}</span></p>
              <Slider min={0.1} max={2} step={0.1} value={[temp]} onValueChange={([v]) => setTemp(v)} aria-label="Temperature" />
              <p className="text-xs">Low: the favourite gets nearly everything. High: probabilities even out and picks get riskier.</p>
            </div>
          </div>
          <ProbBars probs={probs} labels={vocabLabels} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Layout and teaching flow inspired by{" "}
        <a className="underline" href="https://poloclub.github.io/transformer-explainer/">Transformer Explainer</a> (Polo Club, MIT).
        This model differs from GPT-2: characters instead of word pieces, RMSNorm instead of LayerNorm, ReLU instead of GELU, no biases or dropout, and {arch.nEmbd} dims instead of 768. {BOS} = start marker.
      </p>
    </div>
  );
}

import VectorCanvas from "@/components/microgpt/VectorCanvas";
import type { StoryMeta } from "@/lib/microgpt/story";
import { cn } from "@/lib/utils";
import type { Inspect } from "@/workers/story";

const show = (t: string) => t.replace(/\n/g, "⏎").replace(/ /g, "␣");
const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
const maxAbs = (vs: Float32Array[]) => vs.reduce((m, v) => v.reduce((a, x) => Math.max(a, Math.abs(x)), m), 1e-6);
const norm = (v: Float32Array) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const hueStyle = (hue: string) => ({ "--hue": `var(${hue})` }) as React.CSSProperties;

/* ---------- the architecture, with its real shapes ---------- */

function Box({ hue, title, shape, children, className }: { hue: string; title: string; shape?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div style={hueStyle(hue)} className={cn("rounded-md border border-[color-mix(in_oklab,var(--hue)_55%,transparent)] bg-[color-mix(in_oklab,var(--hue)_10%,var(--card))] px-3 py-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <b className="text-sm">{title}</b>
        {shape && <span className="font-mono text-[11px] text-muted-foreground">{shape}</span>}
      </div>
      {children && <p className="mt-0.5 text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

/** a "+" on the residual stream line: this sub-layer's output is added, not substituted */
const Add = ({ label }: { label: string }) => (
  <div className="relative flex items-center gap-2 py-1 pl-1 text-[11px] text-muted-foreground">
    <span className="z-10 -ml-[13px] flex size-5 items-center justify-center rounded-full border bg-card font-mono text-xs text-foreground">+</span>
    {label}
  </div>
);
const Down = () => <div className="py-0.5 text-center text-xs leading-none text-muted-foreground" aria-hidden>↓</div>;

export function ArchMap({ meta }: { meta: StoryMeta }) {
  const c = meta.config, C = c.n_embd;
  const size = (pred: (n: string) => boolean) =>
    meta.tensors.filter((t) => pred(t.name)).reduce((s, t) => s + t.shape.reduce((a, b) => a * b, 1), 0);
  const parts: [string, number, string][] = [
    ["token table", size((n) => n === "wte"), "--mg-emb"],
    ["positions", size((n) => n === "wpe"), "--mg-q"],
    ["attention", size((n) => /qkv|proj/.test(n)), "--mg-attn"],
    ["MLP", size((n) => /\.fc/.test(n)), "--mg-mlp"],
    ["LayerNorms", size((n) => /ln/.test(n)), "--muted-foreground"],
  ];
  const total = parts.reduce((s, p) => s + p[1], 0);
  const hd = C / c.n_head;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        <div className="rounded-md bg-muted/50 px-3 py-1.5 text-center font-mono text-xs text-muted-foreground">your text → token ids, e.g. “Once” = 7454</div>
        <Down />
        <div className="grid grid-cols-2 gap-1.5">
          <Box hue="--mg-emb" title="Token table" shape={`${c.vocab.toLocaleString()} × ${C}`}>Looks up {C} numbers for the token.</Box>
          <Box hue="--mg-q" title="Position table" shape={`${c.ctx} × ${C}`}>Adds {C} numbers for its place.</Box>
        </div>
        <Down />
        {/* the residual stream: one vector per token that every block reads from and adds to */}
        <div className="relative ml-3 border-l-2 border-dashed border-foreground/30 pl-4">
          <p className="-ml-4 mb-1 pl-4 font-mono text-[11px] text-muted-foreground">residual stream: {C} numbers per token, carried top to bottom</p>
          <div className="rounded-lg border border-dashed p-2">
            <p className="mb-1.5 text-center font-mono text-xs text-muted-foreground">Transformer block, repeated × {c.n_layer}</p>
            <Box hue="--muted-foreground" title="LayerNorm" shape={`${C}`} />
            <Down />
            <Box hue="--mg-attn" title={`Attention · ${c.n_head} heads × ${hd} dims`} shape={`4 × ${C}×${C}`}>
              Each head compares this token with every earlier one and copies over what it finds useful.
            </Box>
            <Add label="attention’s result is added to the stream" />
            <Box hue="--muted-foreground" title="LayerNorm" shape={`${C}`} />
            <Down />
            <Box hue="--mg-mlp" title="MLP" shape={`${C} → ${4 * C} → ${C}, GELU`}>
              {4 * C} neurons, each firing for a pattern it learned. Works on this token alone.
            </Box>
            <Add label="MLP’s result is added to the stream" />
          </div>
        </div>
        <Down />
        <Box hue="--muted-foreground" title="Final LayerNorm" shape={`${C}`} />
        <Down />
        <Box hue="--mg-out" title="Unembed + softmax" shape={`${C} → ${c.vocab.toLocaleString()}`}>
          Compares the final vector with every row of the token table (the same table as at the top) to score each possible next token, then turns scores into probabilities.
        </Box>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <h3 className="text-sm font-semibold">Where its {total.toLocaleString()} numbers live</h3>
          <div className="mt-3 flex h-4 gap-px overflow-hidden rounded-sm">
            {parts.map(([label, n, hue]) => (
              <span key={label} title={`${label}: ${n.toLocaleString()}`} style={{ width: `${(n / total) * 100}%`, background: `var(${hue})` }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {parts.map(([label, n, hue]) => (
              <li key={label} className="flex items-center gap-2">
                <i className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(${hue})` }} />
                <span className="flex-1">{label}</span>
                <span className="font-mono text-muted-foreground">{fmt(n)} · {Math.round((n / total) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Most of this model is its vocabulary: one row of {C} numbers for each of {c.vocab.toLocaleString()} tokens.
            The part that actually thinks, {c.n_layer} blocks of attention and MLP, is only {fmt(parts[2][1] + parts[3][1])} numbers.
          </p>
        </div>
        <div className="rounded-md border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">Read it as a stream.</b> Each token’s {C} numbers flow down the dashed line.
          Blocks never replace them, they only add to them, so early information survives to the end.
          Attention is the only step where tokens exchange information; everything else works on one token at a time.
        </div>
      </div>
    </div>
  );
}

/* ---------- one token's real numbers, flowing through it ---------- */

export function FlowMap({ d, token, layer, setLayer }: { d: Inspect; token: string; layer: number; setLayer: (l: number) => void }) {
  const s = {
    add: maxAbs(d.flow.flatMap((f) => [f.attn, f.mlp])),
    hid: maxAbs(d.flow.map((f) => f.hid)),
    res: maxAbs([d.x0, ...d.flow.map((f) => f.resid)]),
  };
  const W = 132, H = 16; // canvas size of one vector
  const V = (v: Float32Array, scale: number, hue?: string, title?: string, w = W) =>
    <VectorCanvas v={Array.from(v)} scale={scale} hue={hue} w={w} h={H} title={title} />;
  const head = "px-2 pb-1 text-left text-[11px] font-normal text-muted-foreground";

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-y-1 text-xs">
        <thead>
          <tr>
            <th className={head} />
            <th className={head}>attention adds</th>
            <th className={head}>MLP neurons ({d.flow[0].hid.length})</th>
            <th className={head}>MLP adds</th>
            <th className={head}>stream after</th>
            <th className={head}>size</th>
            <th className={head}>its guess so far</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 font-mono text-muted-foreground">start</td>
            <td colSpan={3} className="px-2 text-muted-foreground">token “{show(token)}” + its position, looked up in the two tables →</td>
            <td className="px-2">{V(d.x0, s.res, undefined, "embedding")}</td>
            <td className="px-2 font-mono text-muted-foreground">{norm(d.x0).toFixed(1)}</td>
            <td />
          </tr>
          {d.flow.map((f, l) => (
            <tr key={l} onClick={() => setLayer(l)} className={cn("cursor-pointer [&>td]:py-0.5", l === layer && "[&>td]:bg-primary/10")}>
              <td className="rounded-l px-2 font-mono whitespace-nowrap">
                <button type="button" className="underline-offset-2 hover:underline" aria-pressed={l === layer} onClick={() => setLayer(l)}>block {l + 1}</button>
              </td>
              <td className="px-2">{V(f.attn, s.add, "--mg-attn", `block ${l + 1} attention output`)}</td>
              <td className="px-2">{V(f.hid, s.hid, "--mg-mlp", `block ${l + 1} MLP neurons`)}</td>
              <td className="px-2">{V(f.mlp, s.add, "--mg-mlp", `block ${l + 1} MLP output`)}</td>
              <td className="px-2">{V(f.resid, s.res, undefined, `stream after block ${l + 1}`)}</td>
              <td className="px-2 font-mono text-muted-foreground">{norm(f.resid).toFixed(1)}</td>
              <td className="rounded-r px-2 font-mono whitespace-nowrap">
                {d.lens[l].slice(0, 2).map((t, k) => (
                  <span key={k} className={cn("mr-1 rounded border px-1", k > 0 && "text-muted-foreground")}>{show(t.text)} {pct(t.p)}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
        Every cell is one real number from this prediction (stronger colour = bigger). “Size” is the length of the stream vector after each block.
        The last column reads the stream after each block as if it were the final answer (the “logit lens”): watch the guess sharpen.
        Click a block to see its attention below.
      </p>
    </div>
  );
}

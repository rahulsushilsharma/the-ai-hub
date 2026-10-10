import { cn } from "@/lib/utils";

export type Point = { step: number; loss: number };
export type RunLine = { id: string; label: string; color: string; points: Point[]; live?: boolean };

export const BOS = "⏎";

/* ---------- Loss chart ---------- */

const W = 640, H = 240, PAD = { l: 44, r: 12, t: 12, b: 28 };

function smooth(pts: Point[], win: number): Point[] {
  return pts.map((_, i) => {
    const from = Math.max(0, i - win + 1);
    const slice = pts.slice(from, i + 1);
    return { step: pts[i].step, loss: slice.reduce((s, p) => s + p.loss, 0) / slice.length };
  });
}

export function LossChart({ runs, baseline }: { runs: RunLine[]; baseline: number }) {
  const all = runs.flatMap((r) => r.points).filter((p) => Number.isFinite(p.loss));
  if (all.length < 2)
    return (
      <div className="flex h-60 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        The loss curve appears here once training starts.
      </div>
    );
  const maxStep = Math.max(...all.map((p) => p.step));
  const maxLoss = Math.max(baseline * 1.05, ...all.map((p) => p.loss));
  const minLoss = Math.max(0, Math.min(...all.map((p) => p.loss)) - 0.1);
  const x = (s: number) => PAD.l + (s / maxStep) * (W - PAD.l - PAD.r);
  const y = (l: number) => PAD.t + ((maxLoss - l) / (maxLoss - minLoss || 1)) * (H - PAD.t - PAD.b);
  const ticks = [0, 1, 2, 3].map((i) => minLoss + ((maxLoss - minLoss) * i) / 3);
  const path = (pts: Point[]) => {
    const step = Math.max(1, Math.floor(pts.length / 300));
    return pts
      .filter((_, i) => i % step === 0 || i === pts.length - 1)
      .map((p) => `${x(p.step).toFixed(1)},${y(p.loss).toFixed(1)}`)
      .join(" ");
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-60 w-full" role="img" aria-label="Training loss over steps">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(baseline)} y2={y(baseline)} className="stroke-muted-foreground" strokeDasharray="4 4" />
      <text x={W - PAD.r} y={y(baseline) - 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
        random guessing ({baseline.toFixed(2)})
      </text>
      <text x={PAD.l} y={H - 8} className="fill-muted-foreground font-mono text-[10px]">0</text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
        step {maxStep}
      </text>
      {runs.map((r) =>
        r.points.length < 2 ? null : (
          <g key={r.id}>
            <polyline points={path(r.points)} fill="none" stroke={r.color} strokeOpacity={r.live ? 0.25 : 0} strokeWidth="1" />
            <polyline
              points={path(smooth(r.points, Math.max(5, Math.floor(r.points.length / 25))))}
              fill="none"
              stroke={r.color}
              strokeWidth={r.live ? 2.5 : 1.5}
              strokeOpacity={r.live ? 1 : 0.7}
              strokeLinejoin="round"
            />
          </g>
        ),
      )}
    </svg>
  );
}

/* ---------- Embedding scatter ---------- */

export function Scatter({ points }: { points: { x: number; y: number; label: string; hot: boolean }[] }) {
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (v: number) => 20 + ((v - x0) / (x1 - x0 || 1)) * 360;
  const sy = (v: number) => 20 + ((v - y0) / (y1 - y0 || 1)) * 240;
  return (
    <svg viewBox="0 0 400 280" className="w-full max-w-md" role="img" aria-label="2D map of character embeddings">
      {points.map((p) => (
        <text
          key={p.label}
          x={sx(p.x)}
          y={sy(p.y)}
          textAnchor="middle"
          dominantBaseline="middle"
          className={cn("font-mono text-[15px]", p.hot ? "fill-primary font-bold" : "fill-foreground")}
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/* ---------- Architecture diagram ---------- */

export type ArchCfg = { nEmbd: number; nHead: number; nLayer: number; blockSize: number };

function paramBreakdown(c: ArchCfg, V: number) {
  const n = c.nEmbd;
  return {
    tok: V * n,
    pos: c.blockSize * n,
    attn: 4 * n * n * c.nLayer,
    mlp: 8 * n * n * c.nLayer,
    head: V * n,
  };
}

type BlockId = "tok" | "pos" | "norm" | "attn" | "mlp" | "head";

// same stage colours as the Explain map, so a block looks the same in both tabs
const HUE: Record<BlockId, string> = { tok: "--mg-emb", pos: "--mg-emb", norm: "--muted-foreground", attn: "--mg-attn", mlp: "--mg-mlp", head: "--mg-out" };

export function ArchDiagram({
  cfg, V, sel, onSel,
}: { cfg: ArchCfg; V: number; sel: BlockId; onSel: (b: BlockId) => void }) {
  const p = paramBreakdown(cfg, V);
  const total = p.tok + p.pos + p.attn + p.mlp + p.head;
  const d = cfg.nEmbd / cfg.nHead;
  const info: Record<BlockId, { title: string; shape: string; params?: number; text: string }> = {
    tok: { title: "Token embedding", shape: `${V} chars × ${cfg.nEmbd}`, params: p.tok, text: "Each character id looks up its own row of numbers. These numbers are learned: training slowly moves characters that behave alike (like vowels) close together. See them in the Explain tab." },
    pos: { title: "Position embedding", shape: `${cfg.blockSize} positions × ${cfg.nEmbd}`, params: p.pos, text: "A second learned row for each position, added to the token embedding, so the model can tell “first letter” from “fifth letter”. Block size is the longest sequence it can see." },
    norm: { title: "RMSNorm", shape: `${cfg.nEmbd} numbers`, text: "Rescales the vector to a stable size before each sub-layer. Without it, numbers drift and training becomes unstable. It has no learned parameters." },
    attn: { title: `Attention · ${cfg.nHead} heads × ${d} dims`, shape: `4 matrices of ${cfg.nEmbd}×${cfg.nEmbd} per layer`, params: p.attn, text: `Each head compares the current character's query with the key of every earlier character, turns the scores into weights (softmax), and mixes their values. ${cfg.nHead} head${cfg.nHead > 1 ? "s" : ""} can look for ${cfg.nHead > 1 ? "different things" : "one kind of pattern"} at once. This is the only place characters talk to each other. The output is added back to the input (a residual connection).` },
    mlp: { title: "MLP", shape: `${cfg.nEmbd} → ${4 * cfg.nEmbd} → ${cfg.nEmbd}, ReLU`, params: p.mlp, text: "A small two-layer network applied to each position on its own: expand to 4× wider, zero out negatives (ReLU), shrink back. Attention gathers context, the MLP processes it. Also wrapped in a residual connection." },
    head: { title: "Output head + softmax", shape: `${cfg.nEmbd} → ${V} scores`, params: p.head, text: "Projects the final vector to one score (logit) per character. Softmax turns scores into probabilities that sum to 100%. Training pushes up the probability of the character that really came next." },
  };
  const Block = ({ id, className, children }: { id: BlockId; className?: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => onSel(id)}
      aria-pressed={sel === id}
      style={{ "--hue": `var(${HUE[id]})` } as React.CSSProperties}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-[var(--hue)]",
        sel === id ? "border-[var(--hue)] bg-[color-mix(in_oklab,var(--hue)_14%,var(--card))]" : "bg-card",
        className,
      )}
    >
      {children}
    </button>
  );
  const Arrow = () => <div className="text-center text-xs leading-none text-muted-foreground" aria-hidden>↓</div>;
  const s = info[sel];
  const segs: [string, number, string][] = [
    ["embeddings", p.tok + p.pos, HUE.tok], ["attention", p.attn, HUE.attn], ["MLP", p.mlp, HUE.mlp], ["output", p.head, HUE.head],
  ];
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-1.5">
        <div className="rounded-md bg-muted/50 px-3 py-1.5 text-center font-mono text-xs text-muted-foreground">
          characters so far, e.g. ⏎ m a
        </div>
        <Arrow />
        <div className="grid grid-cols-2 gap-1.5">
          <Block id="tok"><b>Token</b> embedding</Block>
          <Block id="pos"><b>Position</b> embedding</Block>
        </div>
        <Arrow />
        <div className="rounded-lg border border-dashed p-2">
          <p className="mb-1.5 text-center font-mono text-xs text-muted-foreground">
            Transformer block × {cfg.nLayer}
          </p>
          <div className="space-y-1.5">
            <Block id="norm">RMSNorm</Block>
            <Block id="attn"><b>Attention</b> <span className="text-muted-foreground">{cfg.nHead} heads</span></Block>
            <p className="text-center font-mono text-[11px] text-muted-foreground">+ residual</p>
            <Block id="norm">RMSNorm</Block>
            <Block id="mlp"><b>MLP</b> <span className="text-muted-foreground">{cfg.nEmbd}→{4 * cfg.nEmbd}→{cfg.nEmbd}</span></Block>
            <p className="text-center font-mono text-[11px] text-muted-foreground">+ residual</p>
          </div>
        </div>
        <Arrow />
        <Block id="head"><b>Output head</b> → softmax</Block>
        <Arrow />
        <div className="rounded-md bg-muted/50 px-3 py-1.5 text-center font-mono text-xs text-muted-foreground">
          probability of each next character
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <h3 className="font-semibold">{s.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {s.shape}{s.params != null && ` · ${s.params.toLocaleString()} params`}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
        </div>
        <div>
          <p className="mb-1.5 font-mono text-xs text-muted-foreground">
            {total.toLocaleString()} parameters in total
          </p>
          <div className="flex h-3 gap-px overflow-hidden rounded-sm">
            {segs.map(([label, n, hue]) => (
              <span key={label} title={`${label}: ${n.toLocaleString()}`} style={{ width: `${(n / total) * 100}%`, background: `var(${hue})` }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {segs.map(([label, , hue]) => (
              <li key={label} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: `var(${hue})` }} />{label}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">For scale: GPT-3 has 175,000,000,000.</p>
        </div>
      </div>
    </div>
  );
}

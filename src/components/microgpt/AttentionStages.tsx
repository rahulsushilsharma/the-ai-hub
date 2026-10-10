import { Button } from "@/components/ui/button";
import { useFlow } from "@/lib/microgpt/flowStore";
import { cn } from "@/lib/utils";
import { scaleLinear } from "d3-scale";
import { gsap } from "gsap";
import { RotateCcw } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { LayerTrace } from "./Explainer";
import VectorCanvas from "./VectorCanvas";

/* Q·Kᵀ -> mask -> softmax -> weighted values, as four panels that reveal in order.
   Q·Kᵀ is computed here for every pair (the trace only stores the causal half),
   so the mask has real numbers to hide. */

type Props = {
  L: LayerTrace[]; head: number; d: number; hl: [number, number];
  labels: string[]; row: number;
  hover: [number, number] | null; setHover: (h: [number, number] | null) => void;
  setFocus: (i: number) => void; qkvScale: number;
};

const STAGES = [
  { t: "① Match", s: "query · key ÷ √d" },
  { t: "② Hide the future", s: "mask" },
  { t: "③ To percentages", s: "softmax" },
  { t: "④ Blend the values", s: "weights × value" },
] as const;

const Arrow = ({ n }: { n: number }) => (
  <span data-arrow={n} className="self-center pt-6 font-mono text-lg text-muted-foreground" aria-hidden>→</span>
);

export default function AttentionStages({ L, head, d, hl, labels, row, hover, setHover, setFocus, qkvScale }: Props) {
  const T = L.length;
  const box = useRef<HTMLDivElement>(null);
  const setFlow = useFlow((s) => s.set);
  const tick = useFlow((s) => s.replayTick);
  const cs = Math.max(11, Math.min(26, 230 / Math.max(T, 1)));

  const qk = useMemo(
    () => L.map((a) => L.map((b) => {
      let s = 0;
      for (let c = hl[0]; c < hl[1]; c++) s += a.q[c] * b.k[c];
      return s / Math.sqrt(d);
    })),
    [L, hl, d],
  );
  const w = L.map((l) => l.heads[head].weights);
  const qkMax = Math.max(1e-6, ...qk.flatMap((r, i) => r.filter((_, j) => j <= i).map(Math.abs)));
  const size = scaleLinear().domain([0, qkMax]).range([2, cs - 2]).clamp(true);
  const wsize = scaleLinear().domain([0, 1]).range([2, cs - 2]);

  const play = () => {
    const el = box.current;
    if (!el) return;
    gsap.killTweensOf(el.querySelectorAll("[data-panel],[data-cell],[data-arrow]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tl = gsap.timeline();
    STAGES.forEach((_, n) => {
      const at = n * 0.7;
      tl.fromTo(el.querySelectorAll(`[data-panel="${n}"]`), { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", clearProps: "transform" }, at);
      tl.fromTo(el.querySelectorAll(`[data-panel="${n}"] [data-cell]`), { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)", stagger: { each: 0.012, from: "start" }, clearProps: "transform" }, at + 0.1);
      if (n > 0) {
        tl.fromTo(el.querySelectorAll(`[data-arrow="${n}"]`), { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.25, clearProps: "transform" }, at - 0.1);
      }
    });
  };
  useEffect(() => {
    play();
  }, [head, tick]); // not on new letters: the panel updates in place

  const hot = (i: number, j: number) => hover?.[0] === i && hover[1] === j;
  const enter = (i: number, j: number) => { setHover([i, j]); setFlow({ hoverToken: i, hoverCell: { row: i, col: j } }); };
  const leave = () => { setHover(null); setFlow({ hoverToken: null, hoverCell: null }); };

  const grid = (n: number, cell: (i: number, j: number) => ReactNode) => (
    <div data-panel={n} className="space-y-1.5">
      <div>
        <p className="text-xs font-semibold">{STAGES[n].t}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{STAGES[n].s}</p>
      </div>
      <div className="inline-grid font-mono text-[10px]" style={{ gridTemplateColumns: `auto repeat(${T}, ${cs}px)` }}>
        <span />
        {labels.map((l, j) => <span key={j} className="text-center text-muted-foreground">{l}</span>)}
        {Array.from({ length: T }, (_, i) => (
          <Fragment key={i}>
            <span className={cn("pr-1 text-right", i === row ? "font-bold text-primary" : "text-muted-foreground")}
              style={{ lineHeight: `${cs}px` }}>{labels[i]}</span>
            {Array.from({ length: T }, (_, j) => <Fragment key={j}>{cell(i, j)}</Fragment>)}
          </Fragment>
        ))}
      </div>
    </div>
  );

  const btn = (i: number, j: number, inner: ReactNode, label: string) => (
    <button type="button" data-cell style={{ width: cs, height: cs }} className="grid place-items-center" aria-label={label}
      onMouseEnter={() => enter(i, j)} onMouseLeave={leave} onFocus={() => enter(i, j)} onBlur={leave} onClick={() => setFocus(i)}>
      {inner}
    </button>
  );
  const ring = (on: boolean) => cn("rounded-full", on && "ring-2 ring-foreground");
  const ghost = (title: string) => (
    <span data-cell title={title} style={{ width: cs, height: cs }}
      className="rounded-[3px] bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--border)_3px,var(--border)_4px)]" />
  );
  const qkDot = (i: number, j: number, faint = false) => (
    <span className={ring(hot(i, j))}
      style={{
        width: size(Math.abs(qk[i][j])), height: size(Math.abs(qk[i][j])),
        background: qk[i][j] >= 0 ? "var(--mg-attn)" : "var(--muted-foreground)", opacity: faint ? 0.35 : 1,
      }} />
  );

  return (
    <div ref={box} className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={play}><RotateCcw /> Replay steps</Button>
        <span className="text-xs text-muted-foreground">Hover a dot: the same pair lights up in every panel.</span>
      </div>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-6">
        {grid(0, (i, j) => btn(i, j, qkDot(i, j, j > i), `${labels[i]} against ${labels[j]}: ${qk[i][j].toFixed(2)}`))}
        <Arrow n={1} />
        {grid(1, (i, j) => j > i
          ? ghost("Masked: cannot look at the future")
          : btn(i, j, qkDot(i, j), `${labels[i]} against ${labels[j]}: ${qk[i][j].toFixed(2)}`))}
        <Arrow n={2} />
        {grid(2, (i, j) => j > i
          ? ghost("Masked")
          : btn(i, j,
            <span className={cn(ring(hot(i, j)), "bg-[var(--mg-attn)]")}
              style={{ width: wsize(w[i][j]), height: wsize(w[i][j]), opacity: 0.3 + 0.7 * w[i][j] }} />,
            `${labels[i]} gives ${labels[j]} ${(w[i][j] * 100).toFixed(0)}%`))}
        <Arrow n={3} />
        <div data-panel={3} className="space-y-1.5">
          <div>
            <p className="text-xs font-semibold">{STAGES[3].t}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{STAGES[3].s}</p>
          </div>
          <div>
            {L.map((l, i) => (
              <div key={i} data-cell className="flex items-center gap-1" style={{ height: cs }}
                onMouseEnter={() => setFlow({ hoverToken: i })} onMouseLeave={() => setFlow({ hoverToken: null })}>
                <span className={cn("w-3 font-mono text-[10px]", i === row ? "font-bold text-primary" : "text-muted-foreground")}>{labels[i]}</span>
                <VectorCanvas v={l.heads[head].out} scale={qkvScale} hue="--mg-attn" w={Math.max(36, d * 12)} h={Math.max(8, cs - 3)}
                  className={cn((i === row || hover?.[0] === i) && "ring-1 ring-[var(--mg-attn)]")} title={`blended value for ${labels[i]}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { scaleLinear } from "d3-scale";
import { useEffect, useRef, useState } from "react";

/* One vector = one <canvas>, one cell per value (Transformer Explainer's VectorCanvas).
   Cheap enough for hundreds of vectors; React never re-renders per animation frame. */

// one shared observer so hundreds of canvases repaint when the theme flips
const subs = new Set<() => void>();
let mo: MutationObserver | null = null;
function onTheme(fn: () => void) {
  if (!mo && typeof MutationObserver !== "undefined") {
    mo = new MutationObserver(() => subs.forEach((s) => s()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  }
  subs.add(fn);
  return () => { subs.delete(fn); };
}

export default function VectorCanvas({ v, scale, w = 56, h = 20, hue, seq, vertical, hl, title, className }: {
  v: number[]; scale: number; w?: number; h?: number;
  hue?: string; // CSS var of a stage colour, e.g. "--mg-q": light = low, strong = high. Without it: diverging slate/foreground.
  seq?: boolean; // values are non-negative (weights, ReLU, probabilities): 0 = lightest
  vertical?: boolean; // stack values top to bottom (narrow tile) instead of left to right
  hl?: [number, number]; // values outside this range are drawn faint (one attention head)
  title?: string; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => onTheme(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const cs = getComputedStyle(c);
    const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    const card = get("--card", "#fff");
    const cache = new Map<number, string>();
    let colour: (x: number) => string;
    if (hue) {
      const base = get(hue, "#888");
      const t = seq
        ? scaleLinear().domain([0, scale || 1]).range([0, 1]).clamp(true)
        : scaleLinear().domain([-(scale || 1), scale || 1]).range([0, 1]).clamp(true);
      colour = (x) => {
        const k = Math.round(t(x) * 20);
        let s = cache.get(k);
        if (!s) cache.set(k, (s = `color-mix(in oklab, ${base} ${6 + k * 4.7}%, ${card})`));
        return s;
      };
    } else {
      const prim = get("--mg-emb", "#94a3b8"), fg = get("--foreground", "#000");
      const mag = scaleLinear().domain([0, scale || 1]).range([0, 1]).clamp(true);
      colour = (x) => {
        const k = Math.round(mag(Math.abs(x)) * 20) * (x < 0 ? -1 : 1);
        let s = cache.get(k);
        if (!s) {
          const a = Math.abs(k) * 5;
          s = k >= 0 ? `color-mix(in oklab, ${prim} ${a}%, ${card})` : `color-mix(in oklab, ${fg} ${a * 0.65}%, ${card})`;
          cache.set(k, s);
        }
        return s;
      };
    }
    ctx.clearRect(0, 0, c.width, c.height);
    const n = v.length;
    const step = ((vertical ? h : w) * dpr) / n;
    v.forEach((x, i) => {
      ctx.globalAlpha = hl && (i < hl[0] || i >= hl[1]) ? 0.3 : 1;
      ctx.fillStyle = colour(x);
      const a = Math.floor(i * step), b = Math.ceil(step);
      if (vertical) ctx.fillRect(0, a, c.width, b);
      else ctx.fillRect(a, 0, b, c.height);
    });
  }, [v, scale, w, h, hue, seq, vertical, hl, tick]);

  return (
    <canvas ref={ref} role="img" aria-label={title} title={title}
      className={cn("block rounded-[3px]", !hue && "border", className)} style={{ width: w, height: h }} />
  );
}

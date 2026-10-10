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

export default function VectorCanvas({ v, scale, w = 56, h = 20, hl, title, className }: {
  v: number[]; scale: number; w?: number; h?: number;
  hl?: [number, number]; // dims outside this range are drawn faint (one attention head)
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
    c.width = w * dpr; c.height = h * dpr;
    const cs = getComputedStyle(c);
    const prim = cs.getPropertyValue("--primary").trim() || "#6366f1";
    const card = cs.getPropertyValue("--card").trim() || "#fff";
    const fg = cs.getPropertyValue("--foreground").trim() || "#000";
    const mag = scaleLinear().domain([0, scale || 1]).range([0, 1]).clamp(true);
    const cache = new Map<number, string>();
    const colour = (x: number) => {
      const k = Math.round(mag(Math.abs(x)) * 20) * (x < 0 ? -1 : 1);
      let s = cache.get(k);
      if (!s) {
        const a = Math.abs(k) * 5;
        s = k >= 0 ? `color-mix(in oklab, ${prim} ${a}%, ${card})` : `color-mix(in oklab, ${fg} ${a * 0.65}%, ${card})`;
        cache.set(k, s);
      }
      return s;
    };
    const cw = (w * dpr) / v.length;
    v.forEach((x, i) => {
      ctx.globalAlpha = hl && (i < hl[0] || i >= hl[1]) ? 0.3 : 1;
      ctx.fillStyle = colour(x);
      ctx.fillRect(Math.floor(i * cw), 0, Math.ceil(cw), h * dpr);
    });
  }, [v, scale, w, h, hl, tick]);

  return (
    <canvas ref={ref} role="img" aria-label={title} title={title}
      className={cn("block rounded-[3px] border", className)} style={{ width: w, height: h }} />
  );
}

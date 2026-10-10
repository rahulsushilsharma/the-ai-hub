import { select } from "d3-selection";

/* Ribbons between real DOM elements, like Transformer Explainer's Sankey.svelte:
   resolve `from`/`to` selectors, pair by index, measure with getBoundingClientRect,
   build a closed cubic-Bezier band, render with a d3 data join.
   Two layers per band: a static source->target colour gradient, and a "pulse" path
   whose white highlight GSAP slides along to show data flowing. */

export type RibbonDef = {
  from: string;
  to: string;
  stage: number; // timeline stage the ribbon belongs to
  c0: string; // CSS var of the source colour
  c1: string; // CSS var of the target colour
  op: number; // resting opacity (their constants/opacity.ts uses 0.4-0.8)
  pin?: "last"; // many sources -> one target: only the last source draws, aimed at the top of the target
  thin?: number; // band thickness relative to the tiles (default 0.55)
  // explicit source->target pairs instead of row i -> row i (attention: letter j feeds letter i)
  pairs?: { s: number; t: number; op: number; th: number }[];
};

type Datum = { id: string; d: string; stage: number; row: number; c0: string; c1: string; op: number };

export function ribbonPath(
  a: { right: number; cy: number; h: number },
  b: { left: number; cy: number; h: number },
  thin = 0.55,
) {
  const c = Math.max(16, (b.left - a.right) * 0.5);
  const ha = (a.h * thin) / 2, hb = (b.h * thin) / 2;
  return `M${a.right},${a.cy - ha} C${a.right + c},${a.cy - ha} ${b.left - c},${b.cy - hb} ${b.left},${b.cy - hb}` +
    ` L${b.left},${b.cy + hb} C${b.left - c},${b.cy + hb} ${a.right + c},${a.cy + ha} ${a.right},${a.cy + ha} Z`;
}

export function drawRibbons(svgEl: SVGSVGElement, container: HTMLElement, defs: RibbonDef[]) {
  const root = container.getBoundingClientRect();
  const data: Datum[] = [];
  defs.forEach((def, di) => {
    const src = [...container.querySelectorAll(def.from)];
    const dst = [...container.querySelectorAll(def.to)];
    const box = (el: Element) => el.getBoundingClientRect();
    const make = (sEl: Element, tEl: Element, k: number, row: number, op: number, th: number, pinTop = false) => {
      const a = box(sEl), b = box(tEl);
      const A = { right: a.right - root.left, cy: a.top - root.top + a.height / 2, h: a.height };
      const B = pinTop
        ? { left: b.left - root.left, cy: b.top - root.top + 24, h: a.height }
        : { left: b.left - root.left, cy: b.top - root.top + b.height / 2, h: b.height };
      data.push({ id: `${di}-${k}`, d: ribbonPath(A, B, th), stage: def.stage, row, c0: def.c0, c1: def.c1, op });
    };
    if (def.pairs) {
      def.pairs.forEach((p, k) => { if (src[p.s] && dst[p.t]) make(src[p.s], dst[p.t], k, p.t, p.op, p.th); });
      return;
    }
    src.forEach((sEl, i) => {
      if (def.pin && i !== src.length - 1) return;
      const t = def.pin ? dst[0] : dst[i];
      if (t) make(sEl, t, i, i, def.op, def.thin ?? 0.55, !!def.pin);
    });
  });

  const svg = select(svgEl).attr("width", container.scrollWidth).attr("height", container.scrollHeight);
  let defsSel = svg.select<SVGDefsElement>("defs");
  if (defsSel.empty()) defsSel = svg.append("defs");

  // static colour gradient per band
  defsSel.selectAll<SVGLinearGradientElement, Datum>("linearGradient.rb").data(data, (d) => d.id).join((enter) => {
    const g = enter.append("linearGradient").attr("class", "rb").attr("id", (d) => `rb-${d.id}`).attr("x1", 0).attr("x2", 1).attr("y1", 0).attr("y2", 0);
    g.append("stop").attr("offset", 0).style("stop-color", (d) => `var(${d.c0})`);
    g.append("stop").attr("offset", 1).style("stop-color", (d) => `var(${d.c1})`);
    return g;
  });
  // moving highlight per band; all stops at 0 = invisible until the timeline slides them
  defsSel.selectAll<SVGLinearGradientElement, Datum>("linearGradient.rp").data(data, (d) => d.id).join((enter) => {
    const g = enter.append("linearGradient").attr("class", "rp").attr("id", (d) => `rp-${d.id}`).attr("x1", 0).attr("x2", 1).attr("y1", 0).attr("y2", 0);
    [0, 0.75, 0].forEach((o) => g.append("stop").attr("offset", 0).style("stop-color", "#fff").style("stop-opacity", o));
    return g;
  });

  svg.selectAll<SVGPathElement, Datum>("path.ribbon").data(data, (d) => d.id).join("path")
    .attr("class", "ribbon")
    .attr("d", (d) => d.d)
    .attr("fill", (d) => `url(#rb-${d.id})`)
    .attr("fill-opacity", (d) => d.op)
    .attr("data-stage", (d) => d.stage)
    .attr("data-rrow", (d) => d.row);

  svg.selectAll<SVGPathElement, Datum>("path.pulse").data(data, (d) => d.id).join("path")
    .attr("class", "pulse")
    .attr("d", (d) => d.d)
    .attr("fill", (d) => `url(#rp-${d.id})`)
    .attr("data-stage", (d) => d.stage)
    .attr("data-rrow", (d) => d.row)
    .attr("data-grad", (d) => `rp-${d.id}`);
}

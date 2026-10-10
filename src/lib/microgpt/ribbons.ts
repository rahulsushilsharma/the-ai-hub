import { select } from "d3-selection";

/* Ribbons between real DOM elements, like Transformer Explainer's Sankey.svelte:
   resolve `from`/`to` selectors, pair by index, measure with getBoundingClientRect,
   build a closed cubic-Bezier ribbon, render with a d3 data join. */

export type RibbonDef = {
  from: string;
  to: string;
  stage: number; // timeline stage the ribbon belongs to
  pin?: "last"; // many sources -> one target: only the last source draws, aimed at the top of the target
};

type Datum = { id: string; d: string; stage: number; row: number };

const THIN = 0.5; // ribbon thickness relative to its anchors

export function ribbonPath(
  a: { right: number; cy: number; h: number },
  b: { left: number; cy: number; h: number },
) {
  const c = Math.max(20, (b.left - a.right) * 0.5);
  const ha = (a.h * THIN) / 2, hb = (b.h * THIN) / 2;
  return `M${a.right},${a.cy - ha} C${a.right + c},${a.cy - ha} ${b.left - c},${b.cy - hb} ${b.left},${b.cy - hb}` +
    ` L${b.left},${b.cy + hb} C${b.left - c},${b.cy + hb} ${a.right + c},${a.cy + ha} ${a.right},${a.cy + ha} Z`;
}

export function drawRibbons(svgEl: SVGSVGElement, container: HTMLElement, defs: RibbonDef[]) {
  const root = container.getBoundingClientRect();
  const data: Datum[] = [];
  defs.forEach((def, di) => {
    const src = [...container.querySelectorAll(def.from)];
    const dst = [...container.querySelectorAll(def.to)];
    src.forEach((s, i) => {
      if (def.pin && i !== src.length - 1) return;
      const t = def.pin ? dst[0] : dst[i];
      if (!t) return;
      const a = s.getBoundingClientRect(), b = t.getBoundingClientRect();
      const A = { right: a.right - root.left, cy: a.top - root.top + a.height / 2, h: a.height };
      const B = { left: b.left - root.left, cy: def.pin ? b.top - root.top + 18 : b.top - root.top + b.height / 2, h: def.pin ? a.height : b.height };
      data.push({ id: `rb-${di}-${i}`, d: ribbonPath(A, B), stage: def.stage, row: i });
    });
  });

  const svg = select(svgEl).attr("width", container.scrollWidth).attr("height", container.scrollHeight);
  let defsSel = svg.select<SVGDefsElement>("defs");
  if (defsSel.empty()) defsSel = svg.append("defs");

  // one gradient per ribbon; GSAP slides the bright middle stop along it to make data "flow"
  defsSel.selectAll<SVGLinearGradientElement, Datum>("linearGradient").data(data, (d) => d.id).join((enter) => {
    const g = enter.append("linearGradient").attr("id", (d) => d.id).attr("x1", 0).attr("x2", 1).attr("y1", 0).attr("y2", 0);
    [0, 1, 2].forEach((k) =>
      g.append("stop").attr("class", `s${k}`).attr("offset", 0)
        .style("stop-color", "var(--primary)").style("stop-opacity", k === 1 ? 0.9 : 0.24));
    return g;
  });

  svg.selectAll<SVGPathElement, Datum>("path.ribbon").data(data, (d) => d.id).join("path")
    .attr("class", "ribbon")
    .attr("d", (d) => d.d)
    .attr("fill", (d) => `url(#${d.id})`)
    .attr("data-stage", (d) => d.stage)
    .attr("data-rrow", (d) => d.row)
    .attr("data-grad", (d) => d.id);
}

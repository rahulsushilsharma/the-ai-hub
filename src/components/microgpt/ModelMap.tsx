import { Button } from "@/components/ui/button";
import { useFlow } from "@/lib/microgpt/flowStore";
import { drawRibbons, type RibbonDef } from "@/lib/microgpt/ribbons";
import { cn } from "@/lib/utils";
import { scaleLinear } from "d3-scale";
import { gsap } from "gsap";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Trace } from "./Explainer";
import VectorCanvas from "./VectorCanvas";
import type { ArchCfg } from "./viz";

/* The whole model on one canvas, left to right: tokens -> embedding -> [attention -> MLP] x layers -> scores.
   Real DOM elements are the nodes; ribbons are measured between them (see lib/microgpt/ribbons.ts).
   A GSAP timeline reveals each stage and slides a bright pulse along the ribbons. */

export type Open = { layer: number; kind: "attn" | "mlp" } | null;
export type Scales = { norm: number; qkv: number; res: number; mlp: number; logit: number };

const STEP_FULL = 0.55;
const STEP_FAST = 0.16;
const W = 56;

type CellCtx = {
  T: number; act: number; hoverToken: number | null;
  setFlow: (p: { hoverToken?: number | null; hoverCell?: { row: number; col: number } | null }) => void;
  setFocus: (i: number) => void;
};

// module-level on purpose: components declared inside render would remount every frame and lose GSAP's inline styles
function Cell({ m, i, stage, name, children, ring }: { m: CellCtx; i: number; stage: number; name: string; children: ReactNode; ring?: boolean }) {
  const dimmed = m.hoverToken != null && m.hoverToken !== i;
  return (
    <div data-stage={stage} data-row={i} data-last={i === m.T - 1 ? "" : undefined}
      className="flex h-7 items-center"
      onMouseEnter={() => m.setFlow({ hoverToken: i })} onMouseLeave={() => m.setFlow({ hoverToken: null, hoverCell: null })}
      onClick={() => m.setFocus(i)}>
      <div data-n={name} className={cn("rounded-[3px] transition-[opacity,box-shadow] duration-150",
        dimmed && "opacity-25", (ring || i === m.act) && "ring-2 ring-primary/70")}>
        {children}
      </div>
    </div>
  );
}

function Col({ title, children, w = W }: { title: ReactNode; children: ReactNode; w?: number }) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 flex h-8 items-end font-mono text-[10px] leading-tight text-muted-foreground" style={{ width: w }}>{title}</div>
      {children}
    </div>
  );
}

export default function ModelMap({ rows, labels, vocabLabels, arch, temp, open, setOpen, head, setHead, focus, setFocus, scale }: {
  rows: Trace[]; labels: string[]; vocabLabels: string[]; arch: ArchCfg; temp: number;
  open: Open; setOpen: (o: Open) => void; head: number; setHead: (h: number) => void;
  focus: number; setFocus: (i: number) => void; scale: Scales;
}) {
  const T = rows.length;
  const L = arch.nLayer;
  const hoverToken = useFlow((s) => s.hoverToken);
  const hoverCell = useFlow((s) => s.hoverCell);
  const setFlow = useFlow((s) => s.set);
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [anim, setAnim] = useState(false);

  const hd = Math.min(head, arch.nHead - 1);
  const dHead = arch.nEmbd / arch.nHead;
  const hl: [number, number] = [hd * dHead, hd * dHead + dHead];
  const act = hoverToken ?? focus;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- stage numbers: 0 tokens, 1 embedding, 2+3l qkv, 3+3l attention out, 4+3l mlp, 2+3L scores, 3+3L probabilities ---- */
  const lastStage = 3 * L + 3;

  /* ---- ribbons ---- */
  const defs = useMemo<RibbonDef[]>(() => {
    const d: RibbonDef[] = [{ from: '[data-n="tok"]', to: '[data-n="emb"]', stage: 1 }];
    let prev = "emb";
    for (let l = 0; l < L; l++) {
      for (const k of ["q", "k", "v"]) d.push({ from: `[data-n="${prev}"]`, to: `[data-n="${k}-${l}"]`, stage: 2 + 3 * l });
      d.push({ from: `[data-n="mat-${l}"]`, to: `[data-n="ao-${l}"]`, stage: 3 + 3 * l });
      d.push({ from: `[data-n="ao-${l}"]`, to: `[data-n="ma-${l}"]`, stage: 4 + 3 * l });
      d.push({ from: `[data-n="ma-${l}"]`, to: `[data-n="mo-${l}"]`, stage: 4 + 3 * l });
      prev = `mo-${l}`;
    }
    d.push({ from: `[data-n="${prev}"]`, to: '[data-n="logit"]', stage: 2 + 3 * L });
    d.push({ from: '[data-n="logit"]', to: '[data-n="probs"]', stage: 3 + 3 * L, pin: "last" });
    return d;
  }, [L]);

  const redraw = useCallback(() => {
    if (root.current && svg.current) drawRibbons(svg.current, root.current, defs);
  }, [defs]);

  useLayoutEffect(() => { redraw(); }, [redraw, rows, hd, open?.layer, open?.kind]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw]);

  // hovering a letter dims every ribbon that does not belong to it
  useEffect(() => {
    if (!svg.current || tl.current?.isActive()) return;
    const paths = [...svg.current.querySelectorAll<SVGPathElement>("path.ribbon")];
    paths.forEach((p) => {
      const hit = hoverToken == null || Number(p.dataset.rrow) === hoverToken;
      gsap.to(p, { opacity: hit ? 1 : 0.12, duration: 0.1, overwrite: "auto" });
    });
  }, [hoverToken, rows]);

  /* ---- timeline ---- */
  const play = useCallback((fast: boolean) => {
    const el = root.current;
    if (!el) return;
    tl.current?.progress(1).kill(); // finish the running one so a new run starts clean
    if (reduced) return;
    const lastSel = fast ? "[data-last]" : "";
    const ribSel = fast ? `[data-rrow="${T - 1}"]` : "";
    const step = fast ? STEP_FAST : STEP_FULL;
    const t = gsap.timeline({ onStart: () => setAnim(true), onComplete: () => setAnim(false), onInterrupt: () => setAnim(false) });
    for (let s = 0; s <= lastStage; s++) {
      const at = s * step;
      const cells = el.querySelectorAll(`[data-stage="${s}"]${lastSel}`);
      if (cells.length) {
        t.fromTo(cells, { opacity: 0, x: -12 },
          { opacity: 1, x: 0, duration: fast ? 0.2 : 0.4, ease: "power2.out", stagger: fast ? 0 : 0.04, clearProps: "transform" }, at + step * 0.35);
      }
      const ribs = [...el.querySelectorAll<SVGPathElement>(`path.ribbon[data-stage="${s}"]${ribSel}`)];
      if (ribs.length) {
        const stops = ribs.map((p) => [...(el.querySelectorAll(`#${p.dataset.grad} stop`) as NodeListOf<SVGStopElement>)]);
        const o = { p: -0.3 };
        const clamp = (x: number) => Math.min(1, Math.max(0, x));
        t.fromTo(ribs, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "sine.inOut" }, at);
        t.to(o, {
          p: 1.3, duration: fast ? 0.35 : 0.7, ease: "sine.inOut",
          onUpdate: () => stops.forEach((ss) => {
            if (ss.length < 3) return;
            ss[0].setAttribute("offset", String(clamp(o.p - 0.25)));
            ss[1].setAttribute("offset", String(clamp(o.p)));
            ss[2].setAttribute("offset", String(clamp(o.p + 0.25)));
          }),
        }, at);
      }
    }
    tl.current = t;
  }, [T, lastStage, reduced]);

  // wow on first load; afterwards only the new letter's path replays
  const first = useRef(true);
  const sig = labels.join("");
  useEffect(() => {
    if (!T) return;
    play(!first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, L]);
  useEffect(() => () => { tl.current?.kill(); }, []);

  /* ---- cells ---- */
  const dim = (i: number) => hoverToken != null && hoverToken !== i;
  const m: CellCtx = { T, act, hoverToken, setFlow, setFocus };
  const rowsOf = (f: (i: number) => ReactNode) => Array.from({ length: T }, (_, i) => <div key={i}>{f(i)}</div>);

  const cellSize = Math.min(18, Math.max(9, 150 / Math.max(T, 1)));
  const dot = scaleLinear().domain([0, 1]).range([2, cellSize - 2]);

  // probabilities for the last letter at the chosen temperature
  const last = rows[T - 1];
  const probs = useMemo(() => {
    if (!last) return [];
    const m = Math.max(...last.logits);
    const e = last.logits.map((l) => Math.exp((l - m) / temp));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((v, i) => ({ i, p: v / z })).sort((a, b) => b.p - a.p).slice(0, 5);
  }, [last, temp]);
  const top1 = (r: Trace) => {
    const m = Math.max(...r.logits);
    const e = r.logits.map((l) => Math.exp(l - m));
    const i = e.indexOf(Math.max(...e));
    return { ch: vocabLabels[i], p: e[i] / e.reduce((a, b) => a + b, 0) };
  };

  if (!T) return null;

  const groupCls = (sel: boolean) =>
    cn("rounded-xl border bg-card/60 p-3 transition-colors", sel ? "border-primary bg-primary/5" : "hover:border-primary/50");
  const toggle = (layer: number, kind: "attn" | "mlp") =>
    setOpen(open && open.layer === layer && open.kind === kind ? null : { layer, kind });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
        <Button size="sm" variant="outline" onClick={() => play(false)} disabled={anim}><RotateCcw /> Replay</Button>
        <span>Each row is one letter flowing left to right. Hover a letter or a dot to trace it. Click a box to open it.</span>
      </div>
      <div className="overflow-x-auto p-4">
        <div ref={root} className="relative w-max">
          <svg ref={svg} className="pointer-events-none absolute left-0 top-0 z-0" aria-hidden />
          <div className="relative z-10 flex items-start gap-12">
            {/* tokens */}
            <Col title="letters" w={32}>
              {rowsOf((i) => (
                <Cell m={m} i={i} stage={0} name="tok">
                  <span className="grid h-5 w-8 place-items-center rounded border bg-background font-mono text-sm font-semibold">{labels[i]}</span>
                </Cell>
              ))}
            </Col>

            {/* embedding */}
            <Col title={<>numbers <br />for each letter</>}>
              {rowsOf((i) => (
                <Cell m={m} i={i} stage={1} name="emb">
                  <VectorCanvas v={rows[i].x0} scale={scale.norm} w={W} title={`embedding of ${labels[i]}`} />
                </Cell>
              ))}
            </Col>

            {Array.from({ length: L }, (_, l) => {
              const sa = open?.layer === l && open.kind === "attn";
              const sm = open?.layer === l && open.kind === "mlp";
              const ly = rows.map((r) => r.layers[l]);
              return (
                <div key={l} className="flex items-start gap-12">
                  {/* attention */}
                  <div className={groupCls(sa)}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => toggle(l, "attn")} aria-expanded={sa}
                        className="rounded px-1 text-sm font-semibold hover:text-primary">
                        Attention{L > 1 ? ` ${l + 1}` : ""} {sa ? "▴" : "▾"}
                      </button>
                      {Array.from({ length: arch.nHead }, (_, h) => (
                        <button key={h} type="button" aria-pressed={h === hd} onClick={() => setHead(h)} title={`Head ${h + 1}`}
                          className={cn("size-5 rounded-full border text-[10px]", h === hd ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary")}>
                          {h + 1}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-6">
                      {(["q", "k", "v"] as const).map((k) => (
                        <Col key={k} title={{ q: "query: what I look for", k: "key: what I offer", v: "value: what I share" }[k]}>
                          {rowsOf((i) => (
                            <Cell m={m} i={i} stage={2 + 3 * l} name={`${k}-${l}`}
                              ring={(k === "q" && hoverCell?.row === i) || (k === "k" && hoverCell?.col === i)}>
                              <VectorCanvas v={ly[i][k]} scale={scale.qkv} w={W} hl={hl} title={`${k} of ${labels[i]}`} />
                            </Cell>
                          ))}
                        </Col>
                      ))}
                      <Col title="who looks at whom" w={T * cellSize + 8}>
                        {rowsOf((i) => (
                          <div data-stage={3 + 3 * l} data-row={i} data-last={i === T - 1 ? "" : undefined} className="flex h-7 items-center">
                            <div data-n={`mat-${l}`} className={cn("flex items-center transition-opacity", dim(i) && "opacity-25")}>
                              {Array.from({ length: T }, (_, j) => {
                                if (j > i) return <span key={j} style={{ width: cellSize, height: cellSize }} className="grid place-items-center"><i className="size-0.5 rounded-full bg-muted-foreground/30" /></span>;
                                const wgt = ly[i].heads[hd].weights[j];
                                const on = hoverCell?.row === i && hoverCell.col === j;
                                return (
                                  <button key={j} type="button" style={{ width: cellSize, height: cellSize }} className="grid place-items-center"
                                    aria-label={`${labels[i]} looks at ${labels[j]}: ${(wgt * 100).toFixed(0)}%`}
                                    onMouseEnter={() => setFlow({ hoverToken: i, hoverCell: { row: i, col: j } })}
                                    onMouseLeave={() => setFlow({ hoverToken: null, hoverCell: null })}
                                    onFocus={() => setFlow({ hoverToken: i, hoverCell: { row: i, col: j } })}
                                    onBlur={() => setFlow({ hoverToken: null, hoverCell: null })}>
                                    <span className={cn("rounded-full bg-primary", on && "ring-2 ring-foreground")}
                                      style={{ width: dot(wgt), height: dot(wgt), opacity: 0.25 + 0.75 * wgt }} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </Col>
                      <Col title={<>mixed values<br />+ input</>}>
                        {rowsOf((i) => (
                          <Cell m={m} i={i} stage={3 + 3 * l} name={`ao-${l}`}>
                            <VectorCanvas v={ly[i].res1} scale={scale.res} w={W} title={`after attention: ${labels[i]}`} />
                          </Cell>
                        ))}
                      </Col>
                    </div>
                  </div>

                  {/* mlp */}
                  <div className={groupCls(sm)}>
                    <div className="mb-2">
                      <button type="button" onClick={() => toggle(l, "mlp")} aria-expanded={sm}
                        className="rounded px-1 text-sm font-semibold hover:text-primary">
                        MLP{L > 1 ? ` ${l + 1}` : ""} {sm ? "▴" : "▾"}
                      </button>
                    </div>
                    <div className="flex gap-6">
                      <Col title={<>{ly[0].mlpAct.length} neurons<br />(dark = off)</>} w={80}>
                        {rowsOf((i) => (
                          <Cell m={m} i={i} stage={4 + 3 * l} name={`ma-${l}`}>
                            <VectorCanvas v={ly[i].mlpAct} scale={scale.mlp} w={80} title={`${ly[i].mlpAct.filter((a) => a > 0).length} neurons fire for ${labels[i]}`} />
                          </Cell>
                        ))}
                      </Col>
                      <Col title={<>thought over<br />+ input</>}>
                        {rowsOf((i) => (
                          <Cell m={m} i={i} stage={4 + 3 * l} name={`mo-${l}`}>
                            <VectorCanvas v={ly[i].res2} scale={scale.res} w={W} title={`after MLP: ${labels[i]}`} />
                          </Cell>
                        ))}
                      </Col>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* scores */}
            <Col title={<>score for every<br />possible next letter</>} w={W + 70}>
              {rowsOf((i) => {
                const b = top1(rows[i]);
                return (
                  <Cell m={m} i={i} stage={2 + 3 * L} name="logit">
                    <span className="flex items-center gap-2">
                      <VectorCanvas v={rows[i].logits} scale={scale.logit} w={W} title={`scores after ${labels[i]}`} />
                      <span className="w-14 font-mono text-xs"><b>{b.ch}</b> <span className="text-muted-foreground">{(b.p * 100).toFixed(0)}%</span></span>
                    </span>
                  </Cell>
                );
              })}
            </Col>

            {/* probabilities for the last letter */}
            <div data-stage={3 + 3 * L} data-n="probs" className="w-48 rounded-xl border bg-background p-3">
              <p className="mb-2 font-mono text-[10px] text-muted-foreground">next letter after “{labels[T - 1]}” (T={temp.toFixed(1)})</p>
              <ul className="space-y-1.5">
                {probs.map(({ i, p }, n) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-4 text-center text-sm font-semibold">{vocabLabels[i]}</span>
                    <span className="h-3 flex-1 rounded-sm bg-muted/60">
                      <span className={cn("block h-full rounded-sm transition-[width] duration-300", n === 0 ? "bg-primary" : "bg-primary/50")} style={{ width: `${p * 100}%` }} />
                    </span>
                    <span className="w-9 text-right text-muted-foreground">{(p * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useFlow } from "@/lib/microgpt/flowStore";
import { drawRibbons, type RibbonDef } from "@/lib/microgpt/ribbons";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Trace } from "./Explainer";
import type { Zone } from "./lessons";
import VectorCanvas from "./VectorCanvas";
import type { ArchCfg } from "./viz";

gsap.registerPlugin(Flip);

/* The whole model at once, left to right, fitted to the width (Transformer Explainer layout):
   letters -> Embedding -> [Attention -> MLP] x layers -> Output.
   Every vector is a narrow tile coloured by what it is (query blue, key red, value green...).
   Ribbons are measured between real tiles (lib/microgpt/ribbons.ts). Click a block to open it
   in place: GSAP Flip grows it from its own box while the rest of the map dims. */

export type Expand = { layer: number; kind: "emb" | "attn" | "mlp" | "out" } | null;
export type Scales = { norm: number; qkv: number; res: number; mlp: number; logit: number };

const TW = 14; // tile width
const STEP_FULL = 0.5;
const STEP_FAST = 0.15;

const HUE = { emb: "--mg-emb", q: "--mg-q", k: "--mg-k", v: "--mg-v", attn: "--mg-attn", mlp: "--mg-mlp", out: "--mg-out" } as const;
const TITLES = { emb: "Embedding", attn: "Attention", mlp: "MLP", out: "Output" } as const;

type RowCtx = { T: number; rowH: number; setFlow: (p: { hoverToken?: number | null }) => void };

// module-level so React keeps the same elements (GSAP's inline styles and the canvases survive re-renders)
function TileCol({ m, label, hue, name, stage, vecs, scale, seq, hl, titleOf }: {
  m: RowCtx; label: string; hue: string; name: string; stage: number; vecs: number[][]; scale: number;
  seq?: boolean; hl?: [number, number]; titleOf: (i: number) => string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-5 items-center text-[11px] font-semibold" style={{ color: `var(${hue})` }}>{label}</div>
      {vecs.map((v, i) => (
        <div key={i} data-stage={stage} data-row={i} data-last={i === m.T - 1 ? "" : undefined}
          className="flex items-center" style={{ height: m.rowH }}
          onMouseEnter={() => m.setFlow({ hoverToken: i })} onMouseLeave={() => m.setFlow({ hoverToken: null })}>
          <div data-n={name}>
            <VectorCanvas v={v} scale={scale} hue={hue} seq={seq} hl={hl} vertical w={TW} h={m.rowH - 6} title={titleOf(i)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Block({ id, kind, title, extra, flex, dim, sel, onOpen, children, stack = 0 }: {
  id: string; kind: keyof typeof TITLES; title: ReactNode; extra?: ReactNode; flex: number; dim: boolean; sel: boolean;
  onOpen: () => void; children: ReactNode; stack?: number;
}) {
  const hue = kind === "emb" ? HUE.emb : kind === "attn" ? HUE.attn : kind === "mlp" ? HUE.mlp : HUE.out;
  return (
    <div data-flip-id={id} role="button" tabIndex={0} aria-label={`Open ${TITLES[kind]}`} aria-expanded={sel}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ flex, "--hue": `var(${hue})` } as CSSProperties}
      className={cn(
        "relative cursor-pointer rounded-xl px-3 pb-2 transition-[background-color,opacity,box-shadow] duration-300 outline-none",
        "hover:bg-[color-mix(in_oklab,var(--hue)_7%,transparent)] focus-visible:ring-2 focus-visible:ring-ring",
        stack > 0 && "border border-[color-mix(in_oklab,var(--hue)_35%,transparent)] bg-card",
        dim && "opacity-25",
      )}>
      {/* stacked cards behind attention: one per head */}
      {Array.from({ length: stack }, (_, k) => (
        <span key={k} aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-[color-mix(in_oklab,var(--hue)_25%,transparent)] bg-card"
          style={{ transform: `translate(${(k + 1) * 5}px, ${-(k + 1) * 5}px)` }} />
      ))}
      <div className="flex h-9 items-center gap-1.5 text-[13px] font-medium">
        <span className="size-2 shrink-0 rounded-full" style={{ background: `var(${hue})` }} />
        <span className="whitespace-nowrap">{title}</span>
        {extra}
      </div>
      <div className="flex justify-between gap-3">{children}</div>
    </div>
  );
}

export default function ModelMap({ rows, labels, vocabLabels, arch, temp, head, setHead, focus, setFocus, scale, zones, expanded, setExpanded, detail }: {
  rows: Trace[]; labels: string[]; vocabLabels: string[]; arch: ArchCfg; temp: number;
  head: number; setHead: (h: number) => void; focus: number; setFocus: (i: number) => void; scale: Scales;
  zones: Zone[]; // textbook spotlight: lit zones stay bright, the rest dim
  expanded: Expand; setExpanded: (e: Expand) => void; detail: ReactNode;
}) {
  const T = rows.length;
  const L = arch.nLayer;
  const hoverToken = useFlow((s) => s.hoverToken);
  const setFlow = useFlow((s) => s.set);
  const replayTick = useFlow((s) => s.replayTick);
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const [band, setBand] = useState<{ top: number; h: number } | null>(null);
  const [minH, setMinH] = useState(0);

  const hd = Math.min(head, arch.nHead - 1);
  const dHead = arch.nEmbd / arch.nHead;
  const hl: [number, number] = [hd * dHead, hd * dHead + dHead];
  const rowH = Math.round(Math.max(18, Math.min(30, 420 / Math.max(1, T))));
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lastStage = 3 * L + 3; // 0 letters, 1 embedding, 2+3l qkv, 3+3l attention, 4+3l mlp, 2+3L scores, 3+3L probabilities
  const zoneDim = (...z: Zone[]) => zones.length > 0 && !z.some((x) => zones.includes(x));
  const m: RowCtx = { T, rowH, setFlow };

  /* ---- ribbons: colour goes from the source stage to the target stage ---- */
  const defs = useMemo<RibbonDef[]>(() => {
    const d: RibbonDef[] = [{ from: '[data-n="tok"]', to: '[data-n="emb"]', stage: 1, c0: HUE.emb, c1: HUE.emb, op: 0.35 }];
    let prev = "emb", prevHue: string = HUE.emb;
    for (let l = 0; l < L; l++) {
      const s = 2 + 3 * l;
      for (const k of ["q", "k", "v"] as const) d.push({ from: `[data-n="${prev}"]`, to: `[data-n="${k}-${l}"]`, stage: s, c0: prevHue, c1: HUE[k], op: 0.35 });
      d.push({ from: `[data-n="q-${l}"]`, to: `[data-n="w-${l}"]`, stage: s + 1, c0: HUE.q, c1: HUE.attn, op: 0.3 });
      d.push({ from: `[data-n="k-${l}"]`, to: `[data-n="w-${l}"]`, stage: s + 1, c0: HUE.k, c1: HUE.attn, op: 0.3 });
      d.push({ from: `[data-n="w-${l}"]`, to: `[data-n="ao-${l}"]`, stage: s + 1, c0: HUE.attn, c1: HUE.attn, op: 0.45 });
      d.push({ from: `[data-n="v-${l}"]`, to: `[data-n="ao-${l}"]`, stage: s + 1, c0: HUE.v, c1: HUE.attn, op: 0.25 });
      d.push({ from: `[data-n="ao-${l}"]`, to: `[data-n="ma-${l}"]`, stage: s + 2, c0: HUE.attn, c1: HUE.mlp, op: 0.4 });
      d.push({ from: `[data-n="ma-${l}"]`, to: `[data-n="mo-${l}"]`, stage: s + 2, c0: HUE.mlp, c1: HUE.mlp, op: 0.4 });
      prev = `mo-${l}`; prevHue = HUE.mlp;
    }
    d.push({ from: `[data-n="${prev}"]`, to: '[data-n="logit"]', stage: 2 + 3 * L, c0: HUE.mlp, c1: HUE.out, op: 0.4 });
    d.push({ from: '[data-n="logit"]', to: '[data-n="probs"]', stage: 3 + 3 * L, c0: HUE.out, c1: HUE.out, op: 0.45, pin: "last" });
    return d;
  }, [L]);

  const redraw = useCallback(() => {
    if (root.current && svg.current) drawRibbons(svg.current, root.current, defs);
  }, [defs]);
  useLayoutEffect(() => { redraw(); }, [redraw, rows, hd, rowH]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw]);

  /* ---- hover: one soft band across the row, and only that row's ribbons stay bright ---- */
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (hoverToken == null) setBand(null);
    else {
      const tok = el.querySelectorAll('[data-n="tok"]')[hoverToken];
      if (tok) {
        const r = tok.getBoundingClientRect(), base = el.getBoundingClientRect();
        setBand({ top: r.top - base.top + r.height / 2 - rowH / 2, h: rowH });
      }
    }
    if (tl.current?.isActive()) return;
    el.querySelectorAll<SVGPathElement>("path.ribbon").forEach((p) => {
      const hit = hoverToken == null || Number(p.dataset.rrow) === hoverToken;
      gsap.to(p, { opacity: hit ? 1 : 0.15, duration: 0.12, overwrite: "auto" });
    });
  }, [hoverToken, rows, rowH]);

  /* ---- timeline (their showFlowAnimation): stage by stage, tiles fade in, a highlight runs along the ribbons ---- */
  const play = useCallback((fast: boolean) => {
    const el = root.current;
    if (!el) return;
    tl.current?.progress(1).kill(); // finish the running one so a new run starts clean
    if (reduced) return;
    const lastSel = fast ? "[data-last]" : "";
    const ribSel = fast ? `[data-rrow="${T - 1}"]` : "";
    const step = fast ? STEP_FAST : STEP_FULL;
    const t = gsap.timeline();
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    for (let s = 0; s <= lastStage; s++) {
      const at = s * step;
      const tiles = el.querySelectorAll(`[data-stage="${s}"]${lastSel}`);
      if (tiles.length) {
        t.fromTo(tiles, { opacity: 0, scale: 0.6 },
          { opacity: 1, scale: 1, duration: fast ? 0.2 : 0.35, ease: "back.out(2)", stagger: fast ? 0 : 0.02, clearProps: "transform" }, at + step * 0.4);
      }
      const ribs = el.querySelectorAll(`path.ribbon[data-stage="${s}"]${ribSel}`);
      if (ribs.length) t.fromTo(ribs, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "sine.inOut" }, at);
      const pulses = [...el.querySelectorAll<SVGPathElement>(`path.pulse[data-stage="${s}"]${ribSel}`)];
      if (pulses.length) {
        const stops = pulses.map((p) => [...el.querySelectorAll<SVGStopElement>(`#${p.dataset.grad} stop`)]);
        const o = { p: -0.3 };
        t.to(o, {
          p: 1.3, duration: fast ? 0.35 : 0.6, ease: "power1.in",
          onUpdate: () => stops.forEach((ss) => {
            ss[0]?.setAttribute("offset", String(clamp(o.p - 0.2)));
            ss[1]?.setAttribute("offset", String(clamp(o.p)));
            ss[2]?.setAttribute("offset", String(clamp(o.p + 0.2)));
          }),
        }, at);
      }
    }
    tl.current = t;
  }, [T, lastStage, reduced]);

  // full flow on first load; afterwards only the new letter's path (their isNextTokenOnly)
  const first = useRef(true);
  const sig = labels.join("");
  useEffect(() => {
    if (!T) return;
    play(!first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, L]);
  const lastTick = useRef(replayTick);
  useEffect(() => {
    if (replayTick !== lastTick.current) { lastTick.current = replayTick; play(false); }
  }, [replayTick, play]);
  useEffect(() => () => { tl.current?.kill(); }, []);

  /* ---- expand in place ---- */
  const flipId = (e: NonNullable<Expand>) => `${e.kind}-${e.layer}`;
  const open = (e: NonNullable<Expand>) => {
    if (expanded && flipId(expanded) === flipId(e)) return setExpanded(null);
    const src = root.current?.querySelector(`[data-flip-id="${flipId(e)}"]`);
    flipState.current = src && !reduced ? Flip.getState(src) : null;
    setExpanded(e);
  };
  useLayoutEffect(() => {
    if (!expanded || !panel.current) { setMinH(0); return; }
    setMinH(panel.current.offsetHeight + 24);
    if (flipState.current) {
      Flip.from(flipState.current, { targets: panel.current, duration: 0.5, ease: "power2.inOut", absolute: true });
      if (body.current) gsap.fromTo(body.current, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.35 });
      flipState.current = null;
    }
  }, [expanded]);
  useEffect(() => {
    const p = panel.current;
    if (!p) return;
    const ro = new ResizeObserver(() => setMinH(p.offsetHeight + 24));
    ro.observe(p);
    return () => ro.disconnect();
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(null); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [expanded, setExpanded]);

  /* ---- data ---- */
  const last = rows[T - 1];
  const probs = useMemo(() => {
    if (!last) return [];
    const mx = Math.max(...last.logits);
    const e = last.logits.map((l) => Math.exp((l - mx) / temp));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((v, i) => ({ i, p: v / z })).sort((a, b) => b.p - a.p).slice(0, 5);
  }, [last, temp]);

  if (!T) return null;
  const isSel = (kind: NonNullable<Expand>["kind"], layer = 0) => expanded?.kind === kind && expanded.layer === layer;
  const headNav = (
    <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Previous head" className="rounded p-0.5 hover:text-foreground disabled:opacity-30"
        disabled={hd === 0} onClick={() => setHead(hd - 1)}><ChevronLeft className="size-3.5" /></button>
      head {hd + 1} of {arch.nHead}
      <button type="button" aria-label="Next head" className="rounded p-0.5 hover:text-foreground disabled:opacity-30"
        disabled={hd >= arch.nHead - 1} onClick={() => setHead(hd + 1)}><ChevronRight className="size-3.5" /></button>
    </span>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <div ref={root} className="relative px-4 pb-4 pt-2" style={{ minWidth: 460 + L * 330, minHeight: minH || undefined }}>
        <svg ref={svg} className="pointer-events-none absolute left-0 top-0 z-0" aria-hidden />
        {band && <div aria-hidden className="pointer-events-none absolute inset-x-2 z-0 rounded-md bg-foreground/[0.06]" style={{ top: band.top, height: band.h }} />}

        <div className="relative z-10 flex items-start gap-6">
          {/* letters */}
          <div className={cn("flex flex-col items-end transition-opacity duration-300", zoneDim("input", "tok") && "opacity-25")}>
            <div className="h-9" /><div className="h-5" />
            {labels.map((l, i) => (
              <div key={i} data-stage={0} data-row={i} data-last={i === T - 1 ? "" : undefined} className="flex items-center" style={{ height: rowH }}
                onMouseEnter={() => setFlow({ hoverToken: i })} onMouseLeave={() => setFlow({ hoverToken: null })}>
                <button type="button" data-n="tok" onClick={() => setFocus(i)}
                  className={cn("rounded px-1.5 font-mono text-[15px] leading-tight", i === focus ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {l}
                </button>
              </div>
            ))}
          </div>

          <Block id="emb-0" kind="emb" title="Embedding" flex={0.45} sel={isSel("emb")} dim={zoneDim("tok", "pos", "sum")}
            onOpen={() => open({ kind: "emb", layer: 0 })}>
            <TileCol m={m} label="vector" hue={HUE.emb} name="emb" stage={1} vecs={rows.map((r) => r.x0)} scale={scale.norm}
              titleOf={(i) => `numbers for “${labels[i]}”`} />
          </Block>

          {Array.from({ length: L }, (_, l) => {
            const ly = rows.map((r) => r.layers[l]);
            const s = 2 + 3 * l;
            return (
              <div key={l} className="contents">
                <Block id={`attn-${l}`} kind="attn" title={`Attention${L > 1 ? ` ${l + 1}` : ""}`} extra={arch.nHead > 1 ? headNav : null}
                  flex={3} stack={Math.min(3, arch.nHead - 1)} sel={isSel("attn", l)} dim={zoneDim("attn", "detail")}
                  onOpen={() => open({ kind: "attn", layer: l })}>
                  <TileCol m={m} label="Q" hue={HUE.q} name={`q-${l}`} stage={s} vecs={ly.map((x) => x.q)} scale={scale.qkv} hl={hl} titleOf={(i) => `query of “${labels[i]}”: what it looks for`} />
                  <TileCol m={m} label="K" hue={HUE.k} name={`k-${l}`} stage={s} vecs={ly.map((x) => x.k)} scale={scale.qkv} hl={hl} titleOf={(i) => `key of “${labels[i]}”: what it offers`} />
                  <TileCol m={m} label="V" hue={HUE.v} name={`v-${l}`} stage={s} vecs={ly.map((x) => x.v)} scale={scale.qkv} hl={hl} titleOf={(i) => `value of “${labels[i]}”: what it shares`} />
                  <TileCol m={m} label="looks at" hue={HUE.attn} name={`w-${l}`} stage={s + 1} seq scale={1}
                    vecs={ly.map((x) => Array.from({ length: T }, (_, j) => x.heads[hd].weights[j] ?? 0))}
                    titleOf={(i) => `how much “${labels[i]}” looks at each earlier letter`} />
                  <TileCol m={m} label="out" hue={HUE.attn} name={`ao-${l}`} stage={s + 1} vecs={ly.map((x) => x.res1)} scale={scale.res}
                    titleOf={(i) => `“${labels[i]}” after attention`} />
                </Block>
                <Block id={`mlp-${l}`} kind="mlp" title={`MLP${L > 1 ? ` ${l + 1}` : ""}`} flex={1} sel={isSel("mlp", l)} dim={zoneDim("mlp", "detail")}
                  onOpen={() => open({ kind: "mlp", layer: l })}>
                  <TileCol m={m} label="neurons" hue={HUE.mlp} name={`ma-${l}`} stage={s + 2} seq vecs={ly.map((x) => x.mlpAct)} scale={scale.mlp}
                    titleOf={(i) => `${ly[i].mlpAct.filter((a) => a > 0).length} of ${ly[i].mlpAct.length} neurons fire for “${labels[i]}”`} />
                  <TileCol m={m} label="out" hue={HUE.mlp} name={`mo-${l}`} stage={s + 2} vecs={ly.map((x) => x.res2)} scale={scale.res}
                    titleOf={(i) => `“${labels[i]}” after the MLP`} />
                </Block>
              </div>
            );
          })}

          <Block id="out-0" kind="out" title="Output" flex={1.6} sel={isSel("out")} dim={zoneDim("out", "panel")}
            onOpen={() => open({ kind: "out", layer: 0 })}>
            <TileCol m={m} label="scores" hue={HUE.out} name="logit" stage={2 + 3 * L} vecs={rows.map((r) => r.logits)} scale={scale.logit}
              titleOf={(i) => `a score for every possible letter after “${labels[i]}”`} />
            <div data-stage={3 + 3 * L} data-n="probs" className="mt-5 min-w-0 flex-1 pl-2">
              <p className="mb-2 text-xs text-muted-foreground">Next after “{labels[T - 1]}”</p>
              <ul className="space-y-1.5">
                {probs.map(({ i, p }, n) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className={cn("w-4 text-center font-mono text-sm", n === 0 && "font-bold")}>{vocabLabels[i]}</span>
                    <span className="h-2.5 flex-1 rounded-full bg-muted">
                      <span className="block h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${Math.max(2, p * 100)}%`, background: `color-mix(in oklab, var(${HUE.out}) ${n === 0 ? 100 : 55}%, var(--card))` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{(p * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </Block>
        </div>

        {/* expanded block: everything else dims, the block grows in place */}
        {expanded && (
          <>
            <div aria-hidden className="absolute inset-0 z-20 rounded-2xl bg-card/80 backdrop-blur-[2px]" onClick={() => setExpanded(null)} />
            <div ref={panel} id="zone-detail" data-flip-id={flipId(expanded)} role="dialog" aria-label={TITLES[expanded.kind]}
              className="absolute inset-x-3 top-2 z-30 overflow-hidden rounded-xl border bg-card shadow-xl"
              style={{ "--hue": `var(${expanded.kind === "emb" ? HUE.emb : expanded.kind === "attn" ? HUE.attn : expanded.kind === "mlp" ? HUE.mlp : HUE.out})` } as CSSProperties}>
              <div className="flex items-center gap-2 border-b bg-[color-mix(in_oklab,var(--hue)_8%,var(--card))] px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-[var(--hue)]" />
                <h3 className="text-sm font-semibold">{TITLES[expanded.kind]}{L > 1 && (expanded.kind === "attn" || expanded.kind === "mlp") ? ` · layer ${expanded.layer + 1}` : ""}</h3>
                <button type="button" onClick={() => setExpanded(null)} aria-label="Close"
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
              </div>
              <div ref={body} className="max-h-[75vh] overflow-auto p-4">{detail}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

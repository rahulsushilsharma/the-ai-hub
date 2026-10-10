import { Button } from "@/components/ui/button";
import { useFlow } from "@/lib/microgpt/flowStore";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Lesson } from "./lessons";
import type { ArchCfg } from "./viz";

/* Non-modal reading panel (Transformer Explainer's "textbook"): the map stays visible and
   lights up the part being explained. Page state lives in Explainer (`tour`). */

export default function Textbook({ tour, setTour, lessons, arch, onGoTrain }: {
  tour: number | null; setTour: (n: number | null) => void; lessons: Lesson[]; arch: ArchCfg; onGoTrain: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const replay = useFlow((s) => s.replay);
  const isOpen = tour != null;

  useEffect(() => {
    const el = panel.current;
    if (!el || !isOpen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "transform" });
    return () => { a.kill(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTour(null);
      else if (e.key === "ArrowRight" && tour! < lessons.length - 1) setTour(tour! + 1);
      else if (e.key === "ArrowLeft" && tour! > 0) setTour(tour! - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [isOpen, tour, lessons.length, setTour]);

  if (tour == null) return null;
  const l = lessons[tour];
  const lastPage = tour === lessons.length - 1;

  return (
    <aside ref={panel} aria-label="Textbook"
      className="fixed inset-x-2 bottom-2 z-40 flex max-h-[60vh] flex-col rounded-xl border bg-card/95 shadow-2xl backdrop-blur md:inset-x-auto md:bottom-4 md:right-4 md:max-h-[calc(100vh-7rem)] md:w-[22rem]">
      <header className="flex items-start gap-2 border-b p-3">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">Page {tour + 1} of {lessons.length}</p>
          <h3 className="text-base font-semibold leading-snug">{l.title}</h3>
        </div>
        <Button size="icon" variant="ghost" className="size-7" onClick={() => setTour(null)} aria-label="Close textbook"><X /></Button>
      </header>

      <div className="overflow-y-auto p-3 text-sm leading-relaxed text-muted-foreground">{l.body(arch)}</div>

      <nav className="flex flex-wrap items-center gap-1.5 border-t p-3" aria-label="Pages">
        <Button size="sm" variant="outline" disabled={tour === 0} onClick={() => setTour(tour - 1)}><ChevronLeft /> Back</Button>
        {lastPage ? (
          <Button size="sm" onClick={() => { setTour(null); onGoTrain(); }}>Train it</Button>
        ) : (
          <Button size="sm" onClick={() => setTour(tour + 1)}>Next <ChevronRight /></Button>
        )}
        <Button size="sm" variant="ghost" onClick={replay} aria-label="Replay flow"><RotateCcw /></Button>
        <div className="ml-auto flex gap-1">
          {lessons.map((x, i) => (
            <button key={x.title} type="button" onClick={() => setTour(i)} aria-label={x.title} aria-current={i === tour}
              className={cn("size-2 rounded-full transition-colors", i === tour ? "bg-primary" : "bg-muted-foreground/30 hover:bg-primary/60")} />
          ))}
        </div>
      </nav>
    </aside>
  );
}

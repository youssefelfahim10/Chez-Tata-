"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { HelpCard } from "@/components/help/help-card";
import { readSeen, subscribeSeen, writeSeen } from "@/lib/help/seen";
import { helpFor } from "@/lib/help/topics";
import { TOURS, type TourId } from "@/lib/help/tours";

type Box = { top: number; left: number; width: number; height: number };

/**
 * Visite guidée : l'écran s'assombrit, l'élément expliqué reste éclairé, et une carte dit à quoi il sert.
 * Si l'élément n'est pas à l'écran, l'explication s'affiche quand même.
 */
export function TourLauncher({ tour, offer = false }: { tour: TourId; offer?: boolean }) {
  const seen = useSyncExternalStore(subscribeSeen, () => readSeen(tour), () => "done" as const);
  const [running, setRunning] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const info = TOURS[tour];

  const close = useCallback(() => {
    writeSeen(tour, "done");
    setRunning(false);
    trigger.current?.focus();
  }, [tour]);

  return (
    <>
      {offer && seen === "new" && !running ? (
        <div className="rounded-card border border-sun/60 bg-sun-soft p-4">
          <p className="text-base font-bold">👋 Première fois ici ?</p>
          <p className="mt-1 text-base text-ink-soft">{info.intro} La visite guidée explique chaque bouton, pas à pas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" ref={trigger} onClick={() => setRunning(true)} className="inline-flex min-h-12 items-center rounded-xl bg-gradient-to-b from-primary to-primary-strong px-5 font-extrabold text-white">
              🧭 Commencer la visite
            </button>
            <button type="button" onClick={() => writeSeen(tour, "later")} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-bold">
              Plus tard
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          ref={trigger}
          onClick={() => setRunning(true)}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-sun bg-sun-soft px-4 text-sm font-bold text-gold-deep transition hover:brightness-95"
        >
          <span aria-hidden>🧭</span> Visite guidée
        </button>
      )}
      {running ? <TourOverlay tour={tour} onClose={close} /> : null}
    </>
  );
}

function TourOverlay({ tour, onClose }: { tour: TourId; onClose: () => void }) {
  const { title, steps } = TOURS[tour];
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [edge, setEdge] = useState<{ top: number; bottom: number } | null>(null);
  const titleId = useId();
  const next = useRef<HTMLButtonElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Suit l'élément expliqué (défilement, rotation de l'écran) et l'amène au centre.
  useEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    const read = (): Box | null => {
      if (!el || !el.isConnected) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
    };
    // Un élément caché dans un bloc replié : on déplie le bloc pour pouvoir l'éclairer.
    for (let d = el?.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
    const first = read();
    if (el && first) {
      // L'élément remonte en haut de l'écran (sous l'en-tête) : la carte d'explication prend le bas sans le cacher.
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, window.scrollY + first.top - 88), behavior: reduced ? "auto" : "smooth" });
    }
    let alive = true;
    let frame = 0;
    let ticks = 0;
    const readCard = () => {
      const c = card.current?.getBoundingClientRect();
      return c ? { top: c.top, bottom: c.bottom } : null;
    };
    const tick = () => {
      if (!alive) return;
      setBox(read());
      setEdge(readCard());
      ticks += 1;
      if (ticks < 50) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onMove = () => {
      if (!alive) return;
      setBox(read());
      setEdge(readCard());
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [step]);

  useEffect(() => {
    next.current?.focus();
  }, [index]);

  const goNext = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") goNext();
      else if (event.key === "ArrowLeft") goBack();
      else if (event.key === "Tab" && card.current) {
        const items = [...card.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (items.length === 0) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (event.shiftKey && document.activeElement === a) {
          event.preventDefault();
          z.focus();
        } else if (!event.shiftKey && document.activeElement === z) {
          event.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goNext, goBack, onClose]);

  // La carte se place à l'opposé de l'élément éclairé pour ne jamais le cacher.
  const atTop = box ? box.top > window.innerHeight * 0.5 : false;
  const pad = 8;
  // Une grande section dépasserait sous (ou sur) la carte : on n'éclaire que la partie visible.
  let spot: Box | null = null;
  if (box) {
    let top = box.top - pad;
    let bottom = box.top + box.height + pad;
    if (edge) {
      if (atTop) top = Math.max(top, edge.bottom + 8);
      else bottom = Math.min(bottom, edge.top - 8);
    }
    spot = { top, left: box.left - pad, width: box.width + pad * 2, height: Math.max(56, bottom - top) };
  }

  return createPortal(
    <div data-tour-overlay className="fixed inset-0 z-[90]" aria-live="polite">
      <div className={`absolute inset-0 ${box ? "" : "bg-ink/65"}`} />
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-4 ring-sun shadow-[0_0_0_9999px_rgba(15,31,61,0.66)] transition-[top,left,width,height] duration-300"
          style={spot}
        />
      ) : null}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`d-in fixed inset-x-3 mx-auto max-h-[62dvh] max-w-md overflow-y-auto rounded-3xl bg-surface p-4 shadow-2xl ${atTop ? "top-3" : "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"}`}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-deep">
            {title.replace(/^Visite (de l’écran |des |du |de la )?/i, "")} · {index + 1}/{steps.length}
          </p>
          <button type="button" onClick={onClose} className="-mr-2 min-h-11 rounded-lg px-3 text-sm font-bold text-ink-soft">
            Quitter ✕
          </button>
        </div>
        <div aria-hidden className="mb-3 flex gap-1">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-sun" : "bg-line"}`} />
          ))}
        </div>
        <HelpCard key={index} topic={helpFor(step.topic)} titleId={titleId} compact />
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={goBack} disabled={index === 0} className="min-h-12 rounded-2xl border border-line bg-surface px-5 text-base font-bold disabled:opacity-35">
            ←<span className="sr-only"> Précédent</span>
          </button>
          <button
            type="button"
            ref={next}
            onClick={goNext}
            className="min-h-12 rounded-2xl bg-gradient-to-b from-primary to-primary-strong px-5 text-lg font-extrabold text-white"
          >
            {last ? "Terminer ✓" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCard } from "@/components/help/help-card";
import { helpFor, type HelpId } from "@/lib/help/topics";

/**
 * Le petit « ? » à côté d'une case ou d'un titre : il ouvre une explication courte, en grand, avec lecture à voix haute.
 * Zone tactile de 44 px (la pastille fait 28 px, le reste est invisible).
 */
export function HelpButton({ topic, className = "" }: { topic: HelpId; className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const info = helpFor(topic);
  // Placé en absolu par le parent (à droite d'un libellé) ou, sinon, dans le flux.
  const position = /\babsolute\b/.test(className) ? "" : "relative";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Aide : ${info.title}`}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`${position} inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-sun bg-sun-soft font-display text-base font-bold leading-none text-gold-deep shadow-sm transition active:scale-90 before:absolute before:-inset-2 before:content-[''] ${className}`}
      >
        ?
      </button>
      {open ? (
        <HelpSheet
          topic={topic}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

function HelpSheet({ topic, onClose }: { topic: HelpId; onClose: () => void }) {
  const titleId = useId();
  const done = useRef<HTMLButtonElement | null>(null);
  const sheet = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    done.current?.focus();
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab" && sheet.current) {
        const items = [...sheet.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/55 sm:items-center" onClick={onClose}>
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="d-in max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl sm:rounded-3xl sm:pb-6"
      >
        <HelpCard topic={helpFor(topic)} titleId={titleId} />
        <button
          ref={done}
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-primary to-primary-strong text-lg font-extrabold text-white"
        >
          J’ai compris
        </button>
      </div>
    </div>,
    document.body,
  );
}

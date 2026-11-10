"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { recordEvent, undoEvent, type RecordResult } from "@/app/actions/journal";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import type { ChildDay, QuickEventType } from "@/lib/journal/day";

export type TodayChild = {
  id: string;
  firstName: string;
  day: ChildDay;
  arrivalLabel: string | null;
  departureLabel: string | null;
  presenceLabel: string | null;
  napSinceLabel: string | null;
};

type ActionType = QuickEventType | "nap_end";

const LABELS: Record<ActionType, { label: string; done: string; icon: string }> = {
  arrival: { label: "Arrivée", done: "Arrivée enregistrée", icon: "👋" },
  departure: { label: "Départ", done: "Départ enregistré", icon: "🏠" },
  meal: { label: "Repas", done: "Repas enregistré", icon: "🍽️" },
  nap: { label: "Sieste", done: "Début de sieste enregistré", icon: "😴" },
  nap_end: { label: "Réveil", done: "Fin de sieste enregistrée", icon: "🌤️" },
  diaper: { label: "Change", done: "Change enregistré", icon: "🧷" },
  care: { label: "Soins", done: "Soin enregistré", icon: "🩹" },
};

const STATUS: Record<ChildDay["status"], { text: string; className: string }> = {
  expected: { text: "Pas encore arrivé", className: "bg-sun-soft text-ink" },
  present: { text: "Présent", className: "bg-leaf-soft text-leaf" },
  gone: { text: "Parti", className: "bg-sky-soft text-ink" },
};

type Toast = { text: string; undo?: Extract<RecordResult, { ok: true }>["undo"]; error?: boolean };

export function TodayBoard({ items }: { items: TodayChild[] }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function show(next: Toast) {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 8000);
  }

  function act(child: TodayChild, type: ActionType) {
    const key = `${child.id}:${type}`;
    if (busy) return;
    setBusy(key);
    const operationId = crypto.randomUUID();
    startTransition(async () => {
      const result = await recordEvent({
        childId: child.id,
        type,
        operationId,
        napId: type === "nap_end" ? (child.day.openNapId ?? undefined) : undefined,
      });
      setBusy(null);
      if (result.ok) show({ text: `${LABELS[type].done} pour ${child.firstName}`, undo: result.undo });
      else show({ text: result.error, error: true });
    });
  }

  function undo() {
    const target = toast?.undo;
    if (!target) return;
    startTransition(async () => {
      const result = await undoEvent(target);
      show(result.ok ? { text: "Action annulée" } : { text: "Annulation impossible", error: true });
    });
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {items.map((child) => {
          const { day } = child;
          const napping = Boolean(day.openNapId);
          const actions: ActionType[] = [
            "arrival",
            "departure",
            "meal",
            napping ? "nap_end" : "nap",
            "diaper",
            "care",
          ];
          const disabled = (type: ActionType) =>
            (type === "arrival" && day.status === "present") ||
            (type === "departure" && day.status !== "present") ||
            busy !== null;
          const counts: [string, number][] = [
            ["repas", day.counts.meal],
            ["sieste", day.counts.nap],
            ["change", day.counts.diaper],
            ["soin", day.counts.care],
          ];
          const summary = counts.filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}${n > 1 ? "s" : ""}`);

          return (
            <li key={child.id} className="rounded-card border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sun text-2xl font-extrabold text-ink"
                >
                  {child.firstName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-extrabold">{child.firstName}</h2>
                  <p className="text-sm text-ink-soft">
                    {day.status === "expected"
                      ? "Aucune arrivée saisie"
                      : [
                          child.arrivalLabel && `Arrivée ${child.arrivalLabel}`,
                          child.departureLabel && `Départ ${child.departureLabel}`,
                          child.presenceLabel,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS[day.status].className}`}>
                  {napping ? "Sieste" : STATUS[day.status].text}
                </span>
              </div>

              {napping || summary.length > 0 ? (
                <p className="mt-3 text-sm text-ink-soft">
                  {[napping && `Dort depuis ${child.napSinceLabel}`, ...summary].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2">
                {actions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => act(child, type)}
                    disabled={disabled(type)}
                    aria-label={`${LABELS[type].label} — ${child.firstName}`}
                    className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border text-sm font-bold transition active:scale-95 disabled:opacity-40 ${
                      type === "nap_end" ? "border-leaf bg-leaf-soft text-leaf" : "border-line bg-cream text-ink"
                    } ${busy === `${child.id}:${type}` ? "animate-pulse" : ""}`}
                  >
                    <span aria-hidden className="text-2xl">
                      {LABELS[type].icon}
                    </span>
                    {LABELS[type].label}
                  </button>
                ))}
              </div>

              {day.status !== "expected" || summary.length > 0 ? (
                <Link
                  href={`/aujourdhui/bilan/${child.id}`}
                  className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-base font-extrabold text-[#06301a]"
                >
                  <WhatsAppIcon className="size-6 text-white" />
                  Bilan du jour sur WhatsApp
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        {toast ? (
          <div
            className={`pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-bold text-white shadow-lg ${
              toast.error ? "bg-danger" : "bg-ink"
            }`}
          >
            <span className="py-2">{toast.error ? toast.text : `✓ ${toast.text}`}</span>
            {toast.undo ? (
              <button type="button" onClick={undo} className="min-h-11 rounded-xl bg-white/15 px-4 font-extrabold text-sun">
                Annuler
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

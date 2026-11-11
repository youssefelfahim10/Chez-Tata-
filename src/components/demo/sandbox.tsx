"use client";

import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { applyAction, demoBilan, DEMO_EMERGENCY, DEMO_KIDS } from "@/lib/demo/sandbox";
import { formatDuration, formatTime, summarizeChildDay, type JournalEvent } from "@/lib/journal/day";
import { LABELS, type ActionType } from "@/lib/journal/labels";

/** Mode « essayez vous-même » : les vrais gestes de l'application sur deux enfants fictifs, en mémoire. */

const ICONS: Record<ActionType, IconName> = {
  arrival: "login",
  departure: "logout",
  meal: "utensils",
  nap: "moon",
  nap_end: "sun",
  diaper: "droplet",
  care: "plus",
};

type View = { name: "home" } | { name: "bilan" | "urgence"; childId: string };
type Toast = { text: string; error?: boolean };

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 min-h-11 text-xs font-bold text-primary underline">
      ← Retour
    </button>
  );
}

export function Sandbox({ onTouched }: { onTouched?: () => void }) {
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [view, setView] = useState<View>({ name: "home" });
  const [toast, setToast] = useState<Toast | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(next: Toast) {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 3500);
  }

  function act(childId: string, action: ActionType) {
    const result = applyAction(events, childId, action, new Date());
    setEvents(result.events);
    say({ text: result.message, error: result.error });
    if (!result.error) onTouched?.();
  }

  const now = new Date();

  return (
    <div className="relative h-full overflow-y-auto px-3 pb-16">
      {view.name === "home" ? (
        <>
          <p className="px-1 pb-2 font-display text-2xl font-semibold leading-tight">Bonjour TaTa !</p>
          <ul className="flex flex-col gap-3">
            {DEMO_KIDS.map((kid) => {
              const mine = events.filter((e) => e.child_id === kid.id);
              const day = summarizeChildDay(mine, now);
              const napping = Boolean(day.openNapId);
              const actions: ActionType[] = ["arrival", "departure", "meal", napping ? "nap_end" : "nap", "diaper", "care"];
              const status = day.status === "present" ? ["Présent", "bg-leaf-soft text-leaf"] : day.status === "gone" ? ["Parti", "bg-primary-soft text-primary"] : ["Pas encore arrivé", "bg-sun-soft text-gold-deep"];
              const counts = [["repas", day.counts.meal], ["sieste", day.counts.nap], ["change", day.counts.diaper], ["soin", day.counts.care]] as const;
              const summary = counts.filter(([, n]) => n > 0).map(([l, n]) => `${l}${n > 1 ? "s" : ""} ×${n}`);
              return (
                <li key={kid.id} className="rounded-2xl border border-line bg-surface p-3 shadow-luxe">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-semibold text-primary">{kid.firstName[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-none">{kid.firstName}</p>
                      <p className="mt-1 text-[10px] text-ink-soft">
                        {day.status === "expected"
                          ? "Aucune arrivée saisie"
                          : [day.arrivalAt && `Arrivée ${formatTime(day.arrivalAt)}`, day.departureAt && `Départ ${formatTime(day.departureAt)}`, formatDuration(day.presenceMs)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${status[1]}`}>{napping ? "Sieste" : status[0]}</span>
                  </div>
                  {summary.length > 0 ? <p className="mt-2 text-[10px] text-ink-soft">{summary.join(" · ")}</p> : null}
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {actions.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => act(kid.id, type)}
                        aria-label={`${LABELS[type].label} — ${kid.firstName}`}
                        className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-cream text-[11px] font-bold text-primary transition active:scale-95"
                      >
                        <Icon name={ICONS[type]} className="size-5" />
                        {LABELS[type].label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                    <button type="button" onClick={() => { setReviewed(false); setView({ name: "bilan", childId: kid.id }); }} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-[#06301a]">
                      <WhatsAppIcon className="size-4 text-white" /> Bilan
                    </button>
                    <button type="button" onClick={() => setView({ name: "urgence", childId: kid.id })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-danger/40 text-danger">
                      <Icon name="alert" className="size-4" /> Urgence
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {view.name === "bilan" ? (
        (() => {
          const bilan = demoBilan(view.childId, events, now);
          return (
            <div>
              <Back onClick={() => setView({ name: "home" })} />
              {bilan.hasContent ? (
                <>
                  <p className="mb-1 text-[11px] font-bold">Message (modifiable dans l’application)</p>
                  <pre className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#dcf8c6] p-3 font-sans text-[11px] leading-relaxed text-[#0b2a14]">{bilan.text}</pre>
                  <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-leaf-soft px-3 text-xs font-bold">
                    <input type="checkbox" className="size-5 accent-primary" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                    J’ai relu ce message
                  </label>
                  <button type="button" disabled={!reviewed} onClick={() => say({ text: "Démo : rien n’est envoyé. Dans l’application, WhatsApp s’ouvre et vous envoyez vous-même." })} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-xs font-extrabold text-[#06301a] disabled:opacity-50">
                    <WhatsAppIcon className="size-5 text-white" /> Partager sur WhatsApp
                  </button>
                </>
              ) : (
                <p className="rounded-xl bg-sun-soft px-3 py-3 text-xs">Aucun geste enregistré aujourd’hui : il n’y a rien à partager. Revenez en arrière et touchez « Arrivée » ou « Repas ».</p>
              )}
            </div>
          );
        })()
      ) : null}

      {view.name === "urgence" ? (
        (() => {
          const info = DEMO_EMERGENCY[view.childId as keyof typeof DEMO_EMERGENCY];
          const name = DEMO_KIDS.find((k) => k.id === view.childId)?.firstName;
          const fake = () => say({ text: "Démo : aucun appel n’est lancé. Dans l’application, ces boutons composent le numéro." });
          return (
            <div>
              <Back onClick={() => setView({ name: "home" })} />
              <p className="font-display text-2xl font-semibold">Urgence · {name}</p>
              <div className="mt-2 rounded-2xl border border-danger/30 bg-pink-soft p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-danger"><Icon name="alert" className="size-4" /> Danger vital : appelez sans attendre</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[["15", "SAMU"], ["112", "Européen"], ["18", "Pompiers"]].map(([n, l]) => (
                    <button key={n} type="button" onClick={fake} className="flex h-14 flex-col items-center justify-center rounded-xl bg-danger text-white">
                      <span className="text-lg font-extrabold leading-none">{n}</span>
                      <span className="text-[9px] font-semibold">{l}</span>
                    </button>
                  ))}
                </div>
              </div>
              <dl className="mt-2 flex flex-col gap-2 text-xs">
                <div className="rounded-xl bg-pink-soft px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Allergies</dt><dd className="font-bold">{info.allergies}</dd></div>
                <div className="rounded-xl bg-cream px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Traitement</dt><dd className="font-bold">{info.medication}</dd></div>
                <div className="rounded-xl border border-line bg-surface px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Médecin</dt><dd className="font-bold">{info.doctor.name} · {info.doctor.phone}</dd></div>
                {info.parents.map((p) => (
                  <div key={p.name} className="rounded-xl border border-line bg-surface px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Parent</dt><dd className="font-bold">{p.name} ({p.relation}) · {p.phone}</dd></div>
                ))}
                {info.pickups.length ? info.pickups.map((p) => (
                  <div key={p.name} className="rounded-xl border border-line bg-surface px-3 py-2"><dt className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Autorisé à récupérer</dt><dd className="font-bold">{p.name} ({p.relation})</dd></div>
                )) : null}
              </dl>
            </div>
          );
        })()
      ) : null}

      <div aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
        {toast ? (
          <p className={`d-in rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white shadow-lg ${toast.error ? "bg-danger" : "bg-ink"}`}>{toast.text}</p>
        ) : null}
      </div>
    </div>
  );
}

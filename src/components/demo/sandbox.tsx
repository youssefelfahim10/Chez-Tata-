"use client";

import { useRef, useState } from "react";
import { ChildAvatar } from "@/components/child-avatar";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { applyAction, demoBilan, DEMO_EMERGENCY, DEMO_KIDS } from "@/lib/demo/sandbox";
import { formatDuration, formatLongDate, formatTime, summarizeChildDay, type ChildDay, type JournalEvent } from "@/lib/journal/day";
import { ACTION_EMOJI, ACTION_TONE, LABELS, type ActionType } from "@/lib/journal/labels";
import { buildTimeline } from "@/lib/journal/timeline";
import { TONES } from "@/lib/ui/tones";

/**
 * Mode « essayez vous-même » : même présentation que l'écran « Aujourd'hui » de l'application
 * (mêmes tailles, mêmes boutons, même frise « Journée de … »), sur deux enfants fictifs, en mémoire.
 * Rien n'est envoyé ni enregistré.
 */

type View = { name: "home" } | { name: "bilan" | "urgence"; childId: string };
type Toast = { text: string; error?: boolean };
type Feedback = { childId: string; text: string; error?: boolean; undo?: () => void; undoLabel?: string };

const STATUS: Record<ChildDay["status"], { text: string; className: string }> = {
  expected: { text: "Pas encore arrivé", className: "bg-sun-soft text-gold-deep" },
  present: { text: "Présent", className: "bg-leaf-soft text-leaf" },
  gone: { text: "Parti", className: "bg-primary-soft text-primary" },
};

const TABS = [
  { label: "Aujourd'hui", icon: "☀️", active: true },
  { label: "Planning", icon: "📅" },
  { label: "Gestion", icon: "📒" },
  { label: "Profil", icon: "👤" },
] as const;

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 min-h-11 text-sm font-bold text-primary underline">
      ← Retour
    </button>
  );
}

export function Sandbox({ onTouched }: { onTouched?: () => void }) {
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [archived, setArchived] = useState<JournalEvent[]>([]);
  const [view, setView] = useState<View>({ name: "home" });
  const [toast, setToast] = useState<Toast | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(next: Toast) {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 3500);
  }

  function act(childId: string, action: ActionType) {
    const before = events;
    const result = applyAction(events, childId, action, new Date());
    if (result.error) return setFeedback({ childId, text: result.message, error: true });
    setEvents(result.events);
    onTouched?.();
    setFeedback({
      childId,
      text: LABELS[action].done,
      undo: () => {
        setEvents(before);
        setFeedback({ childId, text: "Action annulée" });
      },
    });
  }

  function cancelItem(childId: string, targetId: string, label: string, time: string) {
    const item = events.find((e) => e.id === targetId);
    if (!item) return;
    setEvents((list) => list.filter((e) => e.id !== targetId));
    setArchived((list) => [...list, item]);
    setFeedback({
      childId,
      text: `${label} de ${time} annulé`,
      undoLabel: "↩ Rétablir",
      undo: () => {
        setArchived((list) => list.filter((e) => e.id !== targetId));
        setEvents((list) => [...list, item]);
        setFeedback({ childId, text: `${label} de ${time} rétabli` });
      },
    });
  }

  function restoreItem(childId: string, targetId: string, label: string, time: string) {
    const item = archived.find((e) => e.id === targetId);
    if (!item) return;
    setArchived((list) => list.filter((e) => e.id !== targetId));
    setEvents((list) => [...list, item]);
    setFeedback({ childId, text: `${label} de ${time} rétabli` });
  }

  const now = new Date();
  const days = Object.fromEntries(DEMO_KIDS.map((kid) => [kid.id, summarizeChildDay(events.filter((e) => e.child_id === kid.id), now)])) as Record<string, ChildDay>;
  const present = DEMO_KIDS.filter((k) => days[k.id].status === "present").length;

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto px-4 pb-24 pt-2">
        {view.name === "home" ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="font-display text-4xl font-semibold tracking-tight text-ink">Bonjour TaTa !</p>
              <p className="text-base text-ink-soft first-letter:uppercase">{formatLongDate(now)}</p>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-stretch gap-3">
              <p className="rounded-card bg-leaf-soft px-5 py-4 text-lg font-extrabold text-leaf">
                {present === 0 ? "😴 Aucun enfant présent" : `👶 ${present} enfant${present > 1 ? "s" : ""} présent${present > 1 ? "s" : ""}`}
              </p>
              <button
                type="button"
                onClick={() => say({ text: "Démo : la dictée vocale utilise le micro du téléphone, dans l’application." })}
                className="flex min-w-20 flex-col items-center justify-center gap-0.5 rounded-card bg-primary px-4 text-sm font-extrabold text-white"
              >
                <span aria-hidden className="text-2xl">🎙️</span>
                Dicter
              </button>
            </div>

            <ul className="flex flex-col gap-5">
              {DEMO_KIDS.map((kid) => {
                const day = days[kid.id];
                const napping = Boolean(day.openNapId);
                const actions: ActionType[] = ["arrival", "departure", "meal", napping ? "nap_end" : "nap", "diaper", "care"];
                const disabled = (type: ActionType) => (type === "arrival" && day.status === "present") || (type === "departure" && day.status !== "present");
                const arrival = day.arrivalAt ? formatTime(day.arrivalAt) : null;
                const departure = day.departureAt ? formatTime(day.departureAt) : null;
                const timeline = buildTimeline(events.filter((e) => e.child_id === kid.id));
                const cancelled = buildTimeline(archived.filter((e) => e.child_id === kid.id));
                const mine = feedback && feedback.childId === kid.id ? feedback : null;
                const allergies = DEMO_EMERGENCY[kid.id as keyof typeof DEMO_EMERGENCY].allergies;
                const hasAllergy = !allergies.toLowerCase().startsWith("aucune");

                return (
                  <li key={kid.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-luxe">
                    <header className="flex items-center gap-3 p-4 pb-3">
                      <ChildAvatar name={kid.firstName} gender={kid.gender} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xl font-extrabold">{kid.firstName}</h2>
                        <p className="text-sm text-ink-soft">
                          {day.status === "expected" ? "Aucune arrivée saisie" : [arrival && `Arrivée ${arrival}`, departure && `Départ ${departure}`, formatDuration(day.presenceMs)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${napping ? TONES.dusk.chip : STATUS[day.status].className}`}>
                        {napping ? "😴 Sieste" : STATUS[day.status].text}
                      </span>
                    </header>

                    {hasAllergy ? (
                      <p className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-pink-soft px-3 py-2 text-sm font-bold text-danger">
                        <span aria-hidden>⚠️</span>
                        <span>Allergie : {allergies}</span>
                      </p>
                    ) : null}

                    <div className="grid grid-cols-3 gap-2 px-4">
                      {actions.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => act(kid.id, type)}
                          disabled={disabled(type)}
                          aria-label={`${LABELS[type].label} — ${kid.firstName}`}
                          className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-extrabold text-ink transition active:scale-95 disabled:opacity-35 ${TONES[ACTION_TONE[type]].box}`}
                        >
                          <span aria-hidden className="text-3xl">{ACTION_EMOJI[type]}</span>
                          {LABELS[type].label}
                        </button>
                      ))}
                    </div>

                    {mine ? (
                      <div role={mine.error ? "alert" : "status"} aria-live="polite" className={`mx-4 mt-3 rounded-2xl border p-3 ${mine.error ? "border-danger/30 bg-pink-soft text-danger" : "border-leaf/30 bg-leaf-soft"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-extrabold">{mine.error ? `⚠️ ${mine.text}` : `✓ ${mine.text}`}</p>
                          {mine.undo ? (
                            <button type="button" onClick={mine.undo} className="min-h-11 shrink-0 rounded-xl border border-ink/15 bg-surface px-4 text-sm font-extrabold text-primary">
                              {mine.undoLabel ?? "Annuler"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <section aria-label={`Journée de ${kid.firstName}`} className="mx-4 mt-4 rounded-2xl border border-line bg-cream p-3">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold-deep">Journée de {kid.firstName}</h3>
                      {timeline.length === 0 ? (
                        <p className="mt-2 text-sm text-ink-soft">Rien d’enregistré pour l’instant. Touchez un geste ci-dessus.</p>
                      ) : (
                        <ol className="mt-1">
                          {timeline.map((item) => (
                            <li key={item.id} className="border-t border-line py-2.5 first:border-t-0">
                              <div className="flex items-start gap-3">
                                <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-2xl ${TONES[ACTION_TONE[item.type]].box}`}>
                                  {ACTION_EMOJI[item.type]}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold">
                                    {item.label} <span className="font-semibold text-ink-soft">· {item.time}</span>
                                    {item.type === "nap" ? (
                                      <span className="font-semibold text-ink-soft">{item.open ? " → en cours" : item.endTime ? ` → ${item.endTime}${item.duration ? ` (${item.duration})` : ""}` : ""}</span>
                                    ) : null}
                                  </p>
                                  <div className="mt-1.5 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => say({ text: "Démo : dans l’application, vous corrigez ici l’heure et les précisions." })}
                                      aria-label={`Modifier ${item.label} de ${item.time} — ${kid.firstName}`}
                                      className="min-h-10 rounded-full border border-primary/30 bg-surface px-3 text-xs font-extrabold text-primary"
                                    >
                                      ✏️ Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelItem(kid.id, item.id, item.label, item.time)}
                                      aria-label={`Annuler ${item.label} de ${item.time} — ${kid.firstName}`}
                                      className="min-h-10 rounded-full border border-line bg-surface px-3 text-xs font-bold text-ink-soft"
                                    >
                                      ✕ Annuler
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                      {cancelled.length > 0 ? (
                        <details className="mt-2 rounded-xl border border-dashed border-line bg-surface/60">
                          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-bold text-ink-soft">🗂️ Annulés aujourd’hui ({cancelled.length}) · rien n’est perdu</summary>
                          <ul className="px-3 pb-2">
                            {cancelled.map((item) => (
                              <li key={item.id} className="flex items-center gap-3 border-t border-line py-2">
                                <span aria-hidden className="text-xl opacity-60">{ACTION_EMOJI[item.type]}</span>
                                <p className="min-w-0 flex-1 text-sm text-ink-soft line-through decoration-ink-soft/60">{item.label} · {item.time}</p>
                                <button
                                  type="button"
                                  onClick={() => restoreItem(kid.id, item.id, item.label, item.time)}
                                  aria-label={`Rétablir ${item.label} de ${item.time} — ${kid.firstName}`}
                                  className="min-h-11 shrink-0 rounded-xl border border-line bg-surface px-3 text-sm font-extrabold text-primary"
                                >
                                  ↩ Rétablir
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </section>

                    <div className="flex flex-col gap-2 p-4">
                      {timeline.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewed(false);
                            setView({ name: "bilan", childId: kid.id });
                          }}
                          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-base font-extrabold text-[#06301a]"
                        >
                          <WhatsAppIcon className="size-6 text-white" />
                          Bilan du jour sur WhatsApp
                        </button>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => say({ text: "Démo : dans l’application, vous choisissez un message type pour les parents." })}
                          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-primary"
                        >
                          <span aria-hidden>💬</span> Message
                        </button>
                        <button
                          type="button"
                          onClick={() => setView({ name: "urgence", childId: kid.id })}
                          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface px-3 text-sm font-bold text-danger"
                        >
                          <span aria-hidden>🚨</span> Urgence
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {view.name === "bilan" ? (
          (() => {
            const bilan = demoBilan(view.childId, events, now);
            return (
              <div>
                <Back onClick={() => setView({ name: "home" })} />
                {bilan.hasContent ? (
                  <>
                    <p className="mb-1 text-sm font-bold">Message (modifiable dans l’application)</p>
                    <pre className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#dcf8c6] p-3 font-sans text-sm leading-relaxed text-[#0b2a14]">{bilan.text}</pre>
                    <label className="mt-3 flex min-h-12 items-center gap-2 rounded-xl bg-leaf-soft px-3 text-sm font-bold">
                      <input type="checkbox" className="size-5 accent-primary" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                      J’ai relu ce message
                    </label>
                    <button
                      type="button"
                      disabled={!reviewed}
                      onClick={() => say({ text: "Démo : rien n’est envoyé. Dans l’application, WhatsApp s’ouvre et vous envoyez vous-même." })}
                      className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-extrabold text-[#06301a] disabled:opacity-50"
                    >
                      <WhatsAppIcon className="size-6 text-white" /> Partager sur WhatsApp
                    </button>
                  </>
                ) : (
                  <p className="rounded-xl bg-sun-soft px-3 py-3 text-sm">Aucun geste enregistré aujourd’hui : il n’y a rien à partager. Revenez en arrière et touchez « Arrivée » ou « Repas ».</p>
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
                <p className="font-display text-3xl font-semibold">Urgence · {name}</p>
                <div className="mt-3 rounded-2xl border border-danger/30 bg-pink-soft p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-danger"><span aria-hidden>🚨</span> Danger vital : appelez sans attendre</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[["15", "SAMU"], ["112", "Européen"], ["18", "Pompiers"]].map(([n, l]) => (
                      <button key={n} type="button" onClick={fake} className="flex min-h-16 flex-col items-center justify-center rounded-xl bg-danger text-white">
                        <span className="text-xl font-extrabold leading-none">{n}</span>
                        <span className="text-xs font-semibold">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="rounded-xl bg-pink-soft px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">Allergies</dt><dd className="font-bold">{info.allergies}</dd></div>
                  <div className="rounded-xl bg-cream px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">Traitement</dt><dd className="font-bold">{info.medication}</dd></div>
                  <div className="rounded-xl border border-line bg-surface px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">Médecin</dt><dd className="font-bold">{info.doctor.name} · {info.doctor.phone}</dd></div>
                  {info.parents.map((p) => (
                    <div key={p.name} className="rounded-xl border border-line bg-surface px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">Parent</dt><dd className="font-bold">{p.name} ({p.relation}) · {p.phone}</dd></div>
                  ))}
                  {info.pickups.length ? info.pickups.map((p) => (
                    <div key={p.name} className="rounded-xl border border-line bg-surface px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">Autorisé à récupérer</dt><dd className="font-bold">{p.name} ({p.relation})</dd></div>
                  )) : null}
                </dl>
              </div>
            );
          })()
        ) : null}
      </div>

      <div aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-20 z-30">
        {toast ? <p className={`d-in rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg ${toast.error ? "bg-danger" : "bg-ink"}`}>{toast.text}</p> : null}
      </div>

      {/* Même barre d'onglets que l'application (les autres onglets ne sont pas disponibles dans la démonstration). */}
      <nav aria-label="Navigation principale (démonstration)" className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {TABS.map((tab) => (
            <li key={tab.label}>
              <button
                type="button"
                aria-current={"active" in tab ? "page" : undefined}
                onClick={() => ("active" in tab ? setView({ name: "home" }) : say({ text: `Démo : l’onglet « ${tab.label} » est disponible dans l’application.` }))}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-bold ${"active" in tab ? "text-primary" : "text-ink-soft"}`}
              >
                <span aria-hidden className={`rounded-full px-4 py-0.5 text-xl ${"active" in tab ? "bg-sun-soft" : ""}`}>{tab.icon}</span>
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

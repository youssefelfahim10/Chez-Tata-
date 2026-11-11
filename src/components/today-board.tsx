"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncOperation } from "@/app/actions/sync";
import { useJournalSync, type SendFn } from "@/components/use-journal-sync";
import { VoicePanel, type VoiceRow } from "@/components/voice-panel";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { DETAILS, NOTE_MAX } from "@/lib/journal/details";
import {
  formatDuration,
  formatTime,
  parisDateKey,
  parisInstant,
  summarizeChildDay,
  type ChildDay,
  type JournalEvent,
} from "@/lib/journal/day";
import { ACTION_EMOJI, ACTION_TONE, LABELS, type ActionType } from "@/lib/journal/labels";
import { buildTimeline, type TimelineItem } from "@/lib/journal/timeline";
import { TONES } from "@/lib/ui/tones";
import { isPlausibleTime, type Op } from "@/lib/offline/ops";

export type BoardChild = { id: string; firstName: string; allergies?: string | null };

type Props = {
  userId: string;
  orgId: string;
  kids: BoardChild[];
  events: JournalEvent[];
  /** Heure du serveur au moment du rendu (évite un décalage à l'hydratation). */
  serverNow: string;
  send?: SendFn;
  onSynced?: () => void;
  forceOffline?: boolean;
};

const STATUS: Record<ChildDay["status"], { text: string; className: string }> = {
  expected: { text: "Pas encore arrivé", className: "bg-sun-soft text-gold-deep" },
  present: { text: "Présent", className: "bg-leaf-soft text-leaf" },
  gone: { text: "Parti", className: "bg-primary-soft text-primary" },
};

type DetailGroupName = "meal" | "diaper" | "care";
type Toast = {
  text: string;
  error?: boolean;
  /** Enfant concerné : le retour s'affiche alors dans SA carte (sinon en bas de l'écran). */
  childId?: string;
  undo?: Op;
  detail?: { group: DetailGroupName; targetId: string; childName: string; chosen?: string };
};

export function TodayBoard({ userId, orgId, kids, events: serverEvents, serverNow, send = syncOperation, onSynced, forceOffline }: Props) {
  const router = useRouter();
  const handleSynced = useCallback(() => (onSynced ? onSynced() : router.refresh()), [onSynced, router]);
  const { events, pending, online, syncing, problem, clearProblem, submit } = useJournalSync({
    userId,
    orgId,
    serverEvents,
    send,
    onSynced: handleSynced,
    forceOffline,
  });

  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [toast, setToast] = useState<Toast | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function show(next: Toast, ms = 10_000) {
    if (timer.current) clearTimeout(timer.current);
    setNoteOpen(false);
    setNote("");
    setToast(next);
    timer.current = setTimeout(() => setToast(null), ms);
  }

  const days = useMemo(() => {
    const byChild: Record<string, ChildDay> = {};
    for (const kid of kids) {
      byChild[kid.id] = summarizeChildDay(
        events.filter((e) => e.child_id === kid.id),
        now,
      );
    }
    return byChild;
  }, [kids, events, now]);

  /** Enregistre un geste (instantané à l'écran, envoyé dès que possible). */
  function perform(childId: string, action: ActionType, opts: { time?: string; details?: Record<string, string> } = {}): { error?: string; opId?: string; undo?: Op } {
    const kid = kids.find((k) => k.id === childId);
    const day = days[childId];
    if (!kid || !day) return { error: "Enfant introuvable." };
    let occurredAt = new Date().toISOString();
    if (opts.time) {
      occurredAt = parisInstantFor(serverNow, opts.time);
      if (!isPlausibleTime(occurredAt, new Date())) return { error: `${kid.firstName} : l’heure ${opts.time} est dans le futur ou trop ancienne.` };
    }
    const id = crypto.randomUUID();
    const offline = !online;
    if (action === "nap_end") {
      if (!day.openNapId) return { error: `${kid.firstName} n’a pas de sieste en cours.` };
      submit({ kind: "nap_end", id, childId, napId: day.openNapId, occurredAt, offline });
      return { opId: id, undo: { kind: "undo", id: crypto.randomUUID(), targetId: id, undo: "nap_end", napId: day.openNapId } };
    }
    submit({ kind: "create", id, childId, eventType: action, occurredAt, payload: opts.details, offline });
    return { opId: id, undo: { kind: "undo", id: crypto.randomUUID(), targetId: id, undo: "event" } };
  }

  function act(kid: BoardChild, action: ActionType) {
    const result = perform(kid.id, action);
    if (result.error) return show({ text: result.error, error: true, childId: kid.id });
    const group = action === "meal" || action === "diaper" || action === "care" ? action : null;
    show({
      text: `${LABELS[action].done}${online ? "" : " (hors ligne)"}`,
      childId: kid.id,
      undo: result.undo,
      detail: group && result.opId ? { group, targetId: result.opId, childName: kid.firstName } : undefined,
    });
  }

  function undo() {
    if (!toast?.undo) return;
    submit(toast.undo);
    show({ text: "Action annulée", childId: toast.childId }, 4000);
  }

  function choose(value: string) {
    if (!toast?.detail) return;
    const group = DETAILS[toast.detail.group];
    submit({ kind: "detail", id: crypto.randomUUID(), targetId: toast.detail.targetId, payload: { [group.key]: value } });
    const label = group.choices.find((c) => c.value === value)?.label ?? value;
    setToast({ ...toast, detail: { ...toast.detail, chosen: label } });
  }

  function saveNote() {
    if (!toast?.detail || !note.trim()) return;
    submit({ kind: "detail", id: crypto.randomUUID(), targetId: toast.detail.targetId, payload: { note: note.trim().slice(0, NOTE_MAX) } });
    show({ text: "Note ajoutée", childId: toast.childId }, 3000);
  }

  /** Annule un geste depuis la journée de l'enfant (même mécanique que « Annuler » juste après un geste). */
  function undoItem(kid: BoardChild, item: TimelineItem) {
    submit({ kind: "undo", id: crypto.randomUUID(), targetId: item.targetId, undo: "event" });
    show({ text: `${item.label} de ${item.time} annulé`, childId: kid.id }, 4000);
  }

  /** Ouvre le choix de précision pour un geste déjà enregistré. */
  function openDetail(kid: BoardChild, item: TimelineItem) {
    if (!item.canDetail) return;
    show({ text: `${item.label} · ${item.time}`, childId: kid.id, detail: { group: item.canDetail, targetId: item.targetId, childName: kid.firstName } });
  }

  function validateVoice(rows: VoiceRow[]): string[] {
    const problems: string[] = [];
    let done = 0;
    for (const row of rows) {
      const result = perform(row.childId, row.action as ActionType, { time: row.time || undefined, details: row.details });
      if (result.error) problems.push(result.error);
      else done += 1;
    }
    if (done > 0) show({ text: `${done} action${done > 1 ? "s" : ""} enregistrée${done > 1 ? "s" : ""} par la voix` }, 5000);
    return problems;
  }

  const present = kids.filter((k) => days[k.id]?.status === "present").length;

  return (
    <>
      <ConnectionBanner online={online} pending={pending} syncing={syncing} problem={problem} onDismiss={clearProblem} />

      <div className="grid grid-cols-[1fr_auto] items-stretch gap-3">
        <p className="rounded-card bg-leaf-soft px-5 py-4 text-lg font-extrabold text-leaf">
          {present === 0 ? "😴 Aucun enfant présent" : `👶 ${present} enfant${present > 1 ? "s" : ""} présent${present > 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={() => setVoiceOpen((v) => !v)}
          aria-expanded={voiceOpen}
          className="flex min-w-20 flex-col items-center justify-center gap-0.5 rounded-card bg-primary px-4 text-sm font-extrabold text-white"
        >
          <span aria-hidden className="text-2xl">
            🎙️
          </span>
          Dicter
        </button>
      </div>

      {voiceOpen ? (
        <>
          <div aria-hidden className="fixed inset-0 z-40 bg-ink/40" onClick={() => setVoiceOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-cream px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-2xl">
            <VoicePanel kids={kids} onValidate={validateVoice} onClose={() => setVoiceOpen(false)} />
          </div>
        </>
      ) : null}

      <ul className="flex flex-col gap-5">
        {kids.map((kid) => {
          const day = days[kid.id];
          const napping = Boolean(day.openNapId);
          const actions: ActionType[] = ["arrival", "departure", "meal", napping ? "nap_end" : "nap", "diaper", "care"];
          const disabled = (type: ActionType) => (type === "arrival" && day.status === "present") || (type === "departure" && day.status !== "present");
          const arrival = day.arrivalAt ? formatTime(day.arrivalAt) : null;
          const departure = day.departureAt ? formatTime(day.departureAt) : null;
          const timeline = buildTimeline(events.filter((e) => e.child_id === kid.id));
          const feedback = toast && toast.childId === kid.id ? toast : null;
          const feedbackGroup = feedback?.detail ? DETAILS[feedback.detail.group] : null;

          return (
            <li key={kid.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-luxe">
              <header className="flex items-center gap-3 p-4 pb-3">
                <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sun text-2xl font-extrabold text-ink">
                  {kid.firstName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-extrabold">{kid.firstName}</h2>
                  <p className="text-sm text-ink-soft">
                    {day.status === "expected"
                      ? "Aucune arrivée saisie"
                      : [arrival && `Arrivée ${arrival}`, departure && `Départ ${departure}`, formatDuration(day.presenceMs)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${napping ? TONES.dusk.chip : STATUS[day.status].className}`}>
                  {napping ? "😴 Sieste" : STATUS[day.status].text}
                </span>
              </header>

              {kid.allergies ? (
                <p className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-pink-soft px-3 py-2 text-sm font-bold text-danger">
                  <span aria-hidden>⚠️</span>
                  <span>Allergie : {kid.allergies}</span>
                </p>
              ) : null}

              <div className="grid grid-cols-3 gap-2 px-4">
                {actions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => act(kid, type)}
                    disabled={disabled(type)}
                    aria-label={`${LABELS[type].label} — ${kid.firstName}`}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-extrabold text-ink transition active:scale-95 disabled:opacity-35 ${TONES[ACTION_TONE[type]].box}`}
                  >
                    <span aria-hidden className="text-3xl">
                      {ACTION_EMOJI[type]}
                    </span>
                    {LABELS[type].label}
                  </button>
                ))}
              </div>

              {feedback ? (
                <div
                  role={feedback.error ? "alert" : "status"}
                  aria-live="polite"
                  className={`mx-4 mt-3 rounded-2xl border p-3 ${feedback.error ? "border-danger/30 bg-pink-soft text-danger" : "border-leaf/30 bg-leaf-soft"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold">{feedback.error ? `⚠️ ${feedback.text}` : `✓ ${feedback.text}`}</p>
                    {feedback.undo ? (
                      <button type="button" onClick={undo} className="min-h-11 shrink-0 rounded-xl border border-ink/15 bg-surface px-4 text-sm font-extrabold text-primary">
                        Annuler
                      </button>
                    ) : null}
                  </div>
                  {feedbackGroup && feedback.detail ? (
                    <div className="mt-2 border-t border-leaf/20 pt-2">
                      {feedback.detail.chosen ? (
                        <p className="text-sm font-bold text-leaf">Précisé : {feedback.detail.chosen} ✓</p>
                      ) : (
                        <>
                          <p className="mb-2 text-xs font-bold text-ink-soft">{feedbackGroup.title} (facultatif)</p>
                          <div className="flex flex-wrap gap-2">
                            {feedbackGroup.choices.map((c) => (
                              <button key={c.value} type="button" onClick={() => choose(c.value)} className="min-h-11 rounded-full border border-line bg-surface px-3 text-sm font-bold">
                                <span aria-hidden>{c.icon}</span> {c.label}
                              </button>
                            ))}
                            {feedbackGroup.allowNote ? (
                              <button type="button" onClick={() => setNoteOpen((o) => !o)} className="min-h-11 rounded-full border border-line bg-surface px-3 text-sm font-bold">
                                ✍️ Autre…
                              </button>
                            ) : null}
                          </div>
                          {noteOpen ? (
                            <div className="mt-2 flex gap-2">
                              <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={NOTE_MAX}
                                placeholder="Précisez en quelques mots"
                                aria-label="Précision libre"
                                className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-ink"
                              />
                              <button type="button" onClick={saveNote} disabled={!note.trim()} className="min-h-11 rounded-xl bg-primary px-4 font-extrabold text-white disabled:opacity-50">
                                OK
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <section aria-label={`Journée de ${kid.firstName}`} className="mx-4 mt-4 rounded-2xl border border-line bg-cream p-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold-deep">Journée de {kid.firstName}</h3>
                {timeline.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">Rien d’enregistré pour l’instant. Touchez un geste ci-dessus.</p>
                ) : (
                  <ol className="mt-1">
                    {timeline.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0">
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
                          {item.detail ? <p className="text-sm text-ink-soft">{item.detail}</p> : null}
                          {item.canDetail && !item.detail ? (
                            <button type="button" onClick={() => openDetail(kid, item)} className="mt-0.5 min-h-9 text-sm font-bold text-primary underline">
                              Préciser
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => undoItem(kid, item)}
                          aria-label={`Annuler ${item.label} de ${item.time} — ${kid.firstName}`}
                          className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-ink-soft hover:text-danger"
                        >
                          Annuler
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <div className="flex flex-col gap-2 p-4">
                {timeline.length > 0 ? (
                  <Link
                    href={`/aujourdhui/bilan/${kid.id}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-base font-extrabold text-[#06301a]"
                  >
                    <WhatsAppIcon className="size-6 text-white" />
                    Bilan du jour sur WhatsApp
                  </Link>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/aujourdhui/messages/${kid.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-primary">
                    <span aria-hidden>💬</span> Message
                  </Link>
                  <Link href={`/aujourdhui/urgence/${kid.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface px-3 text-sm font-bold text-danger">
                    <span aria-hidden>🚨</span> Urgence
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        {toast && !toast.childId ? (
          <p className={`pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg ${toast.error ? "bg-danger" : "bg-ink"}`}>{toast.error ? toast.text : `✓ ${toast.text}`}</p>
        ) : null}
      </div>
    </>
  );
}

function ConnectionBanner({ online, pending, syncing, problem, onDismiss }: { online: boolean; pending: number; syncing: boolean; problem: string | null; onDismiss: () => void }) {
  if (problem) {
    return (
      <div role="alert" className="flex items-start justify-between gap-3 rounded-card bg-pink-soft px-4 py-3 text-sm font-bold text-danger">
        <span>⚠️ {problem}</span>
        <button type="button" onClick={onDismiss} className="min-h-11 px-2" aria-label="Fermer le message">
          ✕
        </button>
      </div>
    );
  }
  if (!online) {
    return (
      <p role="status" className="rounded-card bg-sun-soft px-4 py-3 text-sm font-bold">
        📴 Hors ligne : vos saisies sont gardées sur ce téléphone{pending > 0 ? ` (${pending} à envoyer)` : ""} et partiront dès le retour du réseau.
      </p>
    );
  }
  if (pending > 0) {
    return (
      <p role="status" className="rounded-card bg-primary-soft px-4 py-3 text-sm font-bold text-primary">
        {syncing ? "🔄 Envoi en cours…" : `⏳ ${pending} saisie${pending > 1 ? "s" : ""} à envoyer`}
      </p>
    );
  }
  return null;
}

/** « HH:MM » de Paris pour le jour de `serverNow` → instant ISO. */
function parisInstantFor(serverNow: string, hhmm: string): string {
  return parisInstant(parisDateKey(serverNow), hhmm).toISOString();
}

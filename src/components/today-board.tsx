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
    if (result.error) return show({ text: result.error, error: true });
    const group = action === "meal" || action === "diaper" || action === "care" ? action : null;
    show({
      text: `${LABELS[action].done} pour ${kid.firstName}${online ? "" : " (hors ligne)"}`,
      undo: result.undo,
      detail: group && result.opId ? { group, targetId: result.opId, childName: kid.firstName } : undefined,
    });
  }

  function undo() {
    if (!toast?.undo) return;
    submit(toast.undo);
    show({ text: "Action annulée" }, 4000);
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
    show({ text: "Note ajoutée ✓" }, 3000);
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
  const detailGroup = toast?.detail ? DETAILS[toast.detail.group] : null;

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

      {voiceOpen ? <VoicePanel kids={kids} onValidate={validateVoice} onClose={() => setVoiceOpen(false)} /> : null}

      <ul className="flex flex-col gap-4">
        {kids.map((kid) => {
          const day = days[kid.id];
          const napping = Boolean(day.openNapId);
          const actions: ActionType[] = ["arrival", "departure", "meal", napping ? "nap_end" : "nap", "diaper", "care"];
          const disabled = (type: ActionType) => (type === "arrival" && day.status === "present") || (type === "departure" && day.status !== "present");
          const counts: [ActionType, string, number][] = [
            ["meal", "repas", day.counts.meal],
            ["nap", "sieste", day.counts.nap],
            ["diaper", "change", day.counts.diaper],
            ["care", "soin", day.counts.care],
          ];
          const summary = counts.filter(([, , n]) => n > 0);
          const arrival = day.arrivalAt ? formatTime(day.arrivalAt) : null;
          const departure = day.departureAt ? formatTime(day.departureAt) : null;

          return (
            <li key={kid.id} className="rounded-card border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
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
              </div>

              {kid.allergies ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-pink-soft px-3 py-2 text-sm font-bold text-danger">
                  <span aria-hidden>⚠️</span>
                  <span>Allergie : {kid.allergies}</span>
                </p>
              ) : null}

              {(napping && day.openNapSince) || summary.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {napping && day.openNapSince ? (
                    <li className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold text-ink ${TONES.dusk.box}`}>
                      <span aria-hidden>😴</span> Dort depuis {formatTime(day.openNapSince)}
                    </li>
                  ) : null}
                  {summary.map(([type, label, n]) => (
                    <li key={type} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold text-ink ${TONES[ACTION_TONE[type]].box}`}>
                      <span aria-hidden>{ACTION_EMOJI[type]}</span>
                      {label}
                      {n > 1 ? "s" : ""} ×{n}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2">
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

              {day.status !== "expected" || summary.length > 0 ? (
                <Link
                  href={`/aujourdhui/bilan/${kid.id}`}
                  className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-base font-extrabold text-[#06301a]"
                >
                  <WhatsAppIcon className="size-6 text-white" />
                  Bilan du jour sur WhatsApp
                </Link>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={`/aujourdhui/messages/${kid.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-primary">
                  <span aria-hidden>💬</span> Message
                </Link>
                <Link href={`/aujourdhui/urgence/${kid.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface px-3 text-sm font-bold text-danger">
                  <span aria-hidden>🚨</span> Urgence
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        {toast ? (
          <div className={`pointer-events-auto w-full max-w-md rounded-2xl px-4 py-2 text-white shadow-lg ${toast.error ? "bg-danger" : "bg-ink"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="py-2 text-sm font-bold">{toast.error ? toast.text : `✓ ${toast.text}`}</span>
              {toast.undo ? (
                <button type="button" onClick={undo} className="min-h-11 rounded-xl bg-white/15 px-4 font-extrabold text-sun">
                  Annuler
                </button>
              ) : null}
            </div>
            {detailGroup && toast.detail ? (
              <div className="border-t border-white/20 pb-2 pt-2">
                {toast.detail.chosen ? (
                  <p className="text-sm font-bold text-sun">Précisé : {toast.detail.chosen} ✓</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-bold text-white/80">{detailGroup.title} (facultatif)</p>
                    <div className="flex flex-wrap gap-2">
                      {detailGroup.choices.map((c) => (
                        <button key={c.value} type="button" onClick={() => choose(c.value)} className="min-h-11 rounded-full bg-white/15 px-3 text-sm font-bold">
                          <span aria-hidden>{c.icon}</span> {c.label}
                        </button>
                      ))}
                      {detailGroup.allowNote ? (
                        <button type="button" onClick={() => setNoteOpen((o) => !o)} className="min-h-11 rounded-full bg-white/15 px-3 text-sm font-bold">
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
                          className="min-h-11 flex-1 rounded-xl bg-white px-3 text-ink"
                        />
                        <button type="button" onClick={saveNote} disabled={!note.trim()} className="min-h-11 rounded-xl bg-sun px-4 font-extrabold text-ink disabled:opacity-50">
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

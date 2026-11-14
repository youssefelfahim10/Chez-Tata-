"use client";

import { ChildAvatar } from "@/components/child-avatar";
import { useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { applyAction, demoBilan, DEMO_EMERGENCY, DEMO_KIDS, runOps, type SandboxState } from "@/lib/demo/sandbox";
import { formatDuration, formatTime, summarizeChildDay } from "@/lib/journal/day";
import { buildEdit, type EditDraft } from "@/lib/journal/edit";
import { DETAILS, NOTE_MAX } from "@/lib/journal/details";
import { ACTION_EMOJI, ACTION_TONE, LABELS, type ActionType } from "@/lib/journal/labels";
import { buildTimeline, type TimelineItem } from "@/lib/journal/timeline";
import type { Op } from "@/lib/offline/ops";
import { TONES } from "@/lib/ui/tones";

/** Mode « essayez vous-même » : les vrais gestes de l'application sur deux enfants fictifs, en mémoire. */

type View = { name: "home" } | { name: "bilan" | "urgence"; childId: string };
type Group = "meal" | "diaper" | "care";
/** Retour affiché DANS la carte de l'enfant concerné (comme dans l'application) ; sans enfant : message général en bas. */
type Toast = { text: string; error?: boolean; childId?: string; undo?: Op; undoLabel?: string; undoDone?: string; detail?: { group: Group; targetId: string; chosen?: string } };
type Editing = EditDraft & { itemId: string; error?: string };

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 min-h-11 text-xs font-bold text-primary underline">
      ← Retour
    </button>
  );
}

export function Sandbox({ onTouched }: { onTouched?: () => void }) {
  const [state, setState] = useState<SandboxState>({ events: [], archived: [] });
  const [view, setView] = useState<View>({ name: "home" });
  const [toast, setToast] = useState<Toast | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { events, archived } = state;

  function say(next: Toast, ms = 9000) {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), ms);
  }
  const apply = (ops: Op[]) => setState((s) => runOps(s, ops));
  const op = <T extends Op["kind"]>(o: Omit<Extract<Op, { kind: T }>, "id">): Op => ({ ...o, id: crypto.randomUUID() }) as unknown as Op;

  function act(kid: { id: string; firstName: string }, action: ActionType) {
    const result = applyAction(events, kid.id, action, new Date());
    if (result.error) return say({ text: result.message, error: true, childId: kid.id });
    setState((s) => ({ ...s, events: result.events }));
    setEditing(null);
    onTouched?.();
    const group = action === "meal" || action === "diaper" || action === "care" ? action : null;
    const undo: Op | undefined = result.created
      ? op<"undo">({ kind: "undo", targetId: result.created, undo: "event" })
      : result.endedNap
        ? op<"undo">({ kind: "undo", targetId: result.endedNap, undo: "nap_end", napId: result.endedNap })
        : undefined;
    say({ text: result.message.split(" pour ")[0], childId: kid.id, undo, detail: group && result.created ? { group, targetId: result.created } : undefined });
  }

  function undoToast() {
    if (!toast?.undo) return;
    apply([toast.undo]);
    say({ text: toast.undoDone ?? "Action annulée", childId: toast.childId }, 4000);
  }

  function choose(value: string) {
    if (!toast?.detail) return;
    const group = DETAILS[toast.detail.group];
    apply([op<"detail">({ kind: "detail", targetId: toast.detail.targetId, payload: { [group.key]: value } })]);
    setToast({ ...toast, detail: { ...toast.detail, chosen: group.choices.find((c) => c.value === value)?.label ?? value } });
  }

  function cancelItem(kidId: string, item: TimelineItem) {
    setEditing(null);
    apply([op<"undo">({ kind: "undo", targetId: item.targetId, undo: "event" })]);
    say(
      {
        text: `${item.label} de ${item.time} annulé`,
        childId: kidId,
        undo: op<"restore">({ kind: "restore", targetId: item.targetId }),
        undoLabel: "↩ Rétablir",
        undoDone: `${item.label} de ${item.time} rétabli`,
      },
      12_000,
    );
  }

  function restoreItem(kidId: string, item: TimelineItem) {
    apply([op<"restore">({ kind: "restore", targetId: item.targetId })]);
    say({ text: `${item.label} de ${item.time} rétabli`, childId: kidId }, 5000);
  }

  function saveEdit(kidId: string, item: TimelineItem) {
    if (!editing) return;
    const outcome = buildEdit(item, editing, new Date());
    if ("error" in outcome) return setEditing({ ...editing, error: outcome.error });
    setEditing(null);
    if ("unchanged" in outcome) return;
    apply([op<"edit">({ kind: "edit", targetId: item.targetId, ...outcome.fields })]);
    say(
      { text: `${item.label} modifié`, childId: kidId, undo: op<"edit">({ kind: "edit", targetId: item.targetId, ...outcome.revert }), undoLabel: "↩ Annuler la modification", undoDone: "Modification annulée" },
      8000,
    );
  }

  const now = new Date();
  const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink";

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
              const timeline = buildTimeline(mine);
              const cancelled = buildTimeline(archived.filter((e) => e.child_id === kid.id));
              const feedback = toast && toast.childId === kid.id ? toast : null;
              const group = feedback?.detail ? DETAILS[feedback.detail.group] : null;
              return (
                <li key={kid.id} className="rounded-2xl border border-line bg-surface p-3 shadow-luxe">
                  <div className="flex items-center gap-2.5">
                    <ChildAvatar name={kid.firstName} gender={kid.gender} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-none">{kid.firstName}</p>
                      <p className="mt-1 text-[10px] text-ink-soft">
                        {day.status === "expected"
                          ? "Aucune arrivée saisie"
                          : [day.arrivalAt && `Arrivée ${formatTime(day.arrivalAt)}`, day.departureAt && `Départ ${formatTime(day.departureAt)}`, formatDuration(day.presenceMs)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${napping ? TONES.dusk.chip : status[1]}`}>{napping ? "😴 Sieste" : status[0]}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {actions.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => act(kid, type)}
                        disabled={(type === "arrival" && day.status === "present") || (type === "departure" && day.status !== "present")}
                        aria-label={`${LABELS[type].label} — ${kid.firstName}`}
                        className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-bold text-ink transition active:scale-95 disabled:opacity-35 ${TONES[ACTION_TONE[type]].box}`}
                      >
                        <span aria-hidden className="text-2xl">{ACTION_EMOJI[type]}</span>
                        {LABELS[type].label}
                      </button>
                    ))}
                  </div>

                  {feedback ? (
                    <div role={feedback.error ? "alert" : "status"} className={`d-in mt-2 rounded-xl border p-2 ${feedback.error ? "border-danger/30 bg-pink-soft text-danger" : "border-leaf/30 bg-leaf-soft"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-extrabold">{feedback.error ? `⚠️ ${feedback.text}` : `✓ ${feedback.text}`}</p>
                        {feedback.undo ? (
                          <button type="button" onClick={undoToast} className="min-h-11 shrink-0 rounded-lg border border-ink/15 bg-surface px-2 text-[10px] font-extrabold text-primary">
                            {feedback.undoLabel ?? "Annuler"}
                          </button>
                        ) : null}
                      </div>
                      {group && feedback.detail ? (
                        feedback.detail.chosen ? (
                          <p className="mt-1 text-[11px] font-bold text-leaf">Précisé : {feedback.detail.chosen} ✓</p>
                        ) : (
                          <div className="mt-1 border-t border-leaf/20 pt-1.5">
                            <p className="mb-1 text-[9px] font-bold text-ink-soft">{group.title} (facultatif)</p>
                            <div className="flex flex-wrap gap-1">
                              {group.choices.map((c) => (
                                <button key={c.value} type="button" onClick={() => choose(c.value)} className="min-h-9 rounded-full border border-line bg-surface px-2 text-[10px] font-bold">
                                  <span aria-hidden>{c.icon}</span> {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}

                  <section aria-label={`Journée de ${kid.firstName}`} className="mt-2.5 rounded-xl border border-line bg-cream p-2">
                    <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold-deep">Journée de {kid.firstName}</h3>
                    {timeline.length === 0 ? (
                      <p className="mt-1 text-[10px] text-ink-soft">Rien d’enregistré. Touchez un geste ci-dessus.</p>
                    ) : (
                      <ol>
                        {timeline.map((item) => {
                          const edited = editing && editing.itemId === item.id ? editing : null;
                          const detailGroup = item.canDetail ? DETAILS[item.canDetail] : null;
                          return (
                            <li key={item.id} className="border-t border-line py-1.5 first:border-t-0">
                              <div className="flex items-start gap-2">
                                <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-lg ${TONES[ACTION_TONE[item.type]].box}`}>{ACTION_EMOJI[item.type]}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-extrabold leading-tight">
                                    {item.label} <span className="font-semibold text-ink-soft">· {item.time}</span>
                                    {item.type === "nap" ? <span className="font-semibold text-ink-soft">{item.open ? " → en cours" : item.endTime ? ` → ${item.endTime}` : ""}</span> : null}
                                  </p>
                                  {item.detail ? <p className="text-[10px] leading-tight text-ink-soft">{item.detail}</p> : null}
                                  <div className="mt-1 flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditing(edited ? null : { itemId: item.id, start: item.startValue, end: item.endValue ?? "", values: { ...item.values } })}
                                      aria-expanded={Boolean(edited)}
                                      aria-label={`Modifier ${item.label} de ${item.time} — ${kid.firstName}`}
                                      className="min-h-9 rounded-full border border-primary/30 bg-surface px-2 text-[10px] font-extrabold text-primary"
                                    >
                                      ✏️ Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelItem(kid.id, item)}
                                      aria-label={`Annuler ${item.label} de ${item.time} — ${kid.firstName}`}
                                      className="min-h-9 rounded-full border border-line bg-surface px-2 text-[10px] font-bold text-ink-soft"
                                    >
                                      ✕ Annuler
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {edited ? (
                                <div className="d-in mt-1.5 rounded-xl border border-sun/60 bg-surface p-2">
                                  <p className="text-[11px] font-extrabold">Modifier : {item.label}</p>
                                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                                    <label className="text-[9px] font-bold text-ink-soft">
                                      {item.type === "nap" ? "Endormi à" : "Heure"}
                                      <input type="time" value={edited.start} onChange={(e) => setEditing({ ...edited, start: e.target.value, error: undefined })} className={fieldClass} />
                                    </label>
                                    {item.endValue !== null ? (
                                      <label className="text-[9px] font-bold text-ink-soft">
                                        Réveil à
                                        <input type="time" value={edited.end} onChange={(e) => setEditing({ ...edited, end: e.target.value, error: undefined })} className={fieldClass} />
                                      </label>
                                    ) : null}
                                  </div>
                                  {detailGroup ? (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {detailGroup.choices.map((c) => {
                                        const on = edited.values[detailGroup.key] === c.value;
                                        return (
                                          <button
                                            key={c.value}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => setEditing({ ...edited, values: { ...edited.values, [detailGroup.key]: on ? "" : c.value } })}
                                            className={`min-h-9 rounded-full border px-2 text-[10px] font-bold ${on ? "border-primary bg-primary text-white" : "border-line bg-surface"}`}
                                          >
                                            <span aria-hidden>{c.icon}</span> {c.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  {detailGroup?.allowNote ? (
                                    <input
                                      value={edited.values.note ?? ""}
                                      onChange={(e) => setEditing({ ...edited, values: { ...edited.values, note: e.target.value } })}
                                      maxLength={NOTE_MAX}
                                      placeholder="Précision libre (facultatif)"
                                      aria-label="Précision libre"
                                      className={fieldClass}
                                    />
                                  ) : null}
                                  {edited.error ? <p role="alert" className="mt-1 text-[10px] font-bold text-danger">⚠️ {edited.error}</p> : null}
                                  <div className="mt-2 flex gap-1.5">
                                    <button type="button" onClick={() => saveEdit(kid.id, item)} className="min-h-11 flex-1 rounded-xl bg-primary px-3 text-[11px] font-extrabold text-white">✓ Enregistrer</button>
                                    <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-[11px] font-bold">Fermer</button>
                                  </div>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {cancelled.length > 0 ? (
                      <details className="mt-1.5 rounded-xl border border-dashed border-line bg-surface/60">
                        <summary className="min-h-11 cursor-pointer px-2 py-2.5 text-[10px] font-bold text-ink-soft">🗂️ Annulés aujourd’hui ({cancelled.length}) · rien n’est perdu</summary>
                        <ul className="px-2 pb-1.5">
                          {cancelled.map((item) => (
                            <li key={item.id} className="flex items-center gap-2 border-t border-line py-1.5">
                              <span aria-hidden className="text-base opacity-60">{ACTION_EMOJI[item.type]}</span>
                              <p className="min-w-0 flex-1 text-[10px] text-ink-soft line-through decoration-ink-soft/60">
                                {item.label} · {item.time}
                                {item.detail ? ` · ${item.detail}` : ""}
                              </p>
                              <button type="button" onClick={() => restoreItem(kid.id, item)} aria-label={`Rétablir ${item.label} de ${item.time} — ${kid.firstName}`} className="min-h-11 shrink-0 rounded-lg border border-line bg-surface px-2 text-[10px] font-extrabold text-primary">
                                ↩ Rétablir
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </section>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                    <button type="button" onClick={() => { setReviewed(false); setView({ name: "bilan", childId: kid.id }); }} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-[#06301a]">
                      <WhatsAppIcon className="size-4 text-white" /> Bilan
                    </button>
                    <button type="button" onClick={() => setView({ name: "urgence", childId: kid.id })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-danger/40 text-danger">
                      <span aria-hidden>🚨</span> Urgence
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
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-danger"><span aria-hidden>🚨</span> Danger vital : appelez sans attendre</p>
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
        {toast && !toast.childId ? (
          <p className={`d-in rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white shadow-lg ${toast.error ? "bg-danger" : "bg-ink"}`}>{toast.text}</p>
        ) : null}
      </div>
    </div>
  );
}

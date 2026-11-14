import { formatTime, type JournalEvent } from "@/lib/journal/day";
import { LABELS, type ActionType } from "@/lib/journal/labels";
import { applyOpsWithArchive, type Op } from "@/lib/offline/ops";
import { buildDayReport, hasContent, renderSummary } from "@/lib/whatsapp/summary";

/**
 * Bac à sable de la démonstration : tout se passe en mémoire, dans le navigateur du visiteur.
 * Rien n'est envoyé ni enregistré. Le bilan est produit par le vrai code de l'application.
 */

export const DEMO_KIDS = [
  { id: "demo-lou", firstName: "Lou", gender: "girl" },
  { id: "demo-noa", firstName: "Noa", gender: "boy" },
] as const;

/** Fiche d'urgence fictive (numéros inexistants : on ne compose jamais de vrai numéro depuis la démo). */
export const DEMO_EMERGENCY = {
  "demo-lou": {
    allergies: "Arachides (exemple fictif)",
    medication: "Aucun traitement",
    doctor: { name: "Dr Exemple", phone: "01 02 03 04 05" },
    parents: [{ name: "Famille Test", relation: "mère", phone: "06 00 00 00 00" }],
    pickups: [{ name: "Tante Test", relation: "tante" }],
  },
  "demo-noa": {
    allergies: "Aucune allergie renseignée",
    medication: "Aucun traitement",
    doctor: { name: "Dr Exemple", phone: "01 02 03 04 05" },
    parents: [{ name: "Famille Démo", relation: "père", phone: "06 11 22 33 44" }],
    pickups: [],
  },
} as const;

export type SandboxState = { events: JournalEvent[]; archived: JournalEvent[] };

/** Applique des opérations (annuler, rétablir, modifier, préciser) avec le code RÉEL de l'application. */
export function runOps(state: SandboxState, ops: Op[]): SandboxState {
  return applyOpsWithArchive(state.events, state.archived, ops);
}

export type SandboxResult = {
  events: JournalEvent[];
  message: string;
  error?: boolean;
  /** Identifiant du geste créé (pour l'annuler ou le préciser). */
  created?: string;
  /** Sieste terminée par ce geste (pour la rouvrir si on annule). */
  endedNap?: string;
};

let sequence = 0;

const kidName = (id: string) => DEMO_KIDS.find((k) => k.id === id)?.firstName ?? "L’enfant";

/** Applique un geste comme le fait l'application : une arrivée par présence, une sieste en cours à la fois. */
export function applyAction(events: JournalEvent[], childId: string, action: ActionType, now: Date): SandboxResult {
  const mine = events.filter((e) => e.child_id === childId).sort((a, b) => a.started_at.localeCompare(b.started_at));
  const lastArrival = mine.filter((e) => e.event_type === "arrival").at(-1);
  const lastDeparture = mine.filter((e) => e.event_type === "departure").at(-1);
  const present = Boolean(lastArrival && !(lastDeparture && lastDeparture.started_at >= lastArrival.started_at));
  const name = kidName(childId);

  if (action === "arrival" && present) return { events, message: `${name} est déjà arrivé(e).`, error: true };
  if (action === "departure" && !present) return { events, message: `${name} n’a pas d’arrivée enregistrée.`, error: true };

  if (action === "nap_end") {
    const open = mine.filter((e) => e.event_type === "nap" && !e.ended_at).at(-1);
    if (!open) return { events, message: `${name} n’a pas de sieste en cours.`, error: true };
    const next = events.map((e) => (e.id === open.id ? { ...e, ended_at: now.toISOString() } : e));
    return { events: next, message: `${LABELS.nap_end.done} pour ${name}`, endedNap: open.id };
  }
  if (action === "nap" && mine.some((e) => e.event_type === "nap" && !e.ended_at)) {
    return { events, message: `${name} dort déjà.`, error: true };
  }

  sequence += 1;
  const event: JournalEvent = { id: `${childId}-${sequence}`, child_id: childId, event_type: action, started_at: now.toISOString(), ended_at: null };
  return { events: [...events, event], message: `${LABELS[action].done} pour ${name} · ${formatTime(event.started_at)}`, created: event.id };
}

/** Bilan du jour d'un enfant fictif, via le code réel (rien d'inventé : seulement les gestes faits). */
export function demoBilan(childId: string, events: JournalEvent[], now: Date): { text: string; hasContent: boolean } {
  const report = buildDayReport(kidName(childId), now, events.filter((e) => e.child_id === childId));
  return { text: renderSummary(report, "Tata"), hasContent: hasContent(report) };
}

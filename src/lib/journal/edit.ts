import { parisDateKey, parisInstant } from "@/lib/journal/day";
import { NOTE_MAX } from "@/lib/journal/details";
import type { TimelineItem } from "@/lib/journal/timeline";
import { isPlausibleTime } from "@/lib/offline/ops";

/** Ce que la personne a saisi dans l'éditeur d'un geste : heures « HH:MM » et précisions (valeur vide = retirée). */
export type EditDraft = { start: string; end: string; values: Record<string, string> };

export type EditFields = { startedAt?: string; endedAt?: string; payload?: Record<string, string> };

export type EditOutcome =
  | { error: string }
  | { unchanged: true }
  /** `fields` = la correction ; `revert` = ce qu'il faut renvoyer pour revenir exactement en arrière. */
  | { fields: EditFields; revert: EditFields };

const DETAIL_KEYS = ["amount", "diaper", "care", "note"] as const;

/**
 * Compare le brouillon à l'état actuel du geste et prépare la correction (et son annulation).
 * Pure et partagée par l'écran Aujourd'hui et la démonstration : mêmes règles partout.
 */
export function buildEdit(item: TimelineItem, draft: EditDraft, now: Date): EditOutcome {
  const date = parisDateKey(item.startedAt);
  let startedAt = item.startedAt;
  let endedAt: string | undefined;
  try {
    if (draft.start !== item.startValue) startedAt = parisInstant(date, draft.start).toISOString();
    if (item.endValue !== null && draft.end !== item.endValue) endedAt = parisInstant(date, draft.end).toISOString();
  } catch {
    return { error: "Indiquez une heure valide." };
  }
  if (startedAt !== item.startedAt && !isPlausibleTime(startedAt, now)) return { error: `L’heure ${draft.start} est dans le futur ou trop ancienne.` };
  if (endedAt && !isPlausibleTime(endedAt, now)) return { error: `L’heure ${draft.end} est dans le futur ou trop ancienne.` };
  const finalEnd = endedAt ?? item.endedAt;
  if (finalEnd && Date.parse(finalEnd) < Date.parse(startedAt)) return { error: "Le réveil ne peut pas précéder l’endormissement." };

  const payload: Record<string, string> = {};
  const undoPayload: Record<string, string> = {};
  for (const key of DETAIL_KEYS) {
    const next = (draft.values[key] ?? "").trim().slice(0, NOTE_MAX);
    const before = item.values[key] ?? "";
    if (next !== before) {
      payload[key] = next;
      undoPayload[key] = before;
    }
  }
  const timeChanged = startedAt !== item.startedAt;
  const hasPayload = Object.keys(payload).length > 0;
  if (!timeChanged && !endedAt && !hasPayload) return { unchanged: true };

  return {
    fields: { ...(timeChanged ? { startedAt } : {}), ...(endedAt ? { endedAt } : {}), ...(hasPayload ? { payload } : {}) },
    revert: { ...(timeChanged ? { startedAt: item.startedAt } : {}), ...(endedAt && item.endedAt ? { endedAt: item.endedAt } : {}), ...(hasPayload ? { payload: undoPayload } : {}) },
  };
}

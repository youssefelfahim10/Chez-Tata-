import { detailLabel, type DetailKey } from "@/lib/journal/details";
import { formatDuration, formatTime, type JournalEvent } from "@/lib/journal/day";
import { LABELS, type ActionType } from "@/lib/journal/labels";

/** Un geste de la journée, prêt à être affiché dans la carte de l'enfant. Rien n'est déduit : seulement ce qui est saisi. */
export type TimelineItem = {
  /** Identifiant d'affichage. */
  id: string;
  /** Identifiant à utiliser pour annuler ou préciser (opération d'origine si elle existe). */
  targetId: string;
  type: Exclude<ActionType, "nap_end">;
  label: string;
  time: string;
  startedAt: string;
  /** Sieste : heure de réveil. */
  endTime: string | null;
  /** Sieste en cours. */
  open: boolean;
  /** Durée d'une sieste terminée. */
  duration: string | null;
  /** Précisions cochées ou notées, séparées par des virgules ; null s'il n'y en a pas. */
  detail: string | null;
  /** Ce geste accepte une précision (repas, change, soin). */
  canDetail: "meal" | "diaper" | "care" | null;
};

const SHOWN = new Set(["arrival", "departure", "meal", "nap", "diaper", "care"]);
const DETAIL_GROUP: Record<string, "meal" | "diaper" | "care"> = { meal: "meal", diaper: "diaper", care: "care" };
const KEYS: DetailKey[] = ["amount", "diaper", "care", "note"];

export function detailText(payload: Record<string, unknown> | undefined): string | null {
  const parts = KEYS.map((k) => detailLabel(k, payload?.[k])).filter((v): v is string => Boolean(v));
  return parts.length ? parts.join(", ") : null;
}

/** Les gestes d'un enfant pour la journée, du plus ancien au plus récent. */
export function buildTimeline(events: JournalEvent[]): TimelineItem[] {
  return events
    .filter((e) => SHOWN.has(e.event_type))
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((e): TimelineItem => {
      const type = e.event_type as TimelineItem["type"];
      const ended = type === "nap" ? e.ended_at : null;
      const detail = detailText(e.event_payload);
      return {
        id: e.id,
        targetId: e.client_operation_id ?? e.id,
        type,
        label: LABELS[type].label,
        time: formatTime(e.started_at),
        startedAt: e.started_at,
        endTime: ended ? formatTime(ended) : null,
        open: type === "nap" && !e.ended_at,
        duration: ended ? formatDuration(new Date(ended).getTime() - new Date(e.started_at).getTime()) : null,
        detail,
        canDetail: DETAIL_GROUP[type] ?? null,
      };
    });
}

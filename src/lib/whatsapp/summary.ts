import { formatDuration, formatLongDate, formatTime, type JournalEvent } from "@/lib/journal/day";
import { detailLabel, type DetailKey } from "@/lib/journal/details";

/**
 * Bilan du jour d'un enfant, construit UNIQUEMENT à partir des événements
 * enregistrés. Aucune donnée manquante n'est inventée : une rubrique sans
 * donnée est simplement omise (pas de repas saisi → pas de ligne « Repas »).
 */
export type DayReport = {
  childName: string;
  date: Date;
  arrivalAt: string | null;
  departureAt: string | null;
  /** Durée entre la première arrivée et le dernier départ ; seulement si les deux existent. */
  presenceMs: number | null;
  meals: Dated[];
  naps: { start: string; end: string | null }[];
  diapers: Dated[];
  cares: Dated[];
};

/** Une heure, avec les précisions cochées ou écrites (jamais déduites). */
type Dated = { at: string; detail: string | null };

function detailOf(e: JournalEvent, key: DetailKey): string | null {
  const payload = e.event_payload ?? {};
  const main = detailLabel(key, payload[key]);
  const note = detailLabel("note", payload.note);
  return [main, note].filter(Boolean).join(" — ") || null;
}

export function buildDayReport(childName: string, date: Date, events: JournalEvent[]): DayReport {
  const sorted = [...events].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const of = (type: string) => sorted.filter((e) => e.event_type === type);
  const arrival = of("arrival")[0] ?? null;
  const departure = of("departure").at(-1) ?? null;
  const gone = arrival && departure && departure.started_at >= arrival.started_at;
  return {
    childName,
    date,
    arrivalAt: arrival?.started_at ?? null,
    departureAt: gone ? departure.started_at : null,
    presenceMs: gone ? new Date(departure.started_at).getTime() - new Date(arrival.started_at).getTime() : null,
    meals: of("meal").map((e) => ({ at: e.started_at, detail: detailOf(e, "amount") })),
    naps: of("nap").map((e) => ({ start: e.started_at, end: e.ended_at })),
    diapers: of("diaper").map((e) => ({ at: e.started_at, detail: detailOf(e, "diaper") })),
    cares: of("care").map((e) => ({ at: e.started_at, detail: detailOf(e, "care") })),
  };
}

export function hasContent(r: DayReport): boolean {
  return Boolean(r.arrivalAt || r.departureAt || r.meals.length || r.naps.length || r.diapers.length || r.cares.length);
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
const timed = (items: Dated[]) => items.map((d) => `${formatTime(d.at)}${d.detail ? ` (${d.detail})` : ""}`).join(", ");

/** Texte prêt à relire et modifier avant tout partage. */
export function renderSummary(r: DayReport, caregiverName?: string): string {
  const lines: string[] = [`🧸 Bilan de la journée — ${r.childName}`, `📅 ${formatLongDate(r.date)}`, ""];
  const body: string[] = [];

  if (r.arrivalAt) body.push(`👋 Arrivée : ${formatTime(r.arrivalAt)}`);
  if (r.departureAt) body.push(`🏠 Départ : ${formatTime(r.departureAt)}`);
  if (r.presenceMs !== null) body.push(`⏱️ Temps de présence : ${formatDuration(r.presenceMs)}`);
  if (r.meals.length) {
    body.push(`🍽️ Repas : ${timed(r.meals)}`);
  }
  for (const nap of r.naps) {
    if (nap.end) {
      const ms = new Date(nap.end).getTime() - new Date(nap.start).getTime();
      body.push(`😴 Sieste : ${formatTime(nap.start)} → ${formatTime(nap.end)} (${formatDuration(ms)})`);
    } else {
      body.push(`😴 Sieste : depuis ${formatTime(nap.start)}`);
    }
  }
  if (r.diapers.length) {
    body.push(`🧷 ${r.diapers.length} ${plural(r.diapers.length, "change", "changes")} : ${timed(r.diapers)}`);
  }
  if (r.cares.length) {
    body.push(`🩹 ${r.cares.length} ${plural(r.cares.length, "soin", "soins")} : ${timed(r.cares)}`);
  }

  lines.push(...body);
  lines.push("", caregiverName?.trim() ? `— ${caregiverName.trim()} · Chez TaTa` : "— Chez TaTa");
  return lines.join("\n");
}

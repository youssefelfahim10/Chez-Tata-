/** Logique pure du journal quotidien (sans accès réseau) : testable isolément. */

export const TIME_ZONE = "Europe/Paris";

export const EVENT_TYPES = ["arrival", "departure", "meal", "nap", "diaper", "care"] as const;
export type QuickEventType = (typeof EVENT_TYPES)[number];

export type JournalEvent = {
  id: string;
  child_id: string;
  event_type: string;
  started_at: string;
  ended_at: string | null;
};

function partsInParis(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Décalage (ms) entre l'heure de Paris et UTC à l'instant donné. */
function parisOffsetMs(date: Date): number {
  const p = partsInParis(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Bornes UTC [début, fin[ de la journée civile à Paris contenant `now`. */
export function parisDayBounds(now: Date): { start: Date; end: Date; isoDate: string } {
  const p = partsInParis(now);
  const midnight = (year: number, month: number, day: number) => {
    const guess = new Date(Date.UTC(year, month - 1, day));
    // Le décalage est évalué à minuit local (important les jours de changement d'heure).
    const first = new Date(guess.getTime() - parisOffsetMs(guess));
    return new Date(guess.getTime() - parisOffsetMs(first));
  };
  const start = midnight(p.year, p.month, p.day);
  const end = midnight(p.year, p.month, p.day + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start, end, isoDate: `${p.year}-${pad(p.month)}-${pad(p.day)}` };
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replace(":", " h ");
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export type ChildDay = {
  status: "expected" | "present" | "gone";
  arrivalAt: string | null;
  departureAt: string | null;
  presenceMs: number;
  openNapId: string | null;
  openNapSince: string | null;
  counts: { meal: number; nap: number; diaper: number; care: number };
};

/**
 * Résume la journée d'un enfant à partir de ses événements non annulés.
 * Ne déduit rien qui ne soit pas saisi : pas d'arrivée, pas de présence.
 */
export function summarizeChildDay(events: JournalEvent[], now: Date): ChildDay {
  const sorted = [...events].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const arrivals = sorted.filter((e) => e.event_type === "arrival");
  const departures = sorted.filter((e) => e.event_type === "departure");
  const lastArrival = arrivals.at(-1) ?? null;
  const lastDeparture = departures.at(-1) ?? null;

  let status: ChildDay["status"] = "expected";
  if (lastArrival) {
    status = lastDeparture && lastDeparture.started_at >= lastArrival.started_at ? "gone" : "present";
  }

  // Durée de présence : somme des intervalles arrivée → départ (ou maintenant).
  let presenceMs = 0;
  let openSince: number | null = null;
  for (const e of sorted) {
    const at = new Date(e.started_at).getTime();
    if (e.event_type === "arrival" && openSince === null) openSince = at;
    if (e.event_type === "departure" && openSince !== null) {
      presenceMs += at - openSince;
      openSince = null;
    }
  }
  if (openSince !== null) presenceMs += Math.max(0, now.getTime() - openSince);

  const openNap = sorted.filter((e) => e.event_type === "nap" && !e.ended_at).at(-1) ?? null;
  const count = (type: string) => sorted.filter((e) => e.event_type === type).length;

  return {
    status,
    arrivalAt: arrivals[0]?.started_at ?? null,
    departureAt: status === "gone" ? lastDeparture!.started_at : null,
    presenceMs,
    openNapId: openNap?.id ?? null,
    openNapSince: openNap?.started_at ?? null,
    counts: { meal: count("meal"), nap: count("nap"), diaper: count("diaper"), care: count("care") },
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Instant UTC correspondant à « jour AAAA-MM-JJ, HH:MM » à Paris (heure d'été comprise). */
export function parisInstant(isoDate: string, hhmm: string): Date {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!date || !time) throw new Error("Date ou heure invalide.");
  const guess = new Date(Date.UTC(+date[1], +date[2] - 1, +date[3], +time[1], +time[2]));
  const first = new Date(guess.getTime() - parisOffsetMs(guess));
  return new Date(guess.getTime() - parisOffsetMs(first));
}

/** « AAAA-MM-JJ » du jour civil parisien d'un instant. */
export function parisDateKey(iso: string): string {
  const p = partsInParis(new Date(iso));
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** « HH:MM » (heure de Paris) d'un instant, format attendu par les champs horaires. */
export function parisHHMM(iso: string): string {
  const p = partsInParis(new Date(iso));
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

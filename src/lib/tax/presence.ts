import { parisDateKey } from "@/lib/journal/day";
import type { PresenceDay } from "./recap";

type PresenceEvent = { child_id: string; event_type: string; started_at: string };

/**
 * Durée de présence par enfant et par jour, d'après les arrivées et départs du journal (jour de Paris).
 * Un jour avec arrivée mais sans départ n'est pas compté (on ne devine pas une heure) : il est signalé dans `incomplete`.
 */
export function presenceFromEvents(events: PresenceEvent[]): { days: PresenceDay[]; incomplete: number } {
  const groups = new Map<string, PresenceEvent[]>();
  for (const e of events) {
    if (e.event_type !== "arrival" && e.event_type !== "departure") continue;
    const key = `${e.child_id}|${parisDateKey(e.started_at)}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  const days: PresenceDay[] = [];
  let incomplete = 0;
  for (const [key, list] of groups) {
    list.sort((a, b) => a.started_at.localeCompare(b.started_at));
    let open: number | null = null;
    let minutes = 0;
    for (const e of list) {
      const at = new Date(e.started_at).getTime();
      if (e.event_type === "arrival") {
        if (open === null) open = at;
      } else if (open !== null) {
        minutes += Math.max(0, Math.round((at - open) / 60_000));
        open = null;
      }
    }
    const [childId, date] = key.split("|");
    if (minutes > 0) days.push({ childId, date, minutes });
    if (open !== null || minutes === 0) incomplete += 1;
  }
  return { days, incomplete };
}

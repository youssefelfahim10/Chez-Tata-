/** Mémoire (sur l'appareil) des visites guidées : « done » = vue ou refusée, « later » = reportée. Jamais de donnée personnelle. */

export type TourSeen = "new" | "later" | "done";

const KEY = (id: string) => `chez-tata-tour-${id}`;
const listeners = new Set<() => void>();
const memo = new Map<string, TourSeen>();

export const subscribeSeen = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function readSeen(id: string): TourSeen {
  const known = memo.get(id);
  if (known) return known;
  let value: TourSeen = "new";
  try {
    const stored = window.localStorage.getItem(KEY(id));
    if (stored === "later" || stored === "done") value = stored;
  } catch {
    /* stockage indisponible : la proposition s'affiche à chaque visite */
  }
  memo.set(id, value);
  return value;
}

export function writeSeen(id: string, value: Exclude<TourSeen, "new">) {
  memo.set(id, value);
  try {
    window.localStorage.setItem(KEY(id), value);
  } catch {
    /* le choix vaut pour cette visite */
  }
  listeners.forEach((l) => l());
}

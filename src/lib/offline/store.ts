import type { QueuedOp } from "./ops";
import { loadQueue, QUEUE_KEY, saveQueue } from "./storage";

/**
 * File d'attente vue comme une source externe (localStorage) : les composants
 * s'y abonnent, chaque changement est persisté sur l'appareil et notifié.
 */
const EMPTY: QueuedOp[] = [];
let cache: QueuedOp[] | null = null;
const listeners = new Set<() => void>();

export const queueStore = {
  get(): QueuedOp[] {
    if (cache === null) cache = loadQueue();
    return cache;
  },
  getServer(): QueuedOp[] {
    return EMPTY;
  },
  set(next: QueuedOp[]) {
    cache = next;
    saveQueue(next);
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    // Autre onglet de la même appli : on relit la file.
    const onStorage = (e: StorageEvent) => {
      if (e.key === QUEUE_KEY) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
export const getOnline = () => navigator.onLine;
export const getOnlineServer = () => true;

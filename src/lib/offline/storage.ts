import type { QueuedOp } from "./ops";

export const QUEUE_KEY = "ct_offline_queue_v1";
const KEY = QUEUE_KEY;

/** File d'attente persistée sur l'appareil. Toute erreur de stockage est absorbée : l'appli reste utilisable. */
export function loadQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedOp[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

/** Vide les pages gardées pour le hors ligne. La file de saisies, elle, est conservée (liée au compte). */
export function clearOfflineCaches(): void {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: "clear" });
  }
}

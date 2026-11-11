import type { JournalEvent } from "@/lib/journal/day";

/**
 * Opérations du journal, rejouables hors ligne. Chaque opération a un
 * identifiant généré sur l'appareil : l'envoyer deux fois ne crée jamais de doublon.
 */

export type EventKind = "arrival" | "departure" | "meal" | "nap" | "diaper" | "care";

export type Op =
  | {
      kind: "create";
      id: string;
      childId: string;
      eventType: EventKind;
      /** Heure réelle du geste (ISO), pas celle de la synchronisation. */
      occurredAt: string;
      payload?: Record<string, string>;
      /** Vrai si l'action a été faite sans connexion. */
      offline?: boolean;
    }
  | { kind: "nap_end"; id: string; childId: string; napId: string; occurredAt: string; offline?: boolean }
  | { kind: "detail"; id: string; targetId: string; payload: Record<string, string> }
  | {
      kind: "undo";
      id: string;
      /** Identifiant de l'opération (ou de l'événement) à annuler. */
      targetId: string;
      undo: "event" | "nap_end";
      /** Pour « nap_end » : la sieste à rouvrir (targetId désigne alors l'opération de réveil). */
      napId?: string;
    }
  /** Rétablit un geste annulé (il revient dans la journée avec ses précisions). */
  | { kind: "restore"; id: string; targetId: string }
  /**
   * Corrige un geste : heure (et réveil d'une sieste) et/ou précisions.
   * Une valeur de précision vide (« ») efface cette précision.
   */
  | { kind: "edit"; id: string; targetId: string; startedAt?: string; endedAt?: string; payload?: Record<string, string> };

export type QueuedOp = { op: Op; userId: string; orgId: string; queuedAt: string };

const matches = (e: JournalEvent, id: string) => e.id === id || e.client_operation_id === id;

/**
 * Événements affichés = ceux du serveur + les opérations pas encore confirmées.
 * C'est ce qui rend l'écran instantané, connecté ou non.
 */
export function applyOps(events: JournalEvent[], ops: Op[]): JournalEvent[] {
  return applyOpsWithArchive(events, [], ops).events;
}

/** Applique des précisions : une valeur vide efface la précision correspondante. */
function mergePayload(current: Record<string, unknown> | undefined, patch: Record<string, string>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") delete next[key];
    else next[key] = value;
  }
  return next;
}

/**
 * Comme `applyOps`, en gardant aussi les gestes annulés (les « archives » du jour) :
 * annuler déplace un geste vers les archives, rétablir le ramène dans la journée.
 */
export function applyOpsWithArchive(events: JournalEvent[], archived: JournalEvent[], ops: Op[]): { events: JournalEvent[]; archived: JournalEvent[] } {
  let result = events.map((e) => ({ ...e }));
  let shelf = archived.map((e) => ({ ...e }));
  for (const op of ops) {
    switch (op.kind) {
      case "create":
        if (!result.some((e) => matches(e, op.id)) && !shelf.some((e) => matches(e, op.id))) {
          result.push({
            id: op.id,
            client_operation_id: op.id,
            child_id: op.childId,
            event_type: op.eventType,
            started_at: op.occurredAt,
            ended_at: null,
            event_payload: { ...(op.payload ?? {}) },
          });
        }
        break;
      case "nap_end":
        for (const e of result) if (matches(e, op.napId) && !e.ended_at) e.ended_at = op.occurredAt;
        break;
      case "detail":
        for (const e of [...result, ...shelf]) if (matches(e, op.targetId)) e.event_payload = { ...(e.event_payload ?? {}), ...op.payload };
        break;
      case "edit":
        for (const e of result) {
          if (!matches(e, op.targetId)) continue;
          if (op.startedAt) e.started_at = op.startedAt;
          if (op.endedAt && e.event_type === "nap") e.ended_at = op.endedAt;
          if (op.payload) e.event_payload = mergePayload(e.event_payload, op.payload);
        }
        break;
      case "undo":
        if (op.undo === "event") {
          const gone = result.filter((e) => matches(e, op.targetId));
          result = result.filter((e) => !matches(e, op.targetId));
          shelf = [...shelf.filter((e) => !gone.some((g) => g.id === e.id)), ...gone];
        } else for (const e of result) if (matches(e, op.napId ?? op.targetId)) e.ended_at = null;
        break;
      case "restore": {
        const back = shelf.filter((e) => matches(e, op.targetId));
        shelf = shelf.filter((e) => !matches(e, op.targetId));
        result = [...result.filter((e) => !back.some((b) => b.id === e.id)), ...back];
        break;
      }
    }
  }
  return { events: result, archived: shelf };
}

/**
 * Ajoute une opération à la file. Annuler une opération encore en attente
 * l'efface simplement (et ses précisions) : le serveur n'en entend jamais parler.
 */
export function enqueueOp(queue: QueuedOp[], item: QueuedOp): QueuedOp[] {
  const { op } = item;
  // Un réveil de sieste encore en attente et aussitôt annulé : rien à envoyer.
  if (op.kind === "undo" && op.undo === "nap_end") {
    const target = queue.find((q) => q.op.id === op.targetId && q.op.kind === "nap_end");
    if (target) return queue.filter((q) => q.op.id !== op.targetId);
  }
  // Annuler puis rétablir (ou l'inverse) avant l'envoi : les deux se neutralisent.
  // Un geste annulé n'est JAMAIS effacé : il part au serveur puis y reste en archive.
  if (op.kind === "restore") {
    const idx = queue.findIndex((q) => q.op.kind === "undo" && q.op.undo === "event" && q.op.targetId === op.targetId);
    if (idx >= 0) return queue.filter((_, i) => i !== idx);
  }
  if (op.kind === "undo" && op.undo === "event") {
    const idx = queue.findIndex((q) => q.op.kind === "restore" && q.op.targetId === op.targetId);
    if (idx >= 0) return queue.filter((_, i) => i !== idx);
  }
  // Deux corrections successives du même geste : une seule, la plus récente l'emporte.
  if (op.kind === "edit") {
    const idx = queue.findIndex((q) => q.op.kind === "edit" && q.op.targetId === op.targetId);
    if (idx >= 0) {
      const merged = [...queue];
      const prev = merged[idx].op as Extract<Op, { kind: "edit" }>;
      merged[idx] = { ...item, op: { ...prev, ...op, id: prev.id, payload: prev.payload || op.payload ? { ...prev.payload, ...op.payload } : undefined } };
      return merged;
    }
  }
  // Une précision remplace la précédente en attente pour la même cible.
  if (op.kind === "detail") {
    const idx = queue.findIndex((q) => q.op.kind === "detail" && q.op.targetId === op.targetId);
    if (idx >= 0) {
      const merged = [...queue];
      const prev = merged[idx].op as Extract<Op, { kind: "detail" }>;
      merged[idx] = { ...item, op: { ...op, payload: { ...prev.payload, ...op.payload } } };
      return merged;
    }
  }
  return [...queue, item];
}

export type SendResult = { status: "ok" } | { status: "rejected"; error: string } | { status: "retry"; reason?: "auth" | "space" };

export type FlushOutcome = {
  /** Raison de l'arrêt si la synchronisation n'a pas pu aller au bout. */
  stoppedBecause?: "auth" | "space" | "network";
  remaining: QueuedOp[];
  synced: QueuedOp[];
  rejected: { item: QueuedOp; error: string }[];
};

/** Envoie la file dans l'ordre. S'arrête au premier échec réseau, sans rien perdre. */
export async function flushQueue(queue: QueuedOp[], send: (item: QueuedOp) => Promise<SendResult>): Promise<FlushOutcome> {
  const synced: QueuedOp[] = [];
  const rejected: FlushOutcome["rejected"] = [];
  let index = 0;
  let stoppedBecause: FlushOutcome["stoppedBecause"];
  for (; index < queue.length; index += 1) {
    const item = queue[index];
    let result: SendResult;
    try {
      result = await send(item);
    } catch {
      result = { status: "retry" };
    }
    if (result.status === "retry") {
      stoppedBecause = result.reason ?? "network";
      break;
    }
    if (result.status === "ok") synced.push(item);
    else rejected.push({ item, error: result.error });
  }
  return { stoppedBecause, remaining: queue.slice(index), synced, rejected };
}

/** Opérations d'un utilisateur et d'un espace précis : on ne mélange jamais deux comptes. */
export function forScope(queue: QueuedOp[], userId: string, orgId: string): QueuedOp[] {
  return queue.filter((q) => q.userId === userId && q.orgId === orgId);
}

/** Heure acceptée par le serveur : ni dans le futur (tolérance 5 min), ni vieille de plus de 72 h. */
export function isPlausibleTime(iso: string, now: Date): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime() + 5 * 60_000 && t >= now.getTime() - 72 * 3_600_000;
}

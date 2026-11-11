import { describe, expect, it } from "vitest";
import type { JournalEvent } from "@/lib/journal/day";
import { sanitizeDetails, detailLabel } from "@/lib/journal/details";
import { applyOps, applyOpsWithArchive, enqueueOp, flushQueue, forScope, isPlausibleTime, type Op, type QueuedOp, type SendResult } from "@/lib/offline/ops";
import { summarizeChildDay } from "@/lib/journal/day";

const U = "user-1", O = "org-1", C = "child-1";
const q = (op: Op, userId = U, orgId = O): QueuedOp => ({ op, userId, orgId, queuedAt: "2026-11-10T08:00:00Z" });
const create = (id: string, eventType: "arrival" | "departure" | "meal" | "nap" | "diaper" | "care", at: string): Op => ({
  kind: "create", id, childId: C, eventType, occurredAt: at,
});
const server = (id: string, type: string, at: string, opId?: string): JournalEvent => ({
  id, child_id: C, event_type: type, started_at: at, ended_at: null, client_operation_id: opId,
});

describe("affichage immédiat des opérations en attente", () => {
  it("ajoute une arrivée en attente sans toucher au serveur", () => {
    const events = applyOps([], [create("op1", "arrival", "2026-11-10T07:30:00Z")]);
    expect(summarizeChildDay(events, new Date("2026-11-10T08:00:00Z")).status).toBe("present");
  });

  it("ne duplique pas un événement déjà revenu du serveur", () => {
    const events = applyOps([server("srv1", "arrival", "2026-11-10T07:30:00Z", "op1")], [create("op1", "arrival", "2026-11-10T07:30:00Z")]);
    expect(events).toHaveLength(1);
  });

  it("termine une sieste en attente comme une sieste du serveur", () => {
    const events = applyOps(
      [server("srv-nap", "nap", "2026-11-10T12:00:00Z")],
      [{ kind: "nap_end", id: "op2", childId: C, napId: "srv-nap", occurredAt: "2026-11-10T13:30:00Z" }],
    );
    expect(events[0].ended_at).toBe("2026-11-10T13:30:00Z");
    const local = applyOps([], [create("n1", "nap", "2026-11-10T12:00:00Z"), { kind: "nap_end", id: "n2", childId: C, napId: "n1", occurredAt: "2026-11-10T13:00:00Z" }]);
    expect(local[0].ended_at).toBe("2026-11-10T13:00:00Z");
  });

  it("rouvre une sieste dont le réveil a été annulé, ou annule le réveil encore en attente", () => {
    const woke: Op = { kind: "nap_end", id: "w1", childId: C, napId: "n1", occurredAt: "2026-11-10T13:00:00Z" };
    const reopened = applyOps([server("n1", "nap", "2026-11-10T12:00:00Z")], [woke, { kind: "undo", id: "u1", targetId: "w1", undo: "nap_end", napId: "n1" }]);
    expect(reopened[0].ended_at).toBeNull();
    let queue = enqueueOp([], q(woke));
    queue = enqueueOp(queue, q({ kind: "undo", id: "u1", targetId: "w1", undo: "nap_end", napId: "n1" }));
    expect(queue).toEqual([]);
  });

  it("fusionne les précisions et retire un événement annulé", () => {
    const withDetail = applyOps([], [create("m1", "meal", "2026-11-10T11:00:00Z"), { kind: "detail", id: "d1", targetId: "m1", payload: { amount: "all" } }]);
    expect(withDetail[0].event_payload).toEqual({ amount: "all" });
    const undone = applyOps([server("s1", "meal", "2026-11-10T11:00:00Z", "m1")], [{ kind: "undo", id: "u1", targetId: "m1", undo: "event" }]);
    expect(undone).toEqual([]);
  });
});

describe("file d'attente", () => {
  it("annuler une action encore en attente ne la perd pas : elle part au serveur puis reste en archive", () => {
    let queue: QueuedOp[] = [];
    queue = enqueueOp(queue, q(create("m1", "meal", "2026-11-10T11:00:00Z")));
    queue = enqueueOp(queue, q({ kind: "detail", id: "d1", targetId: "m1", payload: { amount: "all" } }));
    queue = enqueueOp(queue, q({ kind: "undo", id: "u1", targetId: "m1", undo: "event" }));
    expect(queue.map((i) => i.op.kind)).toEqual(["create", "detail", "undo"]);
  });

  it("annuler puis rétablir avant l'envoi se neutralise (et inversement)", () => {
    let queue = enqueueOp([], q(create("m1", "meal", "2026-11-10T11:00:00Z")));
    queue = enqueueOp(queue, q({ kind: "undo", id: "u1", targetId: "m1", undo: "event" }));
    queue = enqueueOp(queue, q({ kind: "restore", id: "r1", targetId: "m1" }));
    expect(queue.map((i) => i.op.kind)).toEqual(["create"]);
    queue = enqueueOp(enqueueOp([], q({ kind: "restore", id: "r2", targetId: "srv" })), q({ kind: "undo", id: "u2", targetId: "srv", undo: "event" }));
    expect(queue).toEqual([]);
  });

  it("fusionne deux corrections successives du même geste", () => {
    let queue = enqueueOp([], q({ kind: "edit", id: "e1", targetId: "m1", startedAt: "2026-11-10T10:00:00Z" }));
    queue = enqueueOp(queue, q({ kind: "edit", id: "e2", targetId: "m1", payload: { amount: "half" } }));
    queue = enqueueOp(queue, q({ kind: "edit", id: "e3", targetId: "m1", startedAt: "2026-11-10T10:30:00Z" }));
    expect(queue).toHaveLength(1);
    expect(queue[0].op).toMatchObject({ kind: "edit", id: "e1", startedAt: "2026-11-10T10:30:00Z", payload: { amount: "half" } });
  });

  it("garde l'annulation d'une action déjà envoyée", () => {
    const queue = enqueueOp([], q({ kind: "undo", id: "u1", targetId: "srv-1", undo: "event" }));
    expect(queue).toHaveLength(1);
  });

  it("fusionne deux précisions successives sur la même cible", () => {
    let queue = enqueueOp([], q({ kind: "detail", id: "d1", targetId: "m1", payload: { amount: "all" } }));
    queue = enqueueOp(queue, q({ kind: "detail", id: "d2", targetId: "m1", payload: { note: "avec appétit" } }));
    expect(queue).toHaveLength(1);
    expect((queue[0].op as Extract<Op, { kind: "detail" }>).payload).toEqual({ amount: "all", note: "avec appétit" });
  });

  it("n'expose que les opérations du bon compte et du bon espace", () => {
    const queue = [q(create("a", "meal", "2026-11-10T11:00:00Z")), q(create("b", "meal", "2026-11-10T11:00:00Z"), "user-2"), q(create("c", "meal", "2026-11-10T11:00:00Z"), U, "org-2")];
    expect(forScope(queue, U, O).map((x) => x.op.id)).toEqual(["a"]);
  });
});

describe("synchronisation", () => {
  const items = ["a", "b", "c", "d"].map((id) => q(create(id, "meal", "2026-11-10T11:00:00Z")));

  it("envoie dans l'ordre et vide la file", async () => {
    const sent: string[] = [];
    const out = await flushQueue(items, async (i) => (sent.push(i.op.id), { status: "ok" } as SendResult));
    expect(sent).toEqual(["a", "b", "c", "d"]);
    expect(out.remaining).toEqual([]);
    expect(out.synced).toHaveLength(4);
  });

  it("s'arrête à la première panne réseau et conserve le reste, dans l'ordre", async () => {
    const out = await flushQueue(items, async (i) => (i.op.id === "c" ? { status: "retry" } : { status: "ok" }));
    expect(out.synced.map((i) => i.op.id)).toEqual(["a", "b"]);
    expect(out.remaining.map((i) => i.op.id)).toEqual(["c", "d"]);
  });

  it("traite une exception comme une panne réseau", async () => {
    const out = await flushQueue(items, async () => {
      throw new Error("offline");
    });
    expect(out.remaining).toHaveLength(4);
  });

  it("écarte une opération refusée sans bloquer les suivantes", async () => {
    const out = await flushQueue(items, async (i) => (i.op.id === "b" ? { status: "rejected", error: "invalide" } : { status: "ok" }));
    expect(out.rejected.map((r) => r.item.op.id)).toEqual(["b"]);
    expect(out.synced.map((i) => i.op.id)).toEqual(["a", "c", "d"]);
    expect(out.remaining).toEqual([]);
  });
});

describe("garde-fous", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("refuse une heure future ou trop ancienne", () => {
    expect(isPlausibleTime("2026-11-10T11:00:00Z", now)).toBe(true);
    expect(isPlausibleTime("2026-11-10T12:04:00Z", now)).toBe(true);
    expect(isPlausibleTime("2026-11-10T12:10:00Z", now)).toBe(false);
    expect(isPlausibleTime("2026-11-06T11:00:00Z", now)).toBe(false);
    expect(isPlausibleTime("n'importe quoi", now)).toBe(false);
  });

  it("ne garde que des précisions connues et courtes", () => {
    expect(sanitizeDetails({ amount: "all", evil: "x", diaper: "nope", note: "  ok  " })).toEqual({ amount: "all", note: "ok" });
    expect(sanitizeDetails({ note: "x".repeat(500) }).note).toHaveLength(120);
    expect(sanitizeDetails(null)).toEqual({});
    expect(detailLabel("amount", "all")).toBe("tout mangé");
    expect(detailLabel("amount", "zzz")).toBeNull();
  });
});

describe("archives du jour : rien n'est perdu", () => {
  const meal = server("s1", "meal", "2026-11-10T11:00:00Z", "m1");

  it("annuler déplace le geste en archive, rétablir le ramène avec ses précisions", () => {
    const withDetail = { ...meal, event_payload: { amount: "all" } };
    const cancelled = applyOpsWithArchive([withDetail], [], [{ kind: "undo", id: "u1", targetId: "m1", undo: "event" }]);
    expect(cancelled.events).toEqual([]);
    expect(cancelled.archived).toHaveLength(1);
    expect(cancelled.archived[0].event_payload).toEqual({ amount: "all" });
    const back = applyOpsWithArchive([withDetail], [], [
      { kind: "undo", id: "u1", targetId: "m1", undo: "event" },
      { kind: "restore", id: "r1", targetId: "m1" },
    ]);
    expect(back.events).toHaveLength(1);
    expect(back.archived).toEqual([]);
  });

  it("rétablit un geste archivé côté serveur", () => {
    const out = applyOpsWithArchive([], [meal], [{ kind: "restore", id: "r1", targetId: "s1" }]);
    expect(out.events.map((e) => e.id)).toEqual(["s1"]);
    expect(out.archived).toEqual([]);
  });

  it("un geste créé puis annulé hors ligne se retrouve aussi en archive", () => {
    const out = applyOpsWithArchive([], [], [create("m9", "meal", "2026-11-10T11:00:00Z"), { kind: "undo", id: "u9", targetId: "m9", undo: "event" }]);
    expect(out.events).toEqual([]);
    expect(out.archived).toHaveLength(1);
  });

  it("corrige l'heure, le réveil et les précisions (une valeur vide efface)", () => {
    const nap = { ...server("n1", "nap", "2026-11-10T12:00:00Z", "n1"), ended_at: "2026-11-10T13:00:00Z", event_payload: { note: "agité", amount: "all" } };
    const [edited] = applyOps([nap], [{ kind: "edit", id: "e1", targetId: "n1", startedAt: "2026-11-10T12:10:00Z", endedAt: "2026-11-10T13:20:00Z", payload: { note: "", amount: "half" } }]);
    expect(edited.started_at).toBe("2026-11-10T12:10:00Z");
    expect(edited.ended_at).toBe("2026-11-10T13:20:00Z");
    expect(edited.event_payload).toEqual({ amount: "half" });
  });

  it("ne change pas l'heure de fin d'un geste qui n'est pas une sieste", () => {
    const [edited] = applyOps([meal], [{ kind: "edit", id: "e1", targetId: "m1", endedAt: "2026-11-10T13:20:00Z" }]);
    expect(edited.ended_at).toBeNull();
  });
});

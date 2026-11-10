import { describe, expect, it } from "vitest";
import type { JournalEvent } from "@/lib/journal/day";
import { sanitizeDetails, detailLabel } from "@/lib/journal/details";
import { applyOps, enqueueOp, flushQueue, forScope, isPlausibleTime, type Op, type QueuedOp, type SendResult } from "@/lib/offline/ops";
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
  it("annuler une action encore en attente l'efface avec ses précisions", () => {
    let queue: QueuedOp[] = [];
    queue = enqueueOp(queue, q(create("m1", "meal", "2026-11-10T11:00:00Z")));
    queue = enqueueOp(queue, q({ kind: "detail", id: "d1", targetId: "m1", payload: { amount: "all" } }));
    queue = enqueueOp(queue, q({ kind: "undo", id: "u1", targetId: "m1", undo: "event" }));
    expect(queue).toEqual([]);
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

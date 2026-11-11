import { describe, expect, it } from "vitest";
import { buildTimeline, detailText } from "@/lib/journal/timeline";
import type { JournalEvent } from "@/lib/journal/day";

const ev = (id: string, type: string, iso: string, extra: Partial<JournalEvent> = {}): JournalEvent => ({ id, child_id: "c1", event_type: type, started_at: iso, ended_at: null, ...extra });

describe("journée de l'enfant", () => {
  it("classe les gestes du plus ancien au plus récent, avec l'heure de Paris", () => {
    const items = buildTimeline([ev("2", "meal", "2026-11-11T11:40:00Z"), ev("1", "arrival", "2026-11-11T07:12:00Z")]);
    expect(items.map((i) => i.type)).toEqual(["arrival", "meal"]);
    expect(items[0].time).toBe("08 h 12");
    expect(items[1].label).toBe("Repas");
  });

  it("affiche les précisions cochées et la note, sans rien inventer", () => {
    const [meal, plain] = buildTimeline([
      ev("1", "meal", "2026-11-11T11:00:00Z", { event_payload: { amount: "all", note: "a goûté les carottes" } }),
      ev("2", "diaper", "2026-11-11T12:00:00Z"),
    ]);
    expect(meal.detail).toBe("tout mangé, a goûté les carottes");
    expect(plain.detail).toBeNull();
    expect(plain.canDetail).toBe("diaper");
    expect(detailText({ amount: "inconnu" })).toBeNull();
    expect(detailText(undefined)).toBeNull();
  });

  it("une sieste en cours est marquée ouverte, une sieste finie donne sa durée", () => {
    const [open, done] = buildTimeline([
      ev("1", "nap", "2026-11-11T12:30:00Z"),
      ev("2", "nap", "2026-11-11T13:00:00Z", { ended_at: "2026-11-11T14:10:00Z" }),
    ]);
    expect(open).toMatchObject({ open: true, endTime: null, duration: null });
    expect(done).toMatchObject({ open: false, endTime: "15 h 10", duration: "1 h 10" });
  });

  it("utilise l'identifiant de l'opération d'origine pour annuler, sinon celui de l'événement", () => {
    const [a, b] = buildTimeline([ev("srv-1", "arrival", "2026-11-11T07:00:00Z", { client_operation_id: "op-1" }), ev("srv-2", "departure", "2026-11-11T16:00:00Z")]);
    expect(a.targetId).toBe("op-1");
    expect(b.targetId).toBe("srv-2");
  });

  it("ignore les types inconnus", () => {
    expect(buildTimeline([ev("1", "bizarre", "2026-11-11T07:00:00Z")])).toEqual([]);
  });

  it("prépare la correction : heures « HH:MM » de Paris et précisions brutes", () => {
    const [nap, meal] = buildTimeline([
      ev("1", "nap", "2026-11-11T12:30:00Z", { ended_at: "2026-11-11T14:10:00Z" }),
      ev("2", "meal", "2026-11-11T15:00:00Z", { event_payload: { amount: "most", note: "ok", inconnu: "x" } }),
    ]);
    expect(nap.startValue).toBe("13:30");
    expect(nap.endValue).toBe("15:10");
    expect(nap.endedAt).toBe("2026-11-11T14:10:00Z");
    expect(meal.endValue).toBeNull();
    expect(meal.values).toEqual({ amount: "most", note: "ok" });
  });
});

import { describe, expect, it } from "vitest";
import { buildEdit } from "@/lib/journal/edit";
import { buildTimeline } from "@/lib/journal/timeline";
import type { JournalEvent } from "@/lib/journal/day";

// 10 novembre 2026, heure de Paris = UTC+1.
const NOW = new Date("2026-11-10T16:00:00Z");
const ev = (type: string, iso: string, extra: Partial<JournalEvent> = {}): JournalEvent => ({ id: "e1", child_id: "c", event_type: type, started_at: iso, ended_at: null, ...extra });
const first = (e: JournalEvent) => buildTimeline([e])[0];

describe("correction d'un geste (partagée par l'appli et la démo)", () => {
  const meal = first(ev("meal", "2026-11-10T10:45:00Z", { event_payload: { amount: "most" } })); // 11 h 45

  it("ne fait rien si rien n'a changé", () => {
    expect(buildEdit(meal, { start: "11:45", end: "", values: { amount: "most" } }, NOW)).toEqual({ unchanged: true });
  });

  it("change l'heure et la précision, et prépare le retour en arrière exact", () => {
    const out = buildEdit(meal, { start: "12:00", end: "", values: { amount: "all", note: "bien" } }, NOW);
    if (!("fields" in out)) throw new Error("correction attendue");
    expect(out.fields.startedAt).toBe("2026-11-10T11:00:00.000Z");
    expect(out.fields.payload).toEqual({ amount: "all", note: "bien" });
    expect(out.revert.startedAt).toBe(meal.startedAt);
    expect(out.revert.payload).toEqual({ amount: "most", note: "" });
  });

  it("retirer une précision envoie une valeur vide", () => {
    const out = buildEdit(meal, { start: "11:45", end: "", values: {} }, NOW);
    if (!("fields" in out)) throw new Error("correction attendue");
    expect(out.fields.payload).toEqual({ amount: "" });
    expect(out.revert.payload).toEqual({ amount: "most" });
  });

  it("refuse une heure dans le futur ou invalide", () => {
    expect(buildEdit(meal, { start: "23:30", end: "", values: { amount: "most" } }, NOW)).toMatchObject({ error: expect.stringContaining("futur") });
    expect(buildEdit(meal, { start: "", end: "", values: { amount: "most" } }, NOW)).toMatchObject({ error: "Indiquez une heure valide." });
  });

  it("refuse un réveil avant l'endormissement et accepte un réveil corrigé", () => {
    const nap = first(ev("nap", "2026-11-10T11:30:00Z", { ended_at: "2026-11-10T13:00:00Z" })); // 12 h 30 → 14 h 00
    expect(buildEdit(nap, { start: "12:30", end: "12:00", values: {} }, NOW)).toMatchObject({ error: expect.stringContaining("réveil") });
    const out = buildEdit(nap, { start: "12:30", end: "14:20", values: {} }, NOW);
    if (!("fields" in out)) throw new Error("correction attendue");
    expect(out.fields.endedAt).toBe("2026-11-10T13:20:00.000Z");
    expect(out.revert.endedAt).toBe("2026-11-10T13:00:00Z");
  });
});

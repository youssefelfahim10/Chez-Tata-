import { describe, expect, it } from "vitest";
import { formatDuration, formatTime, parisDayBounds, summarizeChildDay, type JournalEvent } from "@/lib/journal/day";

const ev = (id: string, type: string, start: string, end: string | null = null): JournalEvent => ({
  id,
  child_id: "c1",
  event_type: type,
  started_at: start,
  ended_at: end,
});

describe("parisDayBounds", () => {
  it("couvre la journée civile de Paris en hiver (UTC+1)", () => {
    const b = parisDayBounds(new Date("2026-11-10T11:00:00Z"));
    expect(b.isoDate).toBe("2026-11-10");
    expect(b.start.toISOString()).toBe("2026-11-09T23:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-11-10T23:00:00.000Z");
  });

  it("couvre la journée civile de Paris en été (UTC+2)", () => {
    const b = parisDayBounds(new Date("2026-07-01T22:30:00Z"));
    expect(b.isoDate).toBe("2026-07-02");
    expect(b.start.toISOString()).toBe("2026-07-01T22:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-07-02T22:00:00.000Z");
  });

  it("gère les jours de changement d'heure (23 h et 25 h)", () => {
    const spring = parisDayBounds(new Date("2026-03-29T12:00:00Z"));
    expect(spring.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(spring.end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    const autumn = parisDayBounds(new Date("2026-10-25T12:00:00Z"));
    expect(autumn.start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(autumn.end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("formatage", () => {
  it("affiche l'heure de Paris", () => {
    expect(formatTime("2026-11-10T07:30:00Z")).toBe("08 h 30");
  });
  it("affiche les durées", () => {
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(120 * 60_000)).toBe("2 h");
    expect(formatDuration(125 * 60_000)).toBe("2 h 05");
    expect(formatDuration(-5)).toBe("0 min");
  });
});

describe("summarizeChildDay", () => {
  const now = new Date("2026-11-10T14:00:00Z");

  it("n'invente aucune présence sans arrivée saisie", () => {
    const day = summarizeChildDay([ev("1", "meal", "2026-11-10T11:00:00Z")], now);
    expect(day.status).toBe("expected");
    expect(day.arrivalAt).toBeNull();
    expect(day.presenceMs).toBe(0);
    expect(day.counts.meal).toBe(1);
  });

  it("calcule la présence en cours depuis l'arrivée", () => {
    const day = summarizeChildDay([ev("1", "arrival", "2026-11-10T07:30:00Z")], now);
    expect(day.status).toBe("present");
    expect(day.presenceMs).toBe(6.5 * 3_600_000);
  });

  it("additionne plusieurs périodes de présence (départ puis retour)", () => {
    const day = summarizeChildDay(
      [
        ev("1", "arrival", "2026-11-10T07:00:00Z"),
        ev("2", "departure", "2026-11-10T11:00:00Z"),
        ev("3", "arrival", "2026-11-10T13:00:00Z"),
      ],
      now,
    );
    expect(day.status).toBe("present");
    expect(day.arrivalAt).toBe("2026-11-10T07:00:00Z");
    expect(day.presenceMs).toBe(5 * 3_600_000);
  });

  it("marque l'enfant parti et fige la durée", () => {
    const day = summarizeChildDay(
      [ev("1", "arrival", "2026-11-10T07:30:00Z"), ev("2", "departure", "2026-11-10T12:00:00Z")],
      now,
    );
    expect(day.status).toBe("gone");
    expect(day.departureAt).toBe("2026-11-10T12:00:00Z");
    expect(day.presenceMs).toBe(4.5 * 3_600_000);
  });

  it("repère une sieste en cours et compte les événements", () => {
    const day = summarizeChildDay(
      [
        ev("1", "arrival", "2026-11-10T07:30:00Z"),
        ev("2", "nap", "2026-11-10T09:00:00Z", "2026-11-10T10:00:00Z"),
        ev("3", "nap", "2026-11-10T12:30:00Z"),
        ev("4", "diaper", "2026-11-10T10:05:00Z"),
        ev("5", "diaper", "2026-11-10T12:20:00Z"),
      ],
      now,
    );
    expect(day.openNapId).toBe("3");
    expect(day.counts).toEqual({ meal: 0, nap: 2, diaper: 2, care: 0 });
  });
});

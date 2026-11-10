import { describe, expect, it } from "vitest";
import type { JournalEvent } from "@/lib/journal/day";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/lib/whatsapp/link";
import { buildDayReport, hasContent, renderSummary } from "@/lib/whatsapp/summary";

const ev = (id: string, type: string, start: string, end: string | null = null): JournalEvent => ({
  id,
  child_id: "c1",
  event_type: type,
  started_at: start,
  ended_at: end,
});
const day = new Date("2026-11-10T12:00:00Z");

describe("bilan du jour", () => {
  it("n'écrit que ce qui a été enregistré", () => {
    const text = renderSummary(buildDayReport("Lou", day, [ev("1", "arrival", "2026-11-10T07:30:00Z")]));
    expect(text).toContain("Bilan de la journée — Lou");
    expect(text).toContain("Arrivée : 08 h 30");
    for (const absent of ["Départ", "Repas", "Sieste", "change", "soin", "présence"]) expect(text).not.toContain(absent);
  });

  it("ne déduit aucun repas, sieste ou observation", () => {
    const report = buildDayReport("Lou", day, []);
    expect(hasContent(report)).toBe(false);
    const text = renderSummary(report);
    expect(text.split("\n").filter((l) => /[🍽😴🧷🩹👋🏠⏱]/u.test(l))).toEqual([]);
  });

  it("décrit une journée complète, heures de Paris", () => {
    const text = renderSummary(
      buildDayReport("Lou", day, [
        ev("1", "arrival", "2026-11-10T07:30:00Z"),
        ev("2", "meal", "2026-11-10T11:05:00Z"),
        ev("3", "meal", "2026-11-10T15:00:00Z"),
        ev("4", "nap", "2026-11-10T12:00:00Z", "2026-11-10T13:30:00Z"),
        ev("5", "diaper", "2026-11-10T09:00:00Z"),
        ev("6", "care", "2026-11-10T09:20:00Z"),
        ev("7", "departure", "2026-11-10T16:15:00Z"),
      ]),
      "TaTa Démo",
    );
    expect(text).toContain("Arrivée : 08 h 30");
    expect(text).toContain("Départ : 17 h 15");
    expect(text).toContain("Temps de présence : 8 h 45");
    expect(text).toContain("Repas : 12 h 05, 16 h 00");
    expect(text).toContain("Sieste : 13 h 00 → 14 h 30 (1 h 30)");
    expect(text).toContain("1 change : 10 h 00");
    expect(text).toContain("1 soin : 10 h 20");
    expect(text.endsWith("— TaTa Démo · Chez TaTa")).toBe(true);
  });

  it("ne calcule pas de présence sans départ, et signale une sieste en cours", () => {
    const text = renderSummary(
      buildDayReport("Lou", day, [ev("1", "arrival", "2026-11-10T07:30:00Z"), ev("2", "nap", "2026-11-10T12:00:00Z")]),
    );
    expect(text).not.toContain("Temps de présence");
    expect(text).not.toContain("Départ");
    expect(text).toContain("Sieste : depuis 13 h 00");
  });

  it("ignore un départ antérieur à l'arrivée", () => {
    const r = buildDayReport("Lou", day, [ev("1", "departure", "2026-11-10T06:00:00Z"), ev("2", "arrival", "2026-11-10T07:30:00Z")]);
    expect(r.departureAt).toBeNull();
    expect(r.presenceMs).toBeNull();
  });
});

describe("liens WhatsApp", () => {
  it.each([
    ["06 12 34 56 78", "33612345678"],
    ["0612345678", "33612345678"],
    ["+33 6 12 34 56 78", "33612345678"],
    ["0033612345678", "33612345678"],
    ["33612345678", "33612345678"],
    ["+212 6 12 34 56 78", "212612345678"],
  ])("normalise %s", (raw, expected) => expect(toWhatsAppNumber(raw)).toBe(expected));

  it.each(["", "abc", "12345", "06 12 34", null, undefined, "0012", "+0123456789"])("refuse %s", (raw) =>
    expect(toWhatsAppNumber(raw as string)).toBeNull(),
  );

  it("encode le message et fonctionne sans destinataire", () => {
    const url = buildWhatsAppUrl("33612345678", "Bonjour & merci\nà demain 🧸");
    expect(url).toBe(`https://wa.me/33612345678?text=${encodeURIComponent("Bonjour & merci\nà demain 🧸")}`);
    expect(buildWhatsAppUrl(null, "x")).toBe("https://wa.me/?text=x");
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Bonjour & merci\nà demain 🧸");
  });
});

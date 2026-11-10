import { describe, expect, it } from "vitest";
import { contractTypeFor, parseContractForm, parseHours, parseWeeks } from "@/lib/contracts/parse";

const valid = { startDate: "2026-09-01", weeklyHours: "40", weeksPerYear: "52", hourlyNet: "4,50", maintenance: "3,50", meal: "4" };

describe("saisie du contrat", () => {
  it("accepte une saisie complète et convertit en entiers", () => {
    expect(parseContractForm(valid)).toEqual({
      ok: true,
      value: { startDate: "2026-09-01", weeklyHours: 40, weeksPerYear: 52, hourlyNetCents: 450, maintenanceCents: 350, mealCents: 400 },
    });
  });

  it("traite les indemnités vides comme 0 et les semaines vides comme 52", () => {
    const r = parseContractForm({ ...valid, maintenance: "", meal: "", weeksPerYear: "" });
    expect(r).toMatchObject({ ok: true, value: { maintenanceCents: 0, mealCents: 0, weeksPerYear: 52 } });
  });

  it.each([
    ["date manquante", { startDate: "" }],
    ["date impossible", { startDate: "2026-13-45" }],
    ["heures à 0", { weeklyHours: "0" }],
    ["heures > 100", { weeklyHours: "101" }],
    ["heures illisibles", { weeklyHours: "quarante" }],
    ["semaines > 52", { weeksPerYear: "53" }],
    ["salaire à 0", { hourlyNet: "0" }],
    ["salaire à 3 décimales", { hourlyNet: "4,505" }],
    ["salaire négatif", { hourlyNet: "-4" }],
    ["indemnité invalide", { maintenance: "abc" }],
  ])("refuse : %s", (_l, patch) => {
    expect(parseContractForm({ ...valid, ...patch }).ok).toBe(false);
  });

  it("parse les heures et les semaines", () => {
    expect(parseHours("37,5")).toBe(37.5);
    expect(parseHours("0")).toBeNull();
    expect(parseWeeks("46.5")).toBe(46.5);
    expect(parseWeeks("0")).toBeNull();
  });

  it("déduit le type de contrat", () => {
    expect(contractTypeFor(52)).toBe("annee_complete");
    expect(contractTypeFor(46)).toBe("annee_incomplete");
  });
});

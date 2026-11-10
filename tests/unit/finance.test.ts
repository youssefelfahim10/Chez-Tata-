import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORIES, categoryIcon, categoryLabel } from "@/lib/finance/categories";
import { csvCell, groupByCategory, monthRange, monthlyEstimateCents, monthlyMinutes, shiftMonth, sumCents } from "@/lib/finance/summary";

describe("estimation mensualisée", () => {
  it("40 h × 52 semaines ÷ 12 × 4,50 € = 780,00 €", () => {
    expect(monthlyEstimateCents({ scheduledHours: 40, weeksPerYear: 52, hourlyRate: 4.5 })).toBe(78000);
  });

  it("année incomplète : 40 h × 46 semaines", () => {
    // 40 × 46 ÷ 12 = 153,3333 h × 4,50 = 690,00 €
    expect(monthlyEstimateCents({ scheduledHours: 40, weeksPerYear: 46, hourlyRate: 4.5 })).toBe(69000);
  });

  it("arrondit au centime le plus proche, sans dérive de flottants", () => {
    // 9 h × 52 ÷ 12 = 39 h × 3,3333 = 129,9987 → 130,00 €
    expect(monthlyEstimateCents({ scheduledHours: 9, weeksPerYear: 52, hourlyRate: 3.3333 })).toBe(13000);
    expect(monthlyEstimateCents({ scheduledHours: 0.01, weeksPerYear: 1, hourlyRate: 0.0001 })).toBe(0);
  });

  it("donne les heures mensualisées en minutes", () => {
    expect(monthlyMinutes({ scheduledHours: 40, weeksPerYear: 52, hourlyRate: 0 })).toBe(10400); // 173,33 h
    expect(monthlyMinutes({ scheduledHours: 30, weeksPerYear: 52, hourlyRate: 0 })).toBe(7800); // 130 h
  });
});

describe("charges", () => {
  const rows = [
    { category: "alimentation", amount_cents: 12050 },
    { category: "jeux", amount_cents: 3000 },
    { category: "alimentation", amount_cents: 4000 },
    { category: "autre", amount_cents: 950 },
  ];

  it("additionne en centimes entiers", () => {
    expect(sumCents(rows)).toBe(20000);
    expect(sumCents([])).toBe(0);
  });

  it("regroupe par catégorie, du plus gros au plus petit", () => {
    const groups = groupByCategory(rows);
    expect(groups.map((g) => g.category)).toEqual(["alimentation", "jeux", "autre"]);
    expect(groups[0]).toMatchObject({ totalCents: 16050, count: 2, percent: 80 });
    expect(groupByCategory([])).toEqual([]);
  });

  it("calcule les bornes du mois, y compris décembre", () => {
    expect(monthRange("2026-11")).toEqual({ first: "2026-11-01", after: "2026-12-01" });
    expect(monthRange("2026-12")).toEqual({ first: "2026-12-01", after: "2027-01-01" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("a des catégories uniques avec libellé et icône", () => {
    const keys = EXPENSE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(categoryLabel("autre")).toBe("Autre");
    expect(categoryLabel("inconnue")).toBe("inconnue");
    expect(categoryIcon("alimentation")).toBe("🍎");
  });

  it("protège l'export CSV contre l'injection de formule", () => {
    expect(csvCell("=CMD()")).toBe("'=CMD()");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell('dit "oui"; non')).toBe('"dit ""oui""; non"');
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell("Alimentation")).toBe("Alimentation");
  });
});

import { describe, expect, it } from "vitest";
import { estimableMonths, estimateMonths, type EstimateContract } from "@/lib/tax/estimate";
import { buildTaxInput } from "@/lib/tax/recap";

const contract: EstimateContract = {
  childId: "c1",
  startDate: "2025-03-10",
  endDate: null,
  contract: { scheduledHours: 40, weeksPerYear: 52, hourlyRateCents: 400, maintenanceCents: 400, mealCents: 0 },
};

describe("estimation automatique des mois", () => {
  it("n'estime jamais le mois en cours ni les mois à venir", () => {
    expect(estimableMonths(2026, "2026-11-11")).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(estimableMonths(2025, "2026-11-11")).toHaveLength(12);
    expect(estimableMonths(2027, "2026-11-11")).toEqual([]);
    expect(estimableMonths(2026, "2026-01-15")).toEqual([]);
  });

  it("estime d'après le contrat, les présences et ne couvre que la période du contrat", () => {
    const est = estimateMonths({
      year: 2025,
      today: "2026-02-01",
      contracts: [contract],
      attendance: [
        { childId: "c1", date: "2025-04-01", extraMinutes: 30, maintenanceDue: true, mealDue: false },
        { childId: "c1", date: "2025-04-02", extraMinutes: 0, maintenanceDue: true, mealDue: false },
      ],
      invoiced: new Set(),
    });
    expect(est.has("c1|0")).toBe(false); // avant le début du contrat
    expect(est.has("c1|1")).toBe(false);
    expect(est.has("c1|2")).toBe(true); // mars : contrat commencé
    const april = est.get("c1|3")!;
    expect(april.estimated).toBe(true);
    // 40 h × 52 sem ÷ 12 × 4 € = 693,33 € + 30 min × 4 € = 2 € ; entretien : 2 j × 4 €
    expect(april.salaryCents).toBe(69333 + 200);
    expect(april.allowanceCents).toBe(800);
  });

  it("ignore les mois déjà facturés et les contrats terminés avant le mois", () => {
    const est = estimateMonths({
      year: 2025,
      today: "2026-02-01",
      contracts: [{ ...contract, endDate: "2025-05-31" }],
      attendance: [],
      invoiced: new Set(["c1|3"]),
    });
    expect(est.has("c1|3")).toBe(false);
    expect(est.has("c1|4")).toBe(true);
    expect(est.has("c1|5")).toBe(false);
  });

  it("buildTaxInput ne remplace jamais un mois facturé par une estimation", () => {
    const estimates = new Map([
      ["c1|3", { salaryCents: 1, allowanceCents: 1, estimated: true as const }],
      ["c1|4", { salaryCents: 50000, allowanceCents: 2000, estimated: true as const }],
    ]);
    const input = buildTaxInput({
      year: 2025,
      children: [{ id: "c1", name: "Léa" }],
      statements: [{ childId: "c1", paidAt: "2025-04-05", totalCents: 70000, lines: [] }],
      presence: [],
      estimates,
    });
    const months = input.children[0].months;
    expect(months[3]).toEqual({ salaryCents: 70000, allowanceCents: 0 });
    expect(months[4]).toEqual({ salaryCents: 50000, allowanceCents: 2000, estimated: true });
  });
});

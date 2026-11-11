import { describe, expect, it } from "vitest";
import { buildTaxInput, classifyLine, computeTax, DEFAULT_SETTINGS, taxCsv, type TaxInput, type TaxParams } from "@/lib/tax/recap";

const params = (over: Partial<TaxParams> = {}): TaxParams => ({ smicHourlyCents: 1188, parentMealCents: 545, perChild: {}, ...over });

function oneChild(salary: number, allowance: number, fullDays: number, partialMinutes = 0): TaxInput {
  const months = Array.from({ length: 12 }, () => ({ salaryCents: 0, allowanceCents: 0 }));
  months[0] = { salaryCents: salary, allowanceCents: allowance };
  return { year: 2025, children: [{ id: "c1", name: "Lou", months, fullDays, partialMinutes }] };
}

describe("classement des lignes de facture", () => {
  it("distingue indemnités et rémunération", () => {
    expect(classifyLine("Indemnités d'entretien")).toBe("allowance");
    expect(classifyLine("Indemnités de repas")).toBe("allowance");
    expect(classifyLine("Accueil mensualisé")).toBe("salary");
    expect(classifyLine("Heures complémentaires")).toBe("salary");
    expect(classifyLine("Ligne ajoutée à la main")).toBe("salary");
  });
});

describe("somme forfaitaire (exemple officiel impots.gouv.fr)", () => {
  it("retrouve l'exemple : 180 j × 11,88 € × 4 + 594 € de gardes de 24 h → 852,40 € à déclarer", () => {
    const input = oneChild(1_000_000, 0, 180);
    const r = computeTax(input, params({ perChild: { c1: { multiplier: 4, parentMealDays: 0, adjustmentCents: 59_400 } } }));
    expect(r.children[0].forfaitCents).toBe(855_360 + 59_400);
    expect(r.children[0].taxableCents).toBe(85_240);
  });

  it("applique 3 × le SMIC par défaut", () => {
    const r = computeTax(oneChild(800_000, 100_000, 200), params());
    expect(r.children[0].forfaitCents).toBe(200 * 3 * 1188);
    expect(r.children[0].taxableCents).toBe(900_000 - 712_800);
  });

  it("proratise les jours de moins de 8 h : (3 SMIC) × heures ÷ 8", () => {
    const r = computeTax(oneChild(100_000, 0, 0, 40 * 60), params()); // 40 h = 5 jours de 8 h
    expect(r.children[0].equivalentDays).toBe(5);
    expect(r.children[0].forfaitCents).toBe(5 * 3 * 1188);
  });

  it("ne crée jamais de déficit : la déduction est limitée aux sommes reçues", () => {
    const r = computeTax(oneChild(50_000, 0, 200), params());
    expect(r.children[0].forfaitCents).toBeGreaterThan(50_000);
    expect(r.children[0].deductionCents).toBe(50_000);
    expect(r.children[0].taxableCents).toBe(0);
  });

  it("ajoute le repas fourni par les parents (imposable) à ce qui est reçu", () => {
    const r = computeTax(oneChild(100_000, 0, 10), params({ perChild: { c1: { ...DEFAULT_SETTINGS, parentMealDays: 10 } } }));
    expect(r.children[0].parentMealCents).toBe(5450);
    expect(r.children[0].receivedCents).toBe(105_450);
  });

  it("alternative sans le régime : le salaire seul, sans les indemnités", () => {
    const r = computeTax(oneChild(800_000, 150_000, 100), params());
    expect(r.children[0].salaryOnlyCents).toBe(800_000);
  });

  it("sans SMIC saisi, aucune déduction n'est inventée", () => {
    const r = computeTax(oneChild(100_000, 0, 100), params({ smicHourlyCents: 0 }));
    expect(r.missingSmic).toBe(true);
    expect(r.children[0].deductionCents).toBe(0);
    expect(r.children[0].taxableCents).toBe(100_000);
  });

  it("additionne plusieurs enfants", () => {
    const a = oneChild(100_000, 0, 10).children[0];
    const b = { ...oneChild(200_000, 0, 20).children[0], id: "c2", name: "Noa" };
    const r = computeTax({ year: 2025, children: [a, b] }, params());
    expect(r.totals.receivedCents).toBe(300_000);
    expect(r.totals.fullDays).toBe(30);
    expect(r.totals.forfaitCents).toBe(30 * 3 * 1188);
  });
});

describe("construction depuis les factures et les présences", () => {
  const children = [{ id: "c1", name: "Lou" }];

  it("range les montants par mois de paiement et par nature", () => {
    const input = buildTaxInput({
      year: 2025,
      children,
      statements: [
        { childId: "c1", paidAt: "2025-02-05", totalCents: 70_000, lines: [{ label: "Accueil mensualisé", amount_cents: 60_000 }, { label: "Indemnités d'entretien", amount_cents: 10_000 }] },
        { childId: "c1", paidAt: "2026-01-05", totalCents: 99_999, lines: [{ label: "Accueil mensualisé", amount_cents: 99_999 }] },
      ],
      presence: [],
    });
    expect(input.children[0].months[1]).toEqual({ salaryCents: 60_000, allowanceCents: 10_000 });
    expect(input.children[0].months.flatMap((m) => [m.salaryCents, m.allowanceCents]).reduce((a, b) => a + b, 0)).toBe(70_000);
  });

  it("compte le reste non détaillé comme rémunération (le total fait foi)", () => {
    const input = buildTaxInput({ year: 2025, children, statements: [{ childId: "c1", paidAt: "2025-03-01", totalCents: 50_000, lines: [{ label: "Indemnités de repas", amount_cents: 5000 }] }], presence: [] });
    expect(input.children[0].months[2]).toEqual({ salaryCents: 45_000, allowanceCents: 5000 });
  });

  it("sépare jours de 8 h ou plus et minutes des autres jours, hors année et hors enfants inconnus", () => {
    const input = buildTaxInput({
      year: 2025,
      children,
      statements: [],
      presence: [
        { childId: "c1", date: "2025-03-03", minutes: 540 },
        { childId: "c1", date: "2025-03-04", minutes: 480 },
        { childId: "c1", date: "2025-03-05", minutes: 240 },
        { childId: "c1", date: "2025-03-06", minutes: 0 },
        { childId: "c1", date: "2024-12-31", minutes: 600 },
        { childId: "inconnu", date: "2025-03-03", minutes: 600 },
      ],
    });
    expect(input.children[0]).toMatchObject({ fullDays: 2, partialMinutes: 240 });
  });
});

describe("export tableur", () => {
  it("produit un CSV lisible, sans formule dangereuse", () => {
    const input = oneChild(60_000, 10_000, 2, 120);
    input.children[0].name = "=Lou";
    const csv = taxCsv(input, computeTax(input, params()));
    expect(csv.startsWith("﻿Enfant;Mois;")).toBe(true);
    expect(csv).toContain("'=Lou;janvier 2025;600,00;100,00;700,00");
    expect(csv).toContain("\r\n");
  });
});

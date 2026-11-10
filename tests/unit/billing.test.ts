import { describe, expect, it } from "vitest";
import { buildDraftLines, extraPayCents, paymentMethodLabel, sumLines } from "@/lib/billing/invoice";

const contract = { scheduledHours: 40, weeksPerYear: 52, hourlyRateCents: 450, maintenanceCents: 350, mealCents: 400 };

describe("lignes de facture", () => {
  it("propose l'accueil mensualisé seul quand rien d'autre n'a été pointé", () => {
    const lines = buildDraftLines(contract, { extraMinutes: 0, maintenanceDays: 0, mealDays: 0 });
    expect(lines.map((l) => l.key)).toEqual(["base"]);
    expect(lines[0].amountCents).toBe(78000);
    expect(lines[0].detail).toBe("40 h × 52 sem ÷ 12 × 4,50 €");
  });

  it("ajoute heures complémentaires et indemnités à partir des pointages", () => {
    const lines = buildDraftLines(contract, { extraMinutes: 90, maintenanceDays: 18, mealDays: 18 });
    expect(lines.map((l) => [l.key, l.amountCents])).toEqual([
      ["base", 78000],
      ["extra", 675],
      ["maintenance", 6300],
      ["meal", 7200],
    ]);
    expect(sumLines(lines)).toBe(92175);
  });

  it("n'invente aucune indemnité sans tarif au contrat", () => {
    const lines = buildDraftLines({ ...contract, maintenanceCents: 0, mealCents: 0 }, { extraMinutes: 0, maintenanceDays: 20, mealDays: 20 });
    expect(lines.map((l) => l.key)).toEqual(["base"]);
  });

  it("arrondit les heures complémentaires au centime, en entiers", () => {
    expect(extraPayCents(60, 450)).toBe(450);
    expect(extraPayCents(15, 450)).toBe(113); // 112,5 → 113
    expect(extraPayCents(1, 1)).toBe(0);
    expect(extraPayCents(0, 999)).toBe(0);
  });

  it("nomme les modes de paiement", () => {
    expect(paymentMethodLabel("virement")).toBe("Virement");
    expect(paymentMethodLabel("cesu")).toBe("CESU / Pajemploi");
    expect(paymentMethodLabel("inconnu")).toBe("Autre");
  });
});

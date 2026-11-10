import { describe, expect, it } from "vitest";
import { buildContractDoc, buildInvoiceDoc, emptyDetails, parseDetails, scheduleMinutes } from "@/lib/documents/details";

describe("détails du contrat", () => {
  it("lit une valeur absente ou invalide sans planter", () => {
    expect(parseDetails(undefined)).toEqual(emptyDetails());
    expect(parseDetails("n'importe quoi")).toEqual(emptyDetails());
    expect(parseDetails({ schedule: [{ day: "Funday", from: "08:00", to: "17:00" }] })).toEqual(emptyDetails());
  });

  it("garde ce qui est valide et borne le reste", () => {
    const d = parseDetails({ employee: { fullName: "Fatiha" }, care: { meals: ["lunch"], diapers: "parents" }, schedule: [{ day: "Lundi", from: "08:00", to: "17:00" }] });
    expect(d.employee.fullName).toBe("Fatiha");
    expect(d.care.meals).toEqual(["lunch"]);
    expect(parseDetails({ leaveNotes: "x".repeat(501) })).toEqual(emptyDetails());
  });

  it("calcule les heures hebdomadaires du planning", () => {
    expect(scheduleMinutes([{ from: "08:00", to: "17:00" }, { from: "08:30", to: "16:30" }])).toBe(540 + 480);
    expect(scheduleMinutes([{ from: "17:00", to: "08:00" }])).toBe(0);
  });

  it("assemble le contrat sans rien inventer", () => {
    const doc = buildContractDoc({
      today: "2026-11-10",
      childName: "Lou Martin",
      contract: { startDate: "2026-09-01", scheduledHours: 40, weeksPerYear: 46, hourlyRate: 4.5, maintenanceCents: 350, mealCents: 0, contractType: "annee_incomplete" },
      details: emptyDetails(),
      fallbackEmployeeName: "Fatiha L.",
    });
    expect(doc.employee.fullName).toBe("Fatiha L.");
    expect(doc.employee.address).toBe("");
    expect(doc.terms).toMatchObject({ weeklyMinutes: 2400, hourlyNetCents: 450, contractType: "annee_incomplete", weeksPerYear: 46 });
    expect(doc.care.diapers).toBeUndefined();
    expect(doc.parents.names).toEqual([]);
  });

  it("assemble la facture avec libellés français", () => {
    const doc = buildInvoiceDoc({
      number: "FAC-2026-0001",
      issuedOn: "2026-11-10",
      period: "2026-11",
      details: emptyDetails(),
      fallbackEmployeeName: "Fatiha L.",
      childName: "Lou",
      lines: [{ label: "Accueil", amount_cents: 78000, detail: "x" }],
      totalCents: 78000,
      paidOn: "2026-11-10",
      method: "cesu",
    });
    expect(doc.periodLabel).toBe("novembre 2026");
    expect(doc.paymentMethod).toBe("CESU / Pajemploi");
    expect(doc.lines[0]).toEqual({ label: "Accueil", detail: "x", amountCents: 78000 });
  });
});

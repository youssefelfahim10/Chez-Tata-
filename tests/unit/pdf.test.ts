import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { ContractDoc, InvoiceDoc } from "@/lib/documents/types";
import { buildContractPdf } from "@/lib/pdf/contract";
import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { wrapLines } from "@/lib/pdf/kit";

const fontDir = join(__dirname, "..", "..", "public", "fonts");
const fontBytes = {
  regular: new Uint8Array(readFileSync(join(fontDir, "nunito-latin-400-normal.woff"))),
  bold: new Uint8Array(readFileSync(join(fontDir, "nunito-latin-700-normal.woff"))),
  heavy: new Uint8Array(readFileSync(join(fontDir, "nunito-latin-800-normal.woff"))),
  logo: new Uint8Array(readFileSync(join(__dirname, "..", "..", "public", "logo-sm.png"))),
};

const contract: ContractDoc = {
  generatedOn: "2026-11-10",
  employee: { fullName: "Fatiha Lhosni", address: "12 rue des Lilas, 75011 Paris", phone: "06 00 00 00 00", email: "assmat@exemple.test", agrementNumber: "2019-0452", agrementDate: "2019-06-03", insurer: "Assurance Exemple", policyNumber: "RC-123456" },
  parents: { names: ["Camille Martin", "Alex Martin"], address: "5 avenue des Tilleuls, 75012 Paris", phone: "06 11 22 33 44", email: "parents@exemple.test" },
  child: { fullName: "Lou Martin", birthDate: "2025-03-12" },
  terms: { startDate: "2026-09-01", contractType: "annee_incomplete", weeksPerYear: 46, weeklyMinutes: 2400, hourlyNetCents: 450, maintenanceCents: 350, mealCents: 400, adaptation: "1 semaine, du 1er au 5 septembre", trial: "1 mois", notice: "1 mois", overtimeNormalRate: true, majorationPercent: "25" },
  schedule: [
    { day: "Lundi", from: "08:00", to: "17:00" },
    { day: "Mardi", from: "08:00", to: "17:00" },
    { day: "Mercredi", from: "08:30", to: "16:30" },
    { day: "Jeudi", from: "08:00", to: "17:00" },
    { day: "Vendredi", from: "08:00", to: "16:00" },
  ],
  care: { meals: ["lunch", "snack"], diapers: "parents", notes: "Allergie aux arachides : voir ordonnance remise." },
  leaveNotes: "Congés de l'assistante : 3 semaines en août, communiquées avant le 1er mars.",
};

const invoice: InvoiceDoc = {
  number: "FAC-2026-0001",
  issuedOn: "2026-11-10",
  periodLabel: "novembre 2026",
  employee: contract.employee,
  parents: { names: ["Camille Martin", "Alex Martin"], address: "5 avenue des Tilleuls, 75012 Paris" },
  childName: "Lou Martin",
  lines: [
    { label: "Accueil mensualisé", detail: "40 h × 46 sem ÷ 12 × 4,50 €", amountCents: 69000 },
    { label: "Heures complémentaires", detail: "1,5 h × 4,50 €", amountCents: 675 },
    { label: "Indemnités d'entretien", detail: "18 j × 3,50 €", amountCents: 6300 },
    { label: "Indemnités de repas", detail: "18 × 4,00 €", amountCents: 7200 },
  ],
  totalCents: 83175,
  paidOn: "2026-11-10",
  paymentMethod: "Virement",
};

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();
const out = process.env.PDF_OUT;

describe("documents PDF", () => {
  it("génère un contrat complet de plusieurs pages", async () => {
    const bytes = await buildContractPdf(contract, fontBytes);
    expect(new TextDecoder("latin1").decode(bytes.slice(0, 8))).toBe("%PDF-1.7");
    expect(await pages(bytes)).toBeGreaterThanOrEqual(2);
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, "contrat.pdf"), bytes);
    }
  });

  it("génère une facture sur une page", async () => {
    const bytes = await buildInvoicePdf(invoice, fontBytes);
    expect(await pages(bytes)).toBe(1);
    if (out) writeFileSync(join(out, "facture.pdf"), bytes);
  });

  it("n'échoue pas avec des données minimales : les blancs restent à compléter", async () => {
    const minimal: ContractDoc = {
      generatedOn: "2026-11-10",
      employee: { fullName: "Assmat Test" },
      parents: { names: ["Parent Test"] },
      child: { fullName: "Enfant Test" },
      terms: { startDate: "2026-09-01", contractType: "annee_complete", weeksPerYear: 52, weeklyMinutes: 0, hourlyNetCents: 0, maintenanceCents: 0, mealCents: 0 },
      schedule: [],
      care: { meals: [] },
    };
    const bytes = await buildContractPdf(minimal, fontBytes);
    expect(await pages(bytes)).toBeGreaterThanOrEqual(2);
    if (out) writeFileSync(join(out, "contrat-minimal.pdf"), bytes);
  });

  it("supporte émojis, caractères rares et textes très longs sans échouer", async () => {
    const hostile: ContractDoc = {
      ...contract,
      employee: { ...contract.employee, fullName: "Zoé 🧸 Œuvre-Ñandú " + "x".repeat(200), address: "Adresse ".repeat(60) },
      care: { meals: ["breakfast", "lunch", "snack", "milk"], diapers: "assmat", notes: "Note ✅ →  " + "très long ".repeat(200) },
    };
    const bytes = await buildContractPdf(hostile, fontBytes);
    expect(await pages(bytes)).toBeGreaterThanOrEqual(2);
    const inv = await buildInvoicePdf({ ...invoice, lines: Array.from({ length: 40 }, (_, i) => ({ label: `Ligne ${i + 1} 🧸`, detail: "détail", amountCents: 1000 + i })), totalCents: 50000 }, fontBytes);
    expect(await pages(inv)).toBeGreaterThanOrEqual(2);
  });

  it("coupe les lignes sans dépasser la largeur, même pour un mot géant", () => {
    const measure = (s: string) => s.length * 6;
    const lines = wrapLines("un deux trois quatre cinq six sept huit neuf dix", measure, 60);
    expect(lines.every((l) => measure(l) <= 60)).toBe(true);
    expect(lines.join(" ")).toBe("un deux trois quatre cinq six sept huit neuf dix");
    const giant = wrapLines("x".repeat(100), measure, 60);
    expect(giant.every((l) => measure(l) <= 60)).toBe(true);
    expect(giant.join("")).toBe("x".repeat(100));
    expect(wrapLines("a\n\nb", measure, 60)).toEqual(["a", "", "b"]);
  });
});

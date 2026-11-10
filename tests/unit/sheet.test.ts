import { describe, expect, it } from "vitest";
import {
  computeTotals,
  daysInMonth,
  eurosInputToCents,
  formatDateFR,
  formatDecimalHours,
  formatEuros,
  hoursInputToMinutes,
  monthNameFR,
  presenceMinutes,
  type SheetData,
} from "@/lib/sheet/compute";
import { jpegToPdf } from "@/lib/sheet/pdf";
import { drawSheet, place, type SheetContext } from "@/lib/sheet/render";

function recorder() {
  const texts: { text: string; x: number; y: number }[] = [];
  const rects: unknown[] = [];
  const images: unknown[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    textAlign: "center",
    textBaseline: "middle",
    save() {},
    restore() {},
    fillRect: (...args: unknown[]) => void rects.push(args),
    fillText: (text: string, x: number, y: number) => void texts.push({ text, x, y }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    drawImage: (...args: unknown[]) => void images.push(args),
  } as unknown as SheetContext;
  return { ctx, texts, rects, images };
}

const base: SheetData = {
  month: "2026-11",
  childName: "Enfant Test",
  caregiverName: "Assmat Test",
  contract: { maintenanceCents: 350, mealCents: 400 },
  days: {},
};

describe("calculs de la fiche", () => {
  it("compte les jours du mois, bissextile compris", () => {
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2026-12")).toBe(31);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(() => daysInMonth("2026-13")).toThrow();
  });

  it("calcule la présence et refuse un départ avant l'arrivée", () => {
    expect(presenceMinutes({ in: "09:00", out: "17:30" })).toBe(510);
    expect(presenceMinutes({ in: "09:00" })).toBeNull();
    expect(presenceMinutes({ in: "18:00", out: "08:00" })).toBeNull();
    expect(presenceMinutes({ in: "9:00", out: "17:00" })).toBeNull();
  });

  it("additionne en entiers, sans dérive de flottants", () => {
    const totals = computeTotals({
      ...base,
      days: {
        3: { in: "08:00", out: "17:00", absenceMinutes: 15, maintenance: true, meal: true },
        4: { in: "08:30", out: "16:30", extraMinutes: 45, maintenance: true, leave: "CP" },
        5: { leave: "CSS", meal: true },
        31: { in: "08:00", out: "09:00", extraMinutes: 600 }, // le 31 novembre n'existe pas
      },
    });
    expect(totals).toEqual({
      presenceMinutes: 540 + 480,
      absenceMinutes: 15,
      extraMinutes: 45,
      maintenanceCents: 700,
      mealCents: 800,
      paidLeaveDays: 1,
      unpaidLeaveDays: 1,
    });
  });

  it("n'invente pas d'indemnité sans montant au contrat", () => {
    const totals = computeTotals({ ...base, contract: {}, days: { 1: { maintenance: true, meal: true } } });
    expect(totals.maintenanceCents).toBe(0);
    expect(totals.mealCents).toBe(0);
  });

  it("formate à la française", () => {
    expect(formatDecimalHours(90)).toBe("1,5");
    expect(formatDecimalHours(45)).toBe("0,75");
    expect(formatDecimalHours(0)).toBe("0");
    expect(formatEuros(90000)).toBe("900,00");
    expect(formatEuros(5)).toBe("0,05");
    expect(formatEuros(123456)).toBe("1 234,56");
    expect(formatDateFR("2026-11-19")).toBe("19/11/2026");
    expect(formatDateFR("n'importe quoi")).toBe("");
    expect(monthNameFR("2026-11")).toBe("novembre");
  });

  it("lit les saisies sans flottants approximatifs", () => {
    expect(hoursInputToMinutes("1,5")).toBe(90);
    expect(hoursInputToMinutes("0.25")).toBe(15);
    expect(hoursInputToMinutes("abc")).toBe(0);
    expect(hoursInputToMinutes("-2")).toBe(0);
    expect(eurosInputToCents("12,5")).toBe(1250);
    expect(eurosInputToCents("0.07")).toBe(7);
    expect(eurosInputToCents("1 234,56")).toBe(123456);
    expect(eurosInputToCents("12,345")).toBeNull();
    expect(eurosInputToCents("")).toBeNull();
  });
});

describe("dessin de la fiche", () => {
  it("n'écrit rien pour une valeur vide", () => {
    const { ctx, texts } = recorder();
    expect(place(ctx, "  ", { x: 0, y: 0, w: 100, h: 20 })).toBe(false);
    expect(place(ctx, undefined, { x: 0, y: 0, w: 100, h: 20 })).toBe(false);
    expect(texts).toHaveLength(0);
  });

  it("tronque un texte trop long au lieu de déborder", () => {
    const { ctx, texts } = recorder();
    place(ctx, "x".repeat(100), { x: 0, y: 0, w: 60, h: 20 });
    expect(texts[0].text.length).toBeLessThan(11);
    expect(texts[0].text.endsWith("…")).toBe(true);
  });

  it("ne remplit que les données fournies et ne calcule pas le salaire", () => {
    const { ctx, texts } = recorder();
    drawSheet(ctx, { ...base, days: { 9: { in: "09:00", out: "17:30" } } }, { template: {} as CanvasImageSource });
    const written = texts.map((t) => t.text);
    expect(written).toContain("NOVEMBRE");
    expect(written).toContain("2026");
    expect(written).toContain("09:00");
    expect(written).toContain("17:30");
    expect(written).toContain("Enfant Test");
    // Pas de salaire saisi : aucune ligne « … € » de salaire.
    expect(written.filter((t) => t.endsWith(" €"))).toEqual(["0,00 €", "0,00 €"]);
  });

  it("imprime le salaire seulement s'il est saisi", () => {
    const { ctx, texts } = recorder();
    drawSheet(ctx, { ...base, salaryFinalCents: 90000 }, { template: {} as CanvasImageSource });
    expect(texts.map((t) => t.text)).toContain("900,00 €");
  });

  it("laisse vides les jours qui n'existent pas", () => {
    const { ctx, texts } = recorder();
    drawSheet(ctx, { ...base, days: { 31: { note: "fantôme" } } }, { template: {} as CanvasImageSource });
    expect(texts.map((t) => t.text)).not.toContain("fantôme");
  });

  it("dessine les signatures fournies", () => {
    const { ctx, images } = recorder();
    drawSheet(ctx, base, {
      template: {} as CanvasImageSource,
      parentsSignature: {} as CanvasImageSource,
    });
    expect(images).toHaveLength(2); // modèle + signature des parents
  });
});

describe("PDF A4", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 2110, 2982);
  const text = new TextDecoder("latin1").decode(pdf);

  it("a un en-tête et une fin valides", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 595.276 841.89]");
  });

  it("a une table xref dont les décalages pointent sur les objets", () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((offset, i) => expect(text.slice(offset, offset + 7)).toBe(`${i + 1} 0 obj`));
  });

  it("embarque le JPEG tel quel, avec la bonne longueur", () => {
    expect(text).toContain(`/Length ${jpeg.length} >>`);
    const at = pdf.findIndex((_, i) => jpeg.every((b, j) => pdf[i + j] === b));
    expect(at).toBeGreaterThan(0);
  });
});

describe("calage sur le modèle illustré", () => {
  it("garde les colonnes ordonnées, disjointes et dans l'image", async () => {
    const { COLUMNS, TEMPLATE, TABLE } = await import("@/lib/sheet/layout");
    COLUMNS.forEach((col, i) => {
      expect(col.x1).toBeGreaterThan(col.x0);
      expect(col.x1).toBeLessThanOrEqual(TEMPLATE.width);
      if (i > 0) expect(col.x0).toBeGreaterThan(COLUMNS[i - 1].x1);
    });
    expect(TABLE.bottom).toBeLessThan(TEMPLATE.height);
    expect(TABLE.rows).toBe(31);
  });
});

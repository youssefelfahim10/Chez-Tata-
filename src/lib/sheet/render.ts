import {
  computeTotals,
  daysInMonth,
  formatDateFR,
  formatDecimalHours,
  formatEuros,
  monthNameFR,
  parseMonth,
  type SheetData,
  type SheetDay,
} from "./compute";
import { CONTRACT, COLUMNS, HEADER, RECAP, SIGNATURES, TABLE, TEMPLATE, TOTALS_ROW, type Box, type ColumnKey } from "./layout";

/** Sous-ensemble du contexte canvas 2D utilisé ici (facilite les tests). */
export type SheetContext = Pick<
  CanvasRenderingContext2D,
  "save" | "restore" | "fillRect" | "fillText" | "measureText" | "drawImage"
> & {
  font: string;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

type TextOptions = { size?: number; weight?: string; align?: "left" | "center" | "right"; color?: string; background?: string };

/**
 * Écrit `text` dans `box`. Une valeur vide n'écrit RIEN (la fiche d'origine
 * reste intacte) : on n'invente jamais une donnée manquante.
 */
export function place(ctx: SheetContext, text: string | undefined | null, box: Box, options: TextOptions = {}): boolean {
  const value = (text ?? "").trim();
  if (value === "") return false;
  const align = options.align ?? "center";
  const padding = align === "left" ? 3 : 0;
  ctx.save();
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.font = `${options.weight ?? "600"} ${options.size ?? 14}px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.fillStyle = options.color ?? "#17382e";
  let out = value;
  const max = box.w - padding - 3;
  while (ctx.measureText(out).width > max && out.length > 1) out = `${out.slice(0, -2)}…`;
  const x = align === "left" ? box.x + padding : align === "right" ? box.x + box.w - 3 : box.x + box.w / 2;
  ctx.fillText(out, x, box.y + box.h / 2);
  ctx.restore();
  return true;
}

function dayCell(day: SheetDay | undefined, key: ColumnKey, data: SheetData): string {
  if (!day) return "";
  switch (key) {
    case "in":
      return day.in ?? "";
    case "out":
      return day.out ?? "";
    case "absence":
      return day.absenceMinutes ? formatDecimalHours(day.absenceMinutes) : "";
    case "extra":
      return day.extraMinutes ? formatDecimalHours(day.extraMinutes) : "";
    case "maintenance":
      return day.maintenance ? (data.contract.maintenanceCents ? formatEuros(data.contract.maintenanceCents) : "oui") : "";
    case "meal":
      return day.meal ? (data.contract.mealCents ? formatEuros(data.contract.mealCents) : "oui") : "";
    case "leave":
      return day.leave ?? "";
    case "note":
      return day.note ?? "";
  }
}

export type SheetImages = {
  template: CanvasImageSource;
  parentsSignature?: CanvasImageSource;
  caregiverSignature?: CanvasImageSource;
};

/** Dessine la fiche complète : le contexte doit déjà être à l'échelle de TEMPLATE. */
export function drawSheet(ctx: SheetContext, data: SheetData, images: SheetImages): void {
  ctx.drawImage(images.template, 0, 0, TEMPLATE.width, TEMPLATE.height);
  const { year } = parseMonth(data.month);
  const c = data.contract;
  const totals = computeTotals(data);

  place(ctx, monthNameFR(data.month).toUpperCase(), HEADER.month, { size: 15, background: HEADER.month.bg });
  place(ctx, String(year), HEADER.year, { size: 18, background: HEADER.year.bg });
  place(ctx, data.childName, HEADER.child, { size: 18, align: "left", background: "#fff" });
  place(ctx, data.caregiverName, HEADER.caregiver, { size: 18, align: "left", background: "#fff" });

  const field = (text: string | undefined, box: Box, o: TextOptions) =>
    place(ctx, text, box, { ...o, background: text ? "#fff" : undefined });
  field(formatDateFR(c.startDate), CONTRACT.startDate, { size: 15 });
  field(c.schedule, CONTRACT.schedule, { size: 15, align: "left" });
  field(c.monthlyMinutes ? formatDecimalHours(c.monthlyMinutes) : undefined, CONTRACT.monthlyHours, { size: 16 });
  field(c.weeklyMinutes ? formatDecimalHours(c.weeklyMinutes) : undefined, CONTRACT.weeklyHours, { size: 16 });
  field(c.hourlyNetCents ? formatEuros(c.hourlyNetCents) : undefined, CONTRACT.hourlyNet, { size: 16 });
  field(c.monthlyNetCents ? formatEuros(c.monthlyNetCents) : undefined, CONTRACT.monthlyNet, { size: 16 });
  field(c.maintenanceCents ? formatEuros(c.maintenanceCents) : undefined, CONTRACT.maintenance, { size: 16 });
  field(c.mealCents ? formatEuros(c.mealCents) : undefined, CONTRACT.meal, { size: 16 });

  // 31 lignes : les jours qui n'existent pas dans le mois restent vides.
  const rowHeight = (TABLE.bottom - TABLE.top) / TABLE.rows;
  const last = daysInMonth(data.month);
  for (let d = 1; d <= TABLE.rows; d += 1) {
    if (d > last) continue;
    for (const col of COLUMNS) {
      place(
        ctx,
        dayCell(data.days[d], col.key, data),
        { x: col.x0, y: TABLE.top + (d - 1) * rowHeight + 1, w: col.x1 - col.x0, h: rowHeight - 1 },
        { size: col.key === "note" ? 10 : 12, color: "#1c4641" },
      );
    }
  }

  // Totaux du tableau (additions de la saisie).
  const totalBox = (key: ColumnKey): Box => {
    const col = COLUMNS.find((x) => x.key === key)!;
    return { x: col.x0, y: TOTALS_ROW.y, w: col.x1 - col.x0, h: TOTALS_ROW.h };
  };
  place(ctx, formatDecimalHours(totals.absenceMinutes), totalBox("absence"), { size: 12 });
  place(ctx, formatDecimalHours(totals.extraMinutes), totalBox("extra"), { size: 12 });
  place(ctx, formatEuros(totals.maintenanceCents), totalBox("maintenance"), { size: 12 });
  place(ctx, formatEuros(totals.mealCents), totalBox("meal"), { size: 12 });
  place(ctx, `${totals.paidLeaveDays + totals.unpaidLeaveDays} j`, totalBox("leave"), { size: 12 });

  // Récapitulatif. Le salaire n'apparaît que s'il a été saisi.
  const recap = [
    c.monthlyMinutes ? `${formatDecimalHours(c.monthlyMinutes)} h` : "",
    `${formatDecimalHours(totals.absenceMinutes)} h`,
    `${formatDecimalHours(totals.extraMinutes)} h`,
    `${formatEuros(totals.maintenanceCents)} €`,
    `${formatEuros(totals.mealCents)} €`,
    `${totals.paidLeaveDays} j`,
    `${totals.unpaidLeaveDays} j`,
    data.salaryFinalCents != null ? `${formatEuros(data.salaryFinalCents)} €` : "",
  ];
  recap.forEach((text, i) =>
    place(ctx, text, { x: RECAP.x, y: RECAP.ys[i], w: RECAP.w, h: RECAP.h }, { size: 12, align: "right", background: text ? "#fff" : undefined }),
  );

  // Dates et signatures (laissées vides si non fournies : on signe après impression).
  place(ctx, formatDateFR(data.parentsDate), SIGNATURES.parentsDate, { size: 13, background: data.parentsDate ? "#fff" : undefined });
  place(ctx, formatDateFR(data.caregiverDate), SIGNATURES.caregiverDate, { size: 13, background: data.caregiverDate ? "#fff" : undefined });
  const { parentsBox: p, caregiverBox: g } = SIGNATURES;
  if (images.parentsSignature) ctx.drawImage(images.parentsSignature, p.x, p.y, p.w, p.h);
  if (images.caregiverSignature) ctx.drawImage(images.caregiverSignature, g.x, g.y, g.w, g.h);
}

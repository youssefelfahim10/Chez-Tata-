import { buildDraftLines, type BillingContract } from "@/lib/billing/invoice";
import { classifyLine, type MonthAmounts } from "./recap";

/**
 * Estimation automatique des montants d'un mois, quand aucune facture n'a encore été validée :
 * contrat (mensualisation) + ce qui a été pointé (heures complémentaires, jours d'entretien, repas).
 * C'est une ESTIMATION, toujours signalée comme telle et modifiable : la facture validée, elle, fait foi.
 */

export type EstimateContract = { childId: string; startDate: string; endDate: string | null; contract: BillingContract };
export type EstimateAttendance = { childId: string; date: string; extraMinutes: number; maintenanceDue: boolean; mealDue: boolean };

export type MonthEstimate = MonthAmounts & { estimated: true };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Mois (0 = janvier) pour lesquels on peut estimer : jamais le mois en cours ni un mois à venir,
 * car il n'est pas terminé. `today` = AAAA-MM-JJ (jour de Paris).
 */
export function estimableMonths(year: number, today: string): number[] {
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7)) - 1;
  if (year > thisYear) return [];
  const last = year < thisYear ? 11 : thisMonth - 1;
  return Array.from({ length: Math.max(0, last + 1) }, (_, i) => i);
}

/** Estimation par enfant et par mois (clé : `${childId}|${index du mois}`), sans les mois déjà couverts par une facture. */
export function estimateMonths(args: {
  year: number;
  today: string;
  contracts: EstimateContract[];
  attendance: EstimateAttendance[];
  /** Mois déjà facturés : `${childId}|${index du mois}`. */
  invoiced: Set<string>;
}): Map<string, MonthEstimate> {
  const out = new Map<string, MonthEstimate>();
  for (const month of estimableMonths(args.year, args.today)) {
    const prefix = `${args.year}-${pad(month + 1)}`;
    const first = `${prefix}-01`;
    const last = `${prefix}-31`;
    for (const c of args.contracts) {
      const key = `${c.childId}|${month}`;
      if (args.invoiced.has(key) || out.has(key)) continue;
      // Contrat en vigueur pendant ce mois.
      if (c.startDate > last || (c.endDate !== null && c.endDate < first)) continue;
      const rows = args.attendance.filter((a) => a.childId === c.childId && a.date.startsWith(prefix));
      const lines = buildDraftLines(c.contract, {
        extraMinutes: rows.reduce((t, r) => t + Math.max(0, r.extraMinutes), 0),
        maintenanceDays: rows.filter((r) => r.maintenanceDue).length,
        mealDays: rows.filter((r) => r.mealDue).length,
      });
      let salaryCents = 0;
      let allowanceCents = 0;
      for (const l of lines) {
        if (classifyLine(l.label) === "allowance") allowanceCents += l.amountCents;
        else salaryCents += l.amountCents;
      }
      if (salaryCents === 0 && allowanceCents === 0) continue;
      out.set(key, { salaryCents, allowanceCents, estimated: true });
    }
  }
  return out;
}

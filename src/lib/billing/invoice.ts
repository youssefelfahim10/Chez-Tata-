import { monthlyEstimateCents } from "@/lib/finance/summary";
import { formatDecimalHours } from "@/lib/sheet/compute";

/**
 * Lignes proposées pour la facture d'un mois, à partir du contrat et de ce qui a été pointé.
 * Montants en centimes entiers. L'assistante peut cocher, corriger ou ajouter des lignes avant de valider.
 */

export type BillingContract = {
  scheduledHours: number;
  weeksPerYear: number;
  /** Salaire horaire net, en centimes. */
  hourlyRateCents: number;
  maintenanceCents: number;
  mealCents: number;
};

export type MonthActivity = { extraMinutes: number; maintenanceDays: number; mealDays: number };

export type DraftLine = { key: "base" | "extra" | "maintenance" | "meal"; label: string; detail: string; amountCents: number };

const euros = (cents: number) =>
  `${Math.floor(cents / 100).toLocaleString("fr-FR").replace(/[  ]/g, " ")},${String(cents % 100).padStart(2, "0")} €`;

/** Heures complémentaires : minutes × taux horaire ÷ 60, arrondi au centime le plus proche (entiers). */
export function extraPayCents(minutes: number, hourlyRateCents: number): number {
  return Math.floor((minutes * hourlyRateCents * 2 + 60) / 120);
}

export function buildDraftLines(contract: BillingContract, activity: MonthActivity): DraftLine[] {
  const lines: DraftLine[] = [];
  const base = monthlyEstimateCents({
    scheduledHours: contract.scheduledHours,
    weeksPerYear: contract.weeksPerYear,
    hourlyRate: contract.hourlyRateCents / 100,
  });
  lines.push({
    key: "base",
    label: "Accueil mensualisé",
    detail: `${formatDecimalHours(Math.round(contract.scheduledHours * 60))} h × ${contract.weeksPerYear} sem ÷ 12 × ${euros(contract.hourlyRateCents)}`,
    amountCents: base,
  });
  if (activity.extraMinutes > 0) {
    lines.push({
      key: "extra",
      label: "Heures complémentaires",
      detail: `${formatDecimalHours(activity.extraMinutes)} h × ${euros(contract.hourlyRateCents)}`,
      amountCents: extraPayCents(activity.extraMinutes, contract.hourlyRateCents),
    });
  }
  if (activity.maintenanceDays > 0 && contract.maintenanceCents > 0) {
    lines.push({
      key: "maintenance",
      label: "Indemnités d'entretien",
      detail: `${activity.maintenanceDays} j × ${euros(contract.maintenanceCents)}`,
      amountCents: activity.maintenanceDays * contract.maintenanceCents,
    });
  }
  if (activity.mealDays > 0 && contract.mealCents > 0) {
    lines.push({
      key: "meal",
      label: "Indemnités de repas",
      detail: `${activity.mealDays} × ${euros(contract.mealCents)}`,
      amountCents: activity.mealDays * contract.mealCents,
    });
  }
  return lines;
}

export const sumLines = (lines: { amountCents: number }[]) => lines.reduce((t, l) => t + l.amountCents, 0);

export const PAYMENT_METHODS = [
  { value: "virement", label: "Virement", icon: "🏦" },
  { value: "cheque", label: "Chèque", icon: "🧾" },
  { value: "especes", label: "Espèces", icon: "💶" },
  { value: "cesu", label: "CESU / Pajemploi", icon: "📨" },
  { value: "autre", label: "Autre", icon: "➕" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const paymentMethodLabel = (value: string) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? "Autre";

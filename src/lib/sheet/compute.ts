/**
 * Calculs de la fiche de présence mensuelle (logique pure, sans réseau).
 * Durées en minutes entières, montants en centimes entiers : jamais de flottants.
 * Ces totaux sont des additions de ce qui a été saisi ; le salaire à verser
 * n'est jamais calculé ici (il est saisi, voir `salaryFinalCents`).
 */

export type LeaveKind = "CP" | "CSS";

export type SheetDay = {
  /** Heure d'arrivée « HH:MM » (heure de Paris). */
  in?: string;
  out?: string;
  absenceMinutes?: number;
  extraMinutes?: number;
  /** Indemnité d'entretien due ce jour-là (montant pris dans le contrat). */
  maintenance?: boolean;
  /** Indemnité repas / goûter due ce jour-là. */
  meal?: boolean;
  leave?: LeaveKind | null;
  note?: string;
};

export type SheetContract = {
  /** AAAA-MM-JJ */
  startDate?: string;
  schedule?: string;
  monthlyMinutes?: number;
  weeklyMinutes?: number;
  hourlyNetCents?: number;
  monthlyNetCents?: number;
  maintenanceCents?: number;
  mealCents?: number;
};

export type SheetData = {
  /** AAAA-MM */
  month: string;
  childName: string;
  caregiverName: string;
  contract: SheetContract;
  days: Record<number, SheetDay>;
  /** Montant validé par l'utilisateur sur la paie : jamais calculé automatiquement. */
  salaryFinalCents?: number | null;
  parentsDate?: string;
  caregiverDate?: string;
  /** Signatures dessinées (data URL PNG), facultatives. */
  parentsSignature?: string;
  caregiverSignature?: string;
};

export type SheetTotals = {
  presenceMinutes: number;
  absenceMinutes: number;
  extraMinutes: number;
  maintenanceCents: number;
  mealCents: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
};

export function parseMonth(month: string): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error(`Mois invalide : ${month}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function daysInMonth(month: string): number {
  const { year, month: m } = parseMonth(month);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function parseTime(value: string | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes de présence ; `null` si une heure manque ou si le départ précède l'arrivée. */
export function presenceMinutes(day: SheetDay): number | null {
  const start = parseTime(day.in);
  const end = parseTime(day.out);
  if (start === null || end === null || end < start) return null;
  return end - start;
}

export function computeTotals(data: SheetData): SheetTotals {
  const totals: SheetTotals = {
    presenceMinutes: 0,
    absenceMinutes: 0,
    extraMinutes: 0,
    maintenanceCents: 0,
    mealCents: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
  };
  const last = daysInMonth(data.month);
  for (let d = 1; d <= last; d += 1) {
    const day = data.days[d];
    if (!day) continue;
    totals.presenceMinutes += presenceMinutes(day) ?? 0;
    totals.absenceMinutes += day.absenceMinutes ?? 0;
    totals.extraMinutes += day.extraMinutes ?? 0;
    if (day.maintenance) totals.maintenanceCents += data.contract.maintenanceCents ?? 0;
    if (day.meal) totals.mealCents += data.contract.mealCents ?? 0;
    if (day.leave === "CP") totals.paidLeaveDays += 1;
    if (day.leave === "CSS") totals.unpaidLeaveDays += 1;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Formats français
// ---------------------------------------------------------------------------

/** 90 → « 1,5 » ; 45 → « 0,75 » (heures décimales, 2 décimales au plus). */
export function formatDecimalHours(minutes: number): string {
  const hours = minutes / 60;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(hours);
}

/** 1234 → « 12,34 » (sans symbole ; l'euro est imprimé sur la fiche). */
export function formatEuros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${euros.toLocaleString("fr-FR").replace(/ /g, " ")},${rest}`;
}

/** « 2026-11-19 » → « 19/11/2026 » ; valeur invalide → chaîne vide. */
export function formatDateFR(iso: string | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function monthNameFR(month: string): string {
  const { year, month: m } = parseMonth(month);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, m - 1, 1)));
}

/** « 1,5 », « 1.25 » ou « 2 » → minutes ; vide ou invalide → 0. */
export function hoursInputToMinutes(input: string): number {
  const value = Number.parseFloat(input.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : 0;
}

/** « 12,5 » ou « 12.50 » → centimes ; vide ou invalide → null. */
export function eurosInputToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [euros, decimals = ""] = cleaned.split(".");
  return Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
}

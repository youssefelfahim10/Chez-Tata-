/**
 * Calculs du tableau de bord. Entiers uniquement (centimes), jamais de flottants
 * dans les montants. Les estimations sont des repères, pas une paie officielle.
 */

export type ContractFigures = { scheduledHours: number; weeksPerYear: number; hourlyRate: number };

/**
 * Mensualisation usuelle : heures par semaine × semaines travaillées ÷ 12 × taux horaire.
 * Estimation indicative du salaire mensuel net hors indemnités ; la fiche de paie fait foi.
 */
export function monthlyEstimateCents({ scheduledHours, weeksPerYear, hourlyRate }: ContractFigures): number {
  const hours100 = Math.round(scheduledHours * 100);
  const weeks10 = Math.round(weeksPerYear * 10);
  const rate10000 = Math.round(hourlyRate * 10000);
  const numerator = hours100 * weeks10 * rate10000;
  const denominator = 1_200_000; // 100 × 10 × 10 000 × 12 ÷ 100 (euros → centimes)
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** Heures mensualisées (en minutes) : heures hebdo × semaines ÷ 12. */
export function monthlyMinutes({ scheduledHours, weeksPerYear }: ContractFigures): number {
  return Math.round((Math.round(scheduledHours * 100) * Math.round(weeksPerYear * 10) * 60) / (100 * 10 * 12));
}

export type ExpenseRow = { category: string; amount_cents: number };

export function sumCents(rows: { amount_cents: number }[]): number {
  return rows.reduce((total, r) => total + r.amount_cents, 0);
}

/** Totaux par catégorie, du plus gros au plus petit ; part en pourcentage entier du total. */
export function groupByCategory(rows: ExpenseRow[]): { category: string; totalCents: number; count: number; percent: number }[] {
  const map = new Map<string, { totalCents: number; count: number }>();
  for (const r of rows) {
    const entry = map.get(r.category) ?? { totalCents: 0, count: 0 };
    entry.totalCents += r.amount_cents;
    entry.count += 1;
    map.set(r.category, entry);
  }
  const total = sumCents(rows);
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v, percent: total > 0 ? Math.round((v.totalCents * 100) / total) : 0 }))
    .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category));
}

/** Premier jour du mois et du mois suivant (AAAA-MM-JJ). */
export function monthRange(month: string): { first: string; after: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { first: `${month}-01`, after: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Échappe une cellule CSV (guillemets, séparateurs) et neutralise l'injection de formule dans un tableur. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

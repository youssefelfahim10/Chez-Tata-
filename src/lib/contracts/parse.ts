import { eurosInputToCents } from "@/lib/sheet/compute";

/** « 7,5 » ou « 40 » → nombre d'heures ; hors de ]0 ; max] ou plus de 2 décimales → null. */
export function parseHours(input: string, max = 100): number | null {
  const cleaned = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 && value <= max ? value : null;
}

/** Semaines travaillées par an : 0,5 à 52 par pas de 0,5. */
export function parseWeeks(input: string): number | null {
  const cleaned = input.trim().replace(",", ".");
  if (!/^\d+(\.\d)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value >= 1 && value <= 52 ? value : null;
}

export type ContractInput = {
  startDate: string;
  weeklyHours: number;
  weeksPerYear: number;
  /** Salaire horaire net en centimes (stocké en euros, 4 décimales, côté base). */
  hourlyNetCents: number;
  maintenanceCents: number;
  mealCents: number;
};

export type ParsedContract = { ok: true; value: ContractInput } | { ok: false; error: string };

/** Valide la saisie du formulaire de contrat. Messages en français, un seul à la fois. */
export function parseContractForm(raw: Record<string, string>): ParsedContract {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.startDate ?? "") || Number.isNaN(Date.parse(raw.startDate))) {
    return { ok: false, error: "Indiquez la date de début du contrat." };
  }
  const weeklyHours = parseHours(raw.weeklyHours ?? "");
  if (weeklyHours === null) return { ok: false, error: "Heures par semaine : saisissez un nombre entre 0,01 et 100." };
  const weeksPerYear = parseWeeks(raw.weeksPerYear || "52");
  if (weeksPerYear === null) return { ok: false, error: "Semaines par an : saisissez un nombre entre 1 et 52." };
  const hourlyNetCents = eurosInputToCents(raw.hourlyNet ?? "");
  if (hourlyNetCents === null || hourlyNetCents === 0) return { ok: false, error: "Salaire horaire net : saisissez un montant en euros." };
  const maintenanceCents = raw.maintenance?.trim() ? eurosInputToCents(raw.maintenance) : 0;
  if (maintenanceCents === null) return { ok: false, error: "Indemnité d'entretien : montant invalide." };
  const mealCents = raw.meal?.trim() ? eurosInputToCents(raw.meal) : 0;
  if (mealCents === null) return { ok: false, error: "Indemnité de repas : montant invalide." };
  return { ok: true, value: { startDate: raw.startDate, weeklyHours, weeksPerYear, hourlyNetCents, maintenanceCents, mealCents } };
}

/** Type de contrat déduit des semaines : 52 = année complète, moins = année incomplète. */
export function contractTypeFor(weeksPerYear: number): "annee_complete" | "annee_incomplete" {
  return weeksPerYear >= 52 ? "annee_complete" : "annee_incomplete";
}

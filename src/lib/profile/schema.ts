import { z } from "zod";
import type { Employee } from "@/lib/documents/types";

/** Profil de l'assistante maternelle : tout est saisi par elle, rien n'est déduit ni inventé. */

export type ProfileValues = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  contactEmail: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  agreementNumber: string | null;
  agreementDate: string | null;
  agreementExpiry: string | null;
  agreementCapacity: number | null;
  insuranceCompany: string | null;
  insurancePolicy: string | null;
  insuranceExpiry: string | null;
};

/** Ligne de la table `caregiver_profiles` (colonnes utiles). */
export type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  contact_email: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  agreement_number: string | null;
  agreement_date: string | null;
  agreement_expiry: string | null;
  agreement_capacity: number | null;
  insurance_company: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
};

export const PROFILE_COLUMNS =
  "first_name, last_name, phone, contact_email, address_line, postal_code, city, agreement_number, agreement_date, agreement_expiry, agreement_capacity, insurance_company, insurance_policy, insurance_expiry";

const text = (max: number, label: string) => z.string().max(max, `${label} : ${max} caractères au plus.`).transform((v) => (v === "" ? null : v));
const date = (label: string) => z.union([z.literal(""), z.iso.date(`${label} : date invalide.`)]).transform((v) => (v === "" ? null : v));

const schema = z.object({
  displayName: z.string().max(80, "Prénom affiché : 80 caractères au plus."),
  firstName: text(80, "Prénom"),
  lastName: text(80, "Nom"),
  phone: z
    .string()
    .max(30, "Téléphone trop long.")
    .refine((v) => v === "" || /^\+?[\d\s().-]{4,29}$/.test(v), "Numéro de téléphone invalide.")
    .transform((v) => (v === "" ? null : v)),
  contactEmail: z.union([z.literal(""), z.email("Adresse e-mail invalide.").max(254)]).transform((v) => (v === "" ? null : v)),
  addressLine: text(160, "Adresse"),
  postalCode: z
    .string()
    .max(10, "Code postal trop long.")
    .refine((v) => v === "" || /^[0-9A-Za-z -]{3,10}$/.test(v), "Code postal invalide.")
    .transform((v) => (v === "" ? null : v)),
  city: text(80, "Ville"),
  agreementNumber: text(40, "Numéro d'agrément"),
  agreementDate: date("Date d'agrément"),
  agreementExpiry: date("Fin d'agrément"),
  agreementCapacity: z
    .string()
    .refine((v) => v === "" || /^[1-6]$/.test(v), "Nombre d'enfants agréés : un chiffre de 1 à 6.")
    .transform((v) => (v === "" ? null : Number(v))),
  insuranceCompany: text(80, "Assureur"),
  insurancePolicy: text(60, "Numéro de contrat"),
  insuranceExpiry: date("Échéance de l'assurance"),
});

export type ParsedProfile = { ok: true; value: ProfileValues } | { ok: false; error: string };

export function parseProfileForm(read: (key: string) => string): ParsedProfile {
  const keys = Object.keys(schema.shape) as (keyof ProfileValues)[];
  const parsed = schema.safeParse(Object.fromEntries(keys.map((k) => [k, read(k)])));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const v = parsed.data as ProfileValues;
  if (v.agreementDate && v.agreementExpiry && v.agreementExpiry < v.agreementDate) {
    return { ok: false, error: "La fin d'agrément ne peut pas être avant la date d'agrément." };
  }
  return { ok: true, value: v };
}

export function toRow(v: ProfileValues) {
  return {
    first_name: v.firstName,
    last_name: v.lastName,
    phone: v.phone,
    contact_email: v.contactEmail,
    address_line: v.addressLine,
    postal_code: v.postalCode,
    city: v.city,
    agreement_number: v.agreementNumber,
    agreement_date: v.agreementDate,
    agreement_expiry: v.agreementExpiry,
    agreement_capacity: v.agreementCapacity,
    insurance_company: v.insuranceCompany,
    insurance_policy: v.insurancePolicy,
    insurance_expiry: v.insuranceExpiry,
  };
}

export const fullName = (p: Pick<ProfileRow, "first_name" | "last_name"> | null | undefined) => [p?.first_name, p?.last_name].filter(Boolean).join(" ");

export function addressOf(p: Pick<ProfileRow, "address_line" | "postal_code" | "city"> | null | undefined): string {
  if (!p) return "";
  const town = [p.postal_code, p.city].filter(Boolean).join(" ");
  return [p.address_line, town].filter(Boolean).join(", ");
}

/** Coordonnées de l'assistante telles que les attendent les documents (contrat, facture). Vide = blanc à compléter. */
export function employeeFromProfile(p: ProfileRow | null | undefined, fallbackName = ""): Employee {
  return {
    fullName: fullName(p) || fallbackName,
    address: addressOf(p),
    phone: p?.phone ?? "",
    email: p?.contact_email ?? "",
    agrementNumber: p?.agreement_number ?? "",
    agrementDate: p?.agreement_date ?? "",
    insurer: p?.insurance_company ?? "",
    policyNumber: p?.insurance_policy ?? "",
  };
}

/** Part de la fiche remplie (pour encourager sans bloquer). */
export function completion(p: ProfileRow | null | undefined): { done: number; total: number } {
  const checks = [fullName(p), p?.address_line && p?.city, p?.phone, p?.agreement_number, p?.agreement_expiry, p?.insurance_company, p?.insurance_expiry];
  return { done: checks.filter(Boolean).length, total: checks.length };
}

export type Reminder = { key: "agreement" | "insurance"; label: string; date: string; daysLeft: number; level: "late" | "soon" };

/** Nombre de jours entre deux dates AAAA-MM-JJ (négatif si `iso` est passée). */
export function daysUntil(iso: string, todayIso: string): number {
  const a = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const b = Date.UTC(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)));
  return Math.round((a - b) / 86_400_000);
}

/** Échéances à surveiller : dépassées, ou dans les 60 jours. Seulement ce qui est saisi. */
export function remindersFor(p: Pick<ProfileRow, "agreement_expiry" | "insurance_expiry"> | null | undefined, todayIso: string, horizonDays = 60): Reminder[] {
  if (!p) return [];
  const items: [Reminder["key"], string, string | null][] = [
    ["agreement", "Agrément", p.agreement_expiry],
    ["insurance", "Assurance responsabilité civile", p.insurance_expiry],
  ];
  const out: Reminder[] = [];
  for (const [key, label, date] of items) {
    if (!date) continue;
    const daysLeft = daysUntil(date, todayIso);
    if (daysLeft <= horizonDays) out.push({ key, label, date, daysLeft, level: daysLeft < 0 ? "late" : "soon" });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function reminderText(r: Reminder): string {
  if (r.daysLeft < 0) return `${r.label} : échéance dépassée depuis ${-r.daysLeft} jour${-r.daysLeft > 1 ? "s" : ""}`;
  if (r.daysLeft === 0) return `${r.label} : échéance aujourd’hui`;
  return `${r.label} : échéance dans ${r.daysLeft} jour${r.daysLeft > 1 ? "s" : ""}`;
}

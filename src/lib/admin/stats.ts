import { z } from "zod";

/**
 * Lecture et mise en forme des chiffres de l'administration. Les données viennent des fonctions SQL
 * `admin_overview` et `admin_list_users` : on les revalide ici plutôt que de leur faire confiance aveuglément.
 */

const count = z.coerce.number().int().nonnegative();

const dailySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  signups: count,
  logins: count,
  people: count,
});

const overviewSchema = z.object({
  users_total: count,
  users_google: count,
  users_email: count,
  signups_7d: count,
  signups_30d: count,
  active_7d: count,
  active_30d: count,
  logins_7d: count,
  logins_30d: count,
  organizations: count,
  children: count,
  daily: z.array(dailySchema).max(366),
});

export type Overview = z.infer<typeof overviewSchema>;
export type DailyPoint = z.infer<typeof dailySchema>;

export function parseOverview(raw: unknown): Overview | null {
  const parsed = overviewSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const userRowSchema = z.object({
  user_id: z.uuid(),
  email: z.string().nullable(),
  display_name: z.string(),
  provider: z.string(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  suspended: z.boolean(),
  is_admin: z.boolean(),
  space_name: z.string().nullable(),
  space_count: count,
  children_count: count,
  total_count: count,
});

export type UserRow = z.infer<typeof userRowSchema>;

export function parseUserRows(raw: unknown): UserRow[] | null {
  const parsed = z.array(userRowSchema).safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const USERS_PER_PAGE = 25;

/** Numéro de page demandé dans l'adresse : entier ≥ 1, sinon 1. */
export function parsePage(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** Terme de recherche nettoyé (longueur bornée, espaces normalisés). */
export function cleanSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Hauteur relative (0–100) d'une barre ; une valeur non nulle reste toujours visible. */
export function barPercent(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

/** « 2026-11-12 » → « 12/11 ». */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/** Date et heure en France, ou un tiret si absente. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function providerLabel(provider: string): string {
  return provider === "google" ? "Google" : "E-mail";
}

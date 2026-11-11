/** Fille / garçon : sert uniquement à choisir l'icône de l'enfant. Facultatif, jamais déduit du prénom. */

export const GENDERS = ["girl", "boy"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_INFO: Record<Gender, { emoji: string; label: string; box: string }> = {
  girl: { emoji: "👧", label: "Fille", box: "bg-pink-soft" },
  boy: { emoji: "👦", label: "Garçon", box: "bg-primary-soft" },
};

/** Valeur lue en base (ou saisie) → genre connu, sinon null. */
export function toGender(value: unknown): Gender | null {
  return value === "girl" || value === "boy" ? value : null;
}

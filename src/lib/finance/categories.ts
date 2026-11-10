/** Charges courantes d'une assistante maternelle, à cocher. « Autre » demande un texte libre. */
export type ExpenseCategory = { key: string; label: string; icon: string; hint?: string };

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { key: "alimentation", label: "Alimentation", icon: "🍎", hint: "Repas, goûters, lait" },
  { key: "hygiene", label: "Hygiène", icon: "🧻", hint: "Couches, lingettes, savon" },
  { key: "jeux", label: "Jeux et fournitures", icon: "🧸", hint: "Jeux, loisirs créatifs" },
  { key: "menage", label: "Ménage et produits", icon: "🧼" },
  { key: "energie", label: "Électricité et chauffage", icon: "💡", hint: "Quote-part liée à l'accueil" },
  { key: "eau", label: "Eau", icon: "💧" },
  { key: "logement", label: "Logement", icon: "🏠", hint: "Loyer ou quote-part" },
  { key: "assurance", label: "Assurances", icon: "🛡️", hint: "RC pro, habitation" },
  { key: "materiel", label: "Matériel", icon: "🛏️", hint: "Lits, poussette, chaises" },
  { key: "transport", label: "Déplacements", icon: "🚗" },
  { key: "sorties", label: "Sorties et activités", icon: "🎉" },
  { key: "sante", label: "Santé et pharmacie", icon: "🩺" },
  { key: "formation", label: "Formation", icon: "🎓" },
  { key: "numerique", label: "Téléphone, internet, logiciels", icon: "💻" },
  { key: "gestion", label: "Comptable, cotisations", icon: "🧾" },
];

export const OTHER_KEY = "autre";

export function categoryLabel(key: string): string {
  if (key === OTHER_KEY) return "Autre";
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function categoryIcon(key: string): string {
  if (key === OTHER_KEY) return "✍️";
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.icon ?? "🧾";
}

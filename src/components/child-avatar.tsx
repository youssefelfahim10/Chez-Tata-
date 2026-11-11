import { GENDER_INFO, toGender } from "@/lib/children/gender";

const SIZES = {
  sm: "size-10 text-xl",
  md: "size-12 text-2xl",
  lg: "size-14 text-3xl",
} as const;

/**
 * Icône de l'enfant : 👧 pour une fille, 👦 pour un garçon ; sans choix, l'initiale du prénom.
 * Décoratif : le prénom est toujours écrit à côté.
 */
export function ChildAvatar({ name, gender, size = "md" }: { name: string; gender?: string | null; size?: keyof typeof SIZES }) {
  const g = toGender(gender);
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${SIZES[size]} ${g ? `${GENDER_INFO[g].box} border border-line` : "bg-sun text-ink"}`}>
      {g ? GENDER_INFO[g].emoji : name.charAt(0).toUpperCase()}
    </span>
  );
}

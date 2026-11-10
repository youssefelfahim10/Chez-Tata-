/**
 * Précisions que l'on peut cocher après un pointage. Tout est facultatif et
 * n'apparaît dans le bilan que si c'est coché : rien n'est supposé.
 */

export type DetailKey = "amount" | "diaper" | "care" | "note";

export type DetailChoice = { value: string; label: string; icon: string };

export type DetailGroup = { key: DetailKey; title: string; choices: DetailChoice[]; allowNote: boolean };

export const DETAILS: Record<"meal" | "diaper" | "care", DetailGroup> = {
  meal: {
    key: "amount",
    title: "Comment s'est passé le repas ?",
    allowNote: true,
    choices: [
      { value: "all", label: "Tout mangé", icon: "😋" },
      { value: "most", label: "Presque tout", icon: "🙂" },
      { value: "half", label: "La moitié", icon: "😐" },
      { value: "little", label: "Un peu", icon: "😕" },
      { value: "none", label: "Rien", icon: "🚫" },
      { value: "bottle", label: "Biberon", icon: "🍼" },
    ],
  },
  diaper: {
    key: "diaper",
    title: "Type de change",
    allowNote: false,
    choices: [
      { value: "wet", label: "Pipi", icon: "💧" },
      { value: "soiled", label: "Selle", icon: "💩" },
      { value: "both", label: "Les deux", icon: "💧💩" },
      { value: "dry", label: "Sec", icon: "✨" },
      { value: "redness", label: "Rougeurs", icon: "🔴" },
    ],
  },
  care: {
    key: "care",
    title: "Quel soin ?",
    allowNote: true,
    choices: [
      { value: "bump", label: "Bobo", icon: "🩹" },
      { value: "medicine", label: "Médicament", icon: "💊" },
      { value: "fever", label: "Température", icon: "🌡️" },
      { value: "cream", label: "Crème", icon: "🧴" },
      { value: "nose", label: "Nez", icon: "🤧" },
      { value: "other", label: "Autre", icon: "➕" },
    ],
  },
};

export const DETAIL_KEYS: DetailKey[] = ["amount", "diaper", "care", "note"];
export const NOTE_MAX = 120;

const allLabels: Record<string, DetailChoice> = {};
for (const group of Object.values(DETAILS)) for (const c of group.choices) allLabels[`${group.key}:${c.value}`] = c;

/** Texte lisible d'une précision (« tout mangé »), ou null si elle est inconnue. */
export function detailLabel(key: DetailKey, value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (key === "note") return value.trim() ? value.trim() : null;
  return allLabels[`${key}:${value}`]?.label.toLowerCase() ?? null;
}

/** Ne garde que des clés connues et des valeurs courtes : défense contre un payload inattendu. */
export function sanitizeDetails(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const key of DETAIL_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (key === "note") out.note = trimmed.slice(0, NOTE_MAX);
    else if (allLabels[`${key}:${trimmed}`]) out[key] = trimmed;
  }
  return out;
}

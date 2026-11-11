import type { ToneName } from "@/lib/ui/tones";

export type ActionType = "arrival" | "departure" | "meal" | "nap" | "nap_end" | "diaper" | "care";

export const LABELS: Record<ActionType, { label: string; done: string }> = {
  arrival: { label: "Arrivée", done: "Arrivée enregistrée" },
  departure: { label: "Départ", done: "Départ enregistré" },
  meal: { label: "Repas", done: "Repas enregistré" },
  nap: { label: "Sieste", done: "Début de sieste enregistré" },
  nap_end: { label: "Réveil", done: "Fin de sieste enregistrée" },
  diaper: { label: "Change", done: "Change enregistré" },
  care: { label: "Soins", done: "Soin enregistré" },
};

/** Émoji et couleur de chaque geste : les mêmes partout (écran du jour, démo, accueil). */
export const ACTION_EMOJI: Record<ActionType, string> = {
  arrival: "👋",
  departure: "🏠",
  meal: "🍽️",
  nap: "😴",
  nap_end: "🌤️",
  diaper: "🧷",
  care: "🩹",
};

export const ACTION_TONE: Record<ActionType, ToneName> = {
  arrival: "leaf",
  departure: "primary",
  meal: "gold",
  nap: "dusk",
  nap_end: "dusk",
  diaper: "aqua",
  care: "rose",
};

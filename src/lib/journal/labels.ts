export type ActionType = "arrival" | "departure" | "meal" | "nap" | "nap_end" | "diaper" | "care";

export const LABELS: Record<ActionType, { label: string; done: string; icon: string; tone: string }> = {
  arrival: { label: "Arrivée", done: "Arrivée enregistrée", icon: "👋", tone: "bg-leaf-soft border-leaf/30" },
  departure: { label: "Départ", done: "Départ enregistré", icon: "🏠", tone: "bg-sky-soft border-ink/10" },
  meal: { label: "Repas", done: "Repas enregistré", icon: "🍽️", tone: "bg-sun-soft border-sun/40" },
  nap: { label: "Sieste", done: "Début de sieste enregistré", icon: "😴", tone: "bg-sky-soft border-ink/10" },
  nap_end: { label: "Réveil", done: "Fin de sieste enregistrée", icon: "🌤️", tone: "bg-leaf-soft border-leaf/40" },
  diaper: { label: "Change", done: "Change enregistré", icon: "🧷", tone: "bg-cream border-line" },
  care: { label: "Soins", done: "Soin enregistré", icon: "🩹", tone: "bg-primary-soft border-primary/20" },
};

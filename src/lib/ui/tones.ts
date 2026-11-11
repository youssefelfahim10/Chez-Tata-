/**
 * Couleurs fonctionnelles : une couleur = un sens, partout (accueil, démo, écrans de l'appli).
 * Règle d'accessibilité : la couleur n'est JAMAIS seule, elle accompagne toujours une icône et un texte.
 * Les classes sont écrites en entier (Tailwind ne devine pas les noms construits).
 */
export const TONES = {
  leaf: { box: "bg-leaf-soft border-leaf/30", icon: "text-leaf", chip: "bg-leaf-soft text-leaf" },
  primary: { box: "bg-primary-soft border-primary/25", icon: "text-primary", chip: "bg-primary-soft text-primary" },
  gold: { box: "bg-sun-soft border-sun/50", icon: "text-gold-deep", chip: "bg-sun-soft text-gold-deep" },
  dusk: { box: "bg-dusk-soft border-dusk/25", icon: "text-dusk", chip: "bg-dusk-soft text-dusk" },
  aqua: { box: "bg-aqua-soft border-aqua/25", icon: "text-aqua", chip: "bg-aqua-soft text-aqua" },
  rose: { box: "bg-pink-soft border-rose/25", icon: "text-rose", chip: "bg-pink-soft text-rose" },
} as const;

export type ToneName = keyof typeof TONES;

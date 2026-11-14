import type { ReactNode } from "react";

/** Cadre de téléphone de la démonstration. Zone d'écran de hauteur fixe : les scènes ne « sautent » jamais. */
export function Phone({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div
      className="relative mx-auto w-[300px] shrink-0 rounded-[2.8rem] border border-ink/90 bg-ink p-[9px] shadow-[0_60px_100px_-45px_rgb(15_31_61/0.65)]"
      role="img"
      aria-label={label ?? "Aperçu de l’application sur un téléphone"}
    >
      <div className="relative h-[560px] overflow-hidden rounded-[2.2rem] bg-cream">
        <div aria-hidden className="absolute left-1/2 top-2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <div className="h-full pt-9">{children}</div>
      </div>
    </div>
  );
}

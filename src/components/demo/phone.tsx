import type { ReactNode } from "react";

/**
 * Cadre de téléphone de la démonstration. Zone d'écran de hauteur fixe : les scènes ne « sautent » jamais.
 * `wide` : largeur d'un vrai téléphone (390 px), pour que le mode « essayer » ait exactement les tailles de l'application.
 */
export function Phone({ children, label, wide = false }: { children: ReactNode; label?: string; wide?: boolean }) {
  return (
    <div
      className={`relative mx-auto shrink-0 rounded-[2.8rem] border border-ink/90 bg-ink p-[9px] shadow-[0_60px_100px_-45px_rgb(15_31_61/0.65)] ${wide ? "w-[408px]" : "w-[300px]"}`}
      role="img"
      aria-label={label ?? "Aperçu de l’application sur un téléphone"}
    >
      <div className={`relative overflow-hidden rounded-[2.2rem] bg-cream ${wide ? "h-[760px]" : "h-[560px]"}`}>
        <div aria-hidden className="absolute left-1/2 top-2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <div className="h-full pt-9">{children}</div>
      </div>
    </div>
  );
}

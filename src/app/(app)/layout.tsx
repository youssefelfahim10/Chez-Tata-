import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBanner } from "@/components/demo-banner";
import { DesktopNav } from "@/components/desktop-nav";

/**
 * Coque de l'application. Téléphone et tablette (< 1024 px) : une colonne et la barre d'onglets en bas, inchangées.
 * PC (≥ 1024 px) : barre latérale à gauche, contenu plus large. Un élément portant `data-wide` peut occuper toute la largeur ;
 * les autres restent à une largeur de lecture confortable.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense>
        <DemoBanner />
      </Suspense>
      <div className="flex flex-1 flex-col lg:flex-row">
        <Suspense>
          <DesktopNav />
        </Suspense>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-6 pb-28 lg:mx-0 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-12 lg:[&>*]:max-w-3xl lg:[&>[data-wide]]:max-w-none">{children}</main>
      </div>
      <Suspense>
        <BottomNav />
      </Suspense>
    </>
  );
}

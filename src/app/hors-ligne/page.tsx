import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hors ligne" };

/** Page de secours servie par le service worker quand l'appareil n'a plus de réseau. */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p aria-hidden className="text-6xl">
        📴
      </p>
      <h1 className="text-2xl font-extrabold">Vous êtes hors ligne</h1>
      <p className="text-ink-soft">
        Cette page n’a pas encore été ouverte avec du réseau. Dès que la connexion revient, rechargez-la. Les saisies déjà faites sur ce
        téléphone sont conservées.
      </p>
      <a href="/aujourdhui" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 font-bold text-white">
        Réessayer
      </a>
    </main>
  );
}

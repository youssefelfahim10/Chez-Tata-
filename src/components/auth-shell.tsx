import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Écran d'accès : panneau marine (la mascotte garde sa place ici) et formulaire sur fond ivoire.
 * Sur téléphone, le panneau devient un bandeau compact au-dessus du formulaire.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <aside className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-strong to-[#011a40] px-6 pb-9 pt-8 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/5 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-sun/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Image src="/logo-sm.png" alt="" width={44} height={44} className="size-11 rounded-xl ring-1 ring-white/25" priority />
          <span className="font-display text-3xl font-semibold tracking-wide">Chez TaTa</span>
        </div>

        <div className="relative mt-8 flex flex-col items-center gap-6 text-center lg:mt-0">
          <Image
            src="/logo-ours.png"
            alt="La mascotte Chez TaTa"
            width={240}
            height={240}
            className="size-32 rounded-[2rem] shadow-[0_24px_50px_-20px_rgb(0_0_0/0.65)] ring-2 ring-sun/80 ring-offset-4 ring-offset-primary-strong lg:size-52"
            priority
          />
          <div className="hidden lg:block">
            <span aria-hidden className="mx-auto block h-px w-16 bg-sun" />
            <p className="mt-5 font-display text-4xl font-medium leading-tight">Votre métier, avec l’élégance qu’il mérite.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">Journal, présences, contrats et factures réunis dans un espace privé, sécurisé et soigné.</p>
          </div>
        </div>

        <p className="relative mt-8 hidden text-xs font-semibold uppercase tracking-[0.22em] text-sun lg:block">Espace privé · Données protégées</p>
      </aside>

      <section className="flex flex-1 items-center justify-center bg-cream px-4 py-10 lg:px-12">
        <div className="flex w-full max-w-md flex-col gap-7">
          <div className="flex flex-col gap-2 text-center lg:text-left">
            <span aria-hidden className="mx-auto h-0.5 w-10 bg-sun lg:mx-0" />
            <h1 className="font-display text-5xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle ? <p className="text-base text-ink-soft">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

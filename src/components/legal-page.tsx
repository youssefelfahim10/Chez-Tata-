import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-cream">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-primary">
            <Image src="/logo-sm.png" alt="" width={36} height={36} className="size-9 rounded-xl" />
            Chez TaTa
          </Link>
          <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-2xl px-4 font-bold hover:bg-primary-soft">Se connecter</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-primary-strong">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">Dernière mise à jour : {LEGAL.updatedOn}</p>
        {intro ? <p className="mt-4 text-lg text-ink-soft">{intro}</p> : null}
        <div className="mt-8 flex flex-col gap-8 [&_a]:font-bold [&_a]:text-primary [&_a]:underline [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-primary-strong [&_li]:leading-relaxed [&_p]:leading-relaxed [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <footer className="border-t border-line bg-surface">
        <nav aria-label="Informations légales" className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm font-bold text-primary">
          <Link href="/confidentialite" className="underline">Confidentialité</Link>
          <Link href="/conditions" className="underline">Conditions d’utilisation</Link>
          <Link href="/mentions-legales" className="underline">Mentions légales</Link>
          <Link href="/suppression-compte" className="underline">Supprimer mon compte</Link>
          <Link href="/aide" className="underline">Aide</Link>
        </nav>
      </footer>
    </div>
  );
}

export function Contact() {
  return LEGAL.contactEmail ? (
    <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
  ) : (
    <span className="font-bold text-danger">adresse de contact à compléter</span>
  );
}

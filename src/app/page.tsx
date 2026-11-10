import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DemoGate } from "@/components/demo-gate";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

export const metadata: Metadata = {
  title: "Chez TaTa — Moins d'administratif, plus de temps pour les enfants",
  description:
    "Le carnet de bord des assistantes maternelles et des MAM : pointage en une touche, hors ligne, dictée vocale, bilan WhatsApp, fiche de présence illustrée et suivi des charges.",
};

const FEATURES = [
  { icon: "👆", title: "Pointage en une touche", text: "Arrivée, repas, sieste, change, soins : un geste, une confirmation, l’heure exacte." },
  { icon: "📴", title: "Fonctionne sans réseau", text: "Vos saisies restent sur le téléphone et partent toutes seules au retour du réseau." },
  { icon: "🎙️", title: "Dictée vocale", text: "« Lou est arrivé à 8h30 » : l’appli propose, vous validez. Jamais d’enregistrement sans vous." },
  { icon: "💬", title: "Bilan WhatsApp", text: "Un message clair, que vous relisez et modifiez. Il n’est jamais envoyé automatiquement." },
  { icon: "🧾", title: "Charges à cocher", text: "Alimentation, hygiène, assurances… cochez, saisissez le montant, exportez en CSV." },
  { icon: "📄", title: "Fiche de présence A4", text: "La fiche illustrée Chez TaTa, remplie pour vous, en PDF, prête à signer." },
  { icon: "👩‍👩‍👧", title: "Indépendante ou MAM", text: "Un espace par assistante. En MAM, les enfants se partagent, les contrats et finances restent privés." },
  { icon: "🔐", title: "Données protégées", text: "Hébergement dans l’Union européenne et isolation stricte entre les comptes, contrôlée par la base elle-même." },
] as const;

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-gradient-to-br from-leaf-soft via-cream to-sun-soft">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <p className="text-xl font-extrabold text-primary">🧸 Chez TaTa</p>
          <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-surface px-4 font-bold">
            Se connecter
          </Link>
        </div>
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 pb-12 pt-6 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Moins d’administratif, <span className="text-primary">plus de temps pour les enfants.</span>
            </h1>
            <p className="text-lg text-ink-soft">
              Le carnet de bord des assistantes maternelles et des MAM : on pointe la journée en une touche, même sans réseau, et le reste se fait tout seul.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/inscription" className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-7 text-lg font-extrabold text-white">
                ✨ Créer mon espace
              </Link>
              <Link href="/connexion" className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-line bg-surface px-7 text-lg font-extrabold">
                Se connecter
              </Link>
            </div>
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink-soft">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#25D366] text-white">
                <WhatsAppIcon className="size-4" />
              </span>
              Partage du bilan sur WhatsApp, toujours à votre validation
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm rotate-1 rounded-card border border-line bg-surface p-2 shadow-xl">
            <Image src="/fiche/modele-a4.jpg" alt="Aperçu de la fiche de présence illustrée Chez TaTa" width={1055} height={1491} sizes="(max-width: 768px) 80vw, 384px" className="h-auto w-full rounded-2xl" priority />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <h2 className="text-center text-3xl font-extrabold">Pensé pour le terrain</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-ink-soft">Une main sur le bébé, l’autre sur le téléphone : de gros boutons, peu de texte à écrire, tout en français.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-card border border-line bg-surface p-5 shadow-sm">
              <p aria-hidden className="text-3xl">
                {f.icon}
              </p>
              <h3 className="mt-2 text-lg font-extrabold">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
            </li>
          ))}
        </ul>

        <section className="mt-12 rounded-card bg-leaf-soft p-6 text-center">
          <h2 className="text-2xl font-extrabold">Prête à gagner du temps ?</h2>
          <p className="mt-1 text-ink-soft">Créez votre espace en quelques secondes.</p>
          <Link href="/inscription" className="mt-4 inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-8 text-lg font-extrabold text-white">
            Commencer
          </Link>
        </section>

        <section className="mx-auto mt-12 max-w-md" aria-labelledby="demo-title">
          <details className="rounded-card border border-line bg-surface p-5 shadow-sm">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-lg font-extrabold" id="demo-title">
              🎪 Accès démo <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold">équipe</span>
            </summary>
            <p className="mb-4 mt-2 text-sm text-ink-soft">
              Réservé à l’équipe Chez TaTa : explorez l’appli avec des données fictives. Vous pourrez ensuite vous connecter avec un autre compte à tout moment.
            </p>
            <DemoGate />
          </details>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-ink-soft">
          <p className="font-bold text-ink">Chez TaTa</p>
          <p>Conçu pour protéger les données des enfants : isolation entre comptes, hébergement dans l’Union européenne, aucun envoi automatique d’informations.</p>
          <p>Mentions légales et politique de confidentialité : à publier avant l’ouverture au public.</p>
        </div>
      </footer>
    </div>
  );
}

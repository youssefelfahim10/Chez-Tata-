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

const TICKER = [
  "👆 Pointage en une touche",
  "📴 Fonctionne sans réseau",
  "🎙️ Dictée vocale",
  "💬 Bilan WhatsApp à valider",
  "🧾 Charges à cocher",
  "📄 Fiche A4 illustrée",
  "👩‍👩‍👧 Indépendante ou MAM",
  "🔐 Données protégées",
] as const;

const STEPS = [
  { n: "1", icon: "👆", title: "Vous pointez", text: "Arrivée, repas, sieste, change, soins : une touche, l’heure exacte, même sans réseau." },
  { n: "2", icon: "✅", title: "Vous cochez", text: "« Tout mangé », « pipi », « bobo »… Des choix prêts à toucher, un mot libre si besoin." },
  { n: "3", icon: "💬", title: "Vous partagez", text: "Le bilan du jour s’écrit tout seul. Vous le relisez, puis vous l’envoyez vous-même." },
] as const;

const FEATURES = [
  { icon: "👆", tone: "bg-leaf-soft", title: "Pointage en une touche", text: "De gros boutons colorés, pensés pour une seule main et un bébé dans l’autre." },
  { icon: "📴", tone: "bg-sun-soft", title: "Sans réseau, sans stress", text: "Vos saisies restent sur le téléphone et partent toutes seules, avec l’heure réelle du geste." },
  { icon: "🎙️", tone: "bg-primary-soft", title: "Dictée vocale", text: "« Lou est arrivé à 8h30 » : l’appli propose, vous validez. Jamais d’enregistrement sans vous." },
  { icon: "💬", tone: "bg-leaf-soft", title: "Bilan WhatsApp", text: "Un message clair, modifiable, jamais envoyé automatiquement. Les données manquantes sont omises." },
  { icon: "🧾", tone: "bg-sun-soft", title: "Charges à cocher", text: "Alimentation, hygiène, assurances… cochez, saisissez le montant, exportez en CSV." },
  { icon: "📄", tone: "bg-sky-soft", title: "Fiche de présence A4", text: "La fiche illustrée Chez TaTa, remplie pour vous, en PDF, prête à signer." },
  { icon: "📊", tone: "bg-primary-soft", title: "Tableau de bord", text: "Enfants, contrats, revenus estimés et charges du mois, d’un seul regard." },
  { icon: "🔐", tone: "bg-leaf-soft", title: "Données protégées", text: "Hébergement dans l’Union européenne, comptes strictement isolés, contrôlé par la base elle-même." },
] as const;

const PILLARS = [
  { icon: "🇪🇺", title: "Hébergé dans l’UE", text: "Base de données et authentification en Europe." },
  { icon: "🧱", title: "Comptes cloisonnés", text: "Chaque assistante ne voit que ses données : la règle est dans la base, pas seulement dans l’appli." },
  { icon: "✋", title: "Jamais d’envoi automatique", text: "Rien sur un enfant ne part sans votre relecture et votre validation." },
  { icon: "🧾", title: "Traçabilité", text: "Corrections conservées, historique des actions, annulation en un geste." },
] as const;

function PhoneMockup() {
  return (
    <div aria-hidden className="relative mx-auto h-[560px] w-full max-w-[400px] select-none">
      {/* Fiche A4 derrière le téléphone */}
      <div className="anim-float absolute right-0 top-14 w-44 rounded-2xl border border-line bg-surface p-1.5 shadow-xl" style={{ ["--r" as string]: "7deg" }}>
        <Image src="/fiche/modele-a4.jpg" alt="" width={1055} height={1491} sizes="176px" className="h-auto w-full rounded-xl" priority />
      </div>

      {/* Téléphone */}
      <div className="anim-float absolute left-0 top-0 w-[252px] rounded-[2.6rem] border-[7px] border-ink bg-cream shadow-[0_40px_80px_-30px_rgb(24_52_46/0.55)]" style={{ animationDelay: "-2s", ["--r" as string]: "-2deg" }}>
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-ink" />
        <div className="px-3.5 pb-4 pt-3">
          <p className="text-lg font-extrabold leading-tight">Bonjour TaTa !</p>
          <p className="text-[11px] text-ink-soft">mardi 10 novembre 2026</p>

          <div className="relative mt-2.5 h-9">
            <p className="phone-chip-before absolute inset-0 flex items-center rounded-2xl bg-sun-soft px-3 text-xs font-extrabold">😴 Aucun enfant présent</p>
            <p className="phone-chip-after absolute inset-0 flex items-center rounded-2xl bg-leaf-soft px-3 text-xs font-extrabold text-leaf" style={{ opacity: 0 }}>👶 1 enfant présent</p>
          </div>

          <div className="mt-2.5 rounded-3xl border border-line bg-surface p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-full bg-sun text-base font-extrabold">L</span>
              <div className="flex-1">
                <p className="text-sm font-extrabold leading-none">Lou</p>
                <p className="mt-1 text-[10px] text-ink-soft">Journée du jour</p>
              </div>
              <span className="relative block h-6 w-[88px]">
                <span className="phone-chip-before absolute inset-0 flex items-center justify-center rounded-full bg-sun-soft text-[9px] font-bold">Pas encore arrivé</span>
                <span className="phone-chip-after absolute inset-0 flex items-center justify-center rounded-full bg-leaf-soft text-[10px] font-bold text-leaf" style={{ opacity: 0 }}>Présent</span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-extrabold">
              <span className="phone-tap flex h-14 flex-col items-center justify-center rounded-xl border border-leaf/30 bg-leaf-soft"><span className="text-xl">👋</span>Arrivée</span>
              <span className="flex h-14 flex-col items-center justify-center rounded-xl border border-ink/10 bg-sky-soft"><span className="text-xl">🏠</span>Départ</span>
              <span className="flex h-14 flex-col items-center justify-center rounded-xl border border-sun/40 bg-sun-soft"><span className="text-xl">🍽️</span>Repas</span>
              <span className="flex h-14 flex-col items-center justify-center rounded-xl border border-ink/10 bg-sky-soft"><span className="text-xl">😴</span>Sieste</span>
              <span className="flex h-14 flex-col items-center justify-center rounded-xl border border-line bg-cream"><span className="text-xl">🧷</span>Change</span>
              <span className="flex h-14 flex-col items-center justify-center rounded-xl border border-primary/20 bg-primary-soft"><span className="text-xl">🩹</span>Soins</span>
            </div>
            <p className="mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-[11px] font-extrabold text-[#06301a]">
              <WhatsAppIcon className="size-4 text-white" /> Bilan du jour
            </p>
          </div>
          <p className="phone-toast mt-3 rounded-2xl bg-ink px-3 py-2 text-[11px] font-bold text-white" style={{ opacity: 0 }}>
            ✓ Arrivée enregistrée pour Lou
          </p>
        </div>
      </div>

      {/* Pastilles flottantes */}
      <p className="anim-float absolute right-1 top-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-extrabold shadow-lg" style={{ animationDelay: "-1s" }}>
        📴 Synchronisé ✓
      </p>
      <p className="anim-float absolute bottom-24 right-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-extrabold shadow-lg" style={{ animationDelay: "-3.5s" }}>
        🎙️ « Noa a mangé »
      </p>
      <p className="anim-float absolute bottom-2 left-24 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-extrabold text-[#06301a] shadow-lg" style={{ animationDelay: "-5s" }}>
        💬 Bilan prêt à valider
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <header className="ct-glass sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-xl font-extrabold text-primary">
            <Image src="/logo-sm.png" alt="" width={40} height={40} className="size-10 rounded-xl shadow-sm" priority />
            Chez TaTa
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-bold text-ink-soft md:flex">
            <a href="#comment" className="hover:text-ink">Comment ça marche</a>
            <a href="#fonctions" className="hover:text-ink">Fonctions</a>
            <a href="#securite" className="hover:text-ink">Sécurité</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-2xl px-4 font-bold hover:bg-primary-soft">Se connecter</Link>
            <Link href="/inscription" className="hidden min-h-11 items-center rounded-2xl bg-primary px-5 font-extrabold text-white sm:inline-flex">Créer mon espace</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft via-cream to-cream" />
        <div aria-hidden className="anim-blob pointer-events-none absolute -left-24 top-10 -z-10 size-80 rounded-full bg-[#9dbcf0]/55 blur-3xl" />
        <div aria-hidden className="anim-blob pointer-events-none absolute right-0 top-0 -z-10 size-96 rounded-full bg-sun/30 blur-3xl" style={{ animationDelay: "-6s" }} />
        <div aria-hidden className="anim-blob pointer-events-none absolute bottom-0 left-1/3 -z-10 size-72 rounded-full bg-[#f7c6d4]/50 blur-3xl" style={{ animationDelay: "-11s" }} />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div className="flex flex-col gap-6">
            <p className="anim-up inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-surface/80 px-4 py-1.5 text-sm font-bold text-primary shadow-sm">
              <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-pink opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-pink" /></span>
              Pour les assistantes maternelles et les MAM
            </p>
            <h1 className="anim-up font-display text-[3rem] font-semibold leading-[1.02] tracking-tight sm:text-7xl" style={{ animationDelay: "0.1s" }}>
              Moins d’administratif,
              <br />
              <span className="ct-gradient-text">plus de temps pour les enfants.</span>
            </h1>
            <p className="anim-up max-w-xl text-lg leading-relaxed text-ink-soft" style={{ animationDelay: "0.22s" }}>
              Le carnet de bord qui se remplit en une touche, même sans réseau. Le reste — bilan, fiche de présence, charges — se prépare tout seul.
            </p>
            <div className="anim-up flex flex-wrap gap-3" style={{ animationDelay: "0.34s" }}>
              <Link href="/inscription" className="ct-shimmer anim-shimmer inline-flex min-h-14 items-center justify-center rounded-2xl px-8 text-lg font-extrabold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5">
                ✨ Créer mon espace
              </Link>
              <Link href="/connexion" className="ct-glass inline-flex min-h-14 items-center justify-center rounded-2xl border border-line px-8 text-lg font-extrabold transition hover:-translate-y-0.5">
                Se connecter
              </Link>
            </div>
            <ul className="anim-up grid max-w-xl grid-cols-3 gap-3 pt-2" style={{ animationDelay: "0.46s" }}>
              {[
                ["1 touche", "pour pointer"],
                ["0 envoi", "automatique"],
                ["100 %", "des pointages sans réseau"],
              ].map(([big, small]) => (
                <li key={big} className="rounded-2xl border border-line bg-surface/80 p-3 text-center shadow-sm">
                  <p className="text-xl font-extrabold text-primary">{big}</p>
                  <p className="text-xs font-bold text-ink-soft">{small}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="anim-pop" style={{ animationDelay: "0.3s" }}>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Bandeau défilant */}
      <div aria-hidden className="overflow-hidden border-y border-line bg-surface py-3">
        <div className="anim-marquee flex w-max gap-4">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="whitespace-nowrap rounded-full bg-cream px-5 py-2 text-sm font-extrabold text-ink-soft">{item}</span>
          ))}
        </div>
      </div>

      <main className="flex-1">
        {/* Comment ça marche */}
        <section id="comment" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="reveal text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-pink">Comment ça marche</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Trois gestes, et la journée est écrite</h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="reveal ct-card relative rounded-[1.75rem] border border-line bg-surface p-7 shadow-sm">
                <span className="absolute -top-4 left-7 flex size-9 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white shadow-lg shadow-primary/30">{s.n}</span>
                <p aria-hidden className="text-4xl">{s.icon}</p>
                <h3 className="mt-3 text-xl font-extrabold">{s.title}</h3>
                <p className="mt-1.5 text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Fonctions */}
        <section id="fonctions" className="scroll-mt-20 bg-surface/60 py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <div className="reveal text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-pink">Fonctions</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Pensé pour le terrain</h2>
              <p className="mx-auto mt-2 max-w-xl text-ink-soft">De gros boutons, peu de texte à écrire, tout en français.</p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="reveal ct-card rounded-[1.5rem] border border-line bg-surface p-6 shadow-sm">
                  <span aria-hidden className={`flex size-14 items-center justify-center rounded-2xl text-3xl ${f.tone}`}>{f.icon}</span>
                  <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pour qui */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="reveal text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-pink">Pour qui ?</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Seule ou en équipe</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <article className="reveal ct-card rounded-[1.75rem] border border-line bg-gradient-to-br from-leaf-soft to-surface p-8 shadow-sm">
              <p aria-hidden className="text-4xl">🏡</p>
              <h3 className="mt-3 text-2xl font-extrabold">Assistante maternelle indépendante</h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-ink-soft">
                {["Un espace privé, à vous seule", "Vos contrats et vos finances ne regardent que vous", "Fiche de présence et bilans prêts en un geste"].map((t) => (
                  <li key={t} className="flex gap-2"><span aria-hidden className="font-extrabold text-leaf">✓</span>{t}</li>
                ))}
              </ul>
            </article>
            <article className="reveal ct-card rounded-[1.75rem] border border-line bg-gradient-to-br from-sun-soft to-surface p-8 shadow-sm">
              <p aria-hidden className="text-4xl">🏠</p>
              <h3 className="mt-3 text-2xl font-extrabold">Maison d’assistantes maternelles</h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-ink-soft">
                {["Invitez vos collègues par un lien personnel", "Les enfants et le journal se partagent", "Contrats et finances restent privés à chaque assistante"].map((t) => (
                  <li key={t} className="flex gap-2"><span aria-hidden className="font-extrabold text-sun">✓</span>{t}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* Sécurité */}
        <section id="securite" className="relative scroll-mt-20 overflow-hidden bg-primary-strong py-20 text-white">
          <div aria-hidden className="anim-blob pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-[#2766c9]/45 blur-3xl" />
          <div className="relative mx-auto w-full max-w-6xl px-4">
            <div className="reveal text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-sun">Confiance</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Les enfants d’abord, leurs données aussi</h2>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <li key={p.title} className="reveal rounded-[1.5rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <p aria-hidden className="text-3xl">{p.icon}</p>
                  <h3 className="mt-3 text-lg font-extrabold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Appel final */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="reveal relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-[#2766c9] p-10 text-center text-white shadow-2xl shadow-primary/30 sm:p-14">
            <div aria-hidden className="anim-blob absolute -left-10 -top-10 size-56 rounded-full bg-white/15 blur-2xl" />
            <h2 className="relative font-display text-4xl font-semibold tracking-tight sm:text-5xl">Prête à gagner du temps ?</h2>
            <p className="relative mx-auto mt-2 max-w-md text-white/85">Créez votre espace en quelques secondes et pointez votre première journée.</p>
            <Link href="/inscription" className="relative mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-9 text-lg font-extrabold text-primary shadow-lg transition hover:-translate-y-0.5">
              Commencer maintenant
            </Link>
          </div>
        </section>

        {/* Accès démo (équipe) */}
        <section className="mx-auto w-full max-w-md px-4 pb-20" aria-labelledby="demo-title">
          <details className="ct-glass reveal group rounded-[1.5rem] border border-line p-5 shadow-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-lg font-extrabold" id="demo-title">
              <span className="flex items-center gap-2">🎪 Accès démo <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold">équipe</span></span>
              <span aria-hidden className="text-ink-soft transition group-open:rotate-180">⌄</span>
            </summary>
            <p className="mb-4 mt-2 text-sm text-ink-soft">
              Réservé à l’équipe Chez TaTa : explorez l’appli avec des données fictives. Vous pourrez ensuite vous connecter avec un autre compte à tout moment.
            </p>
            <DemoGate />
          </details>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-soft">
          <p className="flex items-center gap-2 font-extrabold text-ink"><Image src="/logo-sm.png" alt="" width={28} height={28} className="size-7 rounded-lg" /> Chez TaTa</p>
          <p>Conçu pour protéger les données des enfants : isolation entre comptes, hébergement dans l’Union européenne, aucun envoi automatique d’informations.</p>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2 pt-1 font-bold text-primary">
            <Link href="/confidentialite" className="underline">Confidentialité</Link>
            <Link href="/conditions" className="underline">Conditions d’utilisation</Link>
            <Link href="/mentions-legales" className="underline">Mentions légales</Link>
            <Link href="/suppression-compte" className="underline">Supprimer mon compte</Link>
            <Link href="/aide" className="underline">Aide</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

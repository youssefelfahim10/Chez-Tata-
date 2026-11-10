import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DemoGate } from "@/components/demo-gate";
import { Icon, type IconName } from "@/components/icons";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

export const metadata: Metadata = {
  title: "Chez TaTa — Moins d'administratif, plus de temps pour les enfants",
  description:
    "Le carnet de bord des assistantes maternelles et des MAM : pointage en une touche, hors ligne, dictée vocale, bilan WhatsApp, fiche de présence illustrée et suivi des charges.",
};

const STEPS = [
  { n: "I", title: "Vous pointez", text: "Arrivée, repas, sieste, change, soins : une touche, l’heure exacte, même sans réseau." },
  { n: "II", title: "Vous cochez", text: "« Tout mangé », « pipi », « bobo »… Des choix prêts à toucher, un mot libre si besoin." },
  { n: "III", title: "Vous partagez", text: "Le bilan du jour s’écrit tout seul. Vous le relisez, puis vous l’envoyez vous-même." },
] as const;

const FEATURES: readonly { icon: IconName; title: string; text: string }[] = [
  { icon: "pointer", title: "Pointage en une touche", text: "De gros boutons, pensés pour une seule main et un bébé dans l’autre." },
  { icon: "wifiOff", title: "Sans réseau, sans stress", text: "Vos saisies restent sur le téléphone et partent avec l’heure réelle du geste." },
  { icon: "mic", title: "Dictée vocale", text: "« Lou est arrivé à 8h30 » : l’appli propose, vous validez." },
  { icon: "message", title: "Bilan WhatsApp", text: "Un message clair, modifiable, jamais envoyé automatiquement." },
  { icon: "receipt", title: "Charges à cocher", text: "Alimentation, hygiène, assurances… cochez, saisissez, exportez en CSV." },
  { icon: "file", title: "Fiche de présence A4", text: "La fiche illustrée Chez TaTa, remplie pour vous, en PDF, prête à signer." },
  { icon: "chart", title: "Tableau de bord", text: "Enfants, contrats, revenus estimés et charges du mois, d’un seul regard." },
  { icon: "shield", title: "Données protégées", text: "Hébergement dans l’Union européenne, comptes strictement isolés." },
];

const PILLARS: readonly { icon: IconName; title: string; text: string }[] = [
  { icon: "globe", title: "Hébergé dans l’UE", text: "Base de données et authentification en Europe." },
  { icon: "lock", title: "Comptes cloisonnés", text: "Chaque assistante ne voit que ses données : la règle est dans la base, pas seulement dans l’appli." },
  { icon: "hand", title: "Jamais d’envoi automatique", text: "Rien sur un enfant ne part sans votre relecture et votre validation." },
  { icon: "history", title: "Traçabilité", text: "Corrections conservées, historique des actions, annulation en un geste." },
];

const ACTIONS: readonly { icon: IconName; label: string; tone: string }[] = [
  { icon: "login", label: "Arrivée", tone: "border-sun/60 bg-sun-soft text-gold-deep" },
  { icon: "logout", label: "Départ", tone: "border-line bg-cream text-primary" },
  { icon: "utensils", label: "Repas", tone: "border-line bg-cream text-primary" },
  { icon: "moon", label: "Sieste", tone: "border-line bg-cream text-primary" },
  { icon: "droplet", label: "Change", tone: "border-line bg-cream text-primary" },
  { icon: "plus", label: "Soins", tone: "border-line bg-cream text-primary" },
];

const LINK_PRIMARY = "inline-flex min-h-13 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-strong px-8 text-base font-bold tracking-wide text-white shadow-[0_10px_24px_-10px_rgb(1_39_95/0.7)] transition hover:brightness-110";
const LINK_GHOST = "inline-flex min-h-13 items-center justify-center rounded-xl border border-line bg-surface px-8 text-base font-bold tracking-wide text-ink transition hover:border-sun";

function Overline({ children, light = false }: { children: string; light?: boolean }) {
  return <p className={`text-xs font-bold uppercase tracking-[0.24em] ${light ? "text-sun" : "text-gold-deep"}`}>{children}</p>;
}

function PhoneMockup() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[290px] select-none rounded-[2.6rem] border border-ink/90 bg-cream p-2 shadow-[0_50px_90px_-40px_rgb(15_31_61/0.55)]">
      <div className="rounded-[2.1rem] border border-line bg-surface px-4 pb-5 pt-3">
        <div className="mx-auto h-1.5 w-16 rounded-full bg-line" />
        <p className="mt-4 font-display text-2xl font-semibold leading-tight">Bonjour TaTa !</p>
        <p className="text-xs text-ink-soft">mardi 10 novembre 2026</p>

        <div className="mt-4 rounded-2xl border border-line p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-semibold text-primary">L</span>
            <div className="flex-1">
              <p className="text-sm font-bold leading-none">Lou</p>
              <p className="mt-1 text-[11px] text-ink-soft">Journée du jour</p>
            </div>
            <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[11px] font-bold text-leaf">Présent</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {ACTIONS.map((a) => (
              <span key={a.label} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-bold ${a.tone}`}>
                <Icon name={a.icon} className="size-5" />
                {a.label}
              </span>
            ))}
          </div>
          <p className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-xs font-bold text-[#06301a]">
            <WhatsAppIcon className="size-4 text-white" /> Bilan du jour
          </p>
        </div>
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-[11px] font-semibold text-white">
          <Icon name="check" className="size-3.5 text-sun" /> Arrivée enregistrée pour Lou
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <header className="ct-glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 font-display text-2xl font-semibold text-primary-strong">
            <Image src="/logo-sm.png" alt="" width={40} height={40} className="size-9 rounded-lg" priority />
            Chez TaTa
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-8 text-sm font-semibold text-ink-soft md:flex">
            <a href="#comment" className="hover:text-ink">Comment ça marche</a>
            <a href="#fonctions" className="hover:text-ink">Fonctions</a>
            <a href="#securite" className="hover:text-ink">Sécurité</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-xl px-4 font-semibold hover:bg-primary-soft">Se connecter</Link>
            <Link href="/inscription" className="hidden min-h-11 items-center rounded-xl bg-primary px-5 font-bold text-white sm:inline-flex">Créer mon espace</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
        <div className="flex flex-col gap-7">
          <div className="anim-up"><Overline>Pour les assistantes maternelles et les MAM</Overline></div>
          <h1 className="anim-up font-display text-[3rem] font-semibold leading-[1.02] tracking-tight sm:text-7xl" style={{ animationDelay: "0.08s" }}>
            Moins d’administratif,
            <br />
            <span className="ct-gradient-text">plus de temps pour les enfants.</span>
          </h1>
          <p className="anim-up max-w-xl text-lg leading-relaxed text-ink-soft" style={{ animationDelay: "0.16s" }}>
            Le carnet de bord qui se remplit en une touche, même sans réseau. Le reste — bilan, fiche de présence, charges — se prépare tout seul.
          </p>
          <div className="anim-up flex flex-wrap gap-3" style={{ animationDelay: "0.24s" }}>
            <Link href="/inscription" className={LINK_PRIMARY}>Créer mon espace</Link>
            <Link href="/connexion" className={LINK_GHOST}>Se connecter</Link>
          </div>
          <p className="anim-up flex items-center gap-2 text-sm text-ink-soft" style={{ animationDelay: "0.32s" }}>
            <Icon name="shield" className="size-4 text-gold-deep" /> Hébergé dans l’Union européenne · aucun envoi automatique
          </p>
        </div>
        <div className="anim-up" style={{ animationDelay: "0.2s" }}>
          <PhoneMockup />
        </div>
      </section>

      <main className="flex-1">
        {/* Comment ça marche */}
        <section id="comment" className="mx-auto w-full max-w-6xl scroll-mt-20 border-t border-line px-4 py-24">
          <div className="reveal text-center">
            <Overline>Comment ça marche</Overline>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Trois gestes, et la journée est écrite</h2>
          </div>
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="reveal border-t border-sun pt-6">
                <p className="font-display text-3xl font-medium text-gold-deep">{s.n}</p>
                <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Fonctions */}
        <section id="fonctions" className="scroll-mt-20 border-t border-line bg-surface py-24">
          <div className="mx-auto w-full max-w-6xl px-4">
            <div className="reveal text-center">
              <Overline>Fonctions</Overline>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Pensé pour le terrain</h2>
              <p className="mx-auto mt-3 max-w-xl text-ink-soft">De gros boutons, peu de texte à écrire, tout en français.</p>
            </div>
            <ul className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="reveal">
                  <span className="flex size-12 items-center justify-center rounded-full border border-sun/60 bg-sun-soft text-gold-deep">
                    <Icon name={f.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pour qui */}
        <section className="mx-auto w-full max-w-6xl px-4 py-24">
          <div className="reveal text-center">
            <Overline>Pour qui ?</Overline>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Seule ou en équipe</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              { icon: "home" as const, title: "Assistante maternelle indépendante", items: ["Un espace privé, à vous seule", "Vos contrats et vos finances ne regardent que vous", "Fiche de présence et bilans prêts en un geste"] },
              { icon: "users" as const, title: "Maison d’assistantes maternelles", items: ["Invitez vos collègues par un lien personnel", "Les enfants et le journal se partagent", "Contrats et finances restent privés à chaque assistante"] },
            ].map((c) => (
              <article key={c.title} className="reveal rounded-card border border-line bg-surface p-8 shadow-luxe">
                <Icon name={c.icon} className="size-7 text-primary" />
                <h3 className="mt-4 font-display text-3xl font-semibold">{c.title}</h3>
                <ul className="mt-5 flex flex-col gap-3 text-ink-soft">
                  {c.items.map((t) => (
                    <li key={t} className="flex gap-3"><Icon name="check" className="mt-0.5 size-5 shrink-0 text-gold-deep" />{t}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Sécurité */}
        <section id="securite" className="scroll-mt-20 bg-gradient-to-br from-primary-strong to-[#011a40] py-24 text-white">
          <div className="mx-auto w-full max-w-6xl px-4">
            <div className="reveal text-center">
              <Overline light>Confiance</Overline>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Les enfants d’abord, leurs données aussi</h2>
            </div>
            <ul className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <li key={p.title} className="reveal border-t border-sun/70 pt-6">
                  <Icon name={p.icon} className="size-6 text-sun" />
                  <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Appel final */}
        <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center">
          <div className="reveal">
            <span aria-hidden className="mx-auto block h-0.5 w-10 bg-sun" />
            <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Prête à gagner du temps ?</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">Créez votre espace en quelques secondes et pointez votre première journée.</p>
            <Link href="/inscription" className={`${LINK_PRIMARY} mt-8`}>Commencer maintenant</Link>
          </div>
        </section>

        {/* Accès démo (équipe) */}
        <section className="mx-auto w-full max-w-md px-4 pb-20" aria-labelledby="demo-title">
          <details className="reveal group rounded-card border border-line bg-surface p-5 shadow-luxe">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-base font-bold" id="demo-title">
              <span className="flex items-center gap-2">Accès démo <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-gold-deep">équipe</span></span>
              <Icon name="chevron" className="size-5 text-ink-soft transition group-open:rotate-180" />
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
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-ink"><Image src="/logo-sm.png" alt="" width={28} height={28} className="size-7 rounded-md" /> Chez TaTa</p>
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

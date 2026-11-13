import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HubLink } from "@/components/hub-link";
import { SignOutForm } from "@/components/sign-out-form";
import { PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { parisDayBounds } from "@/lib/journal/day";
import { completion, fullName, PROFILE_COLUMNS, reminderText, remindersFor, type ProfileRow } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";
import type { ToneName } from "@/lib/ui/tones";

export const metadata: Metadata = { title: "Profil" };

type Item = { href: string; emoji: string; title: string; text: string; tone: ToneName };

const ITEMS: Item[] = [
  { href: "/profil/informations", emoji: "🪪", title: "Mes informations", text: "Identité, adresse, agrément, assurance", tone: "leaf" },
  { href: "/profil/impots", emoji: "🧾", title: "Impôts et documents", text: "Récapitulatif annuel, attestations d’accueil", tone: "gold" },
  { href: "/gestion", emoji: "📒", title: "Contrats, factures, charges", text: "Tout l’administratif de l’accueil", tone: "primary" },
  { href: "/parametres", emoji: "🏠", title: "Mon espace et mon équipe", text: "MAM, invitations, changer d’espace", tone: "aqua" },
  { href: "/parametres#donnees", emoji: "🔐", title: "Mes données", text: "Exporter, supprimer mon compte", tone: "rose" },
];

async function Hub() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const today = parisDayBounds(new Date()).isoDate;
  const [account, profile] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("caregiver_profiles").select(PROFILE_COLUMNS).eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (account.error) throw new Error("Chargement du profil impossible.");
  // Si le profil est indisponible (migration pas encore appliquée), le reste de la page reste utilisable.
  const p = (profile.error ? null : profile.data) as ProfileRow | null;
  const name = fullName(p) || (account.data?.display_name as string | null) || "Mon profil";
  const { done, total } = completion(p);
  const reminders = remindersFor(p, today);

  return (
    <>
      <section className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-luxe">
        <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-display text-3xl font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-semibold">{name}</h2>
          <p className="truncate text-sm text-ink-soft">{user.email}</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {membership.organizationName} · {membership.organizationType === "mam" ? "MAM" : "Assistante indépendante"}
          </p>
        </div>
      </section>

      {reminders.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Échéances à surveiller">
          {reminders.map((r) => (
            <li key={r.key}>
              <Link
                href="/profil/informations"
                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${r.level === "late" ? "bg-pink-soft text-danger" : "bg-sun-soft text-ink"}`}
              >
                <span aria-hidden>{r.level === "late" ? "⚠️" : "⏰"}</span>
                {reminderText(r)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-label="Avancement du profil" className="rounded-card border border-line bg-surface p-4 shadow-luxe">
        <div className="flex items-center justify-between gap-3 text-sm font-bold">
          <span>Profil rempli</span>
          <span className="text-gold-deep">
            {done} / {total}
          </span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Profil rempli" className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-sun" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        {done < total ? (
          <p className="mt-2 text-sm text-ink-soft">
            Plus il est complet, moins vous retapez : contrats, factures et documents d’impôts se remplissent seuls.{" "}
            <Link href="/profil/informations" className="font-bold text-primary underline">
              Compléter
            </Link>
          </p>
        ) : null}
      </section>

      <ul className="flex flex-col gap-3">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <HubLink {...item} />
          </li>
        ))}
      </ul>

      <SignOutForm />
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Vos informations et vos documents">Profil</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Hub />
      </Suspense>
    </>
  );
}

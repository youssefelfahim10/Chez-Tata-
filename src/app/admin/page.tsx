import { Suspense } from "react";
import { BarChart } from "@/components/admin/bar-chart";
import { Card, Notice, PageTitle, Skeleton } from "@/components/ui";
import { parseOverview } from "@/lib/admin/stats";
import { demoEmailToExclude, requirePlatformAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm font-bold text-ink-soft">{label}</p>
      <p className="font-display text-4xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="text-sm text-ink-soft">{hint}</p>
    </Card>
  );
}

async function Dashboard() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview", { p_exclude_email: demoEmailToExclude() });
  const overview = error ? null : parseOverview(data);
  if (!overview) return <Notice tone="error">Impossible de charger les chiffres. Réessayez dans un instant.</Notice>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Comptes créés"
          value={overview.users_total}
          hint={`+${overview.signups_7d} en 7 jours · +${overview.signups_30d} en 30 jours`}
        />
        <Stat label="Connexions (7 jours)" value={overview.logins_7d} hint={`${overview.logins_30d} sur 30 jours`} />
        <Stat
          label="Comptes actifs (7 jours)"
          value={overview.active_7d}
          hint={`${overview.active_30d} sur 30 jours`}
        />
        <Stat label="Espaces" value={overview.organizations} hint={`${overview.children} enfant(s) suivi(s)`} />
      </div>

      <Card className="flex flex-col gap-6">
        <BarChart title="Créations de compte" points={overview.daily} value={(p) => p.signups} unit="création(s)" color="primary" />
        <BarChart title="Connexions" points={overview.daily} value={(p) => p.logins} unit="connexion(s)" color="leaf" />
        <p className="text-sm text-ink-soft">
          Méthode d&apos;inscription : Google {overview.users_google} · E-mail {overview.users_email}. Jours comptés à
          l&apos;heure de Paris. Le journal des connexions a démarré avec cette page : les connexions plus anciennes
          n&apos;y figurent pas, mais « comptes actifs » s&apos;appuie sur la dernière connexion de chaque compte.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-extrabold">Visites du site</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Pas encore branché : prochaine étape (mesure des visites sans cookies, donc sans bandeau à ajouter).
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-extrabold">Abonnements</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Pas encore branché : l&apos;activation d&apos;un compte à l&apos;abonnement viendra avec le paiement.
          </p>
        </Card>
      </div>

      <Notice tone="info">
        Confidentialité : cette page ne montre que des comptes et des comptages. Les enfants, fiches santé, journaux,
        contrats et factures des assistantes restent invisibles ici, même pour vous.
      </Notice>
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Comptes, connexions et activité de la plateforme">Tableau de bord</PageTitle>
      <Suspense fallback={<Skeleton lines={3} />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

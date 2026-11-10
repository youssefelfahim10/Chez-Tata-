import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContractForm, EndContractForm, FamilyForm } from "@/components/family-contract-forms";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { parisDayBounds } from "@/lib/journal/day";
import { formatDateFR, formatDecimalHours, formatEuros } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fiche enfant" };

type Row = Record<string, unknown>;

async function Detail({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(childId)) notFound();
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const today = parisDayBounds(new Date()).isoDate;

  const [child, links, contracts] = await Promise.all([
    supabase
      .from("children")
      .select("id, first_name, last_name, birth_date")
      .eq("id", childId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle(),
    supabase
      .from("child_family_links")
      .select("relationship, families(id, name, contact_details)")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId),
    // La RLS ne renvoie que les contrats de l'assistante connectée.
    supabase
      .from("contracts")
      .select("id, start_date, end_date, scheduled_hours, weeks_per_year, hourly_rate, maintenance_allowance_cents, meal_allowance_cents, status")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId)
      .eq("assigned_assmat_id", user.id)
      .order("start_date", { ascending: false }),
  ]);
  if (child.error || links.error || contracts.error) throw new Error("Chargement de la fiche enfant impossible.");
  if (!child.data) notFound();

  const c = child.data as Row;
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
  const families = ((links.data ?? []) as unknown as { relationship: string; families: { id: string; name: string; contact_details: Record<string, string> } | null }[]).filter(
    (l) => l.families,
  );
  const all = (contracts.data ?? []) as Row[];
  const active = all.find((x) => x.status === "active");
  const past = all.filter((x) => x.status !== "active");

  return (
    <>
      <PageTitle subtitle="Famille et contrat">{name}</PageTitle>
      <Link href="/gestion" className="-mt-2 font-bold text-primary underline">
        ← Retour à la gestion
      </Link>

      <Card>
        <h2 className="text-lg font-extrabold">Famille</h2>
        {families.length === 0 ? (
          <p className="mt-2 text-ink-soft">Aucune famille renseignée.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {families.map((l) => (
              <li key={l.families!.id} className="py-3">
                <p className="font-bold">
                  {l.families!.name} <span className="text-sm font-normal text-ink-soft">({l.relationship})</span>
                </p>
                {l.families!.contact_details?.phone ? <p className="text-sm text-ink-soft">☎ {l.families!.contact_details.phone}</p> : null}
                {l.families!.contact_details?.email ? <p className="text-sm text-ink-soft">✉ {l.families!.contact_details.email}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">Ajouter une famille</h2>
        <FamilyForm childId={childId} />
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">Contrat</h2>
        {active ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["Début", formatDateFR(active.start_date as string)],
                ["Heures / semaine", `${formatDecimalHours(Math.round(Number(active.scheduled_hours) * 60))} h`],
                ["Semaines / an", String(Number(active.weeks_per_year))],
                ["Salaire horaire net", `${formatEuros(Math.round(Number(active.hourly_rate) * 100))} €`],
                ["Entretien / jour", `${formatEuros(active.maintenance_allowance_cents as number)} €`],
                ["Repas / jour", `${formatEuros(active.meal_allowance_cents as number)} €`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-cream px-3 py-2">
                  <dt className="text-xs text-ink-soft">{label}</dt>
                  <dd className="font-extrabold">{value}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/gestion/${childId}/contrat`} className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-white">
              📄 Contrat professionnel (PDF)
            </Link>
            <div className="mt-4">
              <EndContractForm contractId={active.id as string} childId={childId} today={today} />
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 mt-2 text-ink-soft">Aucun contrat actif. Créez-le : il pré-remplit la fiche de présence et se génère en PDF professionnel.</p>
            <Link href={`/gestion/${childId}/contrat`} className="mb-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-white">
              📄 Créer le contrat (PDF)
            </Link>
            <details className="rounded-2xl border border-line p-4">
              <summary className="min-h-11 cursor-pointer font-bold">Saisie rapide (sans document)</summary>
              <div className="mt-3"><ContractForm childId={childId} today={today} /></div>
            </details>
          </>
        )}
        {past.length > 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            {past.length} contrat{past.length > 1 ? "s" : ""} terminé{past.length > 1 ? "s" : ""} conservé{past.length > 1 ? "s" : ""} dans l’historique.
          </p>
        ) : null}
      </Card>
    </>
  );
}

export default function Page({ params }: PageProps<"/gestion/[childId]">) {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <Detail params={params} />
    </Suspense>
  );
}

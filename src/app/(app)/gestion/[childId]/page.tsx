import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChildAvatar } from "@/components/child-avatar";
import { ChildGenderPicker } from "@/components/child-gender-picker";
import { ChildHealthForm } from "@/components/child-health-form";
import { ContractForm, EndContractForm, FamilyForm } from "@/components/family-contract-forms";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { contactsFromJson } from "@/lib/health/schema";
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

  const [child, links, contracts, health] = await Promise.all([
    supabase
      .from("children")
      .select("id, first_name, last_name, birth_date, gender")
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
    supabase
      .from("child_health")
      .select("allergies, diet, medication, medical_notes, doctor_name, doctor_phone, emergency_contacts, authorized_pickups")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId)
      .maybeSingle(),
  ]);
  if (child.error || links.error || contracts.error) throw new Error("Chargement de la fiche enfant impossible.");
  // La fiche santé indisponible (migration pas encore appliquée) ne doit pas bloquer famille et contrat.
  if (health.error) console.error("Fiche santé indisponible", health.error.code);
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
      <Link href="/gestion" className="-mt-2 inline-flex min-h-11 items-center font-bold text-primary underline">
        ← Retour à la gestion
      </Link>

      <Card>
        <div className="flex items-center gap-3">
          <ChildAvatar name={String(c.first_name)} gender={c.gender as string | null} size="lg" />
          <div>
            <h2 className="text-lg font-extrabold">Icône de {String(c.first_name)}</h2>
            <p className="text-sm text-ink-soft">Fille ou garçon : sert seulement à choisir l’icône à l’écran.</p>
          </div>
        </div>
        <ChildGenderPicker childId={childId} gender={(c.gender as string | null) ?? null} />
      </Card>
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

      <Card id="sante" className="scroll-mt-20">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold">Santé et urgences</h2>
          <Link href={`/aujourdhui/urgence/${childId}`} className="inline-flex min-h-11 items-center rounded-xl border border-danger/40 px-4 text-sm font-bold text-danger">
            Voir l’écran Urgence
          </Link>
        </div>
        <p className="mb-4 mt-1 text-sm text-ink-soft">Allergies, traitement, médecin, contacts d’urgence et personnes autorisées à récupérer l’enfant.</p>
        <ChildHealthForm
          childId={childId}
          defaults={{
            allergies: (health.data?.allergies as string | null) ?? "",
            diet: (health.data?.diet as string | null) ?? "",
            medication: (health.data?.medication as string | null) ?? "",
            medicalNotes: (health.data?.medical_notes as string | null) ?? "",
            doctorName: (health.data?.doctor_name as string | null) ?? "",
            doctorPhone: (health.data?.doctor_phone as string | null) ?? "",
            emergencyContacts: contactsFromJson(health.data?.emergency_contacts),
            authorizedPickups: contactsFromJson(health.data?.authorized_pickups),
          }}
        />
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

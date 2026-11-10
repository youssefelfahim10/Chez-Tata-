import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContractEditor } from "@/components/contract-editor";
import { PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { emptyDetails, parseDetails } from "@/lib/documents/details";
import { parisDayBounds } from "@/lib/journal/day";
import { formatDecimalHours } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contrat d'accueil" };

type Row = Record<string, unknown>;
const euros = (cents: number) => (cents ? `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}` : "");

async function Content({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(childId)) notFound();
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const today = parisDayBounds(new Date()).isoDate;

  const [child, links, contract, previous, profile] = await Promise.all([
    supabase.from("children").select("first_name, last_name, birth_date").eq("id", childId).eq("organization_id", membership.organizationId).maybeSingle(),
    supabase.from("child_family_links").select("families(name, contact_details)").eq("organization_id", membership.organizationId).eq("child_id", childId),
    supabase
      .from("contracts")
      .select("start_date, scheduled_hours, weeks_per_year, hourly_rate, maintenance_allowance_cents, meal_allowance_cents, contract_type, details")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId)
      .eq("assigned_assmat_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    // Dernier contrat d'un autre enfant : on reprend les coordonnées de l'assistante pour ne pas les retaper.
    supabase.from("contracts").select("details").eq("organization_id", membership.organizationId).eq("assigned_assmat_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (child.error || links.error || contract.error || previous.error) throw new Error("Chargement du contrat impossible.");
  if (!child.data) notFound();

  const c = contract.data as Row | null;
  const details = c ? parseDetails(c.details) : emptyDetails();
  const known = (previous.data ?? []).map((r) => parseDetails((r as Row).details).employee).find((e) => e.address || e.agrementNumber);
  if (known) {
    for (const key of Object.keys(known) as (keyof typeof known)[]) if (!details.employee[key]) (details.employee[key] as string) = known[key];
  }
  const family = ((links.data ?? []) as unknown as { families: { name: string; contact_details: Record<string, string> | null } | null }[]).find((l) => l.families)?.families;
  if (family) {
    const cd = family.contact_details ?? {};
    details.parents.phone ||= cd.phone ?? "";
    details.parents.email ||= cd.email ?? "";
    details.parents.address ||= cd.address ?? "";
  }

  const childName = [child.data.first_name, child.data.last_name].filter(Boolean).join(" ");
  return (
    <>
      <PageTitle subtitle="Contrat d'accueil professionnel">{childName}</PageTitle>
      <Link href={`/gestion/${childId}`} className="-mt-2 font-bold text-primary underline">← Retour à la fiche enfant</Link>
      <ContractEditor
        childId={childId}
        childName={childName}
        birthDate={(child.data.birth_date as string | null) ?? null}
        hasContract={Boolean(c)}
        today={today}
        fallbackEmployeeName={(profile.data?.display_name as string | undefined)?.trim() ?? ""}
        initial={{
          startDate: c ? (c.start_date as string) : today,
          contractType: c && c.contract_type === "annee_incomplete" ? "annee_incomplete" : "annee_complete",
          weeksPerYear: c ? String(Number(c.weeks_per_year)) : "52",
          weeklyHours: c ? formatDecimalHours(Math.round(Number(c.scheduled_hours) * 60)) : "",
          hourly: c ? euros(Math.round(Number(c.hourly_rate) * 100)) : "",
          maintenance: c ? euros(c.maintenance_allowance_cents as number) : "",
          meal: c ? euros(c.meal_allowance_cents as number) : "",
          details,
        }}
      />
    </>
  );
}

export default function Page({ params }: PageProps<"/gestion/[childId]/contrat">) {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <Content params={params} />
    </Suspense>
  );
}

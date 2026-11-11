import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InvoiceBoard, type InvoiceItem } from "@/components/invoice-board";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { fillEmployeeFromProfile, parseDetails } from "@/lib/documents/details";
import { employeeFromProfile, PROFILE_COLUMNS, type ProfileRow } from "@/lib/profile/schema";
import { monthRange, shiftMonth } from "@/lib/finance/summary";
import { parisDayBounds } from "@/lib/journal/day";
import { monthNameFR } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Factures" };

type Row = Record<string, unknown>;

async function Content({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { user, membership } = await requireWorkspace();
  const params = await searchParams;
  const today = parisDayBounds(new Date()).isoDate;
  const current = today.slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mois ?? "") ? (params.mois as string) : current;
  const { first, after } = monthRange(month);

  const supabase = await createClient();
  const [contracts, statements, profile, caregiver] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, child_id, scheduled_hours, weeks_per_year, hourly_rate, maintenance_allowance_cents, meal_allowance_cents, details, children(first_name, last_name, gender)")
      .eq("organization_id", membership.organizationId)
      .eq("assigned_assmat_id", user.id)
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("monthly_statements")
      .select("contract_id, invoice_number, total_cents, paid_at, payment_method, lines")
      .eq("organization_id", membership.organizationId)
      .eq("period", first)
      .eq("status", "finalized"),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    // Profil de l'assistante : complète les coordonnées laissées vides dans les contrats.
    supabase.from("caregiver_profiles").select(PROFILE_COLUMNS).eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (contracts.error || statements.error) throw new Error("Chargement des factures impossible.");
  const contractRows = (contracts.data ?? []) as unknown as (Row & { children: { first_name: string; last_name: string | null; gender: string | null } | null })[];

  const attendance = contractRows.length
    ? await supabase
        .from("attendance_records")
        .select("child_id, extra_minutes, maintenance_due, meal_due")
        .eq("organization_id", membership.organizationId)
        .in("child_id", contractRows.map((c) => c.child_id as string))
        .gte("date", first)
        .lt("date", after)
    : { data: [], error: null };
  if (attendance.error) throw new Error("Chargement des présences impossible.");

  const fallbackName = (profile.data?.display_name as string | undefined)?.trim() ?? "";
  const items: InvoiceItem[] = contractRows.map((c) => {
    const rows = ((attendance.data ?? []) as Row[]).filter((a) => a.child_id === c.child_id);
    const st = ((statements.data ?? []) as Row[]).find((s) => s.contract_id === c.id);
    const details = fillEmployeeFromProfile(parseDetails(c.details), caregiver.error ? null : employeeFromProfile(caregiver.data as ProfileRow | null));
    return {
      contractId: c.id as string,
      childGender: c.children?.gender ?? null,
      childName: [c.children?.first_name, c.children?.last_name].filter(Boolean).join(" "),
      contract: {
        scheduledHours: Number(c.scheduled_hours),
        weeksPerYear: Number(c.weeks_per_year),
        hourlyRateCents: Math.round(Number(c.hourly_rate) * 100),
        maintenanceCents: c.maintenance_allowance_cents as number,
        mealCents: c.meal_allowance_cents as number,
      },
      activity: {
        extraMinutes: rows.reduce((t, r) => t + (r.extra_minutes as number), 0),
        maintenanceDays: rows.filter((r) => r.maintenance_due).length,
        mealDays: rows.filter((r) => r.meal_due).length,
      },
      details,
      fallbackEmployeeName: fallbackName,
      existing: st
        ? { number: st.invoice_number as string, totalCents: st.total_cents as number, paidAt: st.paid_at as string, method: st.payment_method as string, lines: st.lines as { label: string; detail?: string; amount_cents: number }[] }
        : null,
    };
  });

  const title = `${monthNameFR(month)} ${month.slice(0, 4)}`;
  return (
    <>
      <Link href="/gestion" className="-mt-2 font-bold text-primary underline">← Retour à la gestion</Link>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/gestion/factures?mois=${shiftMonth(month, -1)}`} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-line text-xl" aria-label="Mois précédent">◀</Link>
          <h2 className="text-lg font-extrabold capitalize">{title}</h2>
          <Link href={`/gestion/factures?mois=${shiftMonth(month, 1)}`} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-line text-xl" aria-label="Mois suivant">▶</Link>
        </div>
        <p className="mt-2 text-center text-sm text-ink-soft">Paiement reçu ? Un clic, la facture est prête à envoyer.</p>
      </Card>
      {items.length === 0 ? (
        <Card>
          <p className="font-bold">Aucun contrat actif</p>
          <p className="mt-1 text-ink-soft">Créez d’abord le contrat d’un enfant dans la gestion : la facture s’appuie dessus.</p>
        </Card>
      ) : (
        <InvoiceBoard month={month} today={today} items={items} canInvoice={month <= current} />
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/gestion/factures">) {
  return (
    <>
      <PageTitle subtitle="Paiement reçu, facture envoyée">Factures</PageTitle>
      <Suspense fallback={<Skeleton lines={5} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

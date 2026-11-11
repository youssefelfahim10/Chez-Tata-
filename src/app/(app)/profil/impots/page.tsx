import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TourLauncher } from "@/components/help/tour";
import { TaxHelper, type TaxChildProps } from "@/components/tax-helper";
import { PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { parisDayBounds, parisInstant } from "@/lib/journal/day";
import { addressOf, employeeFromProfile, PROFILE_COLUMNS, type ProfileRow } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";
import { presenceFromEvents } from "@/lib/tax/presence";
import { estimateMonths, estimableMonths } from "@/lib/tax/estimate";
import { buildTaxInput, PARENT_MEAL_CENTS, SMIC_HOURLY_CENTS, type StatementInput } from "@/lib/tax/recap";

export const metadata: Metadata = { title: "Impôts et documents" };

const PAGE = 1000;

async function Content({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const { user, membership } = await requireWorkspace();
  const params = await searchParams;
  const today = parisDayBounds(new Date()).isoDate;
  const thisYear = Number(today.slice(0, 4));
  // La déclaration (au printemps) porte sur l'année précédente ; en fin d'année, on propose l'année en cours.
  const defaultYear = Number(today.slice(5, 7)) <= 7 ? thisYear - 1 : thisYear;
  const asked = Number(params.annee);
  const year = Number.isInteger(asked) && asked >= 2020 && asked <= thisYear ? asked : defaultYear;
  const years = Array.from(new Set([thisYear, thisYear - 1, thisYear - 2])).filter((y) => y >= 2020);

  const supabase = await createClient();
  const [contracts, statements, account, profile] = await Promise.all([
    // La RLS ne renvoie que VOS contrats et VOS factures, même dans une MAM.
    supabase
      .from("contracts")
      .select("child_id, start_date, end_date, status, scheduled_hours, weeks_per_year, hourly_rate, maintenance_allowance_cents, meal_allowance_cents, children(first_name, last_name)")
      .eq("organization_id", membership.organizationId)
      .eq("assigned_assmat_id", user.id),
    supabase
      .from("monthly_statements")
      .select("contract_id, total_cents, lines, paid_at, period, contracts(child_id)")
      .eq("organization_id", membership.organizationId)
      .eq("status", "finalized")
      // Payées dans l'année (montants) OU portant sur un mois de l'année (pour ne pas les estimer en plus).
      .or(`and(paid_at.gte.${year}-01-01,paid_at.lt.${year + 1}-01-01),and(period.gte.${year}-01-01,period.lt.${year + 1}-01-01)`),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("caregiver_profiles").select(PROFILE_COLUMNS).eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (contracts.error || statements.error) throw new Error("Chargement des revenus impossible.");

  type ContractRow = {
    child_id: string;
    start_date: string;
    end_date: string | null;
    status: string;
    scheduled_hours: number | string;
    weeks_per_year: number | string;
    hourly_rate: number | string;
    maintenance_allowance_cents: number;
    meal_allowance_cents: number;
    children: { first_name: string; last_name: string | null } | null;
  };
  const childMap = new Map<string, string>();
  for (const c of (contracts.data ?? []) as unknown as ContractRow[]) {
    if (c.children && !childMap.has(c.child_id)) childMap.set(c.child_id, [c.children.first_name, c.children.last_name].filter(Boolean).join(" "));
  }
  const childList = [...childMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const ids = childList.map((c) => c.id);

  // Présences de l'année (arrivées / départs), par pages de 1000 lignes.
  const events: { child_id: string; event_type: string; started_at: string }[] = [];
  if (ids.length > 0) {
    const from = parisInstant(`${year}-01-01`, "00:00").toISOString();
    const to = parisInstant(`${year + 1}-01-01`, "00:00").toISOString();
    for (let offset = 0; ; offset += PAGE) {
      const page = await supabase
        .from("daily_events")
        .select("child_id, event_type, started_at")
        .eq("organization_id", membership.organizationId)
        .in("child_id", ids)
        .in("event_type", ["arrival", "departure"])
        .is("deleted_at", null)
        .gte("started_at", from)
        .lt("started_at", to)
        .order("started_at")
        .range(offset, offset + PAGE - 1);
      if (page.error) throw new Error("Chargement des présences impossible.");
      events.push(...((page.data ?? []) as typeof events));
      if ((page.data ?? []).length < PAGE) break;
    }
  }
  const families = ids.length
    ? await supabase.from("child_family_links").select("child_id, families(name)").eq("organization_id", membership.organizationId).in("child_id", ids)
    : { data: [], error: null };

  const { days, incomplete } = presenceFromEvents(events);
  const statementRows = ((statements.data ?? []) as unknown as { total_cents: number; lines: { label: string; amount_cents: number }[] | null; paid_at: string | null; period: string; contracts: { child_id: string } | null }[]).filter((s) => s.contracts);
  const stmtInputs: StatementInput[] = statementRows
    .filter((s) => s.paid_at)
    .map((s) => ({ childId: s.contracts!.child_id, paidAt: s.paid_at as string, totalCents: s.total_cents, lines: Array.isArray(s.lines) ? s.lines : [] }));

  // Remplissage automatique : les mois terminés sans facture validée sont estimés d'après le contrat et les présences pointées.
  const invoiced = new Set<string>();
  for (const s of statementRows) if (s.period.startsWith(`${year}-`)) invoiced.add(`${s.contracts!.child_id}|${Number(s.period.slice(5, 7)) - 1}`);
  const contractList = ((contracts.data ?? []) as unknown as ContractRow[]).filter((c) => c.status !== "draft");
  const attendance: { child_id: string; date: string; extra_minutes: number; maintenance_due: boolean; meal_due: boolean }[] = [];
  if (contractList.length > 0 && estimableMonths(year, today).length > 0) {
    for (let offset = 0; ; offset += PAGE) {
      const page = await supabase
        .from("attendance_records")
        .select("child_id, date, extra_minutes, maintenance_due, meal_due")
        .eq("organization_id", membership.organizationId)
        .in("child_id", [...new Set(contractList.map((c) => c.child_id))])
        .gte("date", `${year}-01-01`)
        .lt("date", `${year + 1}-01-01`)
        .order("date")
        .range(offset, offset + PAGE - 1);
      if (page.error) throw new Error("Chargement des présences impossible.");
      attendance.push(...((page.data ?? []) as typeof attendance));
      if ((page.data ?? []).length < PAGE) break;
    }
  }
  const estimates = estimateMonths({
    year,
    today,
    invoiced,
    contracts: contractList.map((c) => ({
      childId: c.child_id,
      startDate: c.start_date,
      endDate: c.end_date,
      contract: {
        scheduledHours: Number(c.scheduled_hours),
        weeksPerYear: Number(c.weeks_per_year),
        hourlyRateCents: Math.round(Number(c.hourly_rate) * 100),
        maintenanceCents: c.maintenance_allowance_cents,
        mealCents: c.meal_allowance_cents,
      },
    })),
    attendance: attendance.map((a) => ({ childId: a.child_id, date: a.date, extraMinutes: a.extra_minutes, maintenanceDue: a.maintenance_due, mealDue: a.meal_due })),
  });
  const input = buildTaxInput({ year, children: childList, statements: stmtInputs, presence: days, estimates });

  const familyOf = new Map<string, string>();
  for (const l of (families.data ?? []) as unknown as { child_id: string; families: { name: string } | null }[]) if (l.families && !familyOf.has(l.child_id)) familyOf.set(l.child_id, l.families.name);

  const props: TaxChildProps[] = input.children.map((c) => {
    const mine = days.filter((d) => d.childId === c.id).map((d) => d.date).sort();
    return {
      id: c.id,
      name: c.name,
      salary: c.months.map((m) => m.salaryCents),
      allowance: c.months.map((m) => m.allowanceCents),
      estimated: c.months.map((m) => Boolean(m.estimated)),
      fullDays: c.fullDays,
      partialMinutes: c.partialMinutes,
      family: familyOf.get(c.id) ?? "",
      daysCount: mine.length,
      firstDay: mine[0] ?? "",
      lastDay: mine.at(-1) ?? "",
    };
  });

  const p = (profile.error ? null : profile.data) as ProfileRow | null;
  const employee = employeeFromProfile(p, (account.data?.display_name as string | undefined)?.trim() ?? "");

  return (
    <TaxHelper
      key={year}
      year={year}
      years={years}
      generatedOn={today}
      caregiver={{ fullName: employee.fullName, address: addressOf(p), phone: employee.phone, email: employee.email || user.email, agreementNumber: employee.agrementNumber }}
      hasProfile={Boolean(p)}
      kids={props}
      incompleteDays={incomplete}
      smicDefaultCents={SMIC_HOURLY_CENTS[year] ?? null}
      mealDefaultCents={PARENT_MEAL_CENTS[year] ?? null}
    />
  );
}

export default function Page({ searchParams }: PageProps<"/profil/impots">) {
  return (
    <>
      <PageTitle subtitle="Aide à la déclaration et attestations">Impôts et documents</PageTitle>
      <Link href="/profil" className="-mt-2 font-bold text-primary underline">
        ← Retour au profil
      </Link>
      <TourLauncher tour="impots" />
      <Suspense fallback={<Skeleton lines={4} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

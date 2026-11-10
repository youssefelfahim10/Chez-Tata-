import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SheetEditor, type SheetChild } from "@/components/sheet-editor";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { parisDateKey, parisDayBounds, parisHHMM, parisInstant } from "@/lib/journal/day";
import { daysInMonth, type SheetData, type SheetDay } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Planning" };

type Row = Record<string, unknown>;

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

async function Content({ searchParams }: { searchParams: Promise<{ mois?: string; enfant?: string }> }) {
  const { user, membership } = await requireWorkspace();
  const params = await searchParams;
  const currentMonth = parisDayBounds(new Date()).isoDate.slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mois ?? "") ? (params.mois as string) : currentMonth;

  const supabase = await createClient();
  const childrenQuery = await supabase
    .from("children")
    .select("id, first_name, last_name")
    .eq("organization_id", membership.organizationId)
    .eq("status", "active")
    .order("first_name");
  if (childrenQuery.error) throw new Error("Chargement des enfants impossible.");
  const children: SheetChild[] = (childrenQuery.data ?? []).map((c: Row) => ({
    id: c.id as string,
    name: [c.first_name, c.last_name].filter(Boolean).join(" "),
  }));

  if (children.length === 0) {
    return (
      <Card>
        <p className="font-bold">Aucun enfant pour le moment</p>
        <p className="mt-1 text-ink-soft">
          Ajoutez un enfant dans l’onglet{" "}
          <Link href="/gestion" className="font-bold text-primary underline">
            Gestion
          </Link>{" "}
          pour préparer sa fiche de présence.
        </p>
      </Card>
    );
  }

  const child = children.find((c) => c.id === params.enfant) ?? children[0];
  const first = `${month}-01`;
  const after = `${nextMonth(month)}-01`;

  const [profile, attendance, events, contract] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("attendance_records")
      .select("date, actual_start, actual_end, absence_minutes, extra_minutes, maintenance_due, meal_due, leave_kind, note")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", child.id)
      .gte("date", first)
      .lt("date", after),
    supabase
      .from("daily_events")
      .select("event_type, started_at")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", child.id)
      .in("event_type", ["arrival", "departure"])
      .is("deleted_at", null)
      .gte("started_at", parisInstant(first, "00:00").toISOString())
      .lt("started_at", parisInstant(after, "00:00").toISOString())
      .order("started_at"),
    // Contrat personnel : la RLS ne renvoie que celui de l'assistante connectée.
    supabase
      .from("contracts")
      .select("start_date, scheduled_hours, weeks_per_year, hourly_rate, maintenance_allowance_cents, meal_allowance_cents")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", child.id)
      .eq("assigned_assmat_id", user.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (attendance.error || events.error) throw new Error("Chargement de la fiche impossible.");

  // Heures proposées d'après le journal (première arrivée, dernier départ) ; la saisie manuelle prime.
  const fromJournal: Record<number, { in?: string; out?: string }> = {};
  for (const e of (events.data ?? []) as Row[]) {
    const iso = e.started_at as string;
    const day = Number(parisDateKey(iso).slice(8));
    const slot = (fromJournal[day] ??= {});
    if (e.event_type === "arrival" && !slot.in) slot.in = parisHHMM(iso);
    if (e.event_type === "departure") slot.out = parisHHMM(iso);
  }

  const days: Record<number, SheetDay> = {};
  for (let d = 1; d <= daysInMonth(month); d += 1) {
    if (fromJournal[d]) days[d] = { ...fromJournal[d] };
  }
  for (const r of (attendance.data ?? []) as Row[]) {
    const day = Number((r.date as string).slice(8));
    const journal = fromJournal[day] ?? {};
    days[day] = {
      in: r.actual_start ? parisHHMM(r.actual_start as string) : journal.in,
      out: r.actual_end ? parisHHMM(r.actual_end as string) : journal.out,
      absenceMinutes: (r.absence_minutes as number) || undefined,
      extraMinutes: (r.extra_minutes as number) || undefined,
      maintenance: (r.maintenance_due as boolean) || undefined,
      meal: (r.meal_due as boolean) || undefined,
      leave: (r.leave_kind as "CP" | "CSS" | null) ?? null,
      note: (r.note as string | null) ?? undefined,
    };
  }

  const c = contract.data as Row | null;
  const initial: SheetData = {
    month,
    childName: child.name,
    caregiverName: (profile.data?.display_name as string | undefined)?.trim() ?? "",
    contract: c
      ? {
          startDate: c.start_date as string,
          weeklyMinutes: Math.round(Number(c.scheduled_hours) * 60),
          // Mensualisation usuelle : heures hebdo × semaines travaillées ÷ 12. Information indicative.
          monthlyMinutes: Math.round((Number(c.scheduled_hours) * Number(c.weeks_per_year) * 60) / 12),
          hourlyNetCents: Math.round(Number(c.hourly_rate) * 100),
          maintenanceCents: c.maintenance_allowance_cents as number,
          mealCents: c.meal_allowance_cents as number,
        }
      : {},
    days,
  };

  return <SheetEditor key={`${child.id}-${month}`} initial={initial} childId={child.id} childrenList={children} hasContract={Boolean(c)} />;
}

export default function Page({ searchParams }: PageProps<"/planning">) {
  return (
    <>
      <PageTitle subtitle="Fiche de présence du mois">Planning</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

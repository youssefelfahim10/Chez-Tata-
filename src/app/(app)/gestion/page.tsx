import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChildForm } from "@/components/child-form";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { monthRange, monthlyEstimateCents, sumCents } from "@/lib/finance/summary";
import { parisDayBounds, summarizeChildDay, type JournalEvent } from "@/lib/journal/day";
import { formatDecimalHours, formatEuros } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gestion" };

type Row = Record<string, unknown>;

function Tile({ icon, value, label, hint, wide, tone = "bg-surface" }: { icon: string; value: string; label: string; hint?: string; wide?: boolean; tone?: string }) {
  return (
    <div className={`rounded-card border border-line p-4 shadow-sm ${tone} ${wide ? "col-span-2" : ""}`}>
      <p aria-hidden className="text-2xl">
        {icon}
      </p>
      <p className="mt-1 text-2xl font-extrabold leading-tight">{value}</p>
      <p className="text-sm font-bold">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

async function Dashboard() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const { start, end, isoDate } = parisDayBounds(now);
  const { first, after } = monthRange(isoDate.slice(0, 7));

  const [children, events, contracts, expenses] = await Promise.all([
    supabase
      .from("children")
      .select("id, first_name, last_name, birth_date")
      .eq("organization_id", membership.organizationId)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("daily_events")
      .select("id, child_id, event_type, started_at, ended_at")
      .eq("organization_id", membership.organizationId)
      .in("event_type", ["arrival", "departure"])
      .is("deleted_at", null)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString()),
    // La RLS ne renvoie que VOS contrats, même dans une MAM.
    supabase
      .from("contracts")
      .select("scheduled_hours, weeks_per_year, hourly_rate")
      .eq("organization_id", membership.organizationId)
      .eq("assigned_assmat_id", user.id)
      .eq("status", "active"),
    supabase
      .from("expenses")
      .select("amount_cents")
      .eq("organization_id", membership.organizationId)
      .eq("owner_id", user.id)
      .gte("date", first)
      .lt("date", after),
  ]);
  if (children.error || events.error || contracts.error || expenses.error) throw new Error("Chargement de la gestion impossible.");

  const kids = (children.data ?? []) as Row[];
  const allEvents = (events.data ?? []) as JournalEvent[];
  const present = kids.filter((k) => summarizeChildDay(allEvents.filter((e) => e.child_id === k.id), now).status === "present").length;

  const contractRows = (contracts.data ?? []) as Row[];
  const weeklyMinutes = contractRows.reduce((t, c) => t + Math.round(Number(c.scheduled_hours) * 60), 0);
  const income = contractRows.reduce(
    (t, c) => t + monthlyEstimateCents({ scheduledHours: Number(c.scheduled_hours), weeksPerYear: Number(c.weeks_per_year), hourlyRate: Number(c.hourly_rate) }),
    0,
  );
  const charges = sumCents((expenses.data ?? []) as { amount_cents: number }[]);
  const hasContracts = contractRows.length > 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon="👶" value={String(kids.length)} label={kids.length > 1 ? "Enfants accueillis" : "Enfant accueilli"} hint={`${present} présent${present > 1 ? "s" : ""} aujourd’hui`} tone="bg-leaf-soft" />
        <Tile
          icon="📄"
          value={String(contractRows.length)}
          label={contractRows.length > 1 ? "Contrats actifs" : "Contrat actif"}
          hint={hasContracts ? `${formatDecimalHours(weeklyMinutes)} h par semaine` : "Aucun contrat pour l’instant"}
        />
        <Tile icon="💶" value={hasContracts ? `${formatEuros(income)} €` : "—"} label="Revenus estimés / mois" hint="Estimation (mensualisation), hors indemnités" tone="bg-sun-soft" />
        <Tile icon="🧾" value={`${formatEuros(charges)} €`} label="Charges du mois" hint="Ce que vous avez payé" />
        <Tile
          icon="⚖️"
          wide
          value={hasContracts ? `${formatEuros(income - charges)} €` : "—"}
          label="Solde indicatif du mois"
          hint="Revenus estimés moins charges. Repère personnel : ce n’est ni une paie ni une déclaration."
        />
      </div>

      <Link href="/gestion/charges" className="flex min-h-16 items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 shadow-sm">
        <span className="flex items-center gap-3 text-lg font-extrabold">
          <span aria-hidden className="text-3xl">
            🧾
          </span>
          Mes charges
          <span className="text-sm font-normal text-ink-soft">cocher · exporter</span>
        </span>
        <span aria-hidden className="text-2xl text-ink-soft">
          ›
        </span>
      </Link>

      <Card>
        <h2 className="text-lg font-extrabold">Enfants accueillis</h2>
        {kids.length === 0 ? (
          <p className="mt-2 text-ink-soft">Aucun enfant pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {kids.map((child) => (
              <li key={child.id as string}>
                <Link href={`/gestion/${child.id as string}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-3 font-bold">
                    <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-sun font-extrabold">
                      {(child.first_name as string).charAt(0).toUpperCase()}
                    </span>
                    {[child.first_name, child.last_name].filter(Boolean).join(" ")}
                  </span>
                  <span className="text-sm text-ink-soft">famille · contrat ›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-extrabold">➕ Ajouter un enfant</h2>
        <ChildForm />
      </Card>

      <Card>
        <p className="font-bold">🚧 Bientôt</p>
        <p className="mt-1 text-ink-soft">Décomptes mensuels, paiements reçus, documents Pajemploi et exports PDF.</p>
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Tableau de bord, contrats et finances">Gestion</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

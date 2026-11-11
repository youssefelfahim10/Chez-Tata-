import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChildAvatar } from "@/components/child-avatar";
import { ChildForm } from "@/components/child-form";
import { HubLink, SectionTitle } from "@/components/hub-link";
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

  const [children, events, contracts, expenses, received] = await Promise.all([
    supabase
      .from("children")
      .select("id, first_name, last_name, birth_date, gender")
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
    // Paiements reçus ce mois (privés à l'assistante : la base ne renvoie que les siens).
    supabase.from("payments").select("amount_cents").eq("organization_id", membership.organizationId).eq("status", "received").gte("payment_date", first).lt("payment_date", after),
  ]);
  if (children.error || events.error || contracts.error || expenses.error || received.error) throw new Error("Chargement de la gestion impossible.");

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
  const cashedIn = sumCents((received.data ?? []) as { amount_cents: number }[]);

  return (
    <>
      <SectionTitle>Ce mois-ci</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon="👶" value={String(kids.length)} label={kids.length > 1 ? "Enfants accueillis" : "Enfant accueilli"} hint={`${present} présent${present > 1 ? "s" : ""} aujourd’hui`} tone="bg-leaf-soft" />
        <Tile
          icon="📄"
          value={String(contractRows.length)}
          label={contractRows.length > 1 ? "Contrats actifs" : "Contrat actif"}
          hint={hasContracts ? `${formatDecimalHours(weeklyMinutes)} h par semaine` : "Aucun contrat pour l’instant"}
        />
        <Tile icon="💶" value={hasContracts ? `${formatEuros(income)} €` : "—"} label="Revenus estimés / mois" hint="Estimation (mensualisation), hors indemnités" tone="bg-sun-soft" />
        <Tile icon="✅" value={`${formatEuros(cashedIn)} €`} label="Encaissé ce mois" hint="Paiements marqués « reçus »" tone="bg-leaf-soft" />
        <Tile icon="🧾" value={`${formatEuros(charges)} €`} label="Charges du mois" hint="Ce que vous avez payé" />
        <Tile
          icon="⚖️"
          value={hasContracts ? `${formatEuros(income - charges)} €` : "—"}
          label="Solde indicatif du mois"
          hint="Revenus estimés moins charges. Simple repère."
        />
      </div>

      <SectionTitle>Mes enfants</SectionTitle>
      <Card>
        {kids.length === 0 ? (
          <p className="text-ink-soft">Aucun enfant pour le moment. Ajoutez le premier ci-dessous.</p>
        ) : (
          <ul className="divide-y divide-line">
            {kids.map((child) => (
              <li key={child.id as string}>
                <Link href={`/gestion/${child.id as string}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-3 font-bold">
                    <ChildAvatar name={child.first_name as string} gender={child.gender as string | null} size="sm" />
                    {[child.first_name, child.last_name].filter(Boolean).join(" ")}
                  </span>
                  <span className="text-sm text-ink-soft">famille · santé · contrat ›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-3 rounded-2xl border border-line" open={kids.length === 0}>
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-bold text-primary">
            <span aria-hidden>➕</span> Ajouter un enfant
          </summary>
          <div className="px-4 pb-4 pt-2">
            <ChildForm />
          </div>
        </details>
      </Card>

      <SectionTitle>Argent et papiers</SectionTitle>
      <HubLink href="/gestion/factures" emoji="💶" title="Factures et paiements" text="Paiement reçu → facture prête à envoyer" tone="gold" />
      <HubLink href="/gestion/charges" emoji="🧾" title="Mes charges" text="Cocher, saisir, exporter" tone="aqua" />
      <HubLink href="/profil/impots" emoji="🏛️" title="Impôts et documents" text="Aide à la déclaration, attestations d’accueil" tone="primary" />
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Mes enfants, mon argent, mes papiers">Gestion</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

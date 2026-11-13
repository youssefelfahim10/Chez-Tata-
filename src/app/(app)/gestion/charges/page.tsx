import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeleteExpenseForm, ExpenseChecklist } from "@/components/expense-forms";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { categoryIcon, categoryLabel } from "@/lib/finance/categories";
import { groupByCategory, monthRange, shiftMonth, sumCents } from "@/lib/finance/summary";
import { parisDayBounds } from "@/lib/journal/day";
import { formatDateFR, formatEuros, monthNameFR } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Charges" };

type Row = { id: string; category: string; label: string; amount_cents: number; date: string };

async function Content({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { user, membership } = await requireWorkspace();
  const params = await searchParams;
  const today = parisDayBounds(new Date()).isoDate;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mois ?? "") ? (params.mois as string) : today.slice(0, 7);
  const { first, after } = monthRange(month);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, category, label, amount_cents, date")
    .eq("organization_id", membership.organizationId)
    .eq("owner_id", user.id)
    .gte("date", first)
    .lt("date", after)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Chargement des charges impossible.");
  const rows = (data ?? []) as Row[];
  const total = sumCents(rows);
  const groups = groupByCategory(rows);
  const title = `${monthNameFR(month)} ${month.slice(0, 4)}`;

  return (
    <>
      <Link href="/gestion" className="-mt-2 inline-flex min-h-11 items-center font-bold text-primary underline">
        ← Retour à la gestion
      </Link>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/gestion/charges?mois=${shiftMonth(month, -1)}`} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-line text-xl" aria-label="Mois précédent">
            ◀
          </Link>
          <h2 className="text-lg font-extrabold capitalize">{title}</h2>
          <Link href={`/gestion/charges?mois=${shiftMonth(month, 1)}`} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-line text-xl" aria-label="Mois suivant">
            ▶
          </Link>
        </div>
        <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-center text-2xl font-extrabold">🧾 {formatEuros(total)} €</p>
        <p className="mt-1 text-center text-sm text-ink-soft">
          {rows.length} charge{rows.length > 1 ? "s" : ""} ce mois-ci
        </p>

        {groups.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.category}>
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>
                    {categoryIcon(g.category)} {categoryLabel(g.category)}
                  </span>
                  <span>
                    {formatEuros(g.totalCents)} € · {g.percent} %
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-cream" role="img" aria-label={`${g.percent} % des charges`}>
                  <div className="h-full rounded-full bg-sun" style={{ width: `${Math.max(g.percent, 3)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-ink-soft">Aucune charge enregistrée ce mois-ci.</p>
        )}
        {rows.length > 0 ? (
          <a href={`/gestion/charges/export?mois=${month}`} className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border border-line font-bold text-primary">
            📤 Exporter en CSV
          </a>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-extrabold">➕ Ajouter des charges</h2>
        <p className="mb-4 text-sm text-ink-soft">Cochez ce que vous avez payé, saisissez le montant. Plusieurs d’un coup, c’est possible.</p>
        <ExpenseChecklist today={today} />
      </Card>

      {rows.length > 0 ? (
        <Card>
          <h2 className="text-lg font-extrabold">Détail du mois</h2>
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span aria-hidden className="text-2xl">
                  {categoryIcon(r.category)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{categoryLabel(r.category)}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {formatDateFR(r.date)}
                    {r.label ? ` · ${r.label}` : ""}
                  </p>
                </div>
                <span className="font-extrabold">{formatEuros(r.amount_cents)} €</span>
                <DeleteExpenseForm id={r.id} label={`${categoryLabel(r.category)} ${formatEuros(r.amount_cents)} €`} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/gestion/charges">) {
  return (
    <>
      <PageTitle subtitle="Cochez, c’est noté">Mes charges</PageTitle>
      <Suspense fallback={<Skeleton lines={5} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

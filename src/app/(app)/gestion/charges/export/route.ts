import { requireWorkspace } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/finance/categories";
import { csvCell, monthRange } from "@/lib/finance/summary";
import { formatDateFR } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";

/** Export CSV des charges du mois (les vôtres uniquement : la base filtre par compte). */
export async function GET(request: Request) {
  const { user, membership } = await requireWorkspace();
  const month = new URL(request.url).searchParams.get("mois") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response("Mois invalide", { status: 400 });
  const { first, after } = monthRange(month);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("date, category, label, amount_cents")
    .eq("organization_id", membership.organizationId)
    .eq("owner_id", user.id)
    .gte("date", first)
    .lt("date", after)
    .order("date");
  if (error) return new Response("Export impossible", { status: 500 });

  const lines = [["Date", "Catégorie", "Précision", "Montant (€)"].join(";")];
  for (const r of data ?? []) {
    const cents = r.amount_cents as number;
    lines.push(
      [
        csvCell(formatDateFR(r.date as string)),
        csvCell(categoryLabel(r.category as string)),
        csvCell((r.label as string) ?? ""),
        csvCell(`${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`),
      ].join(";"),
    );
  }
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Chez_TaTa_charges_${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

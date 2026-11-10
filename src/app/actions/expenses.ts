"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/session";
import { EXPENSE_CATEGORIES, OTHER_KEY, categoryLabel } from "@/lib/finance/categories";
import { formatEuros, eurosInputToCents } from "@/lib/sheet/compute";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Enregistre en une fois les charges cochées (chacune avec son montant). */
export async function addExpenses(_prev: FormState, formData: FormData): Promise<FormState> {
  const date = dateSchema.safeParse(text(formData, "date"));
  if (!date.success || Number.isNaN(Date.parse(`${date.data}T00:00:00Z`))) return { error: "Indiquez la date." };
  const note = text(formData, "note").slice(0, 150);

  const items: { category: string; label: string; cents: number }[] = [];
  for (const cat of EXPENSE_CATEGORIES) {
    if (text(formData, `on_${cat.key}`) !== "on") continue;
    const cents = eurosInputToCents(text(formData, `amt_${cat.key}`));
    if (!cents) return { error: `${cat.label} : indiquez un montant en euros (ex. 12,50).` };
    items.push({ category: cat.key, label: note, cents });
  }
  if (text(formData, `on_${OTHER_KEY}`) === "on") {
    const label = text(formData, "other_label").slice(0, 100);
    if (!label) return { error: "Autre : précisez de quelle charge il s'agit." };
    const cents = eurosInputToCents(text(formData, "other_amount"));
    if (!cents) return { error: "Autre : indiquez un montant en euros (ex. 12,50)." };
    items.push({ category: OTHER_KEY, label: note ? `${label} — ${note}` : label, cents });
  }
  if (items.length === 0) return { error: "Cochez au moins une charge." };
  if (items.some((i) => i.cents > 10_000_000)) return { error: "Un montant dépasse 100 000 € : vérifiez la saisie." };

  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert(
    items.map((i) => ({
      organization_id: membership.organizationId,
      owner_id: user.id,
      category: i.category,
      label: i.label.slice(0, 200),
      amount_cents: i.cents,
      date: date.data,
    })),
  );
  if (error) return { error: "Impossible d'enregistrer les charges. Réessayez." };

  revalidatePath("/gestion");
  revalidatePath("/gestion/charges");
  const total = items.reduce((t, i) => t + i.cents, 0);
  return { message: `${items.length} charge${items.length > 1 ? "s" : ""} enregistrée${items.length > 1 ? "s" : ""} : ${formatEuros(total)} € (${items.map((i) => categoryLabel(i.category)).join(", ")}).` };
}

export async function deleteExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(text(formData, "id"));
  if (!id.success) return { error: "Charge invalide." };
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Suppression impossible." };
  revalidatePath("/gestion");
  revalidatePath("/gestion/charges");
  return { message: "Charge supprimée." };
}

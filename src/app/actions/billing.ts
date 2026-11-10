"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  contractId: z.uuid(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),
  paidAt: z.iso.date(),
  method: z.enum(["virement", "cheque", "especes", "cesu", "autre"]),
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        detail: z.string().trim().max(120).optional(),
        amountCents: z.number().int().min(-999_999_999).max(999_999_999),
      }),
    )
    .min(1)
    .max(30),
});

export type ConfirmPaymentResult = { ok: true; number: string; totalCents: number } | { ok: false; error: string };

/**
 * « Paiement reçu » : la base crée la facture (numéro continu), fige le décompte et enregistre le paiement,
 * en une seule opération. Rien n'est envoyé à personne.
 */
export async function confirmPayment(input: z.input<typeof inputSchema>): Promise<ConfirmPaymentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Vérifiez les lignes, la date et le mode de paiement." };
  const { contractId, period, paidAt, method, lines } = parsed.data;
  await requireWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("finalize_invoice", {
    p_contract: contractId,
    p_period: period,
    p_lines: lines.map((l) => ({ label: l.label, ...(l.detail ? { detail: l.detail } : {}), amount_cents: l.amountCents })),
    p_paid_at: paidAt,
    p_method: method,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Une facture existe déjà pour ce mois." };
    if (error.code === "42501") return { ok: false, error: "Contrat introuvable." };
    if (/Total de facture invalide/.test(error.message)) return { ok: false, error: "Le total doit être supérieur à 0 €." };
    if (/Date de paiement invalide/.test(error.message)) return { ok: false, error: "La date de paiement ne peut pas être dans le futur." };
    return { ok: false, error: "Impossible de générer la facture. Réessayez." };
  }
  const result = data as { invoice_number: string; total_cents: number };
  revalidatePath("/gestion/factures");
  revalidatePath("/gestion");
  return { ok: true, number: result.invoice_number, totalCents: result.total_cents };
}

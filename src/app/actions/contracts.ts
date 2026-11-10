"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/session";
import { detailsSchema } from "@/lib/documents/details";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  childId: z.uuid(),
  contract: z.object({
    startDate: z.iso.date(),
    weeklyHours: z.number().gt(0).lte(100),
    weeksPerYear: z.number().min(1).max(52),
    hourlyNetCents: z.number().int().min(1).max(100_000),
    maintenanceCents: z.number().int().min(0).max(100_000),
    mealCents: z.number().int().min(0).max(100_000),
    contractType: z.enum(["annee_complete", "annee_incomplete"]),
  }),
  details: detailsSchema,
});

export type SaveContractResult = { ok: true; contractId: string } | { ok: false; error: string };

/** Crée ou met à jour le contrat actif de l'enfant (privé à l'assistante) et mémorise les coordonnées de la famille. */
export async function saveContract(input: z.input<typeof inputSchema>): Promise<SaveContractResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Certaines informations sont invalides : vérifiez les champs." };
  const { childId, contract: c, details } = parsed.data;
  if (Math.round(c.weeklyHours * 100) !== c.weeklyHours * 100 && String(c.weeklyHours).split(".")[1]?.length > 2) return { ok: false, error: "Heures par semaine : 2 décimales au plus." };

  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const row = {
    start_date: c.startDate,
    scheduled_hours: c.weeklyHours,
    weeks_per_year: c.weeksPerYear,
    hourly_rate: c.hourlyNetCents / 100,
    maintenance_allowance_cents: c.maintenanceCents,
    meal_allowance_cents: c.mealCents,
    contract_type: c.contractType,
    mileage_enabled: false,
    details,
  };

  const existing = await supabase
    .from("contracts")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .eq("child_id", childId)
    .eq("assigned_assmat_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (existing.error) return { ok: false, error: "Enregistrement impossible. Réessayez." };

  let contractId: string;
  if (existing.data) {
    const { error } = await supabase.from("contracts").update(row).eq("id", existing.data.id).eq("organization_id", membership.organizationId);
    if (error) return { ok: false, error: "Enregistrement impossible. Vérifiez la date de début." };
    contractId = existing.data.id as string;
  } else {
    const { data, error } = await supabase
      .from("contracts")
      .insert({ ...row, organization_id: membership.organizationId, child_id: childId, assigned_assmat_id: user.id, status: "active" })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Création du contrat impossible. Réessayez." };
    contractId = data.id as string;
  }

  // Coordonnées utiles (téléphone, e-mail, adresse) sur la famille liée, pour le bilan WhatsApp et les prochains documents.
  const links = await supabase.from("child_family_links").select("family_id").eq("organization_id", membership.organizationId).eq("child_id", childId);
  const familyId = (links.data?.[0]?.family_id as string | undefined) ?? undefined;
  if (familyId) {
    const family = await supabase.from("families").select("contact_details").eq("id", familyId).eq("organization_id", membership.organizationId).maybeSingle();
    const merged = { ...((family.data?.contact_details as Record<string, string>) ?? {}) };
    if (details.parents.phone) merged.phone = details.parents.phone;
    if (details.parents.email) merged.email = details.parents.email;
    if (details.parents.address) merged.address = details.parents.address;
    await supabase.from("families").update({ contact_details: merged }).eq("id", familyId).eq("organization_id", membership.organizationId);
  }

  revalidatePath(`/gestion/${childId}`);
  revalidatePath(`/gestion/${childId}/contrat`);
  revalidatePath("/gestion");
  return { ok: true, contractId };
}

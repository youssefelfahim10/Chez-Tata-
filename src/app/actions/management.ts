"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/session";
import { contractTypeFor, parseContractForm } from "@/lib/contracts/parse";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

const familySchema = z.object({
  childId: z.uuid(),
  name: z.string().min(1, "Indiquez le nom de la famille.").max(120),
  relationship: z.string().max(40),
  phone: z.string().max(30),
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide.").max(254)]),
});

/** Ajoute une famille et la relie à l'enfant. Les coordonnées ne sont jamais inventées : champs facultatifs. */
export async function addFamily(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = familySchema.safeParse({
    childId: text(formData, "childId"),
    name: text(formData, "name"),
    relationship: text(formData, "relationship") || "parent",
    phone: text(formData, "phone"),
    email: text(formData, "email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { membership } = await requireWorkspace();
  const supabase = await createClient();
  const contact: Record<string, string> = {};
  if (d.phone) contact.phone = d.phone;
  if (d.email) contact.email = d.email;

  const created = await supabase
    .from("families")
    .insert({ organization_id: membership.organizationId, name: d.name, contact_details: contact })
    .select("id")
    .single();
  if (created.error || !created.data) return { error: "Impossible d'ajouter la famille." };

  const link = await supabase.from("child_family_links").insert({
    organization_id: membership.organizationId,
    child_id: d.childId,
    family_id: created.data.id,
    relationship: d.relationship,
  });
  if (link.error) {
    // Pas de famille orpheline si le lien échoue.
    await supabase.from("families").delete().eq("id", created.data.id).eq("organization_id", membership.organizationId);
    return { error: "Impossible de relier la famille à l'enfant." };
  }
  revalidatePath(`/gestion/${d.childId}`);
  return { message: `Famille « ${d.name} » ajoutée.` };
}

/** Crée le contrat actif de l'enfant pour l'assistante connectée (contrat privé, RLS). */
export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const childId = z.uuid().safeParse(text(formData, "childId"));
  if (!childId.success) return { error: "Enfant invalide." };

  const parsed = parseContractForm({
    startDate: text(formData, "startDate"),
    weeklyHours: text(formData, "weeklyHours"),
    weeksPerYear: text(formData, "weeksPerYear"),
    hourlyNet: text(formData, "hourlyNet"),
    maintenance: text(formData, "maintenance"),
    meal: text(formData, "meal"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const c = parsed.value;

  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();

  const existing = await supabase
    .from("contracts")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .eq("child_id", childId.data)
    .eq("assigned_assmat_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (existing.error) return { error: "Vérification impossible. Réessayez." };
  if (existing.data?.length) return { error: "Un contrat est déjà actif pour cet enfant. Terminez-le avant d'en créer un autre." };

  const { error } = await supabase.from("contracts").insert({
    organization_id: membership.organizationId,
    child_id: childId.data,
    assigned_assmat_id: user.id,
    start_date: c.startDate,
    scheduled_hours: c.weeklyHours,
    weeks_per_year: c.weeksPerYear,
    hourly_rate: c.hourlyNetCents / 100,
    maintenance_allowance_cents: c.maintenanceCents,
    meal_allowance_cents: c.mealCents,
    mileage_enabled: false,
    contract_type: contractTypeFor(c.weeksPerYear),
    status: "active",
  });
  if (error) return { error: "Impossible d'enregistrer le contrat." };

  revalidatePath(`/gestion/${childId.data}`);
  revalidatePath("/planning");
  return { message: "Contrat enregistré." };
}

const endSchema = z.object({ contractId: z.uuid(), childId: z.uuid(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Termine le contrat (il n'est jamais supprimé : l'historique des fiches reste lisible). */
export async function endContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = endSchema.safeParse({
    contractId: text(formData, "contractId"),
    childId: text(formData, "childId"),
    endDate: text(formData, "endDate"),
  });
  if (!parsed.success) return { error: "Indiquez la date de fin du contrat." };
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "ended", end_date: parsed.data.endDate })
    .eq("id", parsed.data.contractId)
    .eq("organization_id", membership.organizationId)
    .eq("assigned_assmat_id", user.id)
    .eq("status", "active")
    .select("id");
  if (error || !data?.length) return { error: "Impossible de terminer le contrat (date de fin avant le début ?)." };
  revalidatePath(`/gestion/${parsed.data.childId}`);
  revalidatePath("/planning");
  return { message: "Contrat terminé." };
}

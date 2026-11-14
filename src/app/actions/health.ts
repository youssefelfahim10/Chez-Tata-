"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { parseHealthForm } from "@/lib/health/schema";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

/**
 * Enregistre la fiche santé et urgences d'un enfant. Tout vient de la saisie de l'assistante :
 * rien n'est déduit ni envoyé. La session est revérifiée et la RLS limite l'écriture à son espace.
 */
export async function saveChildHealth(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseHealthForm((key) => String(formData.get(key) ?? "").trim());
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;

  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();

  const child = await supabase
    .from("children")
    .select("id")
    .eq("id", parsed.childId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (child.error || !child.data) return { error: "Enfant introuvable." };

  const { error } = await supabase.from("child_health").upsert(
    {
      organization_id: membership.organizationId,
      child_id: parsed.childId,
      allergies: v.allergies,
      diet: v.diet,
      medication: v.medication,
      medical_notes: v.medicalNotes,
      doctor_name: v.doctorName,
      doctor_phone: v.doctorPhone,
      emergency_contacts: v.emergencyContacts,
      authorized_pickups: v.authorizedPickups,
      updated_by: user.id,
    },
    { onConflict: "organization_id,child_id" },
  );
  if (error) return { error: "Impossible d'enregistrer la fiche. Réessayez." };

  revalidatePath(`/gestion/${parsed.childId}`);
  revalidatePath(`/aujourdhui/urgence/${parsed.childId}`);
  revalidatePath("/aujourdhui");
  revalidatePath("/demarrage");
  return { message: "Fiche enregistrée." };
}

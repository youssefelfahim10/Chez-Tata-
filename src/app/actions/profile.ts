"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { parseProfileForm, toRow } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

/**
 * Enregistre le profil de l'assistante (identité, agrément, assurance) et le prénom affiché.
 * Tout est facultatif et saisi par elle ; la session est revérifiée et la base ne laisse écrire que son propre profil.
 */
export async function saveCaregiverProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseProfileForm((key) => String(formData.get(key) ?? "").trim());
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  if (!v.displayName) return { error: "Indiquez le prénom avec lequel l'application vous accueille." };

  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();

  const name = await supabase.from("profiles").update({ display_name: v.displayName }).eq("id", user.id);
  if (name.error) return { error: "Impossible d'enregistrer votre prénom. Réessayez." };

  const { error } = await supabase
    .from("caregiver_profiles")
    .upsert({ organization_id: membership.organizationId, user_id: user.id, ...toRow(v) }, { onConflict: "organization_id,user_id" });
  if (error) return { error: "Impossible d'enregistrer le profil. Réessayez." };

  revalidatePath("/profil", "layout");
  revalidatePath("/demarrage");
  revalidatePath("/aujourdhui");
  return { message: "Profil enregistré." };
}

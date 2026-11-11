"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/session";
import type { FormState } from "./auth";

const childSchema = z.object({
  firstName: z.string().trim().min(1, "Indiquez le prénom de l'enfant.").max(60),
  lastName: z.string().trim().max(60),
  birthDate: z.union([z.iso.date(), z.literal("")]),
  gender: z.enum(["girl", "boy", ""]),
});

export async function createChild(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireWorkspace();
  const parsed = childSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    gender: formData.get("gender") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("children").insert({
    organization_id: membership.organizationId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName || null,
    birth_date: parsed.data.birthDate || null,
    gender: parsed.data.gender || null,
    created_by: user.id,
  });
  if (error) return { error: "Impossible d'ajouter l'enfant." };
  revalidatePath("/gestion");
  revalidatePath("/aujourdhui");
  return { message: `${parsed.data.firstName} a été ajouté.` };
}

const genderSchema = z.object({ childId: z.uuid(), gender: z.enum(["girl", "boy", ""]) });

/** Choisit l'icône de l'enfant (fille / garçon) ; une valeur vide revient à l'initiale. */
export async function setChildGender(_prev: FormState, formData: FormData): Promise<FormState> {
  const { membership } = await requireWorkspace();
  const parsed = genderSchema.safeParse({ childId: formData.get("childId"), gender: formData.get("gender") ?? "" });
  if (!parsed.success) return { error: "Choix invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .update({ gender: parsed.data.gender || null })
    .eq("id", parsed.data.childId)
    .eq("organization_id", membership.organizationId)
    .select("id");
  if (error || !data?.length) return { error: "Impossible de modifier l'icône." };
  revalidatePath("/gestion");
  revalidatePath(`/gestion/${parsed.data.childId}`);
  revalidatePath("/aujourdhui");
  return {};
}

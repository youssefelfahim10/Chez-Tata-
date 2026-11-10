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
});

export async function createChild(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireWorkspace();
  const parsed = childSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
    birthDate: formData.get("birthDate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("children").insert({
    organization_id: membership.organizationId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName || null,
    birth_date: parsed.data.birthDate || null,
    created_by: user.id,
  });
  if (error) return { error: "Impossible d'ajouter l'enfant." };
  revalidatePath("/gestion");
  revalidatePath("/aujourdhui");
  return { message: `${parsed.data.firstName} a été ajouté.` };
}

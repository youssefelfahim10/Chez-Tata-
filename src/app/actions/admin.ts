"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ userId: z.uuid(), suspended: z.enum(["true", "false"]) });

/**
 * Suspend ou réactive un compte. Revérifie le droit d'administration côté serveur (la base le revérifie aussi)
 * et refuse de se suspendre soi-même ou de suspendre un autre administrateur.
 */
export async function setUserSuspended(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = schema.safeParse({ userId: formData.get("userId"), suspended: formData.get("suspended") });
  if (!parsed.success) redirect("/admin/comptes?erreur=suspension");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_suspended", {
    p_user: parsed.data.userId,
    p_suspended: parsed.data.suspended === "true",
  });
  if (error) redirect("/admin/comptes?erreur=suspension");
  revalidatePath("/admin", "layout");
}

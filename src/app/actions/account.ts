"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/session";
import type { FormState } from "./auth";

const schema = z.object({ confirmation: z.literal("SUPPRIMER", { error: "Tapez SUPPRIMER pour confirmer." }) });

/** Suppression définitive du compte (exigée par RGPD et par les stores). Revérifie la session côté serveur. */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isDemoEmail(user.email)) return { error: "Le compte de démonstration ne peut pas être supprimé." };

  const parsed = schema.safeParse({ confirmation: String(formData.get("confirmation") ?? "").trim() });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "La suppression a échoué. Réessayez ou contactez-nous." };

  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect("/connexion?compte=supprime");
}

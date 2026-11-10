"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDemoConfig } from "@/lib/demo";
import { safeEqual } from "@/lib/security/compare";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const schema = z.object({ code: z.string().trim().min(1).max(200) });

/**
 * Entrée dans la démo, réservée à l'équipe : il faut le code d'accès (variable d'environnement serveur).
 * Les identifiants du compte de démonstration ne quittent jamais le serveur.
 */
export async function enterDemo(_prev: FormState, formData: FormData): Promise<FormState> {
  const config = getDemoConfig();
  if (!config) return { error: "La démo n'est pas activée sur cette installation." };

  const parsed = schema.safeParse({ code: formData.get("code") });
  const valid = parsed.success && safeEqual(parsed.data.code, config.code);
  if (!valid) {
    // Ralentit les essais en rafale ; le code, long et aléatoire, ne se devine pas.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { error: "Code d'accès incorrect." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: config.email, password: config.password });
  if (error) return { error: "La démo est momentanément indisponible." };
  redirect("/aujourdhui");
}

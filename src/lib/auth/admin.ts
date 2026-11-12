import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { getDemoConfig } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

/**
 * Accès à l'administration de la plateforme. Réservé aux comptes listés dans private.platform_admins
 * (par identifiant de compte). Tout autre visiteur reçoit une page « introuvable » : on ne révèle pas
 * que /admin existe. Ce contrôle d'affichage ne remplace pas celui de la base, qui revérifie le droit
 * à chaque appel des fonctions admin_*.
 */
export const requirePlatformAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await requireUser("/admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_i_platform_admin");
  if (error || data !== true) notFound();
  return user;
});

/** Le compte de démonstration publique est exclu des chiffres : il ne représente pas une vraie utilisatrice. */
export function demoEmailToExclude(): string | null {
  return getDemoConfig()?.email ?? null;
}

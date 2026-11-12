import "server-only";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Journalise une connexion réussie pour le tableau de bord de l'administration (comptage des connexions).
 * N'enregistre que le compte, la méthode et l'heure. Un échec ne doit JAMAIS empêcher de se connecter.
 */
export async function recordLogin(supabase: ServerClient, provider: "email" | "google"): Promise<void> {
  try {
    await supabase.rpc("record_login", { p_provider: provider });
  } catch {
    // Statistique seulement : on ignore.
  }
}

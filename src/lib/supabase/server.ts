import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSupabaseEnv } from "./env";
import { hardenCookie } from "./cookies";

/** Client Supabase côté serveur, lié à la session (cookies) de la requête. */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) redirect("/configuration");

  // La session dépend de la requête : on sort explicitement du pré-rendu (la vérification
  // du jeton lit l'heure courante, ce que Cache Components refuse dans un rendu mis en cache).
  await connection();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookie(options));
          }
        } catch {
          // Appelé depuis un Server Component : l'écriture est impossible ici.
          // Le rafraîchissement de session est assuré par src/proxy.ts.
        }
      },
    },
  });
}

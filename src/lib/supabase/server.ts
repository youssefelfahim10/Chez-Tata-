import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "./env";

/** Client Supabase côté serveur, lié à la session (cookies) de la requête. */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) redirect("/configuration");

  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : l'écriture est impossible ici.
          // Le rafraîchissement de session est assuré par src/proxy.ts.
        }
      },
    },
  });
}

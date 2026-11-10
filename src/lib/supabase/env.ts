/**
 * Variables publiques Supabase. La clé « publishable » est conçue pour être
 * exposée au navigateur : la sécurité repose sur la RLS, jamais sur cette clé.
 * Aucune clé secrète (service_role) ne doit être utilisée par l'application web.
 */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

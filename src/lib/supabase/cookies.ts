import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookies de session : illisibles par JavaScript (httpOnly), envoyés seulement en HTTPS en production,
 * jamais sur une requête d'un autre site (lax). L'appli n'utilise que le client serveur : le navigateur
 * n'a pas besoin de lire ces cookies.
 */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/connexion", "/inscription", "/auth", "/configuration"];

/**
 * Rafraîchit la session Supabase et applique une première barrière de
 * redirection. Ce n'est PAS le contrôle d'accès : chaque page et chaque action
 * serveur revérifie la session, et la base applique la RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pages de démonstration (données fictives) : jamais servies en production.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/apercu")) return NextResponse.next();

  const env = getSupabaseEnv();

  if (!env) {
    if (pathname === "/configuration") return NextResponse.next();
    return NextResponse.redirect(new URL("/configuration", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const redirectTo = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!isAuthenticated && !isPublic) {
    return redirectTo("/connexion", pathname === "/" ? undefined : pathname);
  }
  if (isAuthenticated && (pathname === "/" || pathname === "/connexion" || pathname === "/inscription")) {
    const next = request.nextUrl.searchParams.get("next");
    if (!next) return redirectTo("/aujourdhui");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Retour de Google (via Supabase) : échange le code à usage unique contre une session.
 * Toute erreur (refus, annulation, code expiré) renvoie vers la connexion avec un message sobre.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));

  if (code && !params.get("error")) {
    const flowId = params.get("sb_flow_id");
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=google", request.url));
}

"use client";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui";
import { clearOfflineCaches } from "@/lib/offline/storage";

/**
 * Déconnexion : vide les pages gardées pour le hors ligne (appareil éventuellement partagé).
 * Les saisies pas encore envoyées sont conservées et restent liées à CE compte : elles partiront
 * à sa prochaine connexion, jamais sous un autre compte.
 */
export function SignOutForm({ pending }: { pending?: number }) {
  return (
    <form action={signOut} onSubmit={() => clearOfflineCaches()}>
      <Button type="submit" variant="ghost" className="w-full">
        🚪 Se déconnecter
      </Button>
      {pending ? <p className="mt-2 text-sm text-ink-soft">{pending} saisie(s) non envoyée(s) restent sur ce téléphone, liées à votre compte.</p> : null}
    </form>
  );
}

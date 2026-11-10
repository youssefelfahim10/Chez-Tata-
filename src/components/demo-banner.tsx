import { signOut } from "@/app/actions/auth";
import { getUser } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/demo";

/** Bandeau visible uniquement dans la session de démonstration, avec la sortie vers un autre compte. */
export async function DemoBanner() {
  const user = await getUser();
  if (!user || !isDemoEmail(user.email)) return null;
  return (
    <div role="status" className="border-b border-sun/40 bg-sun-soft">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="font-bold">🎪 Mode démonstration : données fictives partagées</span>
        <form action={signOut}>
          <button type="submit" className="min-h-11 rounded-xl border border-ink/20 bg-surface px-3 font-extrabold">
            Autre compte
          </button>
        </form>
      </div>
    </div>
  );
}

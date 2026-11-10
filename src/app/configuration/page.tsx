import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Configuration" };

export default function Page() {
  return (
    <AuthShell title="Configuration requise" subtitle="L'application n'est pas encore reliée à sa base de données.">
      <Card>
        <p className="text-sm text-ink-soft">
          Renseignez <code className="font-bold text-ink">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
          <code className="font-bold text-ink">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (voir{" "}
          <code className="font-bold text-ink">.env.example</code>), puis redémarrez l&apos;application.
        </p>
      </Card>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Connexion" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const { next, erreur } = await searchParams;
  const notice = erreur === "google" ? "La connexion avec Google a été annulée ou a échoué. Réessayez, ou utilisez votre e-mail." : undefined;
  return <SignInForm next={next ? safeNextPath(next) : undefined} notice={notice} />;
}

export default function Page({ searchParams }: PageProps<"/connexion">) {
  return (
    <AuthShell title="Bonjour TaTa !" subtitle="Connectez-vous à votre espace.">
      <Suspense fallback={<SignInForm />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

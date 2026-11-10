import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Connexion" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignInForm next={next ? safeNextPath(next) : undefined} />;
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

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Créer mon espace" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignUpForm next={next ? safeNextPath(next) : undefined} />;
}

export default function Page({ searchParams }: PageProps<"/inscription">) {
  return (
    <AuthShell title="Créer mon espace" subtitle="Moins d'administratif, plus de temps pour les enfants.">
      <Suspense fallback={<SignUpForm />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

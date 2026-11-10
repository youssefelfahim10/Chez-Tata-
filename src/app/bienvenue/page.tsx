import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { CreateOrganizationForm } from "@/components/onboarding-forms";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bienvenue" };

async function Content() {
  await requireUser("/bienvenue");
  return <CreateOrganizationForm />;
}

export default function Page() {
  return (
    <AuthShell title="Bienvenue !" subtitle="Créons votre espace en quelques secondes.">
      <Suspense fallback={<Skeleton lines={2} />}>
        <Content />
      </Suspense>
    </AuthShell>
  );
}

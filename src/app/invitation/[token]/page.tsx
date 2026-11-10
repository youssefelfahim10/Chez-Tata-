import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { AcceptInvitationForm } from "@/components/onboarding-forms";
import { Card, Notice, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return (
      <Card>
        <Notice tone="error">Ce lien d&apos;invitation n&apos;est pas valide.</Notice>
      </Card>
    );
  }
  const user = await requireUser(`/invitation/${token}`);
  return (
    <>
      <AcceptInvitationForm token={token} />
      <p className="text-center text-sm text-ink-soft">Connectée en tant que {user.email}</p>
    </>
  );
}

export default function Page({ params }: PageProps<"/invitation/[token]">) {
  return (
    <AuthShell title="Rejoindre une MAM">
      <Suspense fallback={<Skeleton lines={1} />}>
        <Content params={params} />
      </Suspense>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageComposer } from "@/components/message-composer";
import type { Recipient } from "@/components/share-summary";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Message à la famille" };

type FamilyLink = { relationship: string; families: { id: string; name: string; contact_details: { phone?: string } | null } | null };

async function Messages({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(childId)) notFound();
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();

  const [child, links, profile] = await Promise.all([
    supabase.from("children").select("id, first_name").eq("id", childId).eq("organization_id", membership.organizationId).maybeSingle(),
    supabase.from("child_family_links").select("relationship, families(id, name, contact_details)").eq("organization_id", membership.organizationId).eq("child_id", childId),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (child.error || links.error) throw new Error("Chargement impossible.");
  if (!child.data) notFound();

  const recipients: Recipient[] = ((links.data ?? []) as unknown as FamilyLink[])
    .filter((l) => l.families)
    .map((l) => ({ id: l.families!.id, label: `${l.families!.name} (${l.relationship})`, phone: l.families!.contact_details?.phone ?? null }));

  return (
    <>
      <PageTitle subtitle="Choisissez un modèle, relisez, puis envoyez vous-même">Message pour la famille de {child.data.first_name as string}</PageTitle>
      <Link href="/aujourdhui" className="-mt-2 font-bold text-primary underline">
        ← Retour à Aujourd’hui
      </Link>
      <Card>
        <MessageComposer childName={child.data.first_name as string} sender={(profile.data?.display_name as string | undefined) ?? undefined} recipients={recipients} />
      </Card>
    </>
  );
}

export default function Page({ params }: PageProps<"/aujourdhui/messages/[childId]">) {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <Messages params={params} />
    </Suspense>
  );
}

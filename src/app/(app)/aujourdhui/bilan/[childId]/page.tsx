import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareSummary, type Recipient } from "@/components/share-summary";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { parisDayBounds, type JournalEvent } from "@/lib/journal/day";
import { createClient } from "@/lib/supabase/server";
import { buildDayReport, hasContent, renderSummary } from "@/lib/whatsapp/summary";

export const metadata: Metadata = { title: "Bilan du jour" };

type FamilyLink = { relationship: string; families: { id: string; name: string; contact_details: { phone?: string } | null } | null };

async function Bilan({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(childId)) notFound();
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const { start, end } = parisDayBounds(now);

  const [child, events, links, profile] = await Promise.all([
    supabase.from("children").select("id, first_name").eq("id", childId).eq("organization_id", membership.organizationId).maybeSingle(),
    supabase
      .from("daily_events")
      .select("id, child_id, event_type, started_at, ended_at")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId)
      .is("deleted_at", null)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString())
      .order("started_at"),
    supabase
      .from("child_family_links")
      .select("relationship, families(id, name, contact_details)")
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (child.error || events.error || links.error) throw new Error("Chargement du bilan impossible.");
  if (!child.data) notFound();

  const report = buildDayReport(child.data.first_name as string, now, (events.data ?? []) as JournalEvent[]);
  const text = renderSummary(report, (profile.data?.display_name as string | undefined) ?? undefined);
  const recipients: Recipient[] = ((links.data ?? []) as unknown as FamilyLink[])
    .filter((l) => l.families)
    .map((l) => ({
      id: l.families!.id,
      label: `${l.families!.name} (${l.relationship})`,
      phone: l.families!.contact_details?.phone ?? null,
    }));

  return (
    <>
      <PageTitle subtitle="Relisez, modifiez, puis partagez">Bilan de {child.data.first_name as string}</PageTitle>
      <Link href="/aujourdhui" className="-mt-2 font-bold text-primary underline">
        ← Retour à Aujourd’hui
      </Link>
      <Card>
        <ShareSummary initialText={text} recipients={recipients} hasContent={hasContent(report)} />
      </Card>
    </>
  );
}

export default function Page({ params }: PageProps<"/aujourdhui/bilan/[childId]">) {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <Bilan params={params} />
    </Suspense>
  );
}

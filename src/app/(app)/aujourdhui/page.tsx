import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TodayBoard } from "@/components/today-board";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { formatLongDate, parisDayBounds, type JournalEvent } from "@/lib/journal/day";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aujourd'hui" };

async function Today() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const { start, end } = parisDayBounds(now);

  const [profile, children, events, health] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("children")
      .select("id, first_name")
      .eq("organization_id", membership.organizationId)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("daily_events")
      .select("id, child_id, event_type, started_at, ended_at, client_operation_id, event_payload")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString())
      .order("started_at"),
    supabase.from("child_health").select("child_id, allergies").eq("organization_id", membership.organizationId).not("allergies", "is", null),
  ]);
  if (children.error || events.error) throw new Error("Chargement de la journée impossible.");
  // Le badge d'allergie est un confort : si la fiche santé est indisponible (migration pas encore appliquée),
  // l'écran principal doit rester utilisable.
  if (health.error) console.error("Fiche santé indisponible", health.error.code);

  const allergies = new Map((health.data ?? []).map((h) => [h.child_id as string, (h.allergies as string).trim()]));
  const kids = (children.data ?? []).map((c) => ({ id: c.id as string, firstName: c.first_name as string, allergies: allergies.get(c.id as string) || null }));
  const name = profile.data?.display_name?.trim() || "TaTa";

  return (
    <>
      <PageTitle subtitle={formatLongDate(now)}>Bonjour {name} !</PageTitle>
      {kids.length === 0 ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-ink-soft">Ajoutez un premier enfant pour commencer à pointer sa journée.</p>
          <Link href="/gestion" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-white">
            ➕ Ajouter un enfant
          </Link>
        </Card>
      ) : (
        <TodayBoard
          userId={user.id}
          orgId={membership.organizationId}
          kids={kids}
          events={(events.data ?? []) as JournalEvent[]}
          serverNow={now.toISOString()}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <Today />
    </Suspense>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TodayBoard } from "@/components/today-board";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { formatLongDate, parisDayBounds, type JournalEvent } from "@/lib/journal/day";
import { reminderText, remindersFor } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aujourd'hui" };

async function Today() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const { start, end, isoDate } = parisDayBounds(now);

  const [profile, children, events, archived, health, caregiver] = await Promise.all([
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
    // Gestes annulés aujourd'hui : gardés en archive, on peut toujours les rétablir.
    supabase
      .from("daily_events")
      .select("id, child_id, event_type, started_at, ended_at, client_operation_id, event_payload")
      .eq("organization_id", membership.organizationId)
      .not("deleted_at", "is", null)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString())
      .order("started_at"),
    supabase.from("child_health").select("child_id, allergies").eq("organization_id", membership.organizationId).not("allergies", "is", null),
    // Échéances d'agrément et d'assurance (profil strictement personnel).
    supabase.from("caregiver_profiles").select("agreement_expiry, insurance_expiry").eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (children.error || events.error) throw new Error("Chargement de la journée impossible.");
  // Le badge d'allergie est un confort : si la fiche santé est indisponible (migration pas encore appliquée),
  // l'écran principal doit rester utilisable.
  // L'archive est un confort : si elle est indisponible, la journée reste utilisable.
  if (archived.error) console.error("Archives indisponibles", archived.error.code);
  if (health.error) console.error("Fiche santé indisponible", health.error.code);

  const allergies = new Map((health.data ?? []).map((h) => [h.child_id as string, (h.allergies as string).trim()]));
  const kids = (children.data ?? []).map((c) => ({ id: c.id as string, firstName: c.first_name as string, allergies: allergies.get(c.id as string) || null }));
  const name = profile.data?.display_name?.trim() || "TaTa";
  // Un profil indisponible (migration pas encore appliquée) ne doit jamais bloquer l'écran principal.
  const reminders = caregiver.error ? [] : remindersFor(caregiver.data as { agreement_expiry: string | null; insurance_expiry: string | null } | null, isoDate);

  return (
    <>
      <PageTitle subtitle={formatLongDate(now)}>Bonjour {name} !</PageTitle>
      {reminders.length > 0 ? (
        <Link href="/profil" className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${reminders[0].level === "late" ? "bg-pink-soft text-danger" : "bg-sun-soft text-ink"}`}>
          <span aria-hidden>{reminders[0].level === "late" ? "⚠️" : "⏰"}</span>
          <span className="flex-1">{reminderText(reminders[0])}</span>
          <span aria-hidden>›</span>
        </Link>
      ) : null}
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
          archivedEvents={archived.error ? [] : ((archived.data ?? []) as JournalEvent[])}
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

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TodayBoard, type TodayChild } from "@/components/today-board";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import {
  formatDuration,
  formatLongDate,
  formatTime,
  parisDayBounds,
  summarizeChildDay,
  type JournalEvent,
} from "@/lib/journal/day";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aujourd'hui" };

async function Today() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const { start, end } = parisDayBounds(now);

  const [profile, children, events] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("children")
      .select("id, first_name")
      .eq("organization_id", membership.organizationId)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("daily_events")
      .select("id, child_id, event_type, started_at, ended_at")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString())
      .order("started_at"),
  ]);
  if (children.error || events.error) throw new Error("Chargement de la journée impossible.");

  const allEvents = (events.data ?? []) as JournalEvent[];
  const items: TodayChild[] = (children.data ?? []).map((child) => {
    const day = summarizeChildDay(
      allEvents.filter((e) => e.child_id === child.id),
      now,
    );
    return {
      id: child.id as string,
      firstName: child.first_name as string,
      day,
      arrivalLabel: day.arrivalAt ? formatTime(day.arrivalAt) : null,
      departureLabel: day.departureAt ? formatTime(day.departureAt) : null,
      presenceLabel: day.status === "expected" ? null : formatDuration(day.presenceMs),
      napSinceLabel: day.openNapSince ? formatTime(day.openNapSince) : null,
    };
  });
  const present = items.filter((i) => i.day.status === "present").length;
  const name = profile.data?.display_name?.trim() || "TaTa";

  return (
    <>
      <PageTitle subtitle={formatLongDate(now)}>Bonjour {name} !</PageTitle>
      <p className="rounded-card bg-leaf-soft px-5 py-4 text-lg font-extrabold text-leaf">
        {present === 0
          ? "Aucun enfant présent pour le moment"
          : `${present} enfant${present > 1 ? "s" : ""} présent${present > 1 ? "s" : ""}`}
      </p>
      {items.length === 0 ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-ink-soft">Ajoutez un premier enfant pour commencer à pointer sa journée.</p>
          <Link
            href="/gestion"
            className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-white"
          >
            Ajouter un enfant
          </Link>
        </Card>
      ) : (
        <TodayBoard items={items} />
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

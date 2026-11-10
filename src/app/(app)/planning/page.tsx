import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Planning" };

async function Content() {
  await requireWorkspace();
  return (
    <Card>
      <p className="font-bold">Bientôt disponible</p>
      <p className="mt-1 text-ink-soft">
        Calendrier semaine et mois, présences prévues et réelles, absences, congés et fiche de présence A4.
      </p>
    </Card>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Calendrier et journal">Planning</PageTitle>
      <Suspense fallback={<Skeleton lines={1} />}>
        <Content />
      </Suspense>
    </>
  );
}

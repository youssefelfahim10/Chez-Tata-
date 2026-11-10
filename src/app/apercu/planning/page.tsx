import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SheetDemo } from "@/components/sheet-demo";
import { PageTitle, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Aperçu Planning (démo)", robots: { index: false } };

async function Demo({ searchParams }: { searchParams: Promise<{ mois?: string; enfant?: string }> }) {
  const params = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mois ?? "") ? (params.mois as string) : "2026-11";
  const childId = params.enfant ?? "00000000-0000-4000-8000-000000000001";
  return <SheetDemo month={month} childId={childId} />;
}

export default function Page({ searchParams }: PageProps<"/apercu/planning">) {
  // Démonstration réservée au développement : données fictives, aucun accès à la base.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <p className="mb-3 rounded-2xl bg-sun-soft px-4 py-2 text-sm font-bold">Démonstration : données fictives, rien n’est enregistré.</p>
      <PageTitle subtitle="Fiche de présence du mois">Planning</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Demo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

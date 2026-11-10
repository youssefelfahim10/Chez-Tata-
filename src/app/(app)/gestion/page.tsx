import type { Metadata } from "next";
import { Suspense } from "react";
import { ChildForm } from "@/components/child-form";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gestion" };

async function Children() {
  const { membership } = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, first_name, birth_date")
    .eq("organization_id", membership.organizationId)
    .eq("status", "active")
    .order("first_name");
  if (error) throw new Error("Chargement des enfants impossible.");

  return (
    <>
      <Card>
        <h2 className="text-lg font-extrabold">Enfants accueillis</h2>
        {data.length === 0 ? (
          <p className="mt-2 text-ink-soft">Aucun enfant pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.map((child) => (
              <li key={child.id as string} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="font-bold">{child.first_name as string}</span>
                {child.birth_date ? (
                  <span className="text-sm text-ink-soft">
                    né(e) le {new Date(`${child.birth_date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">Ajouter un enfant</h2>
        <ChildForm />
      </Card>
      <Card>
        <p className="font-bold">Bientôt disponible</p>
        <p className="mt-1 text-ink-soft">
          Familles, contrats, heures, indemnités, décomptes mensuels, paiements et dépenses.
        </p>
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Enfants, contrats et finances">Gestion</PageTitle>
      <Suspense fallback={<Skeleton lines={3} />}>
        <Children />
      </Suspense>
    </>
  );
}

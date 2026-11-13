import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { PROFILE_COLUMNS, type ProfileRow } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mes informations" };

async function Content() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const [account, profile] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    // La RLS ne renvoie que VOTRE profil, même dans une MAM.
    supabase.from("caregiver_profiles").select(PROFILE_COLUMNS).eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (account.error || profile.error) throw new Error("Chargement du profil impossible.");
  const p = (profile.data ?? null) as ProfileRow | null;
  const s = (v: string | null | undefined) => v ?? "";
  return (
    <ProfileForm
      email={user.email}
      defaults={{
        displayName: s(account.data?.display_name as string | null),
        firstName: s(p?.first_name),
        lastName: s(p?.last_name),
        phone: s(p?.phone),
        contactEmail: s(p?.contact_email),
        addressLine: s(p?.address_line),
        postalCode: s(p?.postal_code),
        city: s(p?.city),
        agreementNumber: s(p?.agreement_number),
        agreementDate: s(p?.agreement_date),
        agreementExpiry: s(p?.agreement_expiry),
        agreementCapacity: p?.agreement_capacity ? String(p.agreement_capacity) : "",
        insuranceCompany: s(p?.insurance_company),
        insurancePolicy: s(p?.insurance_policy),
        insuranceExpiry: s(p?.insurance_expiry),
      }}
    />
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Reprises dans vos contrats, factures et documents">Mes informations</PageTitle>
      <Link href="/profil" className="-mt-2 inline-flex min-h-11 items-center font-bold text-primary underline">
        ← Retour au profil
      </Link>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

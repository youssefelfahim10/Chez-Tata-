import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChildForm } from "@/components/child-form";
import { ChildHealthForm } from "@/components/child-health-form";
import { ContractForm, FamilyForm } from "@/components/family-contract-forms";
import { ProfileForm } from "@/components/profile-form";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { contactsFromJson } from "@/lib/health/schema";
import { parisDayBounds } from "@/lib/journal/day";
import { PROFILE_COLUMNS, type ProfileRow } from "@/lib/profile/schema";
import { doneSteps, isStepId, nextStep, parseSkipped, pickChild, progress, STEPS, stepAfter, type ChildSetup, type StepId } from "@/lib/setup/steps";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mise en route" };

type Params = { etape?: string; enfant?: string; passe?: string };

const link = (params: { etape?: StepId; enfant?: string; passe?: StepId[] }) => {
  const q = new URLSearchParams();
  if (params.etape) q.set("etape", params.etape);
  if (params.enfant) q.set("enfant", params.enfant);
  if (params.passe?.length) q.set("passe", params.passe.join(","));
  const s = q.toString();
  return s ? `/demarrage?${s}` : "/demarrage";
};

async function HealthStep({ childId }: { childId: string }) {
  const { membership } = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("child_health")
    .select("allergies, diet, medication, medical_notes, doctor_name, doctor_phone, emergency_contacts, authorized_pickups")
    .eq("organization_id", membership.organizationId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) console.error("Fiche santé indisponible", error.code);
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <ChildHealthForm
      childId={childId}
      defaults={{
        allergies: s(data?.allergies),
        diet: s(data?.diet),
        medication: s(data?.medication),
        medicalNotes: s(data?.medical_notes),
        doctorName: s(data?.doctor_name),
        doctorPhone: s(data?.doctor_phone),
        emergencyContacts: contactsFromJson(data?.emergency_contacts),
        authorizedPickups: contactsFromJson(data?.authorized_pickups),
      }}
    />
  );
}

async function ProfileStep() {
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const [account, profile] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("caregiver_profiles").select(PROFILE_COLUMNS).eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle(),
  ]);
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

async function Content({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const org = membership.organizationId;

  const [profile, children, links, contracts, health] = await Promise.all([
    supabase.from("caregiver_profiles").select("user_id").eq("organization_id", org).eq("user_id", user.id).maybeSingle(),
    supabase.from("children").select("id, first_name").eq("organization_id", org).eq("status", "active").order("created_at"),
    supabase.from("child_family_links").select("child_id").eq("organization_id", org),
    // La RLS ne renvoie que les contrats de l'assistante connectée.
    supabase.from("contracts").select("child_id").eq("organization_id", org).eq("assigned_assmat_id", user.id).eq("status", "active"),
    supabase.from("child_health").select("child_id").eq("organization_id", org),
  ]);
  if (children.error) throw new Error("Chargement de la mise en route impossible.");
  // Profil, familles, santé et contrats sont des conforts : une table indisponible ne doit pas bloquer le parcours.
  const set = (rows: { data: { child_id: unknown }[] | null; error: unknown }) => new Set((rows.error ? [] : (rows.data ?? [])).map((r) => String(r.child_id)));
  const withFamily = set(links);
  const withContract = set(contracts);
  const withHealth = set(health);

  const kids: ChildSetup[] = (children.data ?? []).map((c) => ({
    id: String(c.id),
    firstName: String(c.first_name),
    hasFamily: withFamily.has(String(c.id)),
    hasHealth: withHealth.has(String(c.id)),
    hasContract: withContract.has(String(c.id)),
  }));
  const state = { profileDone: Boolean(profile.data), children: kids };
  const child = pickChild(kids, params.enfant);
  const done = doneSteps(state, child);
  const skipped = parseSkipped(params.passe);
  const chosen = isStepId(params.etape) ? params.etape : undefined;
  let step: StepId | null = chosen ?? nextStep(done, skipped);
  // Une étape d'enfant n'a pas de sens sans enfant : on commence par l'ajouter.
  if (step && step !== "profil" && step !== "enfant" && !child) step = "enfant";
  const info = step ? STEPS.find((s) => s.id === step)! : null;
  const { done: nDone, total } = progress(done);
  const today = parisDayBounds(new Date()).isoDate;
  const keep = { enfant: child?.id, passe: skipped };

  return (
    <>
      <div>
        <div role="progressbar" aria-label="Avancement de la mise en route" aria-valuemin={0} aria-valuemax={total} aria-valuenow={nDone} className="h-2 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-sun transition-[width]" style={{ width: `${(nDone / total) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          {nDone} étape{nDone > 1 ? "s" : ""} sur {total}
        </p>
        <ol className="mt-3 flex flex-wrap gap-2" aria-label="Étapes">
          {STEPS.map((s, i) => {
            const current = s.id === step;
            return (
              <li key={s.id}>
                <Link
                  href={link({ ...keep, etape: s.id })}
                  aria-current={current ? "step" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${
                    current ? "border-sun bg-sun-soft text-gold-deep" : done[s.id] ? "border-leaf/40 bg-leaf-soft text-leaf" : "border-line bg-surface text-ink-soft"
                  }`}
                >
                  <span aria-hidden>{done[s.id] ? "✓" : s.emoji}</span>
                  <span className="sr-only">Étape {i + 1} : </span>
                  {s.label}
                  {done[s.id] ? <span className="sr-only"> (faite)</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {info && step ? (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-deep">
              Étape {STEPS.findIndex((s) => s.id === step) + 1} sur {total}
              {info.optional ? " · facultative" : ""}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold leading-tight">{info.title}</h2>
            <p className="mt-2 text-ink-soft">{info.intro}</p>
          </div>

          {step !== "profil" && step !== "enfant" && child ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
              <span aria-hidden>👶</span> Pour {child.firstName}
              {kids.length > 1
                ? kids
                    .filter((k) => k.id !== child.id)
                    .map((k) => (
                      <Link key={k.id} href={link({ etape: step, enfant: k.id, passe: skipped })} className="inline-flex min-h-11 items-center underline">
                        Choisir {k.firstName}
                      </Link>
                    ))
                : null}
            </div>
          ) : null}

          {step === "profil" ? (
            <Suspense fallback={<Skeleton lines={3} />}>
              <ProfileStep />
            </Suspense>
          ) : null}
          {step === "enfant" ? <ChildForm /> : null}
          {step === "famille" && child ? <FamilyForm childId={child.id} /> : null}
          {step === "sante" && child ? (
            <Suspense fallback={<Skeleton lines={3} />}>
              <HealthStep childId={child.id} />
            </Suspense>
          ) : null}
          {step === "contrat" && child ? <ContractForm childId={child.id} today={today} /> : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {info.optional ? (
              <Link href={link({ ...keep, passe: [...skipped, step] })} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-bold text-ink-soft">
                Passer cette étape
              </Link>
            ) : null}
            {done[step] && stepAfter(step) ? (
              <Link href={link({ ...keep, etape: stepAfter(step)! })} className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-extrabold text-white">
                Continuer →
              </Link>
            ) : null}
            <Link href="/aujourdhui" className="ml-auto inline-flex min-h-12 items-center font-bold text-primary underline">
              Terminer plus tard
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-3xl" aria-hidden>
              🎉
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold leading-tight">Tout est prêt{child ? ` pour ${child.firstName}` : ""} !</h2>
            <p className="mt-2 text-ink-soft">Vous pouvez pointer la journée, générer le contrat en PDF et créer les factures du mois.</p>
          </div>
          <div className="flex flex-col gap-2">
            {child && child.hasContract ? (
              <Link href={`/gestion/${child.id}/contrat`} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 text-base font-extrabold text-white">
                📄 Générer le contrat en PDF
              </Link>
            ) : null}
            <Link href="/aujourdhui" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-base font-extrabold text-primary">
              ☀️ Aller à « Aujourd’hui »
            </Link>
            <Link href={link({ etape: "enfant" })} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-base font-bold">
              ➕ Ajouter un autre enfant
            </Link>
          </div>
          {STEPS.some((s) => !done[s.id]) ? (
            <div className="rounded-xl bg-sun-soft px-4 py-3 text-sm">
              <p className="font-bold">À compléter quand vous voulez :</p>
              <ul className="mt-1 flex flex-wrap gap-x-4">
                {STEPS.filter((s) => !done[s.id]).map((s) => (
                  <li key={s.id}>
                    <Link href={link({ ...keep, etape: s.id })} className="inline-flex min-h-11 items-center font-bold text-primary underline">
                      {s.emoji} {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/demarrage">) {
  return (
    <>
      <PageTitle subtitle="On remplit ensemble, étape par étape, dans l’ordre.">Mise en route</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

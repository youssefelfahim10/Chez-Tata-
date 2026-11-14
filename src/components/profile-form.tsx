"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { saveCaregiverProfile } from "@/app/actions/profile";
import { Button, Field, Notice } from "./ui";

export type ProfileDefaults = {
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
  contactEmail: string;
  addressLine: string;
  postalCode: string;
  city: string;
  agreementNumber: string;
  agreementDate: string;
  agreementExpiry: string;
  agreementCapacity: string;
  insuranceCompany: string;
  insurancePolicy: string;
  insuranceExpiry: string;
};

function Section({ emoji, title, hint, children }: { emoji: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-luxe">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden>{emoji}</span> {title}
        </h2>
        {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

export function ProfileForm({ defaults: d, email }: { defaults: ProfileDefaults; email: string }) {
  const [state, action, pending] = useActionState(saveCaregiverProfile, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Section emoji="👋" title="Comment vous appeler ?" hint="Ce prénom s’affiche dans « Bonjour … ! ».">
        <Field label="Prénom affiché" name="displayName" defaultValue={d.displayName} maxLength={80} required autoComplete="given-name" hint={`Compte : ${email}`} />
      </Section>

      <Section emoji="🪪" title="Identité et coordonnées" hint="Reprises automatiquement dans vos contrats, factures et documents. Tout est facultatif.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" name="firstName" defaultValue={d.firstName} maxLength={80} autoComplete="given-name" />
          <Field label="Nom" name="lastName" defaultValue={d.lastName} maxLength={80} autoComplete="family-name" />
        </div>
        <Field label="Adresse du lieu d’accueil" help="profile.address" name="addressLine" defaultValue={d.addressLine} maxLength={160} autoComplete="street-address" />
        <div className="grid grid-cols-[1fr_2fr] gap-4">
          <Field label="Code postal" name="postalCode" defaultValue={d.postalCode} maxLength={10} inputMode="numeric" autoComplete="postal-code" />
          <Field label="Ville" name="city" defaultValue={d.city} maxLength={80} autoComplete="address-level2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone" name="phone" defaultValue={d.phone} maxLength={30} type="tel" inputMode="tel" autoComplete="tel" />
          <Field label="E-mail de contact" name="contactEmail" defaultValue={d.contactEmail} maxLength={254} type="email" inputMode="email" autoComplete="email" hint="Si différent de celui de connexion." />
        </div>
      </Section>

      <Section emoji="🏛️" title="Agrément" hint="Nous vous prévenons quand l’échéance approche.">
        <Field label="Numéro d’agrément" help="contract.agrement" name="agreementNumber" defaultValue={d.agreementNumber} maxLength={40} autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date d’agrément" name="agreementDate" type="date" defaultValue={d.agreementDate} />
          <Field label="Fin / renouvellement" help="profile.agrementEnd" name="agreementExpiry" type="date" defaultValue={d.agreementExpiry} />
        </div>
        <Field label="Nombre d’enfants agréés" help="profile.capacity" name="agreementCapacity" defaultValue={d.agreementCapacity} inputMode="numeric" maxLength={1} hint="De 1 à 6." />
      </Section>

      <Section emoji="🛡️" title="Assurance responsabilité civile">
        <Field label="Assureur" help="contract.insurance" name="insuranceCompany" defaultValue={d.insuranceCompany} maxLength={80} autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numéro de contrat" name="insurancePolicy" defaultValue={d.insurancePolicy} maxLength={60} autoComplete="off" />
          <Field label="Échéance" help="profile.insuranceEnd" name="insuranceExpiry" type="date" defaultValue={d.insuranceExpiry} />
        </div>
      </Section>

      <p className="rounded-xl bg-sun-soft px-4 py-3 text-sm text-ink">
        Ces informations sont <b>privées</b> : même dans une MAM, personne d’autre ne les voit. Nous ne demandons ni numéro de sécurité sociale ni coordonnées bancaires.
      </p>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer mon profil"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { addFamily, createContract, endContract } from "@/app/actions/management";
import { Button, Field, Notice } from "./ui";

const initial: FormState = {};

function Feedback({ state }: { state: FormState }) {
  return (
    <>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
    </>
  );
}

export function FamilyForm({ childId }: { childId: string }) {
  const [state, action, pending] = useActionState(addFamily, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="childId" value={childId} />
      <Field label="Nom de la famille" name="name" maxLength={120} autoComplete="off" required />
      <Field label="Lien avec l'enfant" name="relationship" maxLength={40} defaultValue="parent" hint="Ex. parent, tuteur." />
      <Field label="Téléphone (facultatif)" name="phone" type="tel" inputMode="tel" maxLength={30} autoComplete="off" />
      <Field label="E-mail (facultatif)" name="email" type="email" inputMode="email" maxLength={254} autoComplete="off" />
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter la famille"}
      </Button>
    </form>
  );
}

export function ContractForm({ childId, today }: { childId: string; today: string }) {
  const [state, action, pending] = useActionState(createContract, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="childId" value={childId} />
      <Field label="Début du contrat" name="startDate" type="date" defaultValue={today} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heures par semaine" name="weeklyHours" inputMode="decimal" placeholder="40" required />
        <Field label="Semaines par an" name="weeksPerYear" inputMode="decimal" defaultValue="52" hint="52 = année complète." />
      </div>
      <Field label="Salaire horaire net (€)" name="hourlyNet" inputMode="decimal" placeholder="4,50" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entretien / jour (€)" name="maintenance" inputMode="decimal" placeholder="0,00" />
        <Field label="Repas / jour (€)" name="meal" inputMode="decimal" placeholder="0,00" />
      </div>
      <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
        Ces montants servent à pré-remplir la fiche de présence. Ils restent privés à votre compte, même dans une MAM. Les indemnités
        kilométriques sont désactivées.
      </p>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le contrat"}
      </Button>
    </form>
  );
}

export function EndContractForm({ contractId, childId, today }: { contractId: string; childId: string; today: string }) {
  const [state, action, pending] = useActionState(endContract, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="childId" value={childId} />
      <Field label="Date de fin" name="endDate" type="date" defaultValue={today} required />
      <Feedback state={state} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "…" : "Terminer ce contrat"}
      </Button>
    </form>
  );
}

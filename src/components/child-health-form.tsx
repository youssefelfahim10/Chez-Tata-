"use client";

import { useActionState } from "react";
import { HelpButton } from "@/components/help/help-button";
import type { FormState } from "@/app/actions/auth";
import { saveChildHealth } from "@/app/actions/health";
import { CONTACT_SLOTS, type Contact } from "@/lib/health/schema";
import { Button, Field, Notice, TextareaField } from "./ui";

const initial: FormState = {};

export type HealthDefaults = {
  allergies: string;
  diet: string;
  medication: string;
  medicalNotes: string;
  doctorName: string;
  doctorPhone: string;
  emergencyContacts: Contact[];
  authorizedPickups: Contact[];
};

const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink transition placeholder:text-ink-soft/70 focus:border-sun focus:outline-none focus:ring-4 focus:ring-sun/20";

function ContactSlot({ prefix, index, legend, contact }: { prefix: "ec" | "pk"; index: number; legend: string; contact?: Contact }) {
  const label = `${legend} ${index + 1}`;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.3fr_1fr_1fr]">
      <input name={`${prefix}_name_${index}`} defaultValue={contact?.name ?? ""} maxLength={120} placeholder="Nom" aria-label={`${label} : nom`} autoComplete="off" className={`${inputClass} col-span-2 sm:col-span-1`} />
      <input name={`${prefix}_relation_${index}`} defaultValue={contact?.relation ?? ""} maxLength={40} placeholder="Lien (mère, tante…)" aria-label={`${label} : lien avec l'enfant`} autoComplete="off" className={inputClass} />
      <input name={`${prefix}_phone_${index}`} defaultValue={contact?.phone ?? ""} maxLength={30} placeholder="Téléphone" type="tel" inputMode="tel" aria-label={`${label} : téléphone`} autoComplete="off" className={inputClass} />
    </div>
  );
}

const VISIBLE_SLOTS = 2;

function ContactRows({ prefix, legend, hint, defaults }: { prefix: "ec" | "pk"; legend: string; hint: string; defaults: Contact[] }) {
  // Les emplacements supplémentaires sont repliés (mais restent dans le formulaire) tant qu'ils sont vides.
  const open = defaults.length > VISIBLE_SLOTS;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="w-full"><span className="flex items-center justify-between gap-2 text-sm font-bold text-ink">{legend} <HelpButton topic={prefix === "ec" ? "health.emergency" : "health.pickup"} /></span></legend>
      <p className="-mt-1 text-sm text-ink-soft">{hint}</p>
      {Array.from({ length: VISIBLE_SLOTS }, (_, i) => (
        <ContactSlot key={i} prefix={prefix} index={i} legend={legend} contact={defaults[i]} />
      ))}
      <details open={open} className="rounded-xl">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">Ajouter d’autres personnes</summary>
        <div className="mt-2 flex flex-col gap-3">
          {Array.from({ length: CONTACT_SLOTS - VISIBLE_SLOTS }, (_, k) => (
            <ContactSlot key={k} prefix={prefix} index={VISIBLE_SLOTS + k} legend={legend} contact={defaults[VISIBLE_SLOTS + k]} />
          ))}
        </div>
      </details>
    </fieldset>
  );
}

export function ChildHealthForm({ childId, defaults }: { childId: string; defaults: HealthDefaults }) {
  const [state, action, pending] = useActionState(saveChildHealth, initial);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="childId" value={childId} />
      <p className="rounded-xl bg-sun-soft px-4 py-3 text-sm text-ink">
        Ce sont des informations de santé : ne saisissez que ce qui est utile en cas d’urgence. Rien n’est envoyé à personne, et tout est facultatif.
      </p>

      <TextareaField label="Allergies" help="health.allergies" name="allergies" defaultValue={defaults.allergies} maxLength={500} placeholder="ex. arachides, œuf" />
      <TextareaField label="Régime alimentaire" help="health.diet" name="diet" defaultValue={defaults.diet} maxLength={300} placeholder="ex. sans porc" />
      <TextareaField label="Traitement en cours" help="health.medication" name="medication" defaultValue={defaults.medication} maxLength={500} placeholder="ex. inhalateur : 2 bouffées si besoin" />
      <TextareaField label="Autres remarques utiles" name="medicalNotes" defaultValue={defaults.medicalNotes} maxLength={500} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Médecin ou pédiatre" help="health.doctor" name="doctorName" defaultValue={defaults.doctorName} maxLength={120} autoComplete="off" />
        <Field label="Téléphone du médecin" name="doctorPhone" defaultValue={defaults.doctorPhone} maxLength={30} type="tel" inputMode="tel" autoComplete="off" />
      </div>

      <ContactRows prefix="ec" legend="Contact d’urgence" hint="Les parents sont déjà dans « Famille » : ajoutez ici d’autres personnes à prévenir." defaults={defaults.emergencyContacts} />
      <ContactRows prefix="pk" legend="Personne autorisée à récupérer l’enfant" hint="Personnes que les parents ont autorisées à venir chercher l’enfant. En cas de doute, vérifiez avec les parents." defaults={defaults.authorizedPickups} />

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer la fiche"}
      </Button>
    </form>
  );
}

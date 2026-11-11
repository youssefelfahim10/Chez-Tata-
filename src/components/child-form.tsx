"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { createChild } from "@/app/actions/journal";
import { GENDER_INFO, GENDERS } from "@/lib/children/gender";
import { Button, Field, Notice } from "./ui";

const initial: FormState = {};

export function ChildForm() {
  const [state, action, pending] = useActionState(createChild, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Prénom de l'enfant" name="firstName" maxLength={60} autoComplete="off" required />
      <Field label="Nom de famille (pour la fiche de présence)" name="lastName" maxLength={60} autoComplete="off" />
      <Field label="Date de naissance (facultatif)" name="birthDate" type="date" />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-bold text-ink">Icône de l’enfant (facultatif)</legend>
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map((g) => (
            <label key={g} className="has-[:checked]:border-primary has-[:checked]:bg-primary-soft flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-surface text-sm font-extrabold">
              <input type="radio" name="gender" value={g} className="sr-only" />
              <span aria-hidden className="text-2xl">
                {GENDER_INFO[g].emoji}
              </span>
              {GENDER_INFO[g].label}
            </label>
          ))}
          <label className="has-[:checked]:border-primary has-[:checked]:bg-primary-soft flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-surface text-sm font-bold">
            <input type="radio" name="gender" value="" defaultChecked className="sr-only" />
            <span aria-hidden className="text-xl">
              🔤
            </span>
            Initiale
          </label>
        </div>
      </fieldset>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter l'enfant"}
      </Button>
    </form>
  );
}

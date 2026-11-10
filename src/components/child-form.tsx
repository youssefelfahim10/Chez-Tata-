"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { createChild } from "@/app/actions/journal";
import { Button, Field, Notice } from "./ui";

const initial: FormState = {};

export function ChildForm() {
  const [state, action, pending] = useActionState(createChild, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Prénom de l'enfant" name="firstName" maxLength={60} autoComplete="off" required />
      <Field label="Date de naissance (facultatif)" name="birthDate" type="date" />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter l'enfant"}
      </Button>
    </form>
  );
}

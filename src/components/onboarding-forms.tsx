"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { acceptInvitation, createOrganization } from "@/app/actions/organization";
import { Button, Card, Field, Notice } from "./ui";

const initial: FormState = {};

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganization, initial);
  return (
    <Card>
      <form action={action} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-bold">Vous travaillez…</legend>
          {[
            { value: "independent", title: "Seule, à mon domicile", text: "Assistante maternelle indépendante." },
            { value: "mam", title: "En MAM", text: "Maison d'assistantes maternelles, à plusieurs." },
          ].map((option, index) => (
            <label
              key={option.value}
              className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 has-checked:border-primary has-checked:bg-primary-soft"
            >
              <input type="radio" name="type" value={option.value} defaultChecked={index === 0} className="size-5 accent-primary" />
              <span>
                <span className="block font-bold">{option.title}</span>
                <span className="block text-sm text-ink-soft">{option.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Nom de votre espace" name="name" placeholder="Chez TaTa" maxLength={120} required />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon espace"}
        </Button>
      </form>
    </Card>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, initial);
  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <p className="text-ink-soft">
          Vous avez été invitée à rejoindre une MAM sur Chez TaTa. Vos contrats et vos finances resteront privés.
        </p>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Un instant…" : "Rejoindre la MAM"}
        </Button>
      </form>
    </Card>
  );
}

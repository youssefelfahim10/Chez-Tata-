"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { inviteMember, updateDisplayName, type InviteState } from "@/app/actions/organization";
import { Button, Field, Notice } from "./ui";

export function DisplayNameForm({ defaultValue }: { defaultValue: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Votre prénom" name="displayName" defaultValue={defaultValue} maxLength={80} required />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" variant="ghost" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

export function InviteForm({ organizationName }: { organizationName: string }) {
  const [state, action, pending] = useActionState(inviteMember, {} as InviteState);
  const [copied, setCopied] = useState(false);

  // Le lien est relatif si NEXT_PUBLIC_SITE_URL n'est pas défini : on le complète côté navigateur.
  const link = state.link ? (state.link.startsWith("/") ? `${window.location.origin}${state.link}` : state.link) : null;
  const message = link
    ? `Bonjour ! Je vous invite à rejoindre « ${organizationName} » sur Chez TaTa. Créez votre compte avec l'adresse ${state.email}, puis ouvrez ce lien (valable 7 jours) : ${link}`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <Field
          label="E-mail de l'assistante à inviter"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          hint="Elle devra se connecter avec cette adresse pour accepter."
          required
        />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'invitation"}
        </Button>
      </form>
      {link ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-sun-soft p-4">
          <p className="text-sm font-bold">Invitation prête pour {state.email}</p>
          <p className="text-sm text-ink-soft">
            Ce lien ne sera plus affiché. Transmettez-le vous-même : rien n&apos;est envoyé automatiquement.
          </p>
          <p className="rounded-xl bg-surface p-3 text-xs break-all">{link}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? "Copié ✓" : "Copier le lien"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-leaf px-5 text-center font-bold text-white"
            >
              WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

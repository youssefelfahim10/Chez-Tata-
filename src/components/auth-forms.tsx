"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type FormState } from "@/app/actions/auth";
import { Button, Card, Field, Notice } from "./ui";

const initial: FormState = {};

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
        <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        Pas encore de compte ?{" "}
        <Link href={withNext("/inscription", next)} className="font-bold text-primary underline">
          Créer mon espace
        </Link>
      </p>
    </Card>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  if (state.message) {
    return (
      <Card>
        <Notice tone="success">{state.message}</Notice>
      </Card>
    );
  }
  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Votre prénom" name="displayName" autoComplete="given-name" maxLength={80} required />
        <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
        <Field
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          hint="10 caractères minimum."
          required
        />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        Déjà inscrite ?{" "}
        <Link href={withNext("/connexion", next)} className="font-bold text-primary underline">
          Se connecter
        </Link>
      </p>
    </Card>
  );
}

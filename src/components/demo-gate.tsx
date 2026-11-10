"use client";

import { useActionState } from "react";
import { enterDemo } from "@/app/actions/demo";
import type { FormState } from "@/app/actions/auth";
import { Button, Notice } from "@/components/ui";

const initial: FormState = {};

/** Accès à la démo, réservé à l'équipe (code d'accès). */
export function DemoGate() {
  const [state, action, pending] = useActionState(enterDemo, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Code d’accès équipe
        <input
          name="code"
          type="password"
          autoComplete="off"
          required
          maxLength={200}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base font-normal"
          placeholder="••••••••••••••••"
        />
      </label>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ouverture…" : "🎪 Entrer dans la démo"}
      </Button>
    </form>
  );
}

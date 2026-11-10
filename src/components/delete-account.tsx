"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { clearOfflineCaches } from "@/lib/offline/storage";
import { Button, Field, Notice } from "./ui";

export function DeleteAccountForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(deleteAccount, {} as FormState);
  return (
    <details className="rounded-2xl border border-line p-4">
      <summary className="min-h-11 cursor-pointer py-2 font-bold text-danger">Supprimer mon compte</summary>
      <form action={action} onSubmit={() => clearOfflineCaches()} className="mt-3 flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          Action <b>définitive</b>. Si vous êtes seule dans votre espace, les enfants, journaux, contrats, factures et charges sont effacés. Dans une MAM, vos documents financiers sont effacés et vos saisies du journal deviennent anonymes.
        </p>
        <Field label="Tapez SUPPRIMER pour confirmer" name="confirmation" autoComplete="off" autoCapitalize="characters" required disabled={disabled} />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" variant="danger" disabled={pending || disabled}>
          {pending ? "Suppression…" : "Supprimer définitivement"}
        </Button>
      </form>
    </details>
  );
}

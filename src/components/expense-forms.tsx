"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { addExpenses, deleteExpense } from "@/app/actions/expenses";
import { Button, Notice } from "@/components/ui";
import { EXPENSE_CATEGORIES, OTHER_KEY } from "@/lib/finance/categories";

const initial: FormState = {};
const inputClass = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

/** Cochez les charges, saisissez le montant : rien d'autre à écrire (sauf « Autre »). */
export function ExpenseChecklist({ today }: { today: string }) {
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addExpenses(prev, formData);
    if (result.message) setRound((n) => n + 1); // vide le formulaire après un succès
    return result;
  }, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Rows key={round} today={today} />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "✓ Enregistrer les charges cochées"}
      </Button>
    </form>
  );
}

function Rows({ today }: { today: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (key: string, value: boolean) => setChecked((c) => ({ ...c, [key]: value }));
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        📅 Date
        <input type="date" name="date" defaultValue={today} required className={inputClass} />
      </label>

      <ul className="flex flex-col gap-2">
        {EXPENSE_CATEGORIES.map((cat) => (
          <li key={cat.key} className={`rounded-2xl border p-3 ${checked[cat.key] ? "border-leaf bg-leaf-soft" : "border-line bg-surface"}`}>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name={`on_${cat.key}`} className="size-6 accent-primary" checked={Boolean(checked[cat.key])} onChange={(e) => toggle(cat.key, e.target.checked)} />
              <span aria-hidden className="text-2xl">
                {cat.icon}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{cat.label}</span>
                {cat.hint ? <span className="block text-xs text-ink-soft">{cat.hint}</span> : null}
              </span>
            </label>
            {checked[cat.key] ? (
              <label className="mt-2 flex items-center gap-2 pl-9 text-sm font-bold">
                Montant
                <input name={`amt_${cat.key}`} inputMode="decimal" placeholder="0,00" aria-label={`Montant ${cat.label}`} className={inputClass} autoFocus />
                <span>€</span>
              </label>
            ) : null}
          </li>
        ))}

        <li className={`rounded-2xl border p-3 ${checked[OTHER_KEY] ? "border-leaf bg-leaf-soft" : "border-line bg-surface"}`}>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name={`on_${OTHER_KEY}`} className="size-6 accent-primary" checked={Boolean(checked[OTHER_KEY])} onChange={(e) => toggle(OTHER_KEY, e.target.checked)} />
            <span aria-hidden className="text-2xl">
              ✍️
            </span>
            <span className="flex-1">
              <span className="block font-bold">Autre (je précise)</span>
              <span className="block text-xs text-ink-soft">Si votre charge n’est pas dans la liste</span>
            </span>
          </label>
          {checked[OTHER_KEY] ? (
            <div className="mt-2 grid gap-2 pl-9">
              <input name="other_label" maxLength={100} placeholder="Ex. Cadeau de fin d’année" aria-label="Précisez la charge" className={inputClass} autoFocus />
              <label className="flex items-center gap-2 text-sm font-bold">
                Montant
                <input name="other_amount" inputMode="decimal" placeholder="0,00" aria-label="Montant autre charge" className={inputClass} />
                <span>€</span>
              </label>
            </div>
          ) : null}
        </li>
      </ul>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        📝 Note (facultatif)
        <input name="note" maxLength={150} placeholder="Ex. courses du samedi" className={inputClass} />
      </label>
    </>
  );
}

export function DeleteExpenseForm({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteExpense, initial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer « ${label} » ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} aria-label={`Supprimer ${label}`} className="min-h-11 min-w-11 rounded-xl text-xl text-ink-soft hover:bg-pink-soft">
        🗑️
      </button>
      {state.error ? <span role="alert" className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

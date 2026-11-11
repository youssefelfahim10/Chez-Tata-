"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { setChildGender } from "@/app/actions/journal";
import { GENDER_INFO, GENDERS, toGender } from "@/lib/children/gender";
import { Notice } from "./ui";

const initial: FormState = {};

/** Choix de l'icône (fille / garçon) sur la fiche de l'enfant. Un clic enregistre. */
export function ChildGenderPicker({ childId, gender }: { childId: string; gender: string | null }) {
  const [state, action, pending] = useActionState(setChildGender, initial);
  const current = toGender(gender);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="childId" value={childId} />
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Icône de l’enfant">
        {GENDERS.map((g) => (
          <button
            key={g}
            type="submit"
            name="gender"
            value={g}
            disabled={pending}
            aria-pressed={current === g}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border text-sm font-extrabold ${current === g ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}
          >
            <span aria-hidden className="text-2xl">
              {GENDER_INFO[g].emoji}
            </span>
            {GENDER_INFO[g].label}
          </button>
        ))}
        <button
          type="submit"
          name="gender"
          value=""
          disabled={pending}
          aria-pressed={current === null}
          className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border text-sm font-bold ${current === null ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}
        >
          <span aria-hidden className="text-xl">
            🔤
          </span>
          Initiale
        </button>
      </div>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
    </form>
  );
}

/**
 * Parcours « Mise en route » : les étapes, dans l'ordre, et ce qui est déjà fait.
 * Rien n'est mémorisé à part : l'avancement se déduit de ce qui est enregistré (profil, enfant, famille, santé, contrat),
 * donc on peut quitter et reprendre à tout moment, et rien ne se désynchronise.
 */

export type StepId = "profil" | "enfant" | "famille" | "sante" | "contrat";

export type StepInfo = {
  id: StepId;
  emoji: string;
  /** Libellé court de la liste d'étapes. */
  label: string;
  title: string;
  /** Explication en langage simple, affichée au-dessus du formulaire. */
  intro: string;
  /** Une étape facultative peut être passée sans bloquer la suite. */
  optional: boolean;
};

export const STEPS: readonly StepInfo[] = [
  {
    id: "profil",
    emoji: "👋",
    label: "Vous",
    title: "Faisons connaissance",
    intro: "Votre prénom s’affiche dans « Bonjour … ! ». Vos coordonnées, votre agrément et votre assurance sont repris tout seuls dans vos contrats et documents. Tout est facultatif sauf le prénom.",
    optional: true,
  },
  {
    id: "enfant",
    emoji: "👶",
    label: "L’enfant",
    title: "Ajoutez l’enfant que vous accueillez",
    intro: "Un prénom suffit pour commencer. Vous pourrez compléter le reste plus tard. Si vous accueillez plusieurs enfants, vous les ajouterez un par un.",
    optional: false,
  },
  {
    id: "famille",
    emoji: "👨‍👩‍👧",
    label: "Les parents",
    title: "Qui sont les parents ?",
    intro: "Le nom de la famille et, si vous le souhaitez, un téléphone et un e-mail. Ces informations servent pour les messages et pour le contrat.",
    optional: true,
  },
  {
    id: "sante",
    emoji: "🩺",
    label: "Santé et urgences",
    title: "Santé et personnes à prévenir",
    intro: "Allergies, médecin, contacts d’urgence et personnes autorisées à récupérer l’enfant. C’est ce qui s’affiche sur l’écran Urgence. Rien n’est obligatoire.",
    optional: true,
  },
  {
    id: "contrat",
    emoji: "📝",
    label: "Le contrat",
    title: "Les horaires et le paiement",
    intro: "Indiquez les heures par semaine, les semaines par an et le salaire horaire net : le montant du mois est calculé pour vous. Vous pourrez ensuite générer le contrat en PDF.",
    optional: false,
  },
];

export type ChildSetup = {
  id: string;
  firstName: string;
  hasFamily: boolean;
  hasHealth: boolean;
  hasContract: boolean;
};

export type SetupState = {
  /** Le profil de l'assistante a été enregistré au moins une fois. */
  profileDone: boolean;
  children: ChildSetup[];
};

export function isStepId(value: string | undefined): value is StepId {
  return STEPS.some((s) => s.id === value);
}

/** Enfant sur lequel porte le parcours : celui demandé, sinon le premier à qui il manque une étape, sinon le dernier ajouté. */
export function pickChild(children: ChildSetup[], preferredId?: string): ChildSetup | null {
  if (children.length === 0) return null;
  const wanted = preferredId ? children.find((c) => c.id === preferredId) : undefined;
  if (wanted) return wanted;
  return children.find((c) => !c.hasFamily || !c.hasHealth || !c.hasContract) ?? children[children.length - 1];
}

/** Étapes déjà faites. Les étapes d'enfant ne comptent que si un enfant existe. */
export function doneSteps(state: SetupState, child: ChildSetup | null): Record<StepId, boolean> {
  return {
    profil: state.profileDone,
    enfant: state.children.length > 0,
    famille: Boolean(child?.hasFamily),
    sante: Boolean(child?.hasHealth),
    contrat: Boolean(child?.hasContract),
  };
}

/**
 * Prochaine étape à montrer : la première non faite et non passée, dans l'ordre.
 * `null` quand tout est fait ou passé. Les étapes obligatoires ne peuvent pas être passées.
 */
export function nextStep(done: Record<StepId, boolean>, skipped: readonly StepId[] = []): StepId | null {
  for (const step of STEPS) {
    if (done[step.id]) continue;
    if (step.optional && skipped.includes(step.id)) continue;
    return step.id;
  }
  return null;
}

/** Étape qui suit `id` dans l'ordre (pour « Passer cette étape »). */
export function stepAfter(id: StepId): StepId | null {
  const i = STEPS.findIndex((s) => s.id === id);
  return STEPS[i + 1]?.id ?? null;
}

export function progress(done: Record<StepId, boolean>): { done: number; total: number } {
  return { done: STEPS.filter((s) => done[s.id]).length, total: STEPS.length };
}

/** Les deux étapes obligatoires (un enfant et un contrat) sont faites : l'application est utilisable. */
export function requiredDone(done: Record<StepId, boolean>): boolean {
  return STEPS.filter((s) => !s.optional).every((s) => done[s.id]);
}

/** « profil,famille » → étapes passées valides (le reste est ignoré). */
export function parseSkipped(raw: string | undefined): StepId[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is StepId => isStepId(s) && STEPS.find((x) => x.id === s)!.optional);
}

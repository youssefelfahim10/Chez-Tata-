import { csvCell } from "@/lib/finance/summary";

/**
 * Aide à la déclaration d'impôts d'une assistante maternelle (régime de la somme forfaitaire).
 *
 * Règle (impots.gouv.fr, « Je suis assistant(e) maternel(le). Comment dois-je déclarer mes revenus ? ») :
 *  - part imposable = rémunérations et indemnités perçues pour l'entretien et l'hébergement des enfants,
 *    moins une somme forfaitaire de 3 × le SMIC horaire par jour de garde et par enfant (4 × pour un enfant donnant
 *    droit à une majoration de salaire) ;
 *  - la somme forfaitaire ne vaut que pour une garde d'au moins 8 h par jour ; en dessous : (3 ou 4 SMIC) × heures ÷ 8 ;
 *  - la déduction est limitée aux sommes reçues (jamais de déficit) ;
 *  - la fourniture du repas par les parents est imposable (évaluée à 5,45 € par jour en 2025) ;
 *  - possibilité de renoncer à ce régime : l'impôt porte alors sur le seul salaire, hors indemnités d'entretien.
 *
 * Ce module est une AIDE : tout est modifiable par l'assistante et rien n'est présenté comme officiel.
 * Montants en centimes entiers. Les cas particuliers (gardes de 24 h consécutives…) se règlent par « ajustement ».
 */

export const FULL_DAY_MINUTES = 8 * 60;

/** SMIC horaire brut en centimes, par année, avec une valeur vérifiée à la source : 11,88 € en 2025. Autres années : à saisir. */
export const SMIC_HOURLY_CENTS: Record<number, number> = { 2025: 1188 };
/** Évaluation du repas fourni par les parents, par jour (centimes) : 5,45 € en 2025 d'après impots.gouv.fr. */
export const PARENT_MEAL_CENTS: Record<number, number> = { 2025: 545 };

export type StatementInput = {
  childId: string;
  /** AAAA-MM-JJ : date de paiement (l'impôt porte sur l'année de perception). */
  paidAt: string;
  totalCents: number;
  lines: { label: string; amount_cents: number }[];
};

export type PresenceDay = { childId: string; date: string; minutes: number };

export type MonthAmounts = { salaryCents: number; allowanceCents: number; /** Montant estimé d'après le contrat et les présences (aucune facture validée). */ estimated?: boolean };

export type TaxChild = {
  id: string;
  name: string;
  /** 12 mois (janvier = index 0). */
  months: MonthAmounts[];
  /** Jours de garde d'au moins 8 h. */
  fullDays: number;
  /** Minutes cumulées des jours de moins de 8 h. */
  partialMinutes: number;
};

export type TaxInput = { year: number; children: TaxChild[] };

export type ChildSettings = { multiplier: 3 | 4; parentMealDays: number; adjustmentCents: number };

export type TaxParams = {
  smicHourlyCents: number;
  parentMealCents: number;
  perChild: Record<string, ChildSettings>;
};

export const DEFAULT_SETTINGS: ChildSettings = { multiplier: 3, parentMealDays: 0, adjustmentCents: 0 };

/** Les indemnités (entretien, repas) se distinguent de la rémunération par leur libellé. */
export function classifyLine(label: string): "allowance" | "salary" {
  return /indemnit/i.test(label) ? "allowance" : "salary";
}

const emptyMonths = (): MonthAmounts[] => Array.from({ length: 12 }, () => ({ salaryCents: 0, allowanceCents: 0 }));

export function buildTaxInput(args: {
  year: number;
  children: { id: string; name: string }[];
  statements: StatementInput[];
  presence: PresenceDay[];
  /** Estimations (clé `${enfant}|${mois}`) appliquées aux seuls mois sans facture validée. */
  estimates?: Map<string, MonthAmounts>;
}): TaxInput {
  const { year } = args;
  const children: TaxChild[] = args.children.map((c) => ({ id: c.id, name: c.name, months: emptyMonths(), fullDays: 0, partialMinutes: 0 }));
  const byId = new Map(children.map((c) => [c.id, c]));
  const invoiced = new Set<string>();

  for (const s of args.statements) {
    const child = byId.get(s.childId);
    if (!child || !s.paidAt.startsWith(`${year}-`)) continue;
    const month = Number(s.paidAt.slice(5, 7)) - 1;
    if (!(month >= 0 && month <= 11)) continue;
    invoiced.add(`${child.id}|${month}`);
    let known = 0;
    for (const line of s.lines ?? []) {
      if (!Number.isFinite(line.amount_cents)) continue;
      known += line.amount_cents;
      if (classifyLine(String(line.label ?? "")) === "allowance") child.months[month].allowanceCents += line.amount_cents;
      else child.months[month].salaryCents += line.amount_cents;
    }
    // Ce qui n'est pas détaillé dans les lignes est compté en rémunération (le total de la facture fait foi).
    child.months[month].salaryCents += s.totalCents - known;
  }

  for (const child of children) {
    child.months.forEach((m, i) => {
      if (invoiced.has(`${child.id}|${i}`)) return;
      const est = args.estimates?.get(`${child.id}|${i}`);
      if (est) child.months[i] = { salaryCents: est.salaryCents, allowanceCents: est.allowanceCents, estimated: true };
    });
  }

  for (const p of args.presence) {
    const child = byId.get(p.childId);
    if (!child || !p.date.startsWith(`${year}-`) || p.minutes <= 0) continue;
    if (p.minutes >= FULL_DAY_MINUTES) child.fullDays += 1;
    else child.partialMinutes += p.minutes;
  }
  return { year, children };
}

export type ChildResult = {
  id: string;
  name: string;
  salaryCents: number;
  allowanceCents: number;
  parentMealCents: number;
  /** Rémunérations + indemnités + repas fournis par les parents. */
  receivedCents: number;
  fullDays: number;
  partialMinutes: number;
  /** Jours équivalents à 8 h : jours complets + heures partielles ÷ 8. */
  equivalentDays: number;
  forfaitCents: number;
  deductionCents: number;
  /** À déclarer (régime de la somme forfaitaire). */
  taxableCents: number;
  /** À déclarer si l'on renonce au régime : le salaire seul, sans les indemnités. */
  salaryOnlyCents: number;
};

export type TaxResult = {
  children: ChildResult[];
  totals: Omit<ChildResult, "id" | "name">;
  missingSmic: boolean;
};

const sum = (items: number[]) => items.reduce((t, n) => t + n, 0);

export function computeTax(input: TaxInput, params: TaxParams): TaxResult {
  const children = input.children.map((c): ChildResult => {
    const settings = params.perChild[c.id] ?? DEFAULT_SETTINGS;
    const salaryCents = sum(c.months.map((m) => m.salaryCents));
    const allowanceCents = sum(c.months.map((m) => m.allowanceCents));
    const parentMealCents = Math.max(0, Math.round(settings.parentMealDays)) * params.parentMealCents;
    const receivedCents = salaryCents + allowanceCents + parentMealCents;
    const workedMinutes = c.fullDays * FULL_DAY_MINUTES + c.partialMinutes;
    const forfaitRaw = params.smicHourlyCents > 0 ? Math.round((settings.multiplier * params.smicHourlyCents * workedMinutes) / FULL_DAY_MINUTES) : 0;
    const forfaitCents = Math.max(0, forfaitRaw + settings.adjustmentCents);
    // Jamais de déficit : la déduction ne dépasse pas ce qui a été reçu.
    const deductionCents = Math.min(forfaitCents, Math.max(0, receivedCents));
    return {
      id: c.id,
      name: c.name,
      salaryCents,
      allowanceCents,
      parentMealCents,
      receivedCents,
      fullDays: c.fullDays,
      partialMinutes: c.partialMinutes,
      equivalentDays: Math.round((workedMinutes / FULL_DAY_MINUTES) * 100) / 100,
      forfaitCents,
      deductionCents,
      taxableCents: receivedCents - deductionCents,
      salaryOnlyCents: salaryCents,
    };
  });
  const totals = {
    salaryCents: sum(children.map((c) => c.salaryCents)),
    allowanceCents: sum(children.map((c) => c.allowanceCents)),
    parentMealCents: sum(children.map((c) => c.parentMealCents)),
    receivedCents: sum(children.map((c) => c.receivedCents)),
    fullDays: sum(children.map((c) => c.fullDays)),
    partialMinutes: sum(children.map((c) => c.partialMinutes)),
    equivalentDays: Math.round(sum(children.map((c) => c.equivalentDays)) * 100) / 100,
    forfaitCents: sum(children.map((c) => c.forfaitCents)),
    deductionCents: sum(children.map((c) => c.deductionCents)),
    taxableCents: sum(children.map((c) => c.taxableCents)),
    salaryOnlyCents: sum(children.map((c) => c.salaryOnlyCents)),
  };
  return { children, totals, missingSmic: params.smicHourlyCents <= 0 };
}

export const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;

const csvEuros = (cents: number) => `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, "0")}`;

/** CSV (séparateur « ; », ouvert directement par Excel) : le détail mensuel, modifiable dans un tableur. */
export function taxCsv(input: TaxInput, result: TaxResult): string {
  const lines = [["Enfant", "Mois", "Rémunération (€)", "Indemnités (€)", "Total (€)"].join(";")];
  for (const c of input.children) {
    c.months.forEach((m, i) => {
      if (m.salaryCents === 0 && m.allowanceCents === 0) return;
      lines.push([csvCell(c.name), csvCell(`${MONTH_NAMES[i]} ${input.year}${m.estimated ? " (estimé)" : ""}`), csvEuros(m.salaryCents), csvEuros(m.allowanceCents), csvEuros(m.salaryCents + m.allowanceCents)].join(";"));
    });
  }
  lines.push("");
  lines.push(["Enfant", "Jours de 8 h ou plus", "Heures des autres jours", "Reçu (€)", "Somme forfaitaire déduite (€)", "À déclarer (€)"].join(";"));
  for (const c of result.children) {
    lines.push([csvCell(c.name), c.fullDays, csvEuros(Math.round((c.partialMinutes / 60) * 100)), csvEuros(c.receivedCents), csvEuros(c.deductionCents), csvEuros(c.taxableCents)].join(";"));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

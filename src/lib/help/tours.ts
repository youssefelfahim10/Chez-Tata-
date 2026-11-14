import type { HelpId } from "./topics";

/**
 * Visites guidées : une suite d'étapes, chacune éclaire un élément de l'écran (`data-tour`) et l'explique.
 * Si l'élément n'est pas à l'écran (ex. pas encore de geste noté), l'explication s'affiche quand même, sans l'éclairer.
 */

export type TourStep = { topic: HelpId; target?: string };
export type Tour = { title: string; intro: string; steps: readonly TourStep[] };

export const TOURS = {
  aujourdhui: {
    title: "Visite de l’écran Aujourd’hui",
    intro: "1 minute pour comprendre chaque bouton.",
    steps: [
      { target: "t-card", topic: "today.card" },
      { target: "t-actions", topic: "today.actions" },
      { target: "t-actions", topic: "today.feedback" },
      { target: "t-journee", topic: "today.journey" },
      { target: "t-journee", topic: "today.edit" },
      { target: "t-journee", topic: "today.cancel" },
      { target: "t-voice", topic: "today.voice" },
      { target: "t-bilan", topic: "today.bilan" },
      { target: "t-urgence", topic: "today.urgence" },
    ],
  },
  factures: {
    title: "Visite des factures",
    intro: "Pour comprendre chaque ligne et chaque case.",
    steps: [
      { target: "f-month", topic: "invoice.month" },
      { target: "f-lines", topic: "invoice.lines" },
      { target: "f-base", topic: "invoice.base" },
      { target: "f-extra", topic: "invoice.extra" },
      { target: "f-maintenance", topic: "invoice.maintenance" },
      { target: "f-meal", topic: "invoice.meal" },
      { target: "f-method", topic: "invoice.method" },
      { target: "f-date", topic: "invoice.date" },
      { target: "f-total", topic: "invoice.total" },
      { target: "f-pay", topic: "invoice.pay" },
    ],
  },
  contrat: {
    title: "Visite du contrat",
    intro: "À quoi sert chaque case à remplir.",
    steps: [
      { target: "c-employee", topic: "contract.employee" },
      { target: "c-parents", topic: "contract.parents" },
      { target: "c-type", topic: "contract.type" },
      { target: "c-schedule", topic: "contract.schedule" },
      { target: "c-weekly", topic: "contract.weekly" },
      { target: "c-hourly", topic: "contract.hourly" },
      { target: "c-maintenance", topic: "invoice.maintenance" },
      { target: "c-majoration", topic: "contract.majoration" },
      { target: "c-meals", topic: "contract.meals" },
    ],
  },
  impots: {
    title: "Visite des impôts",
    intro: "Comprendre les chiffres, étape par étape.",
    steps: [
      { target: "i-intro", topic: "tax.what" },
      { target: "i-smic", topic: "tax.smic" },
      { target: "i-days", topic: "tax.fullDays" },
      { target: "i-forfait", topic: "tax.forfait" },
      { target: "i-months", topic: "tax.months" },
      { target: "i-estimated", topic: "tax.estimated" },
      { target: "i-result", topic: "tax.result" },
      { target: "i-docs", topic: "tax.outputs" },
    ],
  },
  gestion: {
    title: "Visite de la gestion",
    intro: "Trois zones à connaître.",
    steps: [
      { target: "g-month", topic: "gestion.month" },
      { target: "g-kids", topic: "gestion.kids" },
      { target: "g-money", topic: "gestion.money" },
    ],
  },
} as const satisfies Record<string, Tour>;

export type TourId = keyof typeof TOURS;

/** Données des documents générés (contrat d'accueil, facture). Tout champ facultatif absent reste un blanc à compléter : rien n'est inventé. */

export type Person = {
  fullName: string;
  address?: string;
  phone?: string;
  email?: string;
};

export type Employee = Person & {
  agrementNumber?: string;
  agrementDate?: string;
  insurer?: string;
  policyNumber?: string;
};

export const WEEK_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export type ScheduleDay = { day: WeekDay; from: string; to: string };

export type MealKey = "breakfast" | "lunch" | "snack" | "milk";
export const MEAL_LABELS: Record<MealKey, string> = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  snack: "Goûter",
  milk: "Lait / biberons",
};

export type ContractDoc = {
  /** AAAA-MM-JJ */
  generatedOn: string;
  employee: Employee;
  parents: { names: string[]; address?: string; phone?: string; email?: string };
  child: { fullName: string; birthDate?: string };
  terms: {
    startDate: string;
    contractType: "annee_complete" | "annee_incomplete";
    weeksPerYear: number;
    weeklyMinutes: number;
    hourlyNetCents: number;
    maintenanceCents: number;
    mealCents: number;
    adaptation?: string;
    trial?: string;
    notice?: string;
    overtimeNormalRate?: boolean;
    majorationPercent?: string;
  };
  schedule: ScheduleDay[];
  care: { meals: MealKey[]; diapers?: "parents" | "assmat"; notes?: string };
  leaveNotes?: string;
};

export type InvoiceLine = { label: string; detail?: string; amountCents: number };

export type InvoiceDoc = {
  number: string;
  /** AAAA-MM-JJ : date d'émission */
  issuedOn: string;
  periodLabel: string;
  employee: Employee;
  parents: { names: string[]; address?: string };
  childName: string;
  lines: InvoiceLine[];
  totalCents: number;
  paidOn: string;
  paymentMethod: string;
};

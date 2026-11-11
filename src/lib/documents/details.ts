import { z } from "zod";
import { WEEK_DAYS, type ContractDoc, type InvoiceDoc, type InvoiceLine, type MealKey } from "./types";
import { monthNameFR } from "@/lib/sheet/compute";
import { paymentMethodLabel } from "@/lib/billing/invoice";

const text = (max: number) => z.string().trim().max(max).optional().default("");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Détails du contrat stockés dans `contracts.details` (privé à l'assistante). Tout est facultatif et borné. */
export const detailsSchema = z.object({
  employee: z
    .object({
      fullName: text(120),
      address: text(240),
      phone: text(30),
      email: text(160),
      agrementNumber: text(60),
      agrementDate: z.union([z.iso.date(), z.literal("")]).optional().default(""),
      insurer: text(120),
      policyNumber: text(60),
    })
    .default({ fullName: "", address: "", phone: "", email: "", agrementNumber: "", agrementDate: "", insurer: "", policyNumber: "" }),
  parents: z
    .object({ names: z.array(z.string().trim().max(120)).max(2).default([]), address: text(240), phone: text(30), email: text(160) })
    .default({ names: [], address: "", phone: "", email: "" }),
  terms: z
    .object({ adaptation: text(160), trial: text(120), notice: text(120), overtimeNormalRate: z.boolean().default(false), majorationPercent: text(6) })
    .default({ adaptation: "", trial: "", notice: "", overtimeNormalRate: false, majorationPercent: "" }),
  schedule: z.array(z.object({ day: z.enum(WEEK_DAYS), from: hhmm, to: hhmm })).max(7).default([]),
  care: z
    .object({
      meals: z.array(z.enum(["breakfast", "lunch", "snack", "milk"])).max(4).default([]),
      diapers: z.enum(["parents", "assmat", ""]).optional().default(""),
      notes: text(500),
    })
    .default({ meals: [], diapers: "", notes: "" }),
  leaveNotes: text(500),
});

export type ContractDetails = z.infer<typeof detailsSchema>;

export const emptyDetails = (): ContractDetails => detailsSchema.parse({});

/** Lit des détails venant de la base, sans jamais planter : ce qui est invalide est ignoré. */
/**
 * Complète les coordonnées de l'assistante laissées vides dans un contrat avec celles de son profil.
 * Ce qui est déjà saisi dans le contrat n'est jamais écrasé ; sans profil, rien ne change.
 */
export function fillEmployeeFromProfile(details: ContractDetails, profile: Partial<ContractDetails["employee"]> | null | undefined): ContractDetails {
  if (!profile) return details;
  const employee = { ...details.employee };
  for (const key of Object.keys(employee) as (keyof typeof employee)[]) {
    if (!employee[key] && profile[key]) employee[key] = profile[key] as string;
  }
  return { ...details, employee };
}

export function parseDetails(raw: unknown): ContractDetails {
  const result = detailsSchema.safeParse(raw ?? {});
  return result.success ? result.data : emptyDetails();
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function scheduleMinutes(schedule: { from: string; to: string }[]): number {
  return schedule.reduce((sum, d) => sum + Math.max(0, minutes(d.to) - minutes(d.from)), 0);
}

type ContractRecord = {
  startDate: string;
  scheduledHours: number;
  weeksPerYear: number;
  hourlyRate: number;
  maintenanceCents: number;
  mealCents: number;
  contractType: "annee_complete" | "annee_incomplete" | "occasionnel";
};

/** Assemble les données du contrat PDF à partir de la base : rien n'est inventé, les blancs restent à compléter. */
export function buildContractDoc(args: {
  today: string;
  childName: string;
  birthDate?: string | null;
  contract: ContractRecord;
  details: ContractDetails;
  fallbackEmployeeName: string;
}): ContractDoc {
  const { details: d, contract: c } = args;
  const weeklyFromSchedule = scheduleMinutes(d.schedule);
  return {
    generatedOn: args.today,
    employee: {
      fullName: d.employee.fullName || args.fallbackEmployeeName,
      address: d.employee.address,
      phone: d.employee.phone,
      email: d.employee.email,
      agrementNumber: d.employee.agrementNumber,
      agrementDate: d.employee.agrementDate,
      insurer: d.employee.insurer,
      policyNumber: d.employee.policyNumber,
    },
    parents: { names: d.parents.names.filter(Boolean), address: d.parents.address, phone: d.parents.phone, email: d.parents.email },
    child: { fullName: args.childName, birthDate: args.birthDate ?? undefined },
    terms: {
      startDate: c.startDate,
      contractType: c.contractType === "annee_incomplete" ? "annee_incomplete" : "annee_complete",
      weeksPerYear: c.weeksPerYear,
      weeklyMinutes: Math.round(c.scheduledHours * 60) || weeklyFromSchedule,
      hourlyNetCents: Math.round(c.hourlyRate * 100),
      maintenanceCents: c.maintenanceCents,
      mealCents: c.mealCents,
      adaptation: d.terms.adaptation,
      trial: d.terms.trial,
      notice: d.terms.notice,
      overtimeNormalRate: d.terms.overtimeNormalRate,
      majorationPercent: d.terms.majorationPercent,
    },
    schedule: d.schedule,
    care: { meals: d.care.meals as MealKey[], diapers: d.care.diapers === "" ? undefined : d.care.diapers, notes: d.care.notes },
    leaveNotes: d.leaveNotes,
  };
}

export type StoredLine = { label: string; detail?: string; amount_cents: number };

export function buildInvoiceDoc(args: {
  number: string;
  issuedOn: string;
  period: string; // AAAA-MM
  details: ContractDetails;
  fallbackEmployeeName: string;
  childName: string;
  lines: StoredLine[];
  totalCents: number;
  paidOn: string;
  method: string;
}): InvoiceDoc {
  const d = args.details;
  const lines: InvoiceLine[] = args.lines.map((l) => ({ label: l.label, detail: l.detail, amountCents: l.amount_cents }));
  return {
    number: args.number,
    issuedOn: args.issuedOn,
    periodLabel: `${monthNameFR(args.period)} ${args.period.slice(0, 4)}`,
    employee: { fullName: d.employee.fullName || args.fallbackEmployeeName, address: d.employee.address, phone: d.employee.phone, email: d.employee.email, agrementNumber: d.employee.agrementNumber },
    parents: { names: d.parents.names.filter(Boolean), address: d.parents.address },
    childName: args.childName,
    lines,
    totalCents: args.totalCents,
    paidOn: args.paidOn,
    paymentMethod: paymentMethodLabel(args.method),
  };
}

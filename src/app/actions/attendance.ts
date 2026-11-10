"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/session";
import { parisInstant } from "@/lib/journal/day";
import { createClient } from "@/lib/supabase/server";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const daySchema = z
  .object({
    childId: z.uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    in: hhmm.or(z.literal("")),
    out: hhmm.or(z.literal("")),
    absenceMinutes: z.number().int().min(0).max(1440),
    extraMinutes: z.number().int().min(0).max(1440),
    maintenance: z.boolean(),
    meal: z.boolean(),
    leave: z.enum(["CP", "CSS", ""]),
    note: z.string().trim().max(300),
  })
  .refine((d) => !d.in || !d.out || d.out >= d.in, { message: "Le départ ne peut pas précéder l'arrivée." })
  .refine((d) => !d.out || d.in, { message: "Indiquez aussi l'heure d'arrivée." })
  .refine((d) => !Number.isNaN(Date.parse(`${d.date}T00:00:00Z`)) && new Date(`${d.date}T00:00:00Z`).toISOString().startsWith(d.date), {
    message: "Date invalide.",
  });

export type SaveDayResult = { ok: true } | { ok: false; error: string };

/** Enregistre (ou corrige) une journée de la fiche de présence. Heures saisies = heure de Paris. */
export async function saveAttendanceDay(input: z.input<typeof daySchema>): Promise<SaveDayResult> {
  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const d = parsed.data;

  const { membership } = await requireWorkspace();
  const supabase = await createClient();

  const status = d.leave ? "leave" : d.in ? "present" : d.absenceMinutes > 0 ? "absent" : "planned";
  const { error } = await supabase.from("attendance_records").upsert(
    {
      organization_id: membership.organizationId,
      child_id: d.childId,
      date: d.date,
      status,
      actual_start: d.in ? parisInstant(d.date, d.in).toISOString() : null,
      actual_end: d.out ? parisInstant(d.date, d.out).toISOString() : null,
      absence_minutes: d.absenceMinutes,
      extra_minutes: d.extraMinutes,
      maintenance_due: d.maintenance,
      meal_due: d.meal,
      leave_kind: d.leave || null,
      note: d.note || null,
    },
    { onConflict: "child_id,date" },
  );
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };

  revalidatePath("/planning");
  return { ok: true };
}

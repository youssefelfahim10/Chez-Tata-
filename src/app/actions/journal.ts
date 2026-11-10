"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/session";
import { EVENT_TYPES } from "@/lib/journal/day";
import type { FormState } from "./auth";

export type RecordResult =
  | { ok: true; undo: { kind: "event" | "nap_end"; eventId: string } }
  | { ok: false; error: string };

const recordSchema = z.object({
  childId: z.uuid(),
  type: z.enum([...EVENT_TYPES, "nap_end"]),
  // Généré sur l'appareil : un double appui ou un renvoi réseau ne crée pas de doublon.
  operationId: z.uuid(),
  napId: z.uuid().optional(),
});

/** Enregistre une action rapide, horodatée par le serveur. */
export async function recordEvent(input: z.input<typeof recordSchema>): Promise<RecordResult> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Action invalide." };
  const { childId, type, operationId, napId } = parsed.data;

  const { user, membership } = await requireWorkspace();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const failure: RecordResult = { ok: false, error: "Enregistrement impossible. Réessayez." };

  if (type === "nap_end") {
    if (!napId) return failure;
    const { data, error } = await supabase
      .from("daily_events")
      .update({ ended_at: now })
      .eq("id", napId)
      .eq("organization_id", membership.organizationId)
      .eq("child_id", childId)
      .eq("event_type", "nap")
      .is("ended_at", null)
      .is("deleted_at", null)
      .select("id");
    if (error || !data?.length) return failure;
    revalidatePath("/aujourdhui");
    return { ok: true, undo: { kind: "nap_end", eventId: napId } };
  }

  const { error } = await supabase.from("daily_events").upsert(
    {
      organization_id: membership.organizationId,
      child_id: childId,
      assmat_id: user.id,
      event_type: type,
      started_at: now,
      client_operation_id: operationId,
      source: "tap",
    },
    { onConflict: "organization_id,client_operation_id", ignoreDuplicates: true },
  );
  if (error) return failure;

  const { data: saved } = await supabase
    .from("daily_events")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .eq("client_operation_id", operationId)
    .maybeSingle();
  if (!saved) return failure;

  revalidatePath("/aujourdhui");
  return { ok: true, undo: { kind: "event", eventId: saved.id as string } };
}

const undoSchema = z.object({ kind: z.enum(["event", "nap_end"]), eventId: z.uuid() });

/** Annule la dernière action : suppression logique, l'historique est conservé. */
export async function undoEvent(input: z.input<typeof undoSchema>): Promise<{ ok: boolean }> {
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { membership } = await requireWorkspace();
  const supabase = await createClient();
  const patch = parsed.data.kind === "event" ? { deleted_at: new Date().toISOString() } : { ended_at: null };
  const { data, error } = await supabase
    .from("daily_events")
    .update(patch)
    .eq("id", parsed.data.eventId)
    .eq("organization_id", membership.organizationId)
    .select("id");
  revalidatePath("/aujourdhui");
  return { ok: !error && Boolean(data?.length) };
}

const childSchema = z.object({
  firstName: z.string().trim().min(1, "Indiquez le prénom de l'enfant.").max(60),
  birthDate: z.union([z.iso.date(), z.literal("")]),
});

export async function createChild(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireWorkspace();
  const parsed = childSchema.safeParse({
    firstName: formData.get("firstName"),
    birthDate: formData.get("birthDate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("children").insert({
    organization_id: membership.organizationId,
    first_name: parsed.data.firstName,
    birth_date: parsed.data.birthDate || null,
    created_by: user.id,
  });
  if (error) return { error: "Impossible d'ajouter l'enfant." };
  revalidatePath("/gestion");
  revalidatePath("/aujourdhui");
  return { message: `${parsed.data.firstName} a été ajouté.` };
}

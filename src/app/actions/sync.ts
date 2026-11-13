"use server";

import { z } from "zod";
import { getWorkspaceSoft } from "@/lib/auth/session";
import { DETAIL_KEYS, sanitizeDetails } from "@/lib/journal/details";
import { isPlausibleTime, type SendResult } from "@/lib/offline/ops";
import { createClient } from "@/lib/supabase/server";

const detail = z.record(z.string().max(20), z.string().max(200));

const opSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    id: z.uuid(),
    childId: z.uuid(),
    eventType: z.enum(["arrival", "departure", "meal", "nap", "diaper", "care"]),
    occurredAt: z.iso.datetime(),
    payload: detail.optional(),
    offline: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("nap_end"), id: z.uuid(), childId: z.uuid(), napId: z.uuid(), occurredAt: z.iso.datetime(), offline: z.boolean().optional() }),
  z.object({ kind: z.literal("detail"), id: z.uuid(), targetId: z.uuid(), payload: detail }),
  z.object({ kind: z.literal("undo"), id: z.uuid(), targetId: z.uuid(), undo: z.enum(["event", "nap_end"]), napId: z.uuid().optional() }),
  z.object({ kind: z.literal("restore"), id: z.uuid(), targetId: z.uuid() }),
  z.object({
    kind: z.literal("edit"),
    id: z.uuid(),
    targetId: z.uuid(),
    startedAt: z.iso.datetime().optional(),
    endedAt: z.iso.datetime().optional(),
    payload: z.record(z.string().max(20), z.string().max(200)).optional(),
  }),
]);

const inputSchema = z.object({ userId: z.uuid(), orgId: z.uuid(), op: opSchema });

/** Erreurs de données (contrainte, droits) : réessayer ne servirait à rien. */
const isPermanent = (code?: string) => Boolean(code && (code.startsWith("23") || code.startsWith("22") || code === "42501"));

/**
 * Applique UNE opération du journal. Idempotente (rejouer la même opération ne
 * change rien) et sans redirection : une session expirée renvoie « réessayer »,
 * la file d'attente de l'appareil reste intacte.
 */
export async function syncOperation(input: z.input<typeof inputSchema>): Promise<SendResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "rejected", error: "Opération invalide." };
  const { userId, orgId, op } = parsed.data;

  const workspace = await getWorkspaceSoft();
  if (!workspace) return { status: "retry", reason: "auth" };
  if (workspace.user.id !== userId) return { status: "rejected", error: "Cette saisie appartient à un autre compte." };
  if (workspace.membership.organizationId !== orgId) return { status: "retry", reason: "space" };

  const supabase = await createClient();
  const failure = (error: { code?: string } | null): SendResult =>
    error && isPermanent(error.code) ? { status: "rejected", error: "Saisie refusée." } : { status: "retry" };
  const target = (id: string) => `id.eq.${id},client_operation_id.eq.${id}`;

  if (op.kind === "create") {
    if (!isPlausibleTime(op.occurredAt, new Date())) return { status: "rejected", error: "Heure incohérente." };
    const payload: Record<string, unknown> = sanitizeDetails(op.payload);
    if (op.offline) payload.offline = true;
    const { error } = await supabase.from("daily_events").upsert(
      {
        organization_id: orgId,
        child_id: op.childId,
        assmat_id: userId,
        event_type: op.eventType,
        started_at: op.occurredAt,
        event_payload: payload,
        client_operation_id: op.id,
        source: "tap",
      },
      { onConflict: "organization_id,client_operation_id", ignoreDuplicates: true },
    );
    return error ? failure(error) : { status: "ok" };
  }

  if (op.kind === "nap_end") {
    if (!isPlausibleTime(op.occurredAt, new Date())) return { status: "rejected", error: "Heure incohérente." };
    const { data, error } = await supabase
      .from("daily_events")
      .update({ ended_at: op.occurredAt })
      .or(target(op.napId))
      .eq("organization_id", orgId)
      .eq("child_id", op.childId)
      .eq("event_type", "nap")
      .is("ended_at", null)
      .is("deleted_at", null)
      .select("id");
    if (error) return failure(error);
    if (data?.length) return { status: "ok" };
    // Déjà terminée (opération rejouée) ?
    const check = await supabase.from("daily_events").select("ended_at").or(target(op.napId)).eq("organization_id", orgId).maybeSingle();
    return check.data?.ended_at ? { status: "ok" } : { status: "rejected", error: "Sieste introuvable." };
  }

  if (op.kind === "detail") {
    const found = await supabase.from("daily_events").select("id, event_payload").or(target(op.targetId)).eq("organization_id", orgId).maybeSingle();
    if (found.error) return failure(found.error);
    if (!found.data) return { status: "rejected", error: "Événement introuvable." };
    const merged = { ...((found.data.event_payload as Record<string, unknown>) ?? {}), ...sanitizeDetails(op.payload) };
    const { error } = await supabase.from("daily_events").update({ event_payload: merged }).eq("id", found.data.id).eq("organization_id", orgId);
    return error ? failure(error) : { status: "ok" };
  }

  if (op.kind === "restore") {
    // Rétablir un geste annulé : il redevient visible, rien n'est perdu (idempotent).
    const { data, error } = await supabase.from("daily_events").update({ deleted_at: null }).or(target(op.targetId)).eq("organization_id", orgId).select("id");
    if (error) return failure(error);
    return data?.length ? { status: "ok" } : { status: "rejected", error: "Événement introuvable." };
  }

  if (op.kind === "edit") {
    const found = await supabase
      .from("daily_events")
      .select("id, event_type, started_at, ended_at, event_payload")
      .or(target(op.targetId))
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (found.error) return failure(found.error);
    if (!found.data) return { status: "rejected", error: "Événement introuvable." };
    const row = found.data as { id: string; event_type: string; started_at: string; ended_at: string | null; event_payload: Record<string, unknown> | null };
    const startedAt = op.startedAt ?? row.started_at;
    if (op.startedAt && !isPlausibleTime(op.startedAt, new Date())) return { status: "rejected", error: "Heure incohérente." };
    let endedAt = row.ended_at;
    if (op.endedAt) {
      if (row.event_type !== "nap") return { status: "rejected", error: "Heure de fin inutile pour ce geste." };
      if (!isPlausibleTime(op.endedAt, new Date())) return { status: "rejected", error: "Heure incohérente." };
      endedAt = op.endedAt;
    }
    if (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) return { status: "rejected", error: "Le réveil ne peut pas précéder l’endormissement." };
    // Précisions : valeurs connues uniquement ; une valeur vide efface la précision.
    const next: Record<string, unknown> = { ...(row.event_payload ?? {}), ...sanitizeDetails(op.payload) };
    for (const key of DETAIL_KEYS) if (op.payload && op.payload[key] === "") delete next[key];
    const { error } = await supabase
      .from("daily_events")
      .update({ started_at: startedAt, ended_at: endedAt, event_payload: next })
      .eq("id", row.id)
      .eq("organization_id", orgId);
    return error ? failure(error) : { status: "ok" };
  }

  // undo
  const patch = op.undo === "event" ? { deleted_at: new Date().toISOString() } : { ended_at: null };
  const { data, error } = await supabase.from("daily_events").update(patch).or(target(op.undo === "nap_end" ? (op.napId ?? op.targetId) : op.targetId)).eq("organization_id", orgId).select("id");
  if (error) return failure(error);
  return data?.length ? { status: "ok" } : { status: "rejected", error: "Événement introuvable." };
}

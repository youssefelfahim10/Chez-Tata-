"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE, getMemberships, requireUser, requireWorkspace } from "@/lib/auth/session";
import type { FormState } from "./auth";

async function rememberActiveOrg(organizationId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à votre espace.").max(120),
  type: z.enum(["independent", "mam"]),
});

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = createSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_type: parsed.data.type,
  });
  if (error || !data) return { error: "Impossible de créer l'espace. Réessayez." };

  await rememberActiveOrg(data as string);
  redirect("/aujourdhui");
}

export async function switchOrganization(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("organizationId"));
  const memberships = await getMemberships();
  if (id.success && memberships.some((m) => m.organizationId === id.data)) {
    await rememberActiveOrg(id.data);
  }
  redirect("/aujourdhui");
}

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const token = z.string().regex(/^[0-9a-f]{64}$/).safeParse(formData.get("token"));
  const failure = {
    error:
      "Cette invitation n'est pas valable pour ce compte. Vérifiez que vous êtes connectée avec l'adresse e-mail invitée, ou demandez une nouvelle invitation.",
  };
  if (!token.success) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error || !data) return failure;

  await rememberActiveOrg(data as string);
  redirect("/aujourdhui");
}

export type InviteState = FormState & { link?: string; email?: string };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { membership, isManager } = await requireWorkspace();
  if (!isManager || membership.organizationType !== "mam") return { error: "Action non autorisée." };

  const email = z.email().max(254).safeParse(formData.get("email"));
  if (!email.success) return { error: "Adresse e-mail invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_org: membership.organizationId,
    p_email: email.data,
    p_role: "assmat",
  });
  if (error || !data) return { error: "Impossible de créer l'invitation." };

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  revalidatePath("/parametres");
  return { link: `${origin}/invitation/${data as string}`, email: email.data.toLowerCase() };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const { membership } = await requireWorkspace();
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("organization_invitations")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId);
  revalidatePath("/parametres");
}

export async function setMemberStatus(formData: FormData): Promise<void> {
  const { membership } = await requireWorkspace();
  const parsed = z
    .object({ userId: z.uuid(), status: z.enum(["active", "suspended"]) })
    .safeParse({ userId: formData.get("userId"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("set_member_status", {
    p_org: membership.organizationId,
    p_user: parsed.data.userId,
    p_status: parsed.data.status,
  });
  revalidatePath("/parametres");
}

export async function updateDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = z.string().trim().min(1, "Indiquez votre prénom.").max(80).safeParse(formData.get("displayName"));
  if (!name.success) return { error: name.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: name.data }).eq("id", user.id);
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { message: "Enregistré." };
}

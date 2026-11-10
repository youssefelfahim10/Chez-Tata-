import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_ORG_COOKIE = "ct_org";

export type Role = "owner" | "admin" | "assmat";
export type OrgType = "independent" | "mam";

export type CurrentUser = { id: string; email: string };

export type Membership = {
  organizationId: string;
  organizationName: string;
  organizationType: OrgType;
  role: Role;
};

/** Utilisateur vérifié (signature du JWT contrôlée), ou null. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect(next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion");
  return user;
}

/** Espaces dont l'utilisateur est membre actif (filtré par la RLS). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations ( id, name, type )")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Impossible de charger vos espaces.");

  type Row = { role: Role; organizations: { id: string; name: string; type: OrgType } | null };
  return (data as unknown as Row[])
    .filter((row) => row.organizations)
    .map((row) => ({
      organizationId: row.organizations!.id,
      organizationName: row.organizations!.name,
      organizationType: row.organizations!.type,
      role: row.role,
    }));
});

export type Workspace = {
  user: CurrentUser;
  membership: Membership;
  memberships: Membership[];
  isManager: boolean;
};

/**
 * Espace de travail actif. Le cookie n'est qu'une préférence : il est toujours
 * revalidé contre les adhésions réelles, et la RLS s'applique quoi qu'il arrive.
 */
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/bienvenue");

  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organizationId === preferred) ?? memberships[0];
  return {
    user,
    membership,
    memberships,
    isManager: membership.role === "owner" || membership.role === "admin",
  };
});

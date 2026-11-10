import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutForm } from "@/components/sign-out-form";
import { revokeInvitation, setMemberStatus, switchOrganization } from "@/app/actions/organization";
import { DeleteAccountForm } from "@/components/delete-account";
import { DisplayNameForm, InviteForm } from "@/components/settings-forms";
import { Button, Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace, type Role } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Réglages" };

const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Responsable",
  assmat: "Assistante maternelle",
};

type MemberRow = { user_id: string; role: Role; status: "active" | "suspended" };
type InvitationRow = { id: string; email: string; expires_at: string };

async function Settings() {
  const { user, membership, memberships, isManager } = await requireWorkspace();
  const supabase = await createClient();
  const isMam = membership.organizationType === "mam";

  const [profile, members, invitations] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("user_id, role, status")
      .eq("organization_id", membership.organizationId)
      .order("created_at"),
    isMam && isManager
      ? supabase
          .from("organization_invitations")
          .select("id, email, expires_at")
          .eq("organization_id", membership.organizationId)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at")
      : Promise.resolve({ data: [] as InvitationRow[] }),
  ]);

  const memberRows = (members.data ?? []) as MemberRow[];
  const names = new Map<string, string>();
  if (memberRows.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in(
        "id",
        memberRows.map((m) => m.user_id),
      );
    for (const p of data ?? []) names.set(p.id as string, (p.display_name as string) || "Sans nom");
  }
  const pending = (invitations.data ?? []) as InvitationRow[];

  return (
    <>
      <Card>
        <h2 className="text-lg font-extrabold">Mon profil</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">{user.email}</p>
        <DisplayNameForm defaultValue={profile.data?.display_name ?? ""} />
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{membership.organizationName}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {isMam ? "Maison d'assistantes maternelles" : "Assistante maternelle indépendante"} ·{" "}
          {ROLE_LABELS[membership.role]}
        </p>
        {memberships.length > 1 ? (
          <form action={switchOrganization} className="mt-4 flex flex-col gap-2">
            <label htmlFor="organizationId" className="text-sm font-bold">
              Changer d&apos;espace
            </label>
            <div className="flex gap-2">
              <select
                id="organizationId"
                name="organizationId"
                defaultValue={membership.organizationId}
                className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3"
              >
                {memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>
                    {m.organizationName}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="ghost">
                Ouvrir
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      {isMam ? (
        <Card>
          <h2 className="text-lg font-extrabold">Membres de la MAM</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Les enfants et le journal sont partagés. Les contrats et les finances de chacune restent privés.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {memberRows.map((m) => (
              <li key={m.user_id} className="flex min-h-16 items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {names.get(m.user_id) ?? "Sans nom"}
                    {m.user_id === user.id ? " (vous)" : ""}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {ROLE_LABELS[m.role]}
                    {m.status === "suspended" ? " · accès suspendu" : ""}
                  </p>
                </div>
                {isManager && m.role === "assmat" && m.user_id !== user.id ? (
                  <form action={setMemberStatus}>
                    <input type="hidden" name="userId" value={m.user_id} />
                    <input type="hidden" name="status" value={m.status === "active" ? "suspended" : "active"} />
                    <Button type="submit" variant={m.status === "active" ? "danger" : "ghost"} className="px-3 text-sm">
                      {m.status === "active" ? "Suspendre" : "Réactiver"}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isMam && isManager ? (
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">Inviter une assistante</h2>
          <InviteForm organizationName={membership.organizationName} />
          {pending.length > 0 ? (
            <>
              <h3 className="mt-6 text-sm font-bold">Invitations en attente</h3>
              <ul className="mt-2 divide-y divide-line">
                {pending.map((inv) => (
                  <li key={inv.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-sm">{inv.email}</span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <Button type="submit" variant="danger" className="px-3 text-sm">
                        Annuler
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-extrabold">Mes données</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">
          Vos données vous appartiennent : téléchargez-les ou supprimez votre compte à tout moment.{" "}
          <Link href="/confidentialite" className="font-bold text-primary underline">Confidentialité</Link>
        </p>
        <div className="flex flex-col gap-3">
          <a href="/api/export" download className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line px-4 font-bold hover:bg-primary-soft">
            ⬇️ Télécharger mes données
          </a>
          <DeleteAccountForm disabled={isDemoEmail(user.email)} />
          {isDemoEmail(user.email) ? <p className="text-sm text-ink-soft">Compte de démonstration : suppression désactivée.</p> : null}
        </div>
      </Card>

      <SignOutForm />
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageTitle subtitle="Profil, espace et membres">Réglages</PageTitle>
      <Suspense fallback={<Skeleton lines={3} />}>
        <Settings />
      </Suspense>
    </>
  );
}

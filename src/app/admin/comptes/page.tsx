import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { setUserSuspended } from "@/app/actions/admin";
import { Button, Card, Notice, PageTitle, Skeleton } from "@/components/ui";
import {
  USERS_PER_PAGE,
  cleanSearch,
  formatDateTime,
  parsePage,
  parseUserRows,
  providerLabel,
} from "@/lib/admin/stats";
import { demoEmailToExclude, requirePlatformAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Comptes · Administration" };

type SearchParams = Promise<{ q?: string; page?: string; erreur?: string }>;

function pageHref(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/comptes?${query}` : "/admin/comptes";
}

function Badge({ children, tone }: { children: string; tone: "info" | "ok" | "warn" }) {
  const tones = { info: "bg-primary-soft text-primary", ok: "bg-leaf-soft text-leaf", warn: "bg-pink-soft text-danger" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

async function Accounts({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requirePlatformAdmin();
  const params = await searchParams;
  const q = cleanSearch(params.q);
  const page = parsePage(params.page);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: q || null,
    p_limit: USERS_PER_PAGE,
    p_offset: (page - 1) * USERS_PER_PAGE,
    p_exclude_email: demoEmailToExclude(),
  });
  const rows = error ? null : parseUserRows(data);
  if (!rows) return <Notice tone="error">Impossible de charger les comptes. Réessayez dans un instant.</Notice>;

  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));

  return (
    <>
      {params.erreur === "suspension" ? (
        <Notice tone="error">Action impossible : vérifiez que le compte existe et n&apos;est pas un administrateur.</Notice>
      ) : null}

      <form action="/admin/comptes" method="get" className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Rechercher un compte par e-mail ou prénom
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={80}
          placeholder="Rechercher par e-mail ou prénom"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base focus:border-sun focus:outline-none focus:ring-4 focus:ring-sun/20"
        />
        <Button type="submit">Chercher</Button>
      </form>

      <p className="text-sm text-ink-soft">
        {total} compte(s){q ? ` pour « ${q} »` : ""} · page {Math.min(page, pages)} sur {pages}
      </p>

      {rows.length === 0 ? (
        <Card>
          <p className="text-ink-soft">Aucun compte à afficher.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const isSelf = row.user_id === admin.id;
              const canSuspend = !isSelf && !row.is_admin;
              return (
                <li key={row.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{row.display_name || "Sans prénom"}</p>
                      <Badge tone="info">{providerLabel(row.provider)}</Badge>
                      {row.is_admin ? <Badge tone="ok">Administrateur</Badge> : null}
                      {row.suspended ? <Badge tone="warn">Suspendu</Badge> : null}
                    </div>
                    <p className="truncate text-sm text-ink-soft">{row.email ?? "Sans e-mail"}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      Créé le {formatDateTime(row.created_at)} · dernière connexion {formatDateTime(row.last_sign_in_at)}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {row.space_name
                        ? `Espace « ${row.space_name} »${row.space_count > 1 ? ` (+${row.space_count - 1})` : ""} · ${row.children_count} enfant(s)`
                        : "Aucun espace créé"}
                    </p>
                  </div>
                  {canSuspend ? (
                    <form action={setUserSuspended}>
                      <input type="hidden" name="userId" value={row.user_id} />
                      <input type="hidden" name="suspended" value={row.suspended ? "false" : "true"} />
                      <Button type="submit" variant={row.suspended ? "ghost" : "danger"} className="w-full px-4 text-sm sm:w-auto">
                        {row.suspended ? "Réactiver" : "Suspendre"}
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(q, page - 1)} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-bold">
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link href={pageHref(q, page + 1)} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-bold">
              Suivant →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <Notice tone="info">
        Suspendre un compte coupe ses connexions ouvertes : l&apos;accès actuel s&apos;arrête au plus tard dans l&apos;heure
        et la personne ne peut plus se reconnecter, jusqu&apos;à réactivation. Ses données restent intactes. Chaque action est
        tracée.
      </Notice>
    </>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageTitle subtitle="Inscriptions, méthode de connexion et suspension">Comptes</PageTitle>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Accounts searchParams={searchParams} />
      </Suspense>
    </>
  );
}

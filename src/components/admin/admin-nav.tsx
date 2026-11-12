"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/admin/comptes", label: "Comptes", exact: false },
] as const;

/** Navigation de l'administration : deux onglets et un retour vers l'application. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex flex-wrap items-center gap-2">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold transition ${
              active ? "bg-primary text-white" : "border border-line bg-surface text-ink hover:bg-primary-soft"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      <Link
        href="/aujourdhui"
        className="ml-auto inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-ink-soft underline"
      >
        ← Retour à l&apos;application
      </Link>
    </nav>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isTabActive, NAV_TABS } from "@/lib/nav";

/** Barre latérale de la version PC (à partir de 1024 px). Cachée sur téléphone et tablette, qui gardent la barre du bas. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3 py-5 lg:flex">
      <Link href="/aujourdhui" className="flex items-center gap-2.5 px-2 font-display text-2xl font-semibold text-primary-strong">
        <Image src="/logo-sm.png" alt="" width={40} height={40} className="size-9 rounded-lg" />
        Chez TaTa
      </Link>
      <nav aria-label="Navigation principale">
        <ul className="flex flex-col gap-1">
          {NAV_TABS.map((tab) => {
            const active = isTabActive(tab, pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-bold transition ${
                    active ? "bg-sun-soft text-primary" : "text-ink-soft hover:bg-primary-soft hover:text-primary"
                  }`}
                >
                  <span aria-hidden className="text-xl">
                    {tab.icon}
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link href="/aide" className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-ink-soft hover:bg-primary-soft hover:text-primary">
        <span aria-hidden className="text-lg">
          ❓
        </span>
        Aide et contact
      </Link>
    </aside>
  );
}

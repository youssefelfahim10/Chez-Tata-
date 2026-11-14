"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isTabActive, NAV_TABS } from "@/lib/nav";

/** Navigation principale à 4 onglets, atteignable au pouce (téléphone et tablette ; sur PC, voir la barre latérale). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {NAV_TABS.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                  active ? "text-primary" : "text-ink-soft"
                }`}
              >
                <span aria-hidden className={`rounded-full px-4 py-0.5 text-xl ${active ? "bg-sun-soft" : ""}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

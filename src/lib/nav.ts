/** Les 4 onglets principaux de l'application, partagés par la barre du bas (téléphone) et la barre latérale (PC). */
export type NavTab = { href: string; label: string; icon: string; also?: string[] };

export const NAV_TABS: readonly NavTab[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: "☀️" },
  { href: "/planning", label: "Planning", icon: "📅" },
  { href: "/gestion", label: "Gestion", icon: "📒" },
  { href: "/profil", label: "Profil", icon: "👤", also: ["/parametres"] },
];

export function isTabActive(tab: NavTab, pathname: string): boolean {
  return [tab.href, ...(tab.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

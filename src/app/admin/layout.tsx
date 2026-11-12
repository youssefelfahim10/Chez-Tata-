import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

/**
 * Coque de l'administration (sans lecture de session : chaque page revérifie le droit d'accès).
 * Plus large que l'application mobile : c'est un outil de bureau, lisible aussi sur téléphone.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4">
          <p className="text-sm font-bold tracking-wide text-gold-deep uppercase">Chez TaTa · Administration</p>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pt-6 pb-16">{children}</main>
    </>
  );
}

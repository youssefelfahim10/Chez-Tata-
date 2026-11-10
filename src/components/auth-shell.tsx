import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-extrabold text-primary">Chez TaTa</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-ink-soft">{subtitle}</p> : null}
      </div>
      {children}
    </main>
  );
}

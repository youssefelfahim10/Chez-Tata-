import Link from "next/link";
import { HelpButton } from "@/components/help/help-button";
import type { HelpId } from "@/lib/help/topics";
import { TONES, type ToneName } from "@/lib/ui/tones";

/** Rangée de navigation : émoji teinté, titre, explication courte. Même présentation partout (Profil, Gestion). */
export function HubLink({ href, emoji, title, text, tone }: { href: string; emoji: string; title: string; text: string; tone: ToneName }) {
  return (
    <Link href={href} className="flex min-h-18 items-center gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-luxe transition active:scale-[0.99]">
      <span aria-hidden className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${TONES[tone].box}`}>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold">{title}</span>
        <span className="block text-sm text-ink-soft">{text}</span>
      </span>
      <span aria-hidden className="text-2xl text-ink-soft">
        ›
      </span>
    </Link>
  );
}

export function SectionTitle({ children, help }: { children: React.ReactNode; help?: HelpId }) {
  return (
    <h2 className="mt-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.22em] text-gold-deep">
      <span>{children}</span>
      {help ? <HelpButton topic={help} /> : null}
    </h2>
  );
}

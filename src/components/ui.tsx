import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { HelpButton } from "@/components/help/help-button";
import type { HelpId } from "@/lib/help/topics";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-gradient-to-b from-primary to-primary-strong text-white shadow-[0_8px_20px_-8px_rgb(1_39_95/0.7)] hover:brightness-110",
  secondary: "bg-gradient-to-b from-[#d9b865] to-sun text-ink shadow-[0_8px_20px_-10px_rgb(143_111_38/0.7)] hover:brightness-105",
  ghost: "bg-surface text-ink border border-line hover:bg-cream",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-pink-soft",
};

/** Bouton tactile : 48 px de haut minimum. */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-bold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "", id, tour }: { children: ReactNode; className?: string; id?: string; /** Repère de la visite guidée */ tour?: string }) {
  return (
    <section id={id} data-tour={tour} className={`rounded-card border border-line bg-surface p-5 shadow-luxe ${className}`}>{children}</section>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; /** Explication simple, ouverte par le « ? » */ help?: HelpId; /** Repère de la visite guidée */ tour?: string };

export function Field({ label, hint, help, tour, id, name, ...props }: FieldProps) {
  const fieldId = id ?? `field-${name}`;
  return (
    <div className="relative flex flex-col gap-1.5" data-tour={tour}>
      {help ? <HelpButton topic={help} className="absolute -top-1 right-0" /> : null}
      <label htmlFor={fieldId} className={`text-sm font-bold text-ink ${help ? "pr-9" : ""}`}>
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        {...props}
        className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink transition placeholder:text-ink-soft/70 focus:border-sun focus:outline-none focus:ring-4 focus:ring-sun/20"
      />
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; help?: HelpId };

export function TextareaField({ label, hint, help, id, name, ...props }: TextareaProps) {
  const fieldId = id ?? `field-${name}`;
  return (
    <div className="relative flex flex-col gap-1.5">
      {help ? <HelpButton topic={help} className="absolute -top-1 right-0" /> : null}
      <label htmlFor={fieldId} className={`text-sm font-bold text-ink ${help ? "pr-9" : ""}`}>
        {label}
      </label>
      <textarea
        id={fieldId}
        name={name}
        rows={3}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        {...props}
        className="min-h-24 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink transition placeholder:text-ink-soft/70 focus:border-sun focus:outline-none focus:ring-4 focus:ring-sun/20"
      />
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const tones = {
    error: "bg-pink-soft text-danger",
    success: "bg-leaf-soft text-leaf",
    info: "bg-sun-soft text-ink",
  };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{children}</h1>
      {subtitle ? <p className="text-base text-ink-soft first-letter:uppercase">{subtitle}</p> : null}
    </header>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-card bg-line/60" />
      ))}
    </div>
  );
}

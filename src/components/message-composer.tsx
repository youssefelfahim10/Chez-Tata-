"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { ShareSummary, type Recipient } from "@/components/share-summary";
import { findTemplate, missingFields, renderTemplate, TEMPLATES, type Template, type TemplateId, type Values } from "@/lib/messages/templates";

const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink transition placeholder:text-ink-soft/70 focus:border-sun focus:outline-none focus:ring-4 focus:ring-sun/20";

function FieldInput({ field, value, onChange }: { field: Template["fields"][number]; value: string; onChange: (v: string) => void }) {
  const id = `msg-${field.key}`;
  const common = { id, value, placeholder: field.placeholder, className: inputClass };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {field.label}
        {field.required ? <span aria-hidden className="text-pink"> *</span> : null}
      </label>
      {field.kind === "multiline" ? (
        <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} className={`${inputClass} min-h-24 py-3`} maxLength={300} />
      ) : (
        <input {...common} type={field.kind === "date" ? "date" : field.kind === "month" ? "month" : "text"} onChange={(e) => onChange(e.target.value)} maxLength={200} />
      )}
    </div>
  );
}

export function MessageComposer({ childName, sender, recipients }: { childName: string; sender?: string; recipients: Recipient[] }) {
  const [templateId, setTemplateId] = useState<TemplateId>("absence");
  const [values, setValues] = useState<Values>({});
  const template = findTemplate(templateId)!;

  const text = useMemo(() => renderTemplate(templateId, values, childName, sender), [templateId, values, childName, sender]);
  const missing = missingFields(template, values);

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold">Que voulez-vous dire ?</legend>
        {TEMPLATES.map((t) => (
          <label
            key={t.id}
            className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${templateId === t.id ? "border-sun bg-sun-soft" : "border-line bg-surface"}`}
          >
            <input type="radio" name="template" className="mt-1 size-5 accent-primary" checked={templateId === t.id} onChange={() => { setTemplateId(t.id); setValues({}); }} />
            <span>
              <span className="block font-bold">{t.title}</span>
              <span className="block text-sm text-ink-soft">{t.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-4">
        {template.fields.map((f) => (
          <FieldInput key={`${templateId}-${f.key}`} field={f} value={values[f.key] ?? ""} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
        ))}
      </div>

      {text ? (
        // Un nouveau texte (autre modèle ou autre champ) repart d'une relecture complète.
        <ShareSummary key={text} initialText={text} recipients={recipients} hasContent />
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm text-ink-soft">
          <Icon name="message" className="size-4 shrink-0" />
          Renseignez : {missing.map((m) => m.label.toLowerCase()).join(", ")}.
        </p>
      )}
    </div>
  );
}

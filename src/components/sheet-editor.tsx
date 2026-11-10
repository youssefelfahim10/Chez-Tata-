"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveAttendanceDay } from "@/app/actions/attendance";
import { Button, Card, Notice } from "@/components/ui";
import { createSheetPdf, sheetFileName } from "@/lib/sheet/browser";
import {
  computeTotals,
  daysInMonth,
  eurosInputToCents,
  formatDecimalHours,
  formatEuros,
  hoursInputToMinutes,
  presenceMinutes,
  type SheetData,
  type SheetDay,
} from "@/lib/sheet/compute";

export type SheetChild = { id: string; name: string };

type Props = { initial: SheetData; childId: string; childrenList: SheetChild[]; hasContract: boolean };

type Draft = { in: string; out: string; absence: string; extra: string; maintenance: boolean; meal: boolean; leave: string; note: string };

const toDraft = (d: SheetDay | undefined): Draft => ({
  in: d?.in ?? "",
  out: d?.out ?? "",
  absence: d?.absenceMinutes ? formatDecimalHours(d.absenceMinutes) : "",
  extra: d?.extraMinutes ? formatDecimalHours(d.extraMinutes) : "",
  maintenance: Boolean(d?.maintenance),
  meal: Boolean(d?.meal),
  leave: d?.leave ?? "",
  note: d?.note ?? "",
});

const hasData = (d: SheetDay | undefined) =>
  Boolean(d && (d.in || d.out || d.absenceMinutes || d.extraMinutes || d.maintenance || d.meal || d.leave || d.note));

const inputClass = "min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink";

export function SheetEditor({ initial, childId, childrenList, hasContract }: Props) {
  const router = useRouter();
  const { month } = initial;
  const last = daysInMonth(month);
  const [days, setDays] = useState(initial.days);
  const [selected, setSelected] = useState(() => {
    const today = new Date();
    const same = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` === month;
    return same ? Math.min(today.getDate(), last) : 1;
  });
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial.days[selected]));
  const [salary, setSalary] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const data: SheetData = useMemo(
    () => ({ ...initial, days, salaryFinalCents: eurosInputToCents(salary) }),
    [initial, days, salary],
  );
  const totals = useMemo(() => computeTotals(data), [data]);

  const [y, m] = month.split("-").map(Number);
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const dateIso = `${month}-${String(selected).padStart(2, "0")}`;
  const title = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, selected),
  );
  const draftPresence = presenceMinutes({ in: draft.in, out: draft.out });

  function go(next: { mois?: string; enfant?: string }) {
    const qs = new URLSearchParams({ mois: next.mois ?? month, enfant: next.enfant ?? childId });
    router.push(`/planning?${qs.toString()}`);
  }

  function select(day: number) {
    const clamped = Math.max(1, Math.min(last, day));
    setSelected(clamped);
    setDraft(toDraft(days[clamped]));
    setMessage(null);
  }

  function save(thenNext = false) {
    const next: SheetDay = {
      in: draft.in || undefined,
      out: draft.out || undefined,
      absenceMinutes: hoursInputToMinutes(draft.absence) || undefined,
      extraMinutes: hoursInputToMinutes(draft.extra) || undefined,
      maintenance: draft.maintenance || undefined,
      meal: draft.meal || undefined,
      leave: draft.leave === "CP" || draft.leave === "CSS" ? draft.leave : null,
      note: draft.note.trim() || undefined,
    };
    startSaving(async () => {
      const result = await saveAttendanceDay({
        childId,
        date: dateIso,
        in: draft.in,
        out: draft.out,
        absenceMinutes: next.absenceMinutes ?? 0,
        extraMinutes: next.extraMinutes ?? 0,
        maintenance: Boolean(next.maintenance),
        meal: Boolean(next.meal),
        leave: next.leave ?? "",
        note: draft.note.trim(),
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const updated = { ...days, [selected]: next };
      setDays(updated);
      setMessage({ tone: "success", text: "Journée enregistrée." });
      if (thenNext && selected < last) {
        setSelected(selected + 1);
        setDraft(toDraft(updated[selected + 1]));
      }
    });
  }

  async function makePdf(open: boolean) {
    setPdfStatus("Création de la fiche A4…");
    try {
      const blob = await createSheetPdf(data);
      const url = URL.createObjectURL(blob);
      if (open) {
        if (!window.open(url, "_blank")) triggerDownload(url, sheetFileName(data));
      } else {
        triggerDownload(url, sheetFileName(data));
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      setPdfStatus("PDF A4 créé. Vous pouvez le partager ou l’imprimer.");
    } catch (error) {
      setPdfStatus(error instanceof Error ? error.message : "Création du PDF impossible.");
    }
  }

  const contract = initial.contract;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mois" className="text-sm font-bold">
              Mois
            </label>
            <input id="mois" type="month" value={month} className={inputClass} onChange={(e) => e.target.value && go({ mois: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enfant" className="text-sm font-bold">
              Enfant
            </label>
            <select id="enfant" value={childId} className={inputClass} onChange={(e) => go({ enfant: e.target.value })}>
              {childrenList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!hasContract ? (
          <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm text-ink">
            Aucun contrat actif pour cet enfant : les montants d’indemnités resteront vides sur la fiche.
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-extrabold">Choisir un jour</h2>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Calendrier du mois">
          {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
            <div key={i} className="text-center text-xs font-bold text-ink-soft">
              {l}
            </div>
          ))}
          {Array.from({ length: leading }, (_, i) => (
            <div key={`gap-${i}`} />
          ))}
          {Array.from({ length: last }, (_, i) => {
            const day = i + 1;
            const weekend = [0, 6].includes(new Date(y, m - 1, day).getDay());
            const active = day === selected;
            return (
              <button
                key={day}
                type="button"
                onClick={() => select(day)}
                aria-label={`Jour ${day}${hasData(days[day]) ? ", renseigné" : ""}`}
                aria-pressed={active}
                className={`relative h-12 rounded-xl border text-base font-bold ${
                  active ? "border-primary bg-primary text-white" : weekend ? "border-line bg-sun-soft" : "border-line bg-surface"
                }`}
              >
                {day}
                {hasData(days[day]) ? (
                  <span aria-hidden className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${active ? "bg-white" : "bg-sun"}`} />
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-leaf-soft px-4 py-3">
          <strong className="text-lg capitalize">{title}</strong>
          <span className="text-sm font-bold text-leaf">{hasData(days[selected]) ? "✓ Renseignée" : "À renseigner"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Arrivée
            <input type="time" value={draft.in} className={inputClass} onChange={(e) => setDraft({ ...draft, in: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Départ
            <input type="time" value={draft.out} className={inputClass} onChange={(e) => setDraft({ ...draft, out: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Heures d’absence
            <input inputMode="decimal" placeholder="0" value={draft.absence} className={inputClass} onChange={(e) => setDraft({ ...draft, absence: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Heures complémentaires
            <input inputMode="decimal" placeholder="0" value={draft.extra} className={inputClass} onChange={(e) => setDraft({ ...draft, extra: e.target.value })} />
          </label>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Présence du jour : <b>{draftPresence === null ? "—" : `${formatDecimalHours(draftPresence)} h`}</b>
        </p>

        <div className="mt-3 grid gap-2">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line px-4">
            <input type="checkbox" className="size-5" checked={draft.maintenance} onChange={(e) => setDraft({ ...draft, maintenance: e.target.checked })} />
            <span>
              Indemnité d’entretien due
              {contract.maintenanceCents ? <span className="text-ink-soft"> ({formatEuros(contract.maintenanceCents)} €)</span> : null}
            </span>
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line px-4">
            <input type="checkbox" className="size-5" checked={draft.meal} onChange={(e) => setDraft({ ...draft, meal: e.target.checked })} />
            <span>
              Repas / goûter dû
              {contract.mealCents ? <span className="text-ink-soft"> ({formatEuros(contract.mealCents)} €)</span> : null}
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Congé
            <select value={draft.leave} className={inputClass} onChange={(e) => setDraft({ ...draft, leave: e.target.value })}>
              <option value="">Aucun congé</option>
              <option value="CP">Congé payé</option>
              <option value="CSS">Congé sans solde</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Observations (facultatif)
            <textarea rows={2} maxLength={300} value={draft.note} className={`${inputClass} py-3`} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
        </div>

        {message ? (
          <div className="mt-3" role="status">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" variant="ghost" onClick={() => select(selected - 1)} disabled={selected <= 1 || saving}>
            ← Précédent
          </Button>
          <Button type="button" onClick={() => save(true)} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer et suivant →"}
          </Button>
        </div>
        <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => save(false)} disabled={saving}>
          Enregistrer ce jour
        </Button>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-extrabold">Récapitulatif du mois</h2>
        <dl className="grid grid-cols-2 gap-2">
          {[
            ["Présence", `${formatDecimalHours(totals.presenceMinutes)} h`],
            ["Absences", `${formatDecimalHours(totals.absenceMinutes)} h`],
            ["Heures complémentaires", `${formatDecimalHours(totals.extraMinutes)} h`],
            ["Indemnités d’entretien", `${formatEuros(totals.maintenanceCents)} €`],
            ["Indemnités repas", `${formatEuros(totals.mealCents)} €`],
            ["Congés payés / sans solde", `${totals.paidLeaveDays} / ${totals.unpaidLeaveDays} j`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cream px-3 py-2">
              <dt className="text-xs text-ink-soft">{label}</dt>
              <dd className="text-lg font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-bold">
          Total du salaire à verser (€), à saisir
          <input inputMode="decimal" placeholder="Montant validé sur la paie" value={salary} className={inputClass} onChange={(e) => setSalary(e.target.value)} />
        </label>
        <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          Les heures, indemnités et congés sont additionnés à partir de votre saisie. Le salaire n’est jamais calculé à votre place : il reste à
          valider selon le contrat et les règles de paie.
        </p>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-extrabold">Ma fiche A4</h2>
        <p className="mb-3 text-sm text-ink-soft">
          La fiche illustrée « Chez TaTa » est créée sur votre téléphone : aucune donnée n’est envoyée pour la fabriquer.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={() => makePdf(false)}>
            Télécharger le PDF
          </Button>
          <Button type="button" variant="ghost" onClick={() => makePdf(true)}>
            Ouvrir le PDF
          </Button>
        </div>
        {pdfStatus ? (
          <p className="mt-3 text-sm text-ink-soft" role="status">
            {pdfStatus}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function triggerDownload(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}

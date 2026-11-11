"use client";

import { useMemo, useState } from "react";
import { HelpButton } from "@/components/help/help-button";
import type { HelpId } from "@/lib/help/topics";
import { saveContract } from "@/app/actions/contracts";
import { Button, Notice } from "@/components/ui";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { parseHours, parseWeeks } from "@/lib/contracts/parse";
import { buildContractDoc, scheduleMinutes, type ContractDetails } from "@/lib/documents/details";
import { MEAL_LABELS, WEEK_DAYS, type MealKey, type WeekDay } from "@/lib/documents/types";
import { downloadPdf, loadFontBytes, safeFileName, sharePdf } from "@/lib/pdf/browser";
import { buildContractPdf } from "@/lib/pdf/contract";
import { eurosInputToCents, formatDecimalHours } from "@/lib/sheet/compute";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/lib/whatsapp/link";

type Props = {
  childId: string;
  childName: string;
  birthDate: string | null;
  hasContract: boolean;
  today: string;
  fallbackEmployeeName: string;
  initial: {
    startDate: string;
    contractType: "annee_complete" | "annee_incomplete";
    weeksPerYear: string;
    weeklyHours: string;
    hourly: string;
    maintenance: string;
    meal: string;
    details: ContractDetails;
  };
};

const input = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";
const sectionClass = "rounded-card border border-line bg-surface p-5 shadow-sm";

function Chips({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(value === o ? "" : o)}
          aria-pressed={value === o}
          className={`min-h-11 rounded-full border px-4 text-sm font-bold ${value === o ? "border-primary bg-primary text-white" : "border-line bg-cream"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, hint, help, tour }: { label: string; children: React.ReactNode; hint?: string; help?: HelpId; tour?: string }) {
  return (
    <div className="relative" data-tour={tour}>
      {help ? <HelpButton topic={help} className="absolute -top-1 right-0" /> : null}
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        <span className={help ? "pr-9" : ""}>{label}</span>
        {children}
        {hint ? <span className="text-xs font-normal text-ink-soft">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Titre de section avec son « ? » (explication simple) à droite. */
function Heading({ children, help }: { children: React.ReactNode; help?: HelpId }) {
  return (
    <h2 className="flex items-center justify-between gap-2 text-lg font-extrabold">
      <span>{children}</span>
      {help ? <HelpButton topic={help} /> : null}
    </h2>
  );
}

export function ContractEditor({ childId, childName, birthDate, hasContract, today, fallbackEmployeeName, initial }: Props) {
  const d = initial.details;
  const [emp, setEmp] = useState({ ...d.employee, fullName: d.employee.fullName || fallbackEmployeeName });
  const [par, setPar] = useState({ name1: d.parents.names[0] ?? "", name2: d.parents.names[1] ?? "", address: d.parents.address, phone: d.parents.phone, email: d.parents.email });
  const [startDate, setStartDate] = useState(initial.startDate);
  const [type, setType] = useState(initial.contractType);
  const [weeks, setWeeks] = useState(initial.weeksPerYear);
  const [terms, setTerms] = useState({ adaptation: d.terms.adaptation, trial: d.terms.trial, notice: d.terms.notice, overtime: d.terms.overtimeNormalRate, majoration: d.terms.majorationPercent });
  const [days, setDays] = useState<Record<WeekDay, { on: boolean; from: string; to: string }>>(() => {
    const base = Object.fromEntries(WEEK_DAYS.map((day) => [day, { on: false, from: "08:00", to: "17:00" }])) as Record<WeekDay, { on: boolean; from: string; to: string }>;
    for (const s of d.schedule) base[s.day] = { on: true, from: s.from, to: s.to };
    return base;
  });
  const [weeklyText, setWeeklyText] = useState(initial.weeklyHours);
  const [weeklyTouched, setWeeklyTouched] = useState(Boolean(initial.weeklyHours));
  const [hourly, setHourly] = useState(initial.hourly);
  const [maintenance, setMaintenance] = useState(initial.maintenance);
  const [meal, setMeal] = useState(initial.meal);
  const [meals, setMeals] = useState<MealKey[]>(d.care.meals as MealKey[]);
  const [diapers, setDiapers] = useState<"" | "parents" | "assmat">(d.care.diapers);
  const [careNotes, setCareNotes] = useState(d.care.notes);
  const [leaveNotes, setLeaveNotes] = useState(d.leaveNotes);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<null | "save" | "pdf" | "share">(null);

  const schedule = useMemo(() => WEEK_DAYS.filter((day) => days[day].on).map((day) => ({ day, from: days[day].from, to: days[day].to })), [days]);
  const planningMinutes = scheduleMinutes(schedule);
  const weekly = weeklyTouched ? weeklyText : planningMinutes > 0 ? formatDecimalHours(planningMinutes) : "";
  const parentsList = [par.name1, par.name2].map((n) => n.trim()).filter(Boolean);
  const waNumber = toWhatsAppNumber(par.phone);

  function preset(from: string, to: string) {
    setDays(Object.fromEntries(WEEK_DAYS.map((day, i) => [day, { on: i < 5, from, to }])) as typeof days);
    setWeeklyTouched(false);
  }

  /** Valide et prépare les données ; renvoie un message d'erreur sinon. */
  function collect() {
    const weeklyHours = parseHours(weekly);
    if (!startDate) return { ok: false as const, error: "Indiquez la date de début de l'accueil." };
    if (weeklyHours === null) return { ok: false as const, error: "Indiquez les heures d'accueil par semaine (ou cochez les jours du planning)." };
    const weeksPerYear = type === "annee_complete" ? 52 : parseWeeks(weeks || "");
    if (weeksPerYear === null) return { ok: false as const, error: "Indiquez le nombre de semaines d'accueil par an (entre 1 et 52)." };
    const hourlyNetCents = eurosInputToCents(hourly);
    if (!hourlyNetCents) return { ok: false as const, error: "Indiquez le salaire horaire net en euros (ex. 4,50)." };
    const maintenanceCents = maintenance.trim() ? eurosInputToCents(maintenance) : 0;
    const mealCents = meal.trim() ? eurosInputToCents(meal) : 0;
    if (maintenanceCents === null || mealCents === null) return { ok: false as const, error: "Indemnités : montant invalide (ex. 3,50)." };
    const details: ContractDetails = {
      employee: { ...emp, fullName: emp.fullName.trim() },
      parents: { names: parentsList, address: par.address.trim(), phone: par.phone.trim(), email: par.email.trim() },
      terms: { adaptation: terms.adaptation.trim(), trial: terms.trial.trim(), notice: terms.notice.trim(), overtimeNormalRate: terms.overtime, majorationPercent: terms.majoration.trim() },
      schedule,
      care: { meals, diapers, notes: careNotes.trim() },
      leaveNotes: leaveNotes.trim(),
    };
    return { ok: true as const, weeklyHours, weeksPerYear, hourlyNetCents, maintenanceCents, mealCents, details };
  }

  async function run(kind: "save" | "pdf" | "share") {
    setMessage(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) return setMessage({ tone: "error", text: "📴 Hors ligne : l'enregistrement du contrat demande du réseau." });
    const c = collect();
    if (!c.ok) return setMessage({ tone: "error", text: c.error });
    setBusy(kind);
    try {
      const saved = await saveContract({
        childId,
        contract: { startDate, weeklyHours: c.weeklyHours, weeksPerYear: c.weeksPerYear, hourlyNetCents: c.hourlyNetCents, maintenanceCents: c.maintenanceCents, mealCents: c.mealCents, contractType: type },
        details: c.details,
      });
      if (!saved.ok) return setMessage({ tone: "error", text: saved.error });
      if (kind === "save") return setMessage({ tone: "success", text: "Contrat enregistré ✓" });

      const doc = buildContractDoc({
        today,
        childName,
        birthDate,
        contract: { startDate, scheduledHours: c.weeklyHours, weeksPerYear: c.weeksPerYear, hourlyRate: c.hourlyNetCents / 100, maintenanceCents: c.maintenanceCents, mealCents: c.mealCents, contractType: type },
        details: c.details,
        fallbackEmployeeName,
      });
      const bytes = await buildContractPdf(doc, await loadFontBytes());
      const fileName = `Contrat_${safeFileName(childName)}.pdf`;
      if (kind === "pdf") {
        downloadPdf(bytes, fileName);
        return setMessage({ tone: "success", text: "Contrat enregistré et PDF créé ✓" });
      }
      const text = `Bonjour${parentsList[0] ? ` ${parentsList[0]}` : ""}, voici le contrat d'accueil de ${childName}. Merci de le relire et de me dire si tout vous convient. 🧸`;
      const result = await sharePdf(bytes, fileName, text, buildWhatsAppUrl(waNumber, text));
      setMessage({ tone: "success", text: result === "shared" ? "Partage ouvert : choisissez WhatsApp, puis envoyez vous-même." : "PDF téléchargé et WhatsApp ouvert : joignez le fichier, puis envoyez vous-même." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Création du document impossible." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={sectionClass} data-tour="c-employee">
        <Heading help="contract.employee">👩‍🍼 L’assistante maternelle</Heading>
        <p className="mb-3 text-sm text-ink-soft">Ces informations sont reprises d’un contrat à l’autre.</p>
        <div className="grid gap-3">
          <Field label="Nom et prénom"><input className={input} value={emp.fullName} onChange={(e) => setEmp({ ...emp, fullName: e.target.value })} maxLength={120} /></Field>
          <Field label="Adresse"><input className={input} value={emp.address} onChange={(e) => setEmp({ ...emp, address: e.target.value })} maxLength={240} autoComplete="street-address" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone"><input className={input} type="tel" inputMode="tel" value={emp.phone} onChange={(e) => setEmp({ ...emp, phone: e.target.value })} maxLength={30} /></Field>
            <Field label="E-mail"><input className={input} type="email" inputMode="email" value={emp.email} onChange={(e) => setEmp({ ...emp, email: e.target.value })} maxLength={160} /></Field>
            <Field label="N° d'agrément" help="contract.agrement"><input className={input} value={emp.agrementNumber} onChange={(e) => setEmp({ ...emp, agrementNumber: e.target.value })} maxLength={60} /></Field>
            <Field label="Date d'agrément" help="contract.agrement"><input className={input} type="date" value={emp.agrementDate} onChange={(e) => setEmp({ ...emp, agrementDate: e.target.value })} /></Field>
            <Field label="Assurance (assureur)" help="contract.insurance"><input className={input} value={emp.insurer} onChange={(e) => setEmp({ ...emp, insurer: e.target.value })} maxLength={120} /></Field>
            <Field label="N° de contrat" help="contract.insurance"><input className={input} value={emp.policyNumber} onChange={(e) => setEmp({ ...emp, policyNumber: e.target.value })} maxLength={60} /></Field>
          </div>
        </div>
      </section>

      <section className={sectionClass} data-tour="c-parents">
        <Heading help="contract.parents">👪 Les parents</Heading>
        <div className="mt-3 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Parent 1" help="contract.parents"><input className={input} value={par.name1} onChange={(e) => setPar({ ...par, name1: e.target.value })} maxLength={120} placeholder="Nom et prénom" /></Field>
            <Field label="Parent 2 (facultatif)"><input className={input} value={par.name2} onChange={(e) => setPar({ ...par, name2: e.target.value })} maxLength={120} placeholder="Nom et prénom" /></Field>
          </div>
          <Field label="Adresse"><input className={input} value={par.address} onChange={(e) => setPar({ ...par, address: e.target.value })} maxLength={240} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone" hint="Sert aussi au partage WhatsApp." help="contract.phone"><input className={input} type="tel" inputMode="tel" value={par.phone} onChange={(e) => setPar({ ...par, phone: e.target.value })} maxLength={30} /></Field>
            <Field label="E-mail"><input className={input} type="email" inputMode="email" value={par.email} onChange={(e) => setPar({ ...par, email: e.target.value })} maxLength={160} /></Field>
          </div>
        </div>
      </section>

      <section className={sectionClass} data-tour="c-accueil">
        <Heading help="contract.type">🧸 L’accueil de {childName}</Heading>
        <div className="mt-3 grid gap-4">
          <Field label="Début de l'accueil" help="contract.start"><input className={input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <div data-tour="c-type">
            <p className="flex items-center justify-between gap-2 text-sm font-bold">Type d’accueil <HelpButton topic="contract.type" /></p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([["annee_complete", "📆 Année complète", "52 semaines"], ["annee_incomplete", "🗓️ Année incomplète", "moins de 52 semaines"]] as const).map(([v, label, sub]) => (
                <button key={v} type="button" onClick={() => setType(v)} aria-pressed={type === v} className={`min-h-16 rounded-2xl border px-3 text-left font-extrabold ${type === v ? "border-primary bg-leaf-soft" : "border-line bg-cream"}`}>
                  {label}
                  <span className="block text-xs font-normal text-ink-soft">{sub}</span>
                </button>
              ))}
            </div>
            {type === "annee_incomplete" ? (
              <div className="mt-3">
                <Field label="Semaines d'accueil par an" help="contract.weeks"><input className={input} inputMode="decimal" value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder="46" /></Field>
                <Chips options={["46", "45", "44", "42", "40"]} value={weeks} onPick={setWeeks} />
              </div>
            ) : null}
          </div>
          <div>
            <Field label="Période d'adaptation" help="contract.adaptation"><input className={input} value={terms.adaptation} onChange={(e) => setTerms({ ...terms, adaptation: e.target.value })} maxLength={160} placeholder="Ex. 1 semaine" /></Field>
            <Chips options={["Aucune", "3 jours", "1 semaine", "2 semaines"]} value={terms.adaptation} onPick={(v) => setTerms({ ...terms, adaptation: v })} />
          </div>
          <div>
            <Field label="Période d'essai" help="contract.trial"><input className={input} value={terms.trial} onChange={(e) => setTerms({ ...terms, trial: e.target.value })} maxLength={120} placeholder="Ex. 1 mois" /></Field>
            <Chips options={["Aucune", "15 jours", "1 mois", "2 mois"]} value={terms.trial} onPick={(v) => setTerms({ ...terms, trial: v })} />
          </div>
          <div>
            <Field label="Préavis de rupture convenu" help="contract.notice"><input className={input} value={terms.notice} onChange={(e) => setTerms({ ...terms, notice: e.target.value })} maxLength={120} placeholder="Ex. 1 mois" /></Field>
            <Chips options={["15 jours", "1 mois", "2 mois", "3 mois"]} value={terms.notice} onPick={(v) => setTerms({ ...terms, notice: v })} />
          </div>
        </div>
      </section>

      <section className={sectionClass} data-tour="c-schedule">
        <Heading help="contract.schedule">🕗 Planning d’accueil</Heading>
        <p className="mb-3 text-sm text-ink-soft">Cochez les jours, réglez les horaires.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => preset("08:00", "17:00")} className="min-h-11 rounded-full border border-line bg-cream px-4 text-sm font-bold">Lun–Ven 8 h–17 h</button>
          <button type="button" onClick={() => preset("08:30", "16:30")} className="min-h-11 rounded-full border border-line bg-cream px-4 text-sm font-bold">Lun–Ven 8 h 30–16 h 30</button>
          <button type="button" onClick={() => { setDays(Object.fromEntries(WEEK_DAYS.map((day) => [day, { on: false, from: "08:00", to: "17:00" }])) as typeof days); setWeeklyTouched(false); }} className="min-h-11 rounded-full border border-line px-4 text-sm font-bold text-ink-soft">Effacer</button>
        </div>
        <ul className="flex flex-col gap-2">
          {WEEK_DAYS.map((day) => (
            <li key={day} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 ${days[day].on ? "border-leaf bg-leaf-soft" : "border-line"}`}>
              <label className="flex min-h-11 min-w-32 items-center gap-2 font-bold">
                <input type="checkbox" className="size-6 accent-primary" checked={days[day].on} onChange={(e) => { setDays({ ...days, [day]: { ...days[day], on: e.target.checked } }); setWeeklyTouched(false); }} />
                {day}
              </label>
              {days[day].on ? (
                <span className="flex items-center gap-2">
                  <input aria-label={`${day} arrivée`} type="time" className="min-h-11 rounded-xl border border-line bg-surface px-2" value={days[day].from} onChange={(e) => { setDays({ ...days, [day]: { ...days[day], from: e.target.value } }); setWeeklyTouched(false); }} />
                  <span aria-hidden>→</span>
                  <input aria-label={`${day} départ`} type="time" className="min-h-11 rounded-xl border border-line bg-surface px-2" value={days[day].to} onChange={(e) => { setDays({ ...days, [day]: { ...days[day], to: e.target.value } }); setWeeklyTouched(false); }} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <p className="rounded-2xl bg-cream px-4 py-3 text-sm">Total du planning<br /><b className="text-lg">{planningMinutes > 0 ? `${formatDecimalHours(planningMinutes)} h` : "—"}</b></p>
          <Field label="Heures par semaine (contrat)" help="contract.weekly" tour="c-weekly"><input aria-label="Heures par semaine" className={input} inputMode="decimal" value={weekly} onChange={(e) => { setWeeklyText(e.target.value); setWeeklyTouched(true); }} placeholder="40" /></Field>
        </div>
      </section>

      <section className={sectionClass} data-tour="c-pay">
        <Heading>💶 Rémunération et indemnités</Heading>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Salaire horaire net (€)" help="contract.hourly" tour="c-hourly"><input aria-label="Salaire horaire net" className={input} inputMode="decimal" value={hourly} onChange={(e) => setHourly(e.target.value)} placeholder="4,50" /></Field>
          <Field label="Entretien / jour (€)" help="invoice.maintenance" tour="c-maintenance"><input aria-label="Indemnité d'entretien" className={input} inputMode="decimal" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} placeholder="3,50" /></Field>
          <Field label="Repas (€)" help="invoice.meal"><input aria-label="Indemnité de repas" className={input} inputMode="decimal" value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="4,00" /></Field>
          <Field label="Majoration heures majorées (%)" help="contract.majoration" tour="c-majoration"><input aria-label="Majoration" className={input} inputMode="decimal" value={terms.majoration} onChange={(e) => setTerms({ ...terms, majoration: e.target.value })} placeholder="25" /></Field>
        </div>
        <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-line px-4">
          <input type="checkbox" className="size-6 accent-primary" checked={terms.overtime} onChange={(e) => setTerms({ ...terms, overtime: e.target.checked })} />
          <span className="flex-1">Heures complémentaires payées au tarif horaire normal</span>
          <HelpButton topic="contract.overtime" />
        </label>
        <p className="mt-2 text-xs text-ink-soft">Les indemnités kilométriques sont désactivées. Vérifiez les montants et les majorations dans la convention collective.</p>
      </section>

      <section className={sectionClass} data-tour="c-meals">
        <Heading help="contract.meals">🍽️ Repas et quotidien</Heading>
        <p className="mt-3 text-sm font-bold">Repas fournis par vous</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(MEAL_LABELS) as MealKey[]).map((k) => (
            <label key={k} className={`flex min-h-12 items-center gap-2 rounded-2xl border px-3 ${meals.includes(k) ? "border-leaf bg-leaf-soft" : "border-line"}`}>
              <input type="checkbox" className="size-5 accent-primary" checked={meals.includes(k)} onChange={(e) => setMeals(e.target.checked ? [...meals, k] : meals.filter((m) => m !== k))} />
              {MEAL_LABELS[k]}
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm font-bold">Couches et hygiène fournies par</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([["parents", "👪 Les parents"], ["assmat", "👩‍🍼 Moi"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setDiapers(diapers === v ? "" : v)} aria-pressed={diapers === v} className={`min-h-12 rounded-2xl border font-bold ${diapers === v ? "border-primary bg-leaf-soft" : "border-line bg-cream"}`}>{label}</button>
          ))}
        </div>
        <div className="mt-4 grid gap-3">
          <Field label="Précisions (allergies, habitudes…) — facultatif" help="contract.notes"><textarea className={`${input} py-3`} rows={2} value={careNotes} onChange={(e) => setCareNotes(e.target.value)} maxLength={500} /></Field>
          <Field label="Congés : dispositions convenues — facultatif"><textarea className={`${input} py-3`} rows={2} value={leaveNotes} onChange={(e) => setLeaveNotes(e.target.value)} maxLength={500} /></Field>
        </div>
      </section>

      {message ? <div role="status"><Notice tone={message.tone}>{message.text}</Notice></div> : null}

      <div className="grid gap-3 rounded-card border border-line bg-surface p-5 shadow-sm">
        <Button type="button" onClick={() => run("pdf")} disabled={busy !== null}>{busy === "pdf" ? "Création…" : "📄 Générer le contrat (PDF)"}</Button>
        <button type="button" onClick={() => run("share")} disabled={busy !== null} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#25D366] px-5 text-lg font-extrabold text-[#06301a] disabled:opacity-50">
          <WhatsAppIcon className="size-7 text-white" />
          {busy === "share" ? "Préparation…" : "Envoyer aux parents par WhatsApp"}
        </button>
        <Button type="button" variant="ghost" onClick={() => run("save")} disabled={busy !== null}>{busy === "save" ? "Enregistrement…" : hasContract ? "💾 Enregistrer les modifications" : "💾 Enregistrer le contrat"}</Button>
        <p className="text-xs text-ink-soft">Le PDF est créé sur votre téléphone. Pour WhatsApp, rien n’est envoyé sans votre validation dans WhatsApp. Ce modèle doit être relu par les parties avant signature.</p>
      </div>
    </div>
  );
}

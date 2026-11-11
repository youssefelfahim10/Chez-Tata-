"use client";

import Link from "next/link";
import { HelpButton } from "@/components/help/help-button";
import { useMemo, useState } from "react";
import { Button, Card, Field } from "@/components/ui";
import { downloadPdf, loadFontBytes, safeFileName } from "@/lib/pdf/browser";
import { eurosInputToCents, formatEuros, hoursInputToMinutes } from "@/lib/sheet/compute";
import { computeTax, MONTH_NAMES, taxCsv, type ChildSettings, type TaxInput, type TaxParams } from "@/lib/tax/recap";
import type { CaregiverBlock } from "@/lib/pdf/tax";

export type TaxChildProps = {
  id: string;
  name: string;
  /** 12 mois, en centimes. */
  salary: number[];
  allowance: number[];
  /** Mois remplis automatiquement par une estimation (aucune facture validée). */
  estimated: boolean[];
  fullDays: number;
  partialMinutes: number;
  family: string;
  daysCount: number;
  firstDay: string;
  lastDay: string;
};

type Props = {
  year: number;
  years: number[];
  generatedOn: string;
  caregiver: CaregiverBlock;
  hasProfile: boolean;
  kids: TaxChildProps[];
  incompleteDays: number;
  smicDefaultCents: number | null;
  mealDefaultCents: number | null;
};

type ChildState = {
  fullDays: string;
  partialHours: string;
  multiplier: 3 | 4;
  parentMealDays: string;
  adjustment: string;
  salary: string[];
  allowance: string[];
  /** Mois encore à l'état d'estimation (repasse à faux dès que vous le modifiez). */
  estimated: boolean[];
  family: string;
  from: string;
  to: string;
  place: string;
  note: string;
};

const euros = (cents: number) => (cents === 0 ? "" : formatEuros(cents).replace(/\s/g, ""));
const money = (cents: number) => `${formatEuros(cents)} €`;
const toCents = (s: string) => eurosInputToCents(s) ?? 0;
const intOf = (s: string) => {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const hoursText = (minutes: number) => (minutes === 0 ? "" : String(Math.round((minutes / 60) * 100) / 100).replace(".", ","));

function initialState(c: TaxChildProps): ChildState {
  return {
    fullDays: String(c.fullDays),
    partialHours: hoursText(c.partialMinutes),
    multiplier: 3,
    parentMealDays: "",
    adjustment: "",
    salary: c.salary.map(euros),
    allowance: c.allowance.map(euros),
    estimated: [...c.estimated],
    family: c.family,
    from: c.firstDay,
    to: c.lastDay,
    place: "",
    note: "",
  };
}

const small = "min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-right text-sm tabular-nums focus:border-sun focus:outline-none focus:ring-2 focus:ring-sun/30";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? "border-t border-sun/60 pt-2.5 text-base font-extrabold" : "text-sm"}`}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd className={`shrink-0 whitespace-nowrap tabular-nums ${strong ? "text-gold-deep" : "font-bold"}`}>{value}</dd>
    </div>
  );
}

export function TaxHelper({ year, years, generatedOn, caregiver, hasProfile, kids, incompleteDays, smicDefaultCents, mealDefaultCents }: Props) {
  const initial = useMemo(() => Object.fromEntries(kids.map((c) => [c.id, initialState(c)])) as Record<string, ChildState>, [kids]);
  const [states, setStates] = useState<Record<string, ChildState>>(initial);
  const [smic, setSmic] = useState(smicDefaultCents ? euros(smicDefaultCents) : "");
  const [meal, setMeal] = useState(mealDefaultCents ? euros(mealDefaultCents) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, p: Partial<ChildState>) => setStates((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  const setMonth = (id: string, field: "salary" | "allowance", index: number, value: string) =>
    setStates((s) => ({
      ...s,
      [id]: { ...s[id], [field]: s[id][field].map((v, i) => (i === index ? value : v)), estimated: s[id].estimated.map((e, i) => (i === index ? false : e)) },
    }));

  const { input, params } = useMemo(() => {
    const perChild: Record<string, ChildSettings> = {};
    const input: TaxInput = {
      year,
      children: kids.map((c) => {
        const st = states[c.id];
        perChild[c.id] = { multiplier: st.multiplier, parentMealDays: intOf(st.parentMealDays), adjustmentCents: toCents(st.adjustment) };
        return {
          id: c.id,
          name: c.name,
          months: st.salary.map((v, i) => ({ salaryCents: toCents(v), allowanceCents: toCents(st.allowance[i]), estimated: st.estimated[i] })),
          fullDays: intOf(st.fullDays),
          partialMinutes: hoursInputToMinutes(st.partialHours),
        };
      }),
    };
    const params: TaxParams = { smicHourlyCents: toCents(smic), parentMealCents: toCents(meal), perChild };
    return { input, params };
  }, [kids, states, smic, meal, year]);

  const result = useMemo(() => computeTax(input, params), [input, params]);

  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await job();
    } catch {
      setError("Le document n’a pas pu être préparé. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  const pdfHelp = () =>
    run("help", async () => {
      const [{ buildTaxHelpPdf }, assets] = await Promise.all([import("@/lib/pdf/tax"), loadFontBytes()]);
      const bytes = await buildTaxHelpPdf({ generatedOn, year, caregiver, params, input, result }, assets);
      downloadPdf(bytes, `Chez_TaTa_aide_declaration_${year}.pdf`);
    });

  const csv = () => {
    const blob = new Blob([taxCsv(input, result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Chez_TaTa_revenus_${year}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const attestation = (c: TaxChildProps, index: number) =>
    run(`att-${c.id}`, async () => {
      const st = states[c.id];
      const r = result.children[index];
      const [{ buildAttestationPdf }, assets] = await Promise.all([import("@/lib/pdf/tax"), loadFontBytes()]);
      const bytes = await buildAttestationPdf(
        {
          generatedOn,
          year,
          caregiver,
          childName: c.name,
          parentsNames: st.family,
          periodFrom: st.from,
          periodTo: st.to,
          days: c.daysCount,
          salaryCents: r.salaryCents,
          allowanceCents: r.allowanceCents,
          place: st.place,
          note: st.note,
        },
        assets,
      );
      downloadPdf(bytes, `Chez_TaTa_attestation_${year}_${safeFileName(c.name)}.pdf`);
    });

  return (
    <>
      <nav aria-label="Année" className="flex flex-wrap gap-2">
        <HelpButton topic="tax.year" />
        {years.map((y) => (
          <Link key={y} href={`/profil/impots?annee=${y}`} aria-current={y === year ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold ${y === year ? "border-sun bg-sun-soft text-gold-deep" : "border-line bg-surface text-ink-soft"}`}>
            Revenus {y}
          </Link>
        ))}
      </nav>

      <Card className="border-sun/50 bg-sun-soft" tour="i-intro">
        <p className="flex items-center justify-between gap-2 font-bold">Une aide, pas un document officiel <HelpButton topic="tax.what" /></p>
        <p className="mt-1 text-sm text-ink">
          Les montants viennent de vos factures Chez TaTa (année de paiement) et de vos présences. <b>Tout est modifiable</b> : comparez avec vos bulletins, vos déclarations Pajemploi et votre déclaration pré-remplie, puis corrigez.
        </p>
      </Card>

      {!hasProfile ? (
        <Card>
          <p className="text-sm text-ink-soft">
            Vos coordonnées et votre agrément s’inscrivent sur les documents.{" "}
            <Link href="/profil/informations" className="font-bold text-primary underline">
              Compléter mon profil
            </Link>
          </p>
        </Card>
      ) : null}

      {incompleteDays > 0 ? (
        <p role="status" className="rounded-xl bg-pink-soft px-4 py-3 text-sm font-bold text-danger">
          ⚠️ {incompleteDays} jour{incompleteDays > 1 ? "s" : ""} sans heure de départ dans le journal : non compté{incompleteDays > 1 ? "s" : ""}. Corrigez les jours ci-dessous si besoin.
        </p>
      ) : null}

      <Card tour="i-params">
        <h2 className="text-lg font-extrabold">Paramètres de l’année {year}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="SMIC horaire brut (€)" help="tax.smic" tour="i-smic" name="smic" value={smic} onChange={(e) => setSmic(e.target.value)} inputMode="decimal" hint={smicDefaultCents ? "11,88 € en 2025 (impots.gouv.fr)." : `À vérifier pour ${year} sur service-public.fr.`} />
          <Field label="Repas fourni par les parents (€ par jour)" help="tax.parentMeal" name="meal" value={meal} onChange={(e) => setMeal(e.target.value)} inputMode="decimal" hint={mealDefaultCents ? "5,45 € en 2025 (impots.gouv.fr)." : "Seulement si les parents fournissent le repas."} />
        </div>
        {result.missingSmic ? <p className="mt-3 rounded-xl bg-pink-soft px-3 py-2 text-sm font-bold text-danger">Sans SMIC, aucune somme forfaitaire n’est déduite.</p> : null}
      </Card>

      {kids.length === 0 ? (
        <Card>
          <p className="font-bold">Aucun enfant avec un contrat</p>
          <p className="mt-1 text-ink-soft">Créez un contrat dans la gestion : les factures et les présences alimentent ce récapitulatif.</p>
        </Card>
      ) : (
        kids.map((c, index) => {
          const st = states[c.id];
          const r = result.children[index];
          const changed = JSON.stringify(st) !== JSON.stringify(initial[c.id]);
          return (
            <Card key={c.id} className="p-0" tour="i-card">
              <details open={kids.length === 1} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-extrabold">{c.name}</span>
                    <span className="block text-sm text-ink-soft">
                      Reçu {money(r.receivedCents)} · à déclarer <b className="text-gold-deep">{money(r.taxableCents)}</b>
                      {changed ? " · modifié" : ""}
                    </span>
                  </span>
                  <span aria-hidden className="text-xl text-ink-soft transition group-open:rotate-90">
                    ›
                  </span>
                </summary>

                <div className="flex flex-col gap-5 border-t border-line px-5 py-5">
                  <div>
                    <h3 className="font-bold">Jours de garde</h3>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <Field label="Jours de 8 h ou plus" help="tax.fullDays" tour="i-days" name={`full-${c.id}`} value={st.fullDays} onChange={(e) => patch(c.id, { fullDays: e.target.value })} inputMode="numeric" />
                      <Field label="Heures des autres jours" help="tax.partialHours" name={`part-${c.id}`} value={st.partialHours} onChange={(e) => patch(c.id, { partialHours: e.target.value })} inputMode="decimal" hint="Total, ex. 42,5" />
                    </div>
                    <fieldset className="mt-3" data-tour="i-forfait">
                      <legend className="w-full"><span className="flex items-center justify-between gap-2 text-sm font-bold">Somme forfaitaire <HelpButton topic="tax.forfait" /></span></legend>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {([3, 4] as const).map((m) => (
                          <label key={m} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold ${st.multiplier === m ? "border-sun bg-sun-soft" : "border-line"}`}>
                            <input type="radio" name={`mult-${c.id}`} className="size-4 accent-primary" checked={st.multiplier === m} onChange={() => patch(c.id, { multiplier: m })} />
                            {m} × le SMIC
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-soft">
                        <span>4 × pour un enfant donnant droit à une majoration de salaire (handicap, maladie).</span>
                        <HelpButton topic="tax.multiplier" />
                      </p>
                    </fieldset>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Repas fournis par les parents (jours)" help="tax.parentMeal" name={`pm-${c.id}`} value={st.parentMealDays} onChange={(e) => patch(c.id, { parentMealDays: e.target.value })} inputMode="numeric" />
                      <Field label="Ajustement forfait (€)" help="tax.adjust" name={`adj-${c.id}`} value={st.adjustment} onChange={(e) => patch(c.id, { adjustment: e.target.value })} inputMode="decimal" hint="Ex. gardes de 24 h." />
                    </div>
                  </div>

                  {st.estimated.some(Boolean) ? (
                    <p data-tour="i-estimated" className="flex items-start justify-between gap-2 rounded-xl border border-sun/60 bg-sun-soft px-3 py-2 text-sm">
                      <span>✨ <b>{st.estimated.filter(Boolean).length} mois remplis automatiquement</b> d’après le contrat et les présences pointées (mois sans facture validée). Ce sont des <b>estimations</b> : corrigez-les dans le détail ci-dessous, ou validez la facture du mois pour utiliser le montant réel.</span>
                      <HelpButton topic="tax.estimated" />
                    </p>
                  ) : null}

                  <details className="rounded-xl border border-line" data-tour="i-months">
                    <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-bold">
                      <span>Détail par mois de paiement (modifiable)</span>
                      <HelpButton topic="tax.months" />
                    </summary>
                    <div className="overflow-x-auto px-3 pb-3">
                      <table className="w-full min-w-[320px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-ink-soft">
                            <th className="py-2 pr-2 font-bold">Mois</th>
                            <th className="px-1 font-bold">Rémunération €</th>
                            <th className="pl-1 font-bold">Indemnités €</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MONTH_NAMES.map((name, i) => (
                            <tr key={name} className="border-t border-line">
                              <td className="py-1.5 pr-2 capitalize">
                                {name}
                                {st.estimated[i] ? <span className="ml-1 rounded-full bg-sun-soft px-1.5 py-0.5 text-[10px] font-bold normal-case text-ink">estimé</span> : null}
                              </td>
                              <td className="px-1 py-1.5">
                                <input aria-label={`${name} : rémunération`} className={small} inputMode="decimal" value={st.salary[i]} onChange={(e) => setMonth(c.id, "salary", i, e.target.value)} />
                              </td>
                              <td className="pl-1 py-1.5">
                                <input aria-label={`${name} : indemnités`} className={small} inputMode="decimal" value={st.allowance[i]} onChange={(e) => setMonth(c.id, "allowance", i, e.target.value)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  <dl>
                    <Row label="Rémunération" value={money(r.salaryCents)} />
                    <Row label="Indemnités (entretien, repas)" value={money(r.allowanceCents)} />
                    {r.parentMealCents > 0 ? <Row label="Repas fournis par les parents" value={money(r.parentMealCents)} /> : null}
                    <Row label={`Jours équivalents à 8 h`} value={String(r.equivalentDays).replace(".", ",")} />
                    <Row label="Somme forfaitaire déduite" value={`− ${money(r.deductionCents)}`} />
                    <Row label="Part imposable à déclarer" value={money(r.taxableCents)} strong />
                  </dl>

                  {changed ? (
                    <button type="button" onClick={() => setStates((s) => ({ ...s, [c.id]: initial[c.id] }))} className="min-h-11 w-fit text-sm font-bold text-primary underline">
                      Revenir aux valeurs calculées
                    </button>
                  ) : null}

                  <details className="rounded-xl border border-line">
                    <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-bold">📄 Attestation d’accueil pour la famille</summary>
                    <div className="flex flex-col gap-3 px-4 pb-4">
                      <Field label="Nom des parents" name={`fam-${c.id}`} value={st.family} onChange={(e) => patch(c.id, { family: e.target.value })} autoComplete="off" />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Du" name={`from-${c.id}`} type="date" value={st.from} onChange={(e) => patch(c.id, { from: e.target.value })} />
                        <Field label="Au" name={`to-${c.id}`} type="date" value={st.to} onChange={(e) => patch(c.id, { to: e.target.value })} />
                      </div>
                      <Field label="Fait à" name={`place-${c.id}`} value={st.place} onChange={(e) => patch(c.id, { place: e.target.value })} autoComplete="off" />
                      <Field label="Précision (facultatif)" name={`note-${c.id}`} value={st.note} onChange={(e) => patch(c.id, { note: e.target.value })} autoComplete="off" />
                      <p className="text-xs text-ink-soft">
                        {c.daysCount} jour{c.daysCount > 1 ? "s" : ""} d’accueil d’après le journal. Montants repris du détail ci-dessus.
                      </p>
                      <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => attestation(c, index)}>
                        {busy === `att-${c.id}` ? "Préparation…" : "Télécharger l’attestation (PDF)"}
                      </Button>
                    </div>
                  </details>
                </div>
              </details>
            </Card>
          );
        })
      )}

      {kids.length > 0 ? (
        <Card className="border-sun/60" tour="i-outputs">
          <h2 className="flex items-center justify-between gap-2 text-lg font-extrabold">
            <span>Ce que vous reportez dans votre déclaration</span>
            <HelpButton topic="tax.result" />
          </h2>
          <dl className="mt-3" data-tour="i-result">
            <Row label="Montant à déclarer (lignes 1AA à 1DA)" value={money(result.totals.taxableCents)} strong />
            <Row label="Somme forfaitaire déduite (cases 1GA à 1JA)" value={money(result.totals.deductionCents)} />
          </dl>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
            <li>Arrondissez à l’euro sur le formulaire.</li>
            <li>Si votre déclaration est pré-remplie, le montant affiché ne tient pas compte de la part exonérée : corrigez-le avec la part imposable ci-dessus.</li>
            <li>
              Vous pouvez renoncer à ce régime : l’impôt porte alors sur le seul salaire (<b>{money(result.totals.salaryOnlyCents)}</b>), sans les indemnités d’entretien.
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            Règle publiée sur impots.gouv.fr (« Je suis assistant(e) maternel(le). Comment dois-je déclarer mes revenus ? »). Vérifiez les cases et les montants de l’année sur votre déclaration.
          </p>
          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-pink-soft px-3 py-2 text-sm font-bold text-danger">
              {error}
            </p>
          ) : null}
          <p className="mt-4 flex items-center gap-2 text-sm font-bold">
            Vos documents <HelpButton topic="tax.outputs" />
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2" data-tour="i-docs">
            <Button type="button" disabled={busy !== null} onClick={pdfHelp}>
              {busy === "help" ? "Préparation…" : "📄 Télécharger l’aide (PDF)"}
            </Button>
            <Button type="button" variant="ghost" onClick={csv}>
              📊 Exporter le détail (CSV)
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}

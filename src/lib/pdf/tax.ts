import { MONTH_NAMES, type ChildResult, type TaxInput, type TaxParams, type TaxResult } from "@/lib/tax/recap";
import { formatDateFR } from "@/lib/sheet/compute";
import { A4, C, MARGIN, Writer, createDoc, drawBrandHeader, drawRunningHeader, euro, type PdfAssets } from "./kit";

export type CaregiverBlock = { fullName: string; address?: string; phone?: string; email?: string; agreementNumber?: string };

export type TaxPdfData = {
  generatedOn: string;
  year: number;
  caregiver: CaregiverBlock;
  params: TaxParams;
  input: TaxInput;
  result: TaxResult;
};

const hours = (minutes: number) => `${(minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;

function childCard(w: Writer, data: TaxPdfData, index: number) {
  const input = data.input.children[index];
  const r: ChildResult = data.result.children[index];
  const settings = data.params.perChild[r.id];
  // Le tableau mensuel reste d'un seul tenant : si la page ne suffit pas, la fiche passe à la page suivante.
  const monthsWithData = input.months.filter((m) => m.salaryCents !== 0 || m.allowanceCents !== 0).length;
  w.beginCard(index + 1, `${r.name} · ${data.year}`, Math.min(560, 150 + monthsWithData * 27));
  const rows = input.months
    .map((m, i): string[] | null => (m.salaryCents === 0 && m.allowanceCents === 0 ? null : [`${MONTH_NAMES[i]}${m.estimated ? " (estimé)" : ""}`, euro(m.salaryCents), euro(m.allowanceCents), euro(m.salaryCents + m.allowanceCents)]))
    .filter((row): row is string[] => row !== null);
  if (rows.length > 0) {
    w.table(
      [
        { title: "Mois de paiement", width: 150 },
        { title: "Rémunération", width: 110, align: "right" },
        { title: "Indemnités", width: 110, align: "right" },
        { title: "Total", width: 110, align: "right" },
      ],
      rows,
      { totalRow: ["Total de l'année", euro(r.salaryCents), euro(r.allowanceCents), euro(r.salaryCents + r.allowanceCents)] },
    );
  } else {
    w.text("Aucun paiement enregistré pour cette année dans Chez TaTa.", { size: 9.6, color: C.muted });
  }
  w.subhead("Calcul de la somme forfaitaire");
  w.fields(
    [
      ["Jours de 8 h ou plus", String(r.fullDays)],
      ["Heures des autres jours", hours(r.partialMinutes)],
      ["Jours équivalents (÷ 8 h)", String(r.equivalentDays).replace(".", ",")],
      ["Multiplicateur du SMIC", settings?.multiplier === 4 ? "4 fois (majoration de salaire)" : "3 fois"],
      ["Repas fournis par les parents", r.parentMealCents > 0 ? `${settings?.parentMealDays ?? 0} jour(s) · ${euro(r.parentMealCents)}` : "aucun"],
      ["Somme forfaitaire", euro(r.forfaitCents)],
      ["Somme déduite", euro(r.deductionCents)],
      ["Reçu (rémunération + indemnités)", euro(r.receivedCents)],
      ["Part imposable à déclarer", euro(r.taxableCents)],
    ],
    { labelWidth: 190 },
  );
  w.endCard();
}

/** Aide à la déclaration d'impôts : récapitulatif par enfant, calcul de la somme forfaitaire, report dans la déclaration. */
export async function buildTaxHelpPdf(data: TaxPdfData, assets: PdfAssets): Promise<Uint8Array> {
  const { doc, fonts, logo } = await createDoc(assets, {
    title: `Aide à la déclaration d'impôts ${data.year}`,
    subject: `Récapitulatif des revenus d'accueil — année ${data.year}`,
  });
  const w = new Writer(doc, fonts, logo, (writer) => drawRunningHeader(writer, `Aide à la déclaration · revenus ${data.year}`));
  drawBrandHeader(w, {
    kicker: `Assistante maternelle · Revenus ${data.year}`,
    title: "Revenus d'accueil",
    subtitle: "Aide à la déclaration d'impôts",
    meta: [
      ["Année", String(data.year)],
      ["Établi le", formatDateFR(data.generatedOn)],
      ["Assistante", data.caregiver.fullName || "—"],
    ],
  });

  w.beginCard(null, "Assistante maternelle", 80);
  w.fields([
    ["Nom", data.caregiver.fullName],
    ["Adresse", data.caregiver.address],
    ["Téléphone", data.caregiver.phone],
    ["E-mail", data.caregiver.email],
    ["Agrément n°", data.caregiver.agreementNumber],
  ]);
  w.endCard();

  w.beginCard(null, "Synthèse de l'année", 150);
  w.table(
    [
      { title: "Enfant", width: 150 },
      { title: "Reçu", width: 100, align: "right" },
      { title: "Somme déduite", width: 110, align: "right" },
      { title: "À déclarer", width: 100, align: "right" },
    ],
    data.result.children.map((c) => [c.name, euro(c.receivedCents), euro(c.deductionCents), euro(c.taxableCents)]),
    { totalRow: ["Total", euro(data.result.totals.receivedCents), euro(data.result.totals.deductionCents), euro(data.result.totals.taxableCents)] },
  );
  w.endCard();

  w.callout(
    data.result.missingSmic
      ? "Le montant horaire du SMIC n'a pas été renseigné : aucune somme forfaitaire n'est déduite dans ce document. Complétez-le dans Chez TaTa puis régénérez le document."
      : `Somme forfaitaire calculée avec un SMIC horaire de ${euro(data.params.smicHourlyCents)}. Ce montant est à vérifier pour l'année ${data.year}.`,
    data.result.missingSmic ? "pink" : "navy",
    9,
  );

  data.input.children.forEach((_, i) => childCard(w, data, i));

  w.beginCard(null, "Où reporter ces montants", 160);
  w.text(`1. Montant à déclarer : ${euro(data.result.totals.taxableCents)} (arrondi à l'euro : ${Math.round(data.result.totals.taxableCents / 100)} €). À inscrire dans la rubrique « Traitements et salaires » du formulaire n° 2042, lignes 1AA à 1DA lorsque vous êtes employée directement par des particuliers.`, { size: 9.8 });
  w.space(4);
  w.text(`2. Somme forfaitaire déduite : ${euro(data.result.totals.deductionCents)} (arrondie : ${Math.round(data.result.totals.deductionCents / 100)} €). À reporter dans les cases prévues pour la part exonérée (lignes 1GA à 1JA, selon la personne du foyer).`, { size: 9.8 });
  w.space(4);
  w.text("3. Si votre déclaration est pré-remplie, le montant pré-imprimé ne tient pas compte de la part exonérée : il faut le corriger en y inscrivant la part imposable ci-dessus.", { size: 9.8 });
  w.space(4);
  w.text(`Si vous renoncez à ce régime particulier, l'impôt porte sur le seul salaire, sans les indemnités d'entretien : vous soustrayez alors les indemnités du montant déclaré. Dans ce cas, votre salaire de référence dans ce récapitulatif est de ${euro(data.result.totals.salaryOnlyCents)}.`, { size: 9.8, color: C.muted });
  w.endCard();

  w.callout(
    "Document d'aide à la préparation, établi à partir de ce que vous avez saisi dans Chez TaTa et de la règle publiée sur impots.gouv.fr (régime de la somme forfaitaire des assistants maternels). Ce n'est ni une déclaration de revenus ni un justificatif officiel : les bulletins de salaire, les déclarations Pajemploi et votre déclaration pré-remplie font foi. Comparez les montants avec ces documents et corrigez-les si besoin. Les cases et plafonds peuvent changer d'une année à l'autre : vérifiez-les sur impots.gouv.fr.",
    "yellow",
    8.6,
  );
  w.footers(`Aide à la déclaration · revenus ${data.year}`);
  return doc.save();
}

export type AttestationData = {
  generatedOn: string;
  year: number;
  caregiver: CaregiverBlock;
  childName: string;
  parentsNames: string;
  periodFrom: string;
  periodTo: string;
  days: number;
  salaryCents: number;
  allowanceCents: number;
  place?: string;
  note?: string;
};

/** Attestation annuelle d'accueil, sur l'honneur, à remettre à la famille. Tous les champs sont modifiables avant génération. */
export async function buildAttestationPdf(data: AttestationData, assets: PdfAssets): Promise<Uint8Array> {
  const { doc, fonts, logo } = await createDoc(assets, {
    title: `Attestation d'accueil ${data.year} — ${data.childName}`,
    subject: `Attestation annuelle d'accueil — ${data.year}`,
  });
  const w = new Writer(doc, fonts, logo, (writer) => drawRunningHeader(writer, `Attestation d'accueil · ${data.childName}`));
  drawBrandHeader(w, {
    kicker: `Assistante maternelle · Année ${data.year}`,
    title: "Attestation",
    subtitle: "d'accueil · attestation annuelle sur l'honneur",
    meta: [
      ["Enfant accueilli", data.childName],
      ["Année", String(data.year)],
      ["Établie le", formatDateFR(data.generatedOn)],
    ],
  });

  const total = data.salaryCents + data.allowanceCents;
  w.beginCard(1, "Je soussignée", 90);
  w.fields([
    ["Nom", data.caregiver.fullName],
    ["Adresse", data.caregiver.address],
    ["Agrément n°", data.caregiver.agreementNumber],
  ]);
  w.endCard();

  w.beginCard(2, "Atteste avoir accueilli", 110);
  w.fields([
    ["Enfant", data.childName],
    ["Famille", data.parentsNames],
    ["Période", data.periodFrom || data.periodTo ? `du ${formatDateFR(data.periodFrom)} au ${formatDateFR(data.periodTo)}` : ""],
    ["Nombre de jours d'accueil", data.days > 0 ? String(data.days) : ""],
  ]);
  w.endCard();

  w.beginCard(3, `Et avoir perçu au titre de ${data.year}`, 120);
  w.table(
    [
      { title: "Nature", width: 280 },
      { title: "Montant", width: 120, align: "right" },
    ],
    [
      ["Rémunération (salaire net)", euro(data.salaryCents)],
      ["Indemnités (entretien, repas)", euro(data.allowanceCents)],
    ],
    { totalRow: ["Total perçu", euro(total)] },
  );
  if (data.note?.trim()) {
    w.space(4);
    w.text(data.note.trim(), { size: 9.6, color: C.muted });
  }
  w.endCard();

  w.ensure(130);
  w.space(18);
  w.text(`Fait à ${data.place?.trim() || "____________________"}, le ${formatDateFR(data.generatedOn)}`, { size: 10.4 });
  w.space(10);
  const top = w.y;
  w.page.drawRectangle({ x: A4.width - MARGIN.right - 200, y: top - 70, width: 200, height: 70, borderColor: C.line, borderWidth: 1, borderRadius: 8 } as Parameters<typeof w.page.drawRectangle>[0]);
  w.at(w.page, "SIGNATURE", A4.width - MARGIN.right - 188, top - 14, { size: 7.6, font: fonts.heavy, color: C.muted });
  w.y = top - 80;

  w.callout(
    "Attestation sur l'honneur établie par l'assistante maternelle à partir de ses propres enregistrements. Elle ne remplace pas les documents officiels (bulletins de salaire, attestations et déclarations Pajemploi) qui font foi pour la rémunération.",
    "yellow",
    8.6,
  );
  w.footers(`Attestation d'accueil ${data.year} · ${data.childName}`);
  return doc.save();
}

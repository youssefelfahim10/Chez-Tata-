import { type ContractDoc, MEAL_LABELS, type MealKey } from "@/lib/documents/types";
import { formatDateFR, formatDecimalHours } from "@/lib/sheet/compute";
import { monthlyEstimateCents, monthlyMinutes } from "@/lib/finance/summary";
import { C, MARGIN, Writer, createDoc, drawBrandHeader, drawRunningHeader, euro, type PdfAssets } from "./kit";

const hoursLabel = (minutes: number) => `${formatDecimalHours(minutes)} h`;
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Contrat d'accueil : sections en cadres numérotés, repères chiffrés en tête, signatures encadrées. */
export async function buildContractPdf(data: ContractDoc, assets: PdfAssets): Promise<Uint8Array> {
  const { doc, fonts, logo } = await createDoc(assets, {
    title: `Contrat d'accueil — ${data.child.fullName}`,
    subject: "Contrat d'accueil d'un enfant chez une assistante maternelle",
  });
  const w = new Writer(doc, fonts, logo, (writer) => drawRunningHeader(writer, `Contrat d'accueil · ${data.child.fullName}`));
  const t = data.terms;
  const parents = data.parents.names.filter(Boolean);

  drawBrandHeader(w, {
    kicker: "Assistante maternelle · Accueil régulier",
    title: "Contrat d'accueil",
    subtitle: "d'un enfant chez une assistante maternelle",
    meta: [
      ["Enfant accueilli", data.child.fullName],
      ["Début de l'accueil", formatDateFR(t.startDate)],
      ["Établi le", formatDateFR(data.generatedOn)],
    ],
  });

  const monthlyMin = monthlyMinutes({ scheduledHours: t.weeklyMinutes / 60, weeksPerYear: t.weeksPerYear, hourlyRate: 0 });
  const estimate = monthlyEstimateCents({ scheduledHours: t.weeklyMinutes / 60, weeksPerYear: t.weeksPerYear, hourlyRate: t.hourlyNetCents / 100 });

  // Repères chiffrés
  const tiles: [string, string][] = [
    ["Heures par semaine", hoursLabel(t.weeklyMinutes)],
    ["Semaines par an", String(t.weeksPerYear)],
    ["Salaire horaire net", euro(t.hourlyNetCents)],
    ["Mensualité indicative", euro(estimate)],
  ];
  const gap = 8;
  const tileW = (w.contentWidth - gap * 3) / 4;
  const tileTop = w.y;
  tiles.forEach(([label, value], i) => {
    const x = MARGIN.left + i * (tileW + gap);
    w.page.drawRectangle({ x, y: tileTop - 46, width: tileW, height: 46, color: i === 3 ? C.yellowTint : C.navyTint, borderColor: C.line, borderWidth: 0.8, borderRadius: 8 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.at(w.page, label.toUpperCase(), x + tileW / 2, tileTop - 15, { size: 6.6, font: fonts.heavy, color: C.muted, align: "center" });
    w.at(w.page, value, x + tileW / 2, tileTop - 35, { size: 13.5, font: fonts.heavy, color: i === 3 ? C.pink : C.deepNavy, align: "center" });
  });
  w.y = tileTop - 52;
  w.text("Entre les soussignés :", { size: 9.6, color: C.muted });

  // 1. Parties
  w.beginCard(1, "Les parties");
  w.subhead("L'assistante maternelle");
  w.fields([
    ["Nom et prénom", data.employee.fullName],
    ["Adresse", data.employee.address],
    ["Téléphone", data.employee.phone],
    ["E-mail", data.employee.email],
    ["N° d'agrément", data.employee.agrementNumber],
    ["Date de l'agrément", data.employee.agrementDate ? formatDateFR(data.employee.agrementDate) : ""],
    ["Assurance responsabilité civile", [data.employee.insurer, data.employee.policyNumber && `contrat n° ${data.employee.policyNumber}`].filter(Boolean).join(" · ")],
  ]);
  w.subhead(parents.length > 1 ? "Les parents (employeurs)" : "Le parent (employeur)");
  w.fields([
    ["Nom et prénom", parents.join(" et ")],
    ["Adresse", data.parents.address],
    ["Téléphone", data.parents.phone],
    ["E-mail", data.parents.email],
  ]);

  // 2. L'enfant
  w.beginCard(2, "L'enfant accueilli");
  w.fields([
    ["Nom et prénom", data.child.fullName],
    ["Date de naissance", data.child.birthDate ? formatDateFR(data.child.birthDate) : ""],
  ]);

  // 3. Début et nature
  w.beginCard(3, "Début et nature de l'accueil");
  w.fields([["Début de l'accueil", formatDateFR(t.startDate)]]);
  w.space(3);
  w.checkbox("Accueil régulier sur l'année complète (52 semaines)", t.contractType === "annee_complete");
  w.checkbox(`Accueil régulier sur une année incomplète (${t.weeksPerYear} semaines d'accueil par an)`, t.contractType === "annee_incomplete");
  w.space(4);
  w.fields([
    ["Période d'adaptation", t.adaptation],
    ["Période d'essai", t.trial],
  ]);

  // 4. Planning
  w.beginCard(4, "Planning d'accueil", data.schedule.length > 0 ? 24 + Math.min(data.schedule.length, 2) * 25.2 : 60);
  if (data.schedule.length > 0) {
    const durations = data.schedule.map((d) => Math.max(0, toMinutes(d.to) - toMinutes(d.from)));
    w.table(
      [
        { title: "Jour", width: 120 },
        { title: "Arrivée", width: 100, align: "center" },
        { title: "Départ", width: 100, align: "center" },
        { title: "Durée", width: 100, align: "right" },
      ],
      data.schedule.map((d, i) => [d.day, d.from.replace(":", " h "), d.to.replace(":", " h "), hoursLabel(durations[i])]),
      { totalRow: ["Total hebdomadaire", "", "", hoursLabel(durations.reduce((a, b) => a + b, 0))] },
    );
  } else {
    w.text("Planning à compléter : jours et horaires d'accueil convenus entre les parties.", { color: C.muted, size: 9.6 });
    for (let i = 0; i < 3; i += 1) {
      w.space(15);
      w.page.drawLine({ start: { x: w.left, y: w.y }, end: { x: w.left + w.width, y: w.y }, thickness: 0.6, color: C.line, dashArray: [2, 2.5] });
    }
    w.space(4);
  }
  w.text("Les horaires peuvent être modifiés d'un commun accord ; toute modification est confirmée par écrit.", { size: 8.8, color: C.muted });

  // 5. Mensualisation
  w.beginCard(5, "Mensualisation", 120);
  w.fields(
    [
      ["Heures d'accueil par semaine", hoursLabel(t.weeklyMinutes)],
      ["Semaines d'accueil par an", String(t.weeksPerYear)],
      ["Heures mensualisées", hoursLabel(monthlyMin)],
      ["Rémunération mensuelle de base", `${euro(estimate)} nets (indicatif)`],
    ],
    { labelWidth: 176 },
  );
  w.callout("Calcul indicatif : heures par semaine × semaines d'accueil ÷ 12, multiplié par le salaire horaire net. Le salaire effectivement versé et déclaré (Pajemploi) fait foi.", "navy");

  // 6. Rémunération
  w.beginCard(6, "Rémunération", 80);
  w.fields([["Salaire horaire net", euro(t.hourlyNetCents)]]);
  w.space(3);
  w.checkbox("Les heures complémentaires sont rémunérées au tarif horaire normal", Boolean(t.overtimeNormalRate));
  w.space(3);
  w.fields([["Majoration des heures majorées", t.majorationPercent ? `${t.majorationPercent} %` : ""]], { labelWidth: 170 });

  // 7. Indemnités
  w.beginCard(7, "Indemnités", 60);
  w.fields([
    ["Indemnité d'entretien", t.maintenanceCents ? `${euro(t.maintenanceCents)} par jour d'accueil` : ""],
    ["Indemnité de repas", t.mealCents ? `${euro(t.mealCents)} par repas fourni` : ""],
    ["Indemnités kilométriques", "Sans objet"],
  ]);

  // 8. Repas et quotidien
  w.beginCard(8, "Repas, soins et quotidien", 215);
  w.text("Repas fournis par l'assistante maternelle", { font: fonts.bold, size: 9.6, color: C.navy });
  w.space(3);
  (Object.keys(MEAL_LABELS) as MealKey[]).forEach((k) => w.checkbox(MEAL_LABELS[k], data.care.meals.includes(k)));
  w.space(6);
  w.text("Couches et produits d'hygiène fournis par", { font: fonts.bold, size: 9.6, color: C.navy });
  w.space(3);
  w.checkbox("Les parents", data.care.diapers === "parents");
  w.checkbox("L'assistante maternelle", data.care.diapers === "assmat");
  if (data.care.notes?.trim()) {
    w.space(5);
    w.fields([["Précisions", data.care.notes]]);
  }
  w.callout("Les parents informent l'assistante maternelle de tout élément utile à la santé et au bien-être de l'enfant (allergies, traitements, habitudes). Aucun médicament n'est donné sans ordonnance.", "yellow");

  // 9. Congés et absences
  w.beginCard(9, "Congés et absences", 70);
  w.text("Les dates de congés de l'assistante maternelle et celles des parents sont communiquées à l'avance et par écrit, dans le respect de la convention collective. Les parents préviennent l'assistante maternelle dès qu'ils connaissent l'absence de l'enfant.", { size: 9.6 });
  if (data.leaveNotes?.trim()) {
    w.space(5);
    w.fields([["Dispositions convenues", data.leaveNotes]]);
  }

  // 10. Assurances
  w.beginCard(10, "Assurances et responsabilité", 60);
  w.text("L'assistante maternelle déclare être couverte par une assurance de responsabilité civile professionnelle. Les parents déclarent être couverts par une assurance de responsabilité civile pour leur enfant.", { size: 9.6 });

  // 11. Rupture
  w.beginCard(11, "Rupture du contrat", 80);
  w.text("Le contrat peut être rompu selon les règles de la convention collective nationale des assistants maternels du particulier employeur et du Code de l'action sociale et des familles.", { size: 9.6 });
  w.space(4);
  w.fields([["Préavis convenu", t.notice]]);

  // 12. Données personnelles
  w.beginCard(12, "Données personnelles", 70);
  w.text("Les informations de ce contrat servent uniquement à organiser l'accueil de l'enfant et à établir les documents qui s'y rattachent. Elles ne sont pas communiquées à des tiers sans nécessité et peuvent être consultées ou rectifiées sur demande.", { size: 9.6 });
  w.endCard();

  // Signatures : cadre dédié, lieu et date, puis deux zones de signature.
  w.beginCard(null, "Signatures", 210);
  w.text("Fait en deux exemplaires originaux, un pour chaque partie.", { size: 9.4, color: C.muted });
  w.space(8);
  const rowTop = w.y;
  w.at(w.page, "Fait à", w.left, rowTop - 10, { size: 10, font: fonts.bold, color: C.deepNavy });
  w.page.drawLine({ start: { x: w.left + 34, y: rowTop - 12 }, end: { x: w.left + w.width * 0.55, y: rowTop - 12 }, thickness: 0.6, color: C.line, dashArray: [2, 2.5] });
  w.at(w.page, "Le", w.left + w.width * 0.6, rowTop - 10, { size: 10, font: fonts.bold, color: C.deepNavy });
  w.page.drawLine({ start: { x: w.left + w.width * 0.6 + 16, y: rowTop - 12 }, end: { x: w.left + w.width, y: rowTop - 12 }, thickness: 0.6, color: C.line, dashArray: [2, 2.5] });
  w.y = rowTop - 26;

  const gapS = 12;
  const boxW = (w.width - gapS) / 2;
  const boxTop = w.y;
  const boxH = 112;
  [
    [w.left, parents.length > 1 ? "Les parents" : "Le parent"],
    [w.left + boxW + gapS, "L'assistante maternelle"],
  ].forEach(([x, title]) => {
    const bx = x as number;
    w.page.drawRectangle({ x: bx, y: boxTop - boxH, width: boxW, height: boxH, color: C.white } as Parameters<typeof w.page.drawRectangle>[0]);
    w.page.drawRectangle({ x: bx, y: boxTop - 26, width: boxW, height: 26, color: C.navyTint, borderRadius: 8 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.page.drawRectangle({ x: bx, y: boxTop - 26, width: boxW, height: 13, color: C.navyTint });
    w.page.drawRectangle({ x: bx + 10, y: boxTop - 20, width: 3, height: 14, color: C.yellow });
    w.at(w.page, title as string, bx + 20, boxTop - 16.5, { size: 9.8, font: fonts.heavy, color: C.deepNavy });
    w.at(w.page, "Lu et approuvé, bon pour accord", bx + 12, boxTop - 40, { size: 8.2, color: C.muted });
    w.page.drawLine({ start: { x: bx + 12, y: boxTop - boxH + 20 }, end: { x: bx + boxW - 12, y: boxTop - boxH + 20 }, thickness: 0.6, color: C.line, dashArray: [2, 2.5] });
    w.at(w.page, "Signature", bx + 12, boxTop - boxH + 8, { size: 7.2, color: C.muted });
    // bordure dessinée en dernier : elle reste entière
    w.page.drawRectangle({ x: bx, y: boxTop - boxH, width: boxW, height: boxH, borderColor: C.navy, borderWidth: 1.1, borderRadius: 8 } as Parameters<typeof w.page.drawRectangle>[0]);
  });
  w.y = boxTop - boxH - 6;
  w.endCard();

  w.callout("Document généré par Chez TaTa à partir des informations saisies. Il doit être relu et validé par les parties avant signature et ne constitue pas un conseil juridique. Références utiles : convention collective nationale des assistants maternels du particulier employeur, Service-Public.fr, Pajemploi.", "yellow", 8.4);

  w.footers(`Contrat d'accueil · ${data.child.fullName}`);
  return doc.save();
}

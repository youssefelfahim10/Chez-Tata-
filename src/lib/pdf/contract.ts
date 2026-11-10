import { type ContractDoc, MEAL_LABELS, type MealKey } from "@/lib/documents/types";
import { formatDateFR, formatDecimalHours } from "@/lib/sheet/compute";
import { monthlyEstimateCents, monthlyMinutes } from "@/lib/finance/summary";
import { A4, C, MARGIN, Writer, createDoc, drawBrandHeader, drawRunningHeader, euro, type FontBytes } from "./kit";

const hoursLabel = (minutes: number) => `${formatDecimalHours(minutes)} h`;

/** Contrat d'accueil d'un enfant : mise en page soignée, champs manquants laissés à compléter. */
export async function buildContractPdf(data: ContractDoc, fontBytes: FontBytes): Promise<Uint8Array> {
  const { doc, fonts } = await createDoc(fontBytes, {
    title: `Contrat d'accueil — ${data.child.fullName}`,
    subject: "Contrat d'accueil d'un enfant chez une assistante maternelle",
  });
  const w = new Writer(doc, fonts, (writer) => drawRunningHeader(writer, `Contrat d'accueil · ${data.child.fullName}`));
  drawBrandHeader(w, {
    kicker: "Assistante maternelle · Accueil régulier",
    title: "Contrat d'accueil d'un enfant",
    right: [`${data.child.fullName}`, `Établi le ${formatDateFR(data.generatedOn)}`],
  });

  const t = data.terms;
  const weeklyH = t.weeklyMinutes;
  const monthlyMin = monthlyMinutes({ scheduledHours: weeklyH / 60, weeksPerYear: t.weeksPerYear, hourlyRate: 0 });
  const estimate = monthlyEstimateCents({ scheduledHours: weeklyH / 60, weeksPerYear: t.weeksPerYear, hourlyRate: t.hourlyNetCents / 100 });
  const parents = data.parents.names.filter(Boolean);

  w.text("Entre les soussignés :", { size: 10, color: C.muted });

  // 1. Parties
  w.article(1, "Les parties");
  w.text("L'assistante maternelle", { font: fonts.heavy, size: 10.4, color: C.green });
  w.space(2);
  w.fields([
    ["Nom et prénom", data.employee.fullName],
    ["Adresse", data.employee.address],
    ["Téléphone", data.employee.phone],
    ["E-mail", data.employee.email],
    ["N° d'agrément", data.employee.agrementNumber],
    ["Date de l'agrément", data.employee.agrementDate ? formatDateFR(data.employee.agrementDate) : ""],
    ["Assurance responsabilité civile", [data.employee.insurer, data.employee.policyNumber && `contrat n° ${data.employee.policyNumber}`].filter(Boolean).join(" · ")],
  ]);
  w.space(8);
  w.text(parents.length > 1 ? "Les parents (employeurs)" : "Le parent (employeur)", { font: fonts.heavy, size: 10.4, color: C.green });
  w.space(2);
  w.fields([
    ["Nom et prénom", parents.join(" et ")],
    ["Adresse", data.parents.address],
    ["Téléphone", data.parents.phone],
    ["E-mail", data.parents.email],
  ]);

  // 2. L'enfant
  w.article(2, "L'enfant accueilli");
  w.fields([
    ["Nom et prénom", data.child.fullName],
    ["Date de naissance", data.child.birthDate ? formatDateFR(data.child.birthDate) : ""],
  ]);

  // 3. Durée
  w.article(3, "Début et nature de l'accueil");
  w.fields([["Début de l'accueil", formatDateFR(t.startDate)]]);
  w.space(2);
  w.checkbox("Accueil régulier sur l'année complète (52 semaines)", t.contractType === "annee_complete");
  w.checkbox(`Accueil régulier sur une année incomplète (${t.weeksPerYear} semaines d'accueil par an)`, t.contractType === "annee_incomplete");
  w.space(4);
  w.fields([
    ["Période d'adaptation", t.adaptation],
    ["Période d'essai", t.trial],
  ]);

  // 4. Planning
  w.article(4, "Planning d'accueil", data.schedule.length > 0 ? 24 + Math.min(data.schedule.length, 2) * 25.2 : 60);
  if (data.schedule.length > 0) {
    w.table(
      [
        { title: "Jour", width: 120 },
        { title: "Arrivée", width: 100, align: "center" },
        { title: "Départ", width: 100, align: "center" },
        { title: "Durée", width: 100, align: "right" },
      ],
      data.schedule.map((d) => {
        const [fh, fm] = d.from.split(":").map(Number);
        const [th, tm] = d.to.split(":").map(Number);
        const mins = Math.max(0, th * 60 + tm - (fh * 60 + fm));
        return [d.day, d.from.replace(":", " h "), d.to.replace(":", " h "), hoursLabel(mins)];
      }),
      { totalRow: ["Total hebdomadaire", "", "", hoursLabel(data.schedule.reduce((s, d) => {
        const [fh, fm] = d.from.split(":").map(Number);
        const [th, tm] = d.to.split(":").map(Number);
        return s + Math.max(0, th * 60 + tm - (fh * 60 + fm));
      }, 0))] },
    );
  } else {
    w.text("Planning à compléter : jours et horaires d'accueil convenus entre les parties.", { color: C.muted, size: 9.6 });
    w.space(6);
    for (let i = 0; i < 3; i += 1) {
      w.ensure(18);
      w.rule(C.line, 0.6);
      w.space(16);
    }
  }
  w.text("Les horaires peuvent être modifiés d'un commun accord ; toute modification est confirmée par écrit.", { size: 9, color: C.muted });

  // 5. Mensualisation
  w.article(5, "Mensualisation");
  w.fields([
    ["Heures d'accueil par semaine", hoursLabel(weeklyH)],
    ["Semaines d'accueil par an", String(t.weeksPerYear)],
    ["Heures mensualisées", hoursLabel(monthlyMin)],
    ["Rémunération mensuelle de base", `${euro(estimate)} nets (indicatif)`],
  ]);
  w.callout("Calcul indicatif : heures par semaine × semaines d'accueil ÷ 12, multiplié par le salaire horaire net. Le salaire effectivement versé et déclaré (Pajemploi) fait foi.");

  // 6. Rémunération
  w.article(6, "Rémunération");
  w.fields([["Salaire horaire net", euro(t.hourlyNetCents)]]);
  w.space(2);
  w.checkbox("Les heures complémentaires sont rémunérées au tarif horaire normal", Boolean(t.overtimeNormalRate));
  w.fields([["Majoration des heures majorées", t.majorationPercent ? `${t.majorationPercent} %` : ""]], { labelWidth: 190 });

  // 7. Indemnités
  w.article(7, "Indemnités");
  w.fields([
    ["Indemnité d'entretien", t.maintenanceCents ? `${euro(t.maintenanceCents)} par jour d'accueil` : ""],
    ["Indemnité de repas", t.mealCents ? `${euro(t.mealCents)} par repas fourni` : ""],
    ["Indemnités kilométriques", "Sans objet"],
  ]);

  // 8. Repas et soins
  w.article(8, "Repas, soins et quotidien");
  w.text("Repas fournis par l'assistante maternelle :", { font: fonts.bold, size: 9.6 });
  w.space(2);
  (Object.keys(MEAL_LABELS) as MealKey[]).forEach((k) => w.checkbox(MEAL_LABELS[k], data.care.meals.includes(k)));
  w.space(4);
  w.text("Couches et produits d'hygiène fournis par :", { font: fonts.bold, size: 9.6 });
  w.space(2);
  w.checkbox("Les parents", data.care.diapers === "parents");
  w.checkbox("L'assistante maternelle", data.care.diapers === "assmat");
  if (data.care.notes?.trim()) {
    w.space(4);
    w.fields([["Précisions", data.care.notes]]);
  }
  w.callout("Les parents informent l'assistante maternelle de tout élément utile à la santé et au bien-être de l'enfant (allergies, traitements, habitudes). Aucun médicament n'est donné sans ordonnance.", "orange");

  // 9. Congés et absences
  w.article(9, "Congés et absences");
  w.text(
    "Les dates de congés de l'assistante maternelle et celles des parents sont communiquées à l'avance et par écrit, dans le respect de la convention collective. Les parents préviennent l'assistante maternelle dès qu'ils connaissent l'absence de l'enfant.",
    { size: 9.8 },
  );
  if (data.leaveNotes?.trim()) {
    w.space(4);
    w.fields([["Dispositions convenues", data.leaveNotes]]);
  }

  // 10. Assurances
  w.article(10, "Assurances et responsabilité");
  w.text(
    "L'assistante maternelle déclare être couverte par une assurance de responsabilité civile professionnelle. Les parents déclarent être couverts par une assurance de responsabilité civile pour leur enfant.",
    { size: 9.8 },
  );

  // 11. Rupture
  w.article(11, "Rupture du contrat");
  w.text("Le contrat peut être rompu selon les règles de la convention collective nationale des assistants maternels du particulier employeur et du Code de l'action sociale et des familles.", { size: 9.8 });
  w.space(3);
  w.fields([["Préavis convenu", t.notice]]);

  // 12. Données personnelles
  w.article(12, "Données personnelles");
  w.text(
    "Les informations de ce contrat servent uniquement à organiser l'accueil de l'enfant et à établir les documents qui s'y rattachent. Elles ne sont pas communiquées à des tiers sans nécessité et peuvent être consultées ou rectifiées sur demande.",
    { size: 9.8 },
  );

  // Signatures
  w.ensure(150);
  w.space(16);
  const top = w.y;
  w.at(w.page, "Fait en deux exemplaires, à ______________________, le ____ / ____ / ________", MARGIN.left, top - 10, { size: 10, font: fonts.bold });
  const boxW = (w.contentWidth - 16) / 2;
  const boxTop = top - 26;
  const boxH = 100;
  [
    [MARGIN.left, parents.length > 1 ? "Les parents" : "Le parent"],
    [MARGIN.left + boxW + 16, "L'assistante maternelle"],
  ].forEach(([x, title]) => {
    w.page.drawRectangle({ x: x as number, y: boxTop - boxH, width: boxW, height: boxH, color: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 10 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.at(w.page, title as string, (x as number) + 12, boxTop - 18, { size: 10, font: fonts.heavy, color: C.greenDeep });
    w.at(w.page, "Lu et approuvé, bon pour accord", (x as number) + 12, boxTop - 31, { size: 8.4, color: C.muted });
    w.page.drawLine({ start: { x: (x as number) + 12, y: boxTop - boxH + 16 }, end: { x: (x as number) + boxW - 12, y: boxTop - boxH + 16 }, thickness: 0.6, color: C.line, dashArray: [2, 2] });
    w.at(w.page, "Signature", (x as number) + 12, boxTop - boxH + 6, { size: 7.4, color: C.muted });
  });
  w.y = boxTop - boxH - 14;

  w.callout(
    "Document généré par Chez TaTa à partir des informations saisies. Il doit être relu et validé par les parties avant signature et ne constitue pas un conseil juridique. Références utiles : convention collective nationale des assistants maternels du particulier employeur, Service-Public.fr, Pajemploi.",
    "orange",
    8.4,
  );

  w.footers(`Chez TaTa · Contrat d'accueil · ${data.child.fullName}`);
  void A4;
  return doc.save();
}

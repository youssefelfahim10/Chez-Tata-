import { type InvoiceDoc } from "@/lib/documents/types";
import { formatDateFR } from "@/lib/sheet/compute";
import { A4, C, MARGIN, Writer, clipped, createDoc, drawBrandHeader, drawRunningHeader, euro, type PdfAssets } from "./kit";

/** Facture mensuelle, émise au moment où le paiement est reçu. */
export async function buildInvoicePdf(data: InvoiceDoc, assets: PdfAssets): Promise<Uint8Array> {
  const { doc, fonts, logo } = await createDoc(assets, {
    title: `Facture ${data.number} — ${data.childName}`,
    subject: `Facture d'accueil — ${data.periodLabel}`,
  });
  const w = new Writer(doc, fonts, logo, (writer) => drawRunningHeader(writer, `Facture ${data.number}`));
  drawBrandHeader(w, {
    kicker: `Accueil de l'enfant · ${data.periodLabel}`,
    title: "Facture",
    subtitle: "Paiement reçu — récapitulatif de la période",
    meta: [
      ["Numéro", data.number],
      ["Émise le", formatDateFR(data.issuedOn)],
      ["Période", data.periodLabel],
    ],
  });

  // Deux cadres : émetteur / destinataire
  const gap = 14;
  const colW = (w.contentWidth - gap) / 2;
  const top = w.y;
  const h = 100;
  const infoCard = (x: number, title: string, rows: string[]) => {
    w.page.drawRectangle({ x, y: top - h, width: colW, height: h, color: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 9 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.page.drawRectangle({ x, y: top - 26, width: colW, height: 26, color: C.navyTint, borderRadius: 9 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.page.drawRectangle({ x, y: top - 26, width: colW, height: 13, color: C.navyTint });
    w.page.drawRectangle({ x: x + 12, y: top - 21, width: 3, height: 16, color: C.yellow });
    w.at(w.page, title.toUpperCase(), x + 22, top - 17, { size: 8.6, font: fonts.heavy, color: C.pink });
    let yy = top - 44;
    rows.filter(Boolean).slice(0, 5).forEach((row, i) => {
      const lines = row.length > 44 ? [row.slice(0, 44), row.slice(44, 88)] : [row];
      lines.forEach((line) => {
        w.at(w.page, line, x + 14, yy, { size: i === 0 ? 11.4 : 9, font: i === 0 ? fonts.heavy : fonts.regular, color: i === 0 ? C.deepNavy : C.muted });
        yy -= i === 0 ? 15 : 12.4;
      });
    });
  };
  infoCard(MARGIN.left, "Émetteur", [data.employee.fullName, data.employee.address ?? "", data.employee.phone ?? "", data.employee.agrementNumber ? `Agrément n° ${data.employee.agrementNumber}` : ""]);
  infoCard(MARGIN.left + colW + gap, "Facturé à", [data.parents.names.filter(Boolean).join(" et "), data.parents.address ?? "", `Enfant accueilli : ${data.childName}`]);
  w.y = top - h - 14;

  // Bandeau de repères
  const barTop = w.y;
  const cells: [string, string][] = [
    ["Enfant accueilli", data.childName],
    ["Période", data.periodLabel],
    ["Reçu le", formatDateFR(data.paidOn)],
    ["Mode de paiement", data.paymentMethod],
  ];
  w.page.drawRectangle({ x: MARGIN.left, y: barTop - 42, width: w.contentWidth, height: 42, color: C.navyTint, borderColor: C.line, borderWidth: 0.8, borderRadius: 8 } as Parameters<typeof w.page.drawRectangle>[0]);
  cells.forEach(([label, value], i) => {
    const cw = w.contentWidth / cells.length;
    const x = MARGIN.left + i * cw;
    if (i > 0) w.page.drawLine({ start: { x, y: barTop - 8 }, end: { x, y: barTop - 34 }, thickness: 0.6, color: C.line });
    w.at(w.page, label.toUpperCase(), x + 12, barTop - 15, { size: 6.6, font: fonts.heavy, color: C.muted });
    w.at(w.page, value, x + 12, barTop - 31, { size: 10.4, font: fonts.heavy, color: C.deepNavy });
  });
  w.y = barTop - 48;

  // Détail
  w.beginCard(null, "Détail de la période", 120);
  w.table(
    [
      { title: "Désignation", width: 230 },
      { title: "Détail du calcul", width: 180 },
      { title: "Montant", width: 90, align: "right" },
    ],
    data.lines.map((l) => [l.label, l.detail ?? "", euro(l.amountCents)]),
    { totalRow: ["Total", "", euro(data.totalCents)] },
  );
  w.endCard();

  // Bandeau « payée »
  w.ensure(116);
  w.space(14);
  const bt = w.y;
  const bh = 84;
  w.page.drawRectangle({ x: MARGIN.left, y: bt - bh, width: w.contentWidth, height: bh, color: C.navy, borderRadius: 12 } as Parameters<typeof w.page.drawRectangle>[0]);
  clipped(w.page, MARGIN.left + 120, bt - bh, w.contentWidth - 240, bh, () => {
    w.page.drawCircle({ x: A4.width / 2 + 40, y: bt - bh / 2, size: 40, color: C.deepNavy, opacity: 0.7 });
    w.page.drawCircle({ x: A4.width / 2 - 30, y: bt - bh / 2 + 22, size: 11, color: C.pink, opacity: 0.8 });
    w.page.drawCircle({ x: A4.width / 2 - 6, y: bt - bh / 2 - 26, size: 7, color: C.yellow, opacity: 0.9 });
  });
  w.page.drawCircle({ x: MARGIN.left + 40, y: bt - bh / 2, size: 20, color: C.white });
  w.check(w.page, MARGIN.left + 30, bt - bh / 2 - 5, 19, C.green, 0.17);
  w.at(w.page, "FACTURE PAYÉE", MARGIN.left + 74, bt - 31, { size: 9, font: fonts.heavy, color: C.yellow });
  w.at(w.page, `Reçu le ${formatDateFR(data.paidOn)}`, MARGIN.left + 74, bt - 48, { size: 11.2, font: fonts.heavy, color: C.white });
  w.at(w.page, `${data.paymentMethod} · Merci pour votre confiance`, MARGIN.left + 74, bt - 64, { size: 9, color: C.white });
  w.at(w.page, euro(data.totalCents), A4.width - MARGIN.right - 20, bt - 52, { size: 26, font: fonts.heavy, color: C.white, align: "right" });
  w.page.drawRectangle({ x: A4.width - MARGIN.right - 20 - 70, y: bt - 62, width: 70, height: 3.2, color: C.yellow });
  w.y = bt - bh - 8;

  w.callout("Document récapitulatif établi par l'assistante maternelle à la réception du paiement. Il ne remplace ni le bulletin de salaire ni la déclaration Pajemploi, qui font foi pour la rémunération.", "yellow", 8.6);

  w.footers(`Facture ${data.number} · ${data.periodLabel}`);
  return doc.save();
}

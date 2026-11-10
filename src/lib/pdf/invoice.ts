import { type InvoiceDoc } from "@/lib/documents/types";
import { formatDateFR } from "@/lib/sheet/compute";
import { A4, C, MARGIN, Writer, clipped, createDoc, drawBrandHeader, drawRunningHeader, euro, type FontBytes } from "./kit";

/** Facture mensuelle, émise au moment où le paiement est reçu. */
export async function buildInvoicePdf(data: InvoiceDoc, fontBytes: FontBytes): Promise<Uint8Array> {
  const { doc, fonts } = await createDoc(fontBytes, {
    title: `Facture ${data.number} — ${data.childName}`,
    subject: `Facture d'accueil — ${data.periodLabel}`,
  });
  const w = new Writer(doc, fonts, (writer) => drawRunningHeader(writer, `Facture ${data.number}`));
  drawBrandHeader(w, {
    kicker: `Accueil de l'enfant · ${data.periodLabel}`,
    title: "Facture",
    right: [data.number, `Émise le ${formatDateFR(data.issuedOn)}`],
  });

  const colW = (w.contentWidth - 16) / 2;
  const cardTop = w.y;
  const cardH = 112;
  const card = (x: number, title: string, rows: string[]) => {
    w.page.drawRectangle({ x, y: cardTop - cardH, width: colW, height: cardH, color: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 10 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.page.drawRectangle({ x: x + 14, y: cardTop - 10, width: 34, height: 3, color: C.orange, borderRadius: 1.5 } as Parameters<typeof w.page.drawRectangle>[0]);
    w.at(w.page, title.toUpperCase(), x + 14, cardTop - 24, { size: 8, font: fonts.heavy, color: C.green });
    let yy = cardTop - 42;
    rows.filter(Boolean).slice(0, 5).forEach((row, i) => {
      const lines = row.length > 46 ? [row.slice(0, 46), row.slice(46, 92)] : [row];
      lines.forEach((line) => {
        w.at(w.page, line, x + 14, yy, { size: i === 0 ? 11 : 9, font: i === 0 ? fonts.heavy : fonts.regular, color: i === 0 ? C.ink : C.muted });
        yy -= i === 0 ? 15 : 12.4;
      });
    });
  };
  card(MARGIN.left, "Émetteur", [
    data.employee.fullName,
    data.employee.address ?? "",
    data.employee.phone ?? "",
    data.employee.agrementNumber ? `Agrément n° ${data.employee.agrementNumber}` : "",
  ]);
  card(MARGIN.left + colW + 16, "Facturé à", [data.parents.names.filter(Boolean).join(" et "), data.parents.address ?? "", `Enfant accueilli : ${data.childName}`]);
  w.y = cardTop - cardH - 18;

  w.text("Détail de la période", { font: fonts.heavy, size: 12, color: C.greenDeep });
  w.space(4);
  w.table(
    [
      { title: "Désignation", width: 250 },
      { title: "Détail", width: 160 },
      { title: "Montant", width: 90, align: "right" },
    ],
    data.lines.map((l) => [l.label, l.detail ?? "", euro(l.amountCents)]),
    { totalRow: ["Total", "", euro(data.totalCents)] },
  );

  // Bloc « payée »
  w.ensure(120);
  w.space(10);
  const top = w.y;
  const h = 78;
  w.page.drawRectangle({ x: MARGIN.left, y: top - h, width: w.contentWidth, height: h, color: C.green, borderRadius: 12 } as Parameters<typeof w.page.drawRectangle>[0]);
  clipped(w.page, MARGIN.left + 90, top - h, w.contentWidth - 180, h, () => {
    w.page.drawCircle({ x: A4.width - MARGIN.right - 150, y: top - h / 2, size: 34, color: C.greenDeep, opacity: 0.45 });
    w.page.drawCircle({ x: A4.width - MARGIN.right - 190, y: top - h / 2 + 18, size: 12, color: C.orange, opacity: 0.5 });
  });
  // Pastille de validation (coche vectorielle)
  w.page.drawCircle({ x: MARGIN.left + 36, y: top - h / 2, size: 17, color: C.white });
  w.check(w.page, MARGIN.left + 27, top - h / 2 - 4, 17, C.green);
  w.at(w.page, "PAYÉE", MARGIN.left + 66, top - 30, { size: 9, font: fonts.heavy, color: rgbSoft() });
  w.at(w.page, `Reçu le ${formatDateFR(data.paidOn)} · ${data.paymentMethod}`, MARGIN.left + 66, top - 46, { size: 10.2, font: fonts.bold, color: C.white });
  w.at(w.page, "Merci pour votre confiance.", MARGIN.left + 66, top - 62, { size: 9, color: C.white });
  w.at(w.page, euro(data.totalCents), A4.width - MARGIN.right - 18, top - 49, { size: 23, font: fonts.heavy, color: C.white, align: "right" });
  w.y = top - h - 16;

  w.callout("Document récapitulatif établi par l'assistante maternelle à la réception du paiement. Il ne remplace ni le bulletin de salaire ni la déclaration Pajemploi, qui font foi pour la rémunération.", "orange", 8.6);

  w.footers(`Chez TaTa · Facture ${data.number} · ${data.periodLabel}`);
  return doc.save();
}

function rgbSoft() {
  return C.greenSoft;
}

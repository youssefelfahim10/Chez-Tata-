import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

/** Palette Chez TaTa, déclinée pour l'impression (contrastes sûrs sur papier). */
export const C = {
  ink: rgb(0.094, 0.204, 0.18), // #18342e
  muted: rgb(0.376, 0.459, 0.435), // #60756f
  green: rgb(0.086, 0.463, 0.365), // #16765d
  greenDeep: rgb(0.059, 0.361, 0.275), // #0f5c46
  greenSoft: rgb(0.914, 0.973, 0.933), // #e9f8ee
  orange: rgb(0.945, 0.604, 0.216), // #f19a37
  orangeSoft: rgb(1, 0.957, 0.878), // #fff4e0
  pink: rgb(0.988, 0.914, 0.933), // #fce9ee
  line: rgb(0.859, 0.914, 0.875), // #dbe9df
  paper: rgb(0.99, 0.992, 0.985),
  white: rgb(1, 1, 1),
};

export const A4 = { width: 595.276, height: 841.89 };
export const MARGIN = { left: 48, right: 48, top: 48, bottom: 56 };

/** Dessine dans un rectangle : tout ce qui dépasse est rogné (formes décoratives qui ne débordent jamais). */
export function clipped(page: PDFPage, x: number, y: number, width: number, height: number, draw: () => void) {
  page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
  draw();
  page.pushOperators(popGraphicsState());
}

export type FontBytes = { regular: Uint8Array; bold: Uint8Array; heavy: Uint8Array };
export type Fonts = { regular: PDFFont; bold: PDFFont; heavy: PDFFont };

export async function createDoc(bytes: FontBytes, meta: { title: string; subject: string }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(bytes.regular, { subset: true }),
    bold: await doc.embedFont(bytes.bold, { subset: true }),
    heavy: await doc.embedFont(bytes.heavy, { subset: true }),
  };
  doc.setTitle(meta.title);
  doc.setSubject(meta.subject);
  doc.setAuthor("Chez TaTa");
  doc.setCreator("Chez TaTa");
  doc.setProducer("Chez TaTa");
  return { doc, fonts };
}

const REPLACEMENTS: Record<string, string> = { " ": " ", " ": " ", " ": " ", "‑": "-", "–": "–", "→": "->", "✓": "x", "​": "" };

/** Remplace les caractères que la police ne sait pas dessiner (émojis, symboles rares) au lieu de faire échouer le PDF. */
export function sanitize(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const replaced = REPLACEMENTS[ch] ?? ch;
    for (const c of replaced) {
      const cp = c.codePointAt(0)!;
      if (c === "\n" || supported.has(cp)) out += c;
      else out += "";
    }
  }
  return out;
}

/** Coupe un texte en lignes qui tiennent dans `maxWidth` (mots trop longs coupés). Pure : testable avec une fausse mesure. */
export function wrapLines(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      let piece = word;
      while (measure(piece) > maxWidth && piece.length > 1) {
        // Mot plus large que la ligne : on le découpe.
        let cut = piece.length - 1;
        while (cut > 1 && measure(piece.slice(0, cut)) > maxWidth) cut -= 1;
        if (current) {
          lines.push(current);
          current = "";
        }
        lines.push(piece.slice(0, cut));
        piece = piece.slice(cut);
      }
      const candidate = current ? `${current} ${piece}` : piece;
      if (measure(candidate) <= maxWidth) current = candidate;
      else {
        lines.push(current);
        current = piece;
      }
    }
    lines.push(current);
  }
  return lines;
}

type TextOpts = { size?: number; font?: PDFFont; color?: RGB; maxWidth?: number; lineHeight?: number; align?: "left" | "right" | "center" };

/**
 * Rédacteur de document : gère la position, les sauts de page, les titres, paragraphes, tableaux et signatures.
 * Les pieds de page (numéros) sont ajoutés à la fin, quand le nombre de pages est connu.
 */
export class Writer {
  page: PDFPage;
  y: number;
  readonly contentWidth = A4.width - MARGIN.left - MARGIN.right;
  private pages: PDFPage[] = [];

  constructor(
    public readonly doc: PDFDocument,
    public readonly fonts: Fonts,
    private readonly onNewPage?: (writer: Writer, pageIndex: number) => void,
  ) {
    this.page = this.addPage();
    this.y = A4.height - MARGIN.top;
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([A4.width, A4.height]);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: C.paper });
    this.pages.push(page);
    return page;
  }

  get pageCount() {
    return this.pages.length;
  }
  allPages() {
    return this.pages;
  }

  newPage() {
    this.page = this.addPage();
    this.y = A4.height - MARGIN.top;
    this.onNewPage?.(this, this.pages.length - 1);
  }

  /** S'assure qu'il reste `height` points ; sinon, nouvelle page. */
  ensure(height: number) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  space(points: number) {
    this.y -= points;
  }

  text(raw: string, opts: TextOpts & { x?: number } = {}): number {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 10;
    const lineHeight = opts.lineHeight ?? size * 1.45;
    const x = opts.x ?? MARGIN.left;
    const maxWidth = opts.maxWidth ?? this.contentWidth - (x - MARGIN.left);
    const text = sanitize(raw, font);
    const lines = wrapLines(text, (s) => font.widthOfTextAtSize(s, size), maxWidth);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      let drawX = x;
      const w = font.widthOfTextAtSize(line, size);
      if (opts.align === "right") drawX = x + maxWidth - w;
      if (opts.align === "center") drawX = x + (maxWidth - w) / 2;
      this.page.drawText(line, { x: drawX, y: this.y + size * 0.28, size, font, color: opts.color ?? C.ink });
    }
    return lines.length;
  }

  /** Dessine un texte à une position absolue (sans toucher à la position courante). */
  at(page: PDFPage, raw: string, x: number, y: number, opts: Omit<TextOpts, "maxWidth" | "lineHeight"> = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 10;
    const text = sanitize(raw, font).replace(/\n/g, " ");
    const w = font.widthOfTextAtSize(text, size);
    const drawX = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
    page.drawText(text, { x: drawX, y, size, font, color: opts.color ?? C.ink });
    return w;
  }

  width(raw: string, font: PDFFont, size: number) {
    return font.widthOfTextAtSize(sanitize(raw, font), size);
  }

  rule(color: RGB = C.line, thickness = 0.8) {
    this.page.drawLine({ start: { x: MARGIN.left, y: this.y }, end: { x: A4.width - MARGIN.right, y: this.y }, thickness, color });
  }

  /** Titre d'article : pastille numérotée + intitulé, avec filet. */
  article(num: number, title: string, keepWith = 0) {
    // Le titre reste avec son contenu : si `keepWith` ne tient pas sur la page, on passe à la suivante.
    this.ensure(54 + keepWith);
    this.space(11);
    const y = this.y;
    this.page.drawCircle({ x: MARGIN.left + 11, y: y - 4, size: 11, color: C.green });
    this.at(this.page, String(num), MARGIN.left + 11, y - 7.6, { size: 11, font: this.fonts.heavy, color: C.white, align: "center" });
    this.at(this.page, title.toUpperCase(), MARGIN.left + 30, y - 7.4, { size: 11.5, font: this.fonts.heavy, color: C.greenDeep });
    this.y = y - 20;
    this.page.drawLine({ start: { x: MARGIN.left, y: this.y }, end: { x: A4.width - MARGIN.right, y: this.y }, thickness: 1.2, color: C.greenSoft });
    this.space(4);
  }

  /** Lignes « libellé : valeur » ; une valeur absente reste un blanc à compléter à la main. */
  fields(rows: [string, string | undefined | null][], opts: { labelWidth?: number } = {}) {
    const labelWidth = opts.labelWidth ?? 150;
    for (const [label, value] of rows) {
      const valueText = value && value.trim() ? value : "";
      const font = valueText ? this.fonts.bold : this.fonts.regular;
      const lines = wrapLines(sanitize(valueText, font), (s) => font.widthOfTextAtSize(s, 10), this.contentWidth - labelWidth - 6);
      const height = Math.max(1, lines.length) * 13.8;
      this.ensure(height + 2);
      const top = this.y;
      this.at(this.page, label, MARGIN.left, top - 11, { size: 9.5, color: C.muted });
      if (valueText) {
        let yy = top - 11;
        for (const line of lines) {
          this.page.drawText(line, { x: MARGIN.left + labelWidth, y: yy, size: 10, font: this.fonts.bold, color: C.ink });
          yy -= 13.8;
        }
      } else {
        // Blanc à compléter à la main : on n'invente rien.
        this.page.drawLine({
          start: { x: MARGIN.left + labelWidth, y: top - 12.5 },
          end: { x: A4.width - MARGIN.right, y: top - 12.5 },
          thickness: 0.6,
          color: C.line,
          dashArray: [2, 2],
        });
      }
      this.y = top - height;
    }
  }

  /** Encadré coloré avec du texte. */
  callout(raw: string, tone: "green" | "orange" = "green", size = 9.2) {
    const font = this.fonts.regular;
    const padX = 12;
    const padY = 9;
    const lines = wrapLines(sanitize(raw, font), (s) => font.widthOfTextAtSize(s, size), this.contentWidth - padX * 2);
    const lineHeight = size * 1.45;
    const height = lines.length * lineHeight + padY * 2;
    this.ensure(height + 6);
    this.space(4);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN.left,
      y: top - height,
      width: this.contentWidth,
      height,
      color: tone === "green" ? C.greenSoft : C.orangeSoft,
      borderColor: tone === "green" ? C.line : rgb(0.98, 0.84, 0.6),
      borderWidth: 0.8,
      borderRadius: 8,
    } as Parameters<PDFPage["drawRectangle"]>[0]);
    let yy = top - padY - size;
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN.left + padX, y: yy + 2, size, font, color: C.ink });
      yy -= lineHeight;
    }
    this.y = top - height - 6;
  }

  /** Coche vectorielle (les polices ne contiennent pas « ✓ »). */
  check(page: PDFPage, x: number, y: number, size: number, color: RGB = C.green) {
    page.drawLine({ start: { x, y: y + size * 0.45 }, end: { x: x + size * 0.38, y }, thickness: size * 0.16, color });
    page.drawLine({ start: { x: x + size * 0.38, y }, end: { x: x + size, y: y + size * 0.85 }, thickness: size * 0.16, color });
  }

  /** Case à cocher imprimée : cochée ou vide. */
  checkbox(label: string, checked: boolean, opts: { x?: number; width?: number } = {}) {
    const x = opts.x ?? MARGIN.left;
    const size = 9.6;
    const font = checked ? this.fonts.bold : this.fonts.regular;
    const lines = wrapLines(sanitize(label, font), (s) => font.widthOfTextAtSize(s, size), (opts.width ?? this.contentWidth) - 22);
    const height = lines.length * 13.5 + 2;
    this.ensure(height);
    const top = this.y;
    this.page.drawRectangle({ x, y: top - 11.5, width: 10, height: 10, borderColor: checked ? C.green : C.muted, borderWidth: 1, color: checked ? C.greenSoft : C.white, borderRadius: 2 } as Parameters<PDFPage["drawRectangle"]>[0]);
    if (checked) this.check(this.page, x + 1.8, top - 9.3, 6.6);
    let yy = top - 10.2;
    for (const line of lines) {
      this.page.drawText(line, { x: x + 16, y: yy, size, font, color: C.ink });
      yy -= 13.5;
    }
    this.y = top - height;
  }

  /** Tableau simple : en-tête coloré, lignes alternées. Reste d'un seul tenant s'il tient sur une page. */
  table(columns: { title: string; width: number; align?: "left" | "right" | "center" }[], rows: string[][], opts: { totalRow?: string[] } = {}) {
    const headH = 24;
    const pad = 8;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const scale = this.contentWidth / total;
    const widths = columns.map((c) => c.width * scale);
    const measureRow = (cells: string[], strong: boolean) => {
      const font = strong ? this.fonts.heavy : this.fonts.regular;
      const wrapped = cells.map((cell, i) => wrapLines(sanitize(cell, font), (s) => font.widthOfTextAtSize(s, 9.6), widths[i] - pad * 2));
      return { wrapped, height: Math.max(...wrapped.map((l) => l.length)) * 13.2 + 12, font };
    };
    const measured = rows.map((r) => measureRow(r, false));
    const totalMeasured = opts.totalRow ? measureRow(opts.totalRow, true) : null;
    // On ne commence un tableau que si l'en-tête et au moins deux lignes tiennent (pas d'en-tête orphelin).
    const startBlock = headH + (measured[0]?.height ?? 0) + (measured[1]?.height ?? 0);
    if (this.y - startBlock < MARGIN.bottom) this.newPage();

    const drawHead = () => {
      this.ensure(headH + 30);
      const top = this.y;
      this.page.drawRectangle({ x: MARGIN.left, y: top - headH, width: this.contentWidth, height: headH, color: C.green, borderRadius: 6 } as Parameters<PDFPage["drawRectangle"]>[0]);
      let x = MARGIN.left;
      columns.forEach((c, i) => {
        const align = c.align ?? "left";
        const cx = align === "right" ? x + widths[i] - pad : align === "center" ? x + widths[i] / 2 : x + pad;
        this.at(this.page, c.title, cx, top - 15.5, { size: 8.8, font: this.fonts.heavy, color: C.white, align });
        x += widths[i];
      });
      this.y = top - headH;
    };
    drawHead();
    const drawRow = (m: { wrapped: string[][]; height: number; font: PDFFont }, index: number, strong = false, keepAfter = 0) => {
      // La dernière ligne reste avec la ligne de total (jamais de total seul sur une page).
      if (this.y - (m.height + keepAfter) < MARGIN.bottom) {
        this.newPage();
        drawHead();
      }
      const top = this.y;
      if (strong) this.page.drawRectangle({ x: MARGIN.left, y: top - m.height, width: this.contentWidth, height: m.height, color: C.orangeSoft });
      else if (index % 2 === 1) this.page.drawRectangle({ x: MARGIN.left, y: top - m.height, width: this.contentWidth, height: m.height, color: C.greenSoft });
      let x = MARGIN.left;
      m.wrapped.forEach((lines, i) => {
        const align = columns[i].align ?? "left";
        let yy = top - 15;
        for (const line of lines) {
          const w = m.font.widthOfTextAtSize(line, 9.6);
          const dx = align === "right" ? x + widths[i] - pad - w : align === "center" ? x + (widths[i] - w) / 2 : x + pad;
          this.page.drawText(line, { x: dx, y: yy, size: 9.6, font: m.font, color: C.ink });
          yy -= 13.2;
        }
        x += widths[i];
      });
      this.page.drawLine({ start: { x: MARGIN.left, y: top - m.height }, end: { x: A4.width - MARGIN.right, y: top - m.height }, thickness: 0.5, color: C.line });
      this.y = top - m.height;
    };
    measured.forEach((m, i) => drawRow(m, i, false, i === measured.length - 1 ? (totalMeasured?.height ?? 0) : 0));
    if (totalMeasured) drawRow(totalMeasured, 0, true);
    this.space(4);
  }

  /** Pieds de page sur toutes les pages : filet, mention, numéro. */
  footers(left: string) {
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      page.drawLine({ start: { x: MARGIN.left, y: 38 }, end: { x: A4.width - MARGIN.right, y: 38 }, thickness: 0.6, color: C.line });
      this.at(page, left, MARGIN.left, 24, { size: 7.8, color: C.muted });
      this.at(page, `Page ${i + 1} / ${total}`, A4.width - MARGIN.right, 24, { size: 7.8, color: C.muted, align: "right" });
    });
  }
}

/** Bandeau d'en-tête de marque : bande verte, liseré orange, formes douces rognées, titre du document. */
export function drawBrandHeader(w: Writer, opts: { kicker: string; title: string; right?: string[] }) {
  const { page } = w;
  const h = 132;
  const top = A4.height;
  page.drawRectangle({ x: 0, y: top - h, width: A4.width, height: h, color: C.green });
  clipped(page, 0, top - h, A4.width, h, () => {
    page.drawCircle({ x: A4.width - 70, y: top - 14, size: 100, color: C.greenDeep, opacity: 0.55 });
    page.drawCircle({ x: A4.width - 170, y: top - 128, size: 54, color: C.orange, opacity: 0.3 });
    page.drawCircle({ x: 18, y: top - 126, size: 34, color: C.white, opacity: 0.09 });
  });
  page.drawRectangle({ x: 0, y: top - h - 5, width: A4.width, height: 5, color: C.orange });

  // Marque
  page.drawRectangle({ x: MARGIN.left, y: top - 66, width: 34, height: 34, color: C.white, borderRadius: 10 } as Parameters<PDFPage["drawRectangle"]>[0]);
  w.at(page, "T", MARGIN.left + 17, top - 57.6, { size: 21, font: w.fonts.heavy, color: C.green, align: "center" });
  page.drawCircle({ x: MARGIN.left + 30, y: top - 35, size: 4.2, color: C.orange });
  w.at(page, "Chez TaTa", MARGIN.left + 46, top - 54, { size: 19, font: w.fonts.heavy, color: C.white });
  w.at(page, "Moins d'administratif, plus de temps pour les enfants", MARGIN.left + 46, top - 67, { size: 7.8, color: C.white });

  w.at(page, opts.kicker.toUpperCase(), MARGIN.left, top - 98, { size: 8.2, font: w.fonts.bold, color: rgb(0.78, 0.94, 0.86) });
  w.at(page, opts.title, MARGIN.left, top - 120, { size: 20, font: w.fonts.heavy, color: C.white });
  (opts.right ?? []).forEach((line, i) => w.at(page, line, A4.width - MARGIN.right, top - 46 - i * 14, { size: i === 0 ? 12 : 8.8, font: i === 0 ? w.fonts.heavy : w.fonts.regular, color: C.white, align: "right" }));
  w.y = top - h - 24;
}

/** Petit en-tête des pages suivantes. */
export function drawRunningHeader(w: Writer, label: string) {
  const { page } = w;
  page.drawRectangle({ x: 0, y: A4.height - 30, width: A4.width, height: 30, color: C.green });
  page.drawRectangle({ x: 0, y: A4.height - 33, width: A4.width, height: 3, color: C.orange });
  w.at(page, "Chez TaTa", MARGIN.left, A4.height - 20, { size: 10.5, font: w.fonts.heavy, color: C.white });
  w.at(page, label, A4.width - MARGIN.right, A4.height - 20, { size: 8.4, color: C.white, align: "right" });
  w.y = A4.height - 56;
}

export const euro = (cents: number) => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  return `${sign}${whole},${String(abs % 100).padStart(2, "0")} €`;
};

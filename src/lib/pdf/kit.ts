import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, appendBezierCurve, clip, closePath, endPath, lineTo, moveTo, popGraphicsState, pushGraphicsState, rectangle, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

/** Palette Chez TaTa, relevée sur le logo : marine, rose, jaune, vert. Fond blanc, teintes très claires. */
export const C = {
  navy: rgb(0.024, 0.216, 0.486), // #06377c
  deepNavy: rgb(0.004, 0.153, 0.373), // #01275f
  pink: rgb(0.929, 0.075, 0.349), // #ed1359
  yellow: rgb(0.992, 0.722, 0.012), // #fdb803
  green: rgb(0.231, 0.635, 0.122), // #3ba21f
  ink: rgb(0.059, 0.122, 0.239), // #0f1f3d
  muted: rgb(0.357, 0.42, 0.55), // #5b6b8c
  line: rgb(0.835, 0.871, 0.941), // #d5deef
  navyTint: rgb(0.933, 0.953, 0.984), // #eef3fb
  pinkTint: rgb(1, 0.941, 0.961), // #fff0f5
  yellowTint: rgb(1, 0.973, 0.882), // #fff8e1
  greenTint: rgb(0.925, 0.973, 0.906), // #ecf8e7
  white: rgb(1, 1, 1),
};

export const A4 = { width: 595.276, height: 841.89 };
export const MARGIN = { left: 44, right: 44, top: 44, bottom: 58 };

export type PdfAssets = { regular: Uint8Array; bold: Uint8Array; heavy: Uint8Array; logo: Uint8Array };
export type Fonts = { regular: PDFFont; bold: PDFFont; heavy: PDFFont };

export async function createDoc(assets: PdfAssets, meta: { title: string; subject: string }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(assets.regular, { subset: true }),
    bold: await doc.embedFont(assets.bold, { subset: true }),
    heavy: await doc.embedFont(assets.heavy, { subset: true }),
  };
  const logo = await doc.embedPng(assets.logo);
  doc.setTitle(meta.title);
  doc.setSubject(meta.subject);
  doc.setAuthor("Chez TaTa");
  doc.setCreator("Chez TaTa");
  doc.setProducer("Chez TaTa");
  return { doc, fonts, logo };
}

/** Dessine dans un rectangle : tout ce qui dépasse est rogné. */
export function clipped(page: PDFPage, x: number, y: number, width: number, height: number, draw: () => void) {
  page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
  draw();
  page.pushOperators(popGraphicsState());
}

/** Dessine dans un rectangle à coins arrondis (logo, vignettes). */
export function roundedClip(page: PDFPage, x: number, y: number, width: number, height: number, radius: number, draw: () => void) {
  const k = radius * 0.5523;
  const r = radius;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y),
    lineTo(x + width - r, y),
    appendBezierCurve(x + width - r + k, y, x + width, y + r - k, x + width, y + r),
    lineTo(x + width, y + height - r),
    appendBezierCurve(x + width, y + height - r + k, x + width - r + k, y + height, x + width - r, y + height),
    lineTo(x + r, y + height),
    appendBezierCurve(x + r - k, y + height, x, y + height - r + k, x, y + height - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
    closePath(),
    clip(),
    endPath(),
  );
  draw();
  page.pushOperators(popGraphicsState());
}

const REPLACEMENTS: Record<string, string> = { " ": " ", " ": " ", " ": " ", "‑": "-", "→": "->", "✓": "x", "​": "" };

/** Retire les caractères que la police ne sait pas dessiner (émojis, symboles rares) au lieu de faire échouer le PDF. */
export function sanitize(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text.normalize("NFC")) {
    for (const c of REPLACEMENTS[ch] ?? ch) {
      if (c === "\n" || supported.has(c.codePointAt(0)!)) out += c;
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
type RectOpts = Parameters<PDFPage["drawRectangle"]>[0];
const rounded = (o: RectOpts & { borderRadius?: number }) => o as RectOpts;

const CARD_PAD = 14;
const CARD_HEAD = 28;

/**
 * Rédacteur de document : sections en cadres, champs, cases à cocher, tableaux, encadrés.
 * Les cadres se prolongent proprement d'une page à l'autre. Les pieds de page sont posés à la fin.
 */
export class Writer {
  page: PDFPage;
  y: number;
  indent = 0;
  readonly contentWidth = A4.width - MARGIN.left - MARGIN.right;
  private pages: PDFPage[] = [];
  private card: { num: number | null; title: string; startY: number } | null = null;

  constructor(
    public readonly doc: PDFDocument,
    public readonly fonts: Fonts,
    public readonly logo: PDFImage,
    private readonly runningHeader: (writer: Writer) => void,
  ) {
    this.page = this.addPage();
    this.y = A4.height - MARGIN.top;
  }

  get left() {
    return MARGIN.left + this.indent;
  }
  get width() {
    return this.contentWidth - this.indent * 2;
  }
  get pageCount() {
    return this.pages.length;
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([A4.width, A4.height]);
    this.pages.push(page);
    return page;
  }

  newPage() {
    const card = this.card;
    if (card) this.strokeCard(card.startY, this.y - 6);
    this.page = this.addPage();
    this.runningHeader(this);
    if (card) {
      this.card = { ...card, startY: this.y };
      this.drawCardHead(card.num, `${card.title} (suite)`);
    }
  }

  /** S'assure qu'il reste `height` points ; sinon, nouvelle page. */
  ensure(height: number) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }
  space(points: number) {
    this.y -= points;
  }

  // ---------- Cadres de section ----------

  private drawCardHead(num: number | null, title: string) {
    const x = MARGIN.left;
    const top = this.y;
    this.page.drawRectangle(rounded({ x, y: top - CARD_HEAD, width: this.contentWidth, height: CARD_HEAD, color: C.navyTint, borderRadius: 8 }));
    this.page.drawRectangle({ x, y: top - CARD_HEAD, width: this.contentWidth, height: CARD_HEAD / 2, color: C.navyTint });
    this.page.drawRectangle({ x: x + 14, y: top - CARD_HEAD + 6, width: 3, height: CARD_HEAD - 12, color: C.yellow });
    if (num !== null) {
      this.page.drawCircle({ x: x + 36, y: top - CARD_HEAD / 2, size: 9.5, color: C.pink });
      this.at(this.page, String(num), x + 36, top - CARD_HEAD / 2 - 3.4, { size: 10, font: this.fonts.heavy, color: C.white, align: "center" });
    }
    this.at(this.page, title.toUpperCase(), x + (num !== null ? 53 : 28), top - CARD_HEAD / 2 - 3.6, { size: 10.2, font: this.fonts.heavy, color: C.deepNavy });
    this.y = top - CARD_HEAD - 7;
    this.indent = CARD_PAD;
  }

  private strokeCard(startY: number, endY: number) {
    this.page.drawRectangle(rounded({ x: MARGIN.left, y: endY, width: this.contentWidth, height: startY - endY, borderColor: C.line, borderWidth: 1, borderRadius: 8 }));
  }

  /** Ouvre un cadre de section : bandeau titre (numéro rose) puis contenu à l'intérieur du cadre. */
  beginCard(num: number | null, title: string, keepWith = 0) {
    this.endCard();
    this.ensure(CARD_HEAD + 34 + keepWith);
    this.space(10);
    this.card = { num, title, startY: this.y };
    this.drawCardHead(num, title);
  }

  endCard() {
    if (!this.card) return;
    this.space(4);
    this.strokeCard(this.card.startY, this.y);
    this.card = null;
    this.indent = 0;
    this.space(2);
  }

  // ---------- Texte ----------

  text(raw: string, opts: TextOpts & { x?: number } = {}): number {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 10;
    const lineHeight = opts.lineHeight ?? size * 1.45;
    const x = opts.x ?? this.left;
    const maxWidth = opts.maxWidth ?? this.width - (x - this.left);
    const lines = wrapLines(sanitize(raw, font), (s) => font.widthOfTextAtSize(s, size), maxWidth);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      const w = font.widthOfTextAtSize(line, size);
      const drawX = opts.align === "right" ? x + maxWidth - w : opts.align === "center" ? x + (maxWidth - w) / 2 : x;
      this.page.drawText(line, { x: drawX, y: this.y + size * 0.28, size, font, color: opts.color ?? C.ink });
    }
    return lines.length;
  }

  /** Texte à une position absolue (sans toucher à la position courante). */
  at(page: PDFPage, raw: string, x: number, y: number, opts: Omit<TextOpts, "maxWidth" | "lineHeight"> = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 10;
    const text = sanitize(raw, font).replace(/\n/g, " ");
    const w = font.widthOfTextAtSize(text, size);
    const drawX = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
    page.drawText(text, { x: drawX, y, size, font, color: opts.color ?? C.ink });
    return w;
  }

  width_(raw: string, font: PDFFont, size: number) {
    return font.widthOfTextAtSize(sanitize(raw, font), size);
  }

  /** Sous-titre dans un cadre. */
  subhead(raw: string) {
    this.ensure(26);
    this.space(6);
    this.text(raw, { font: this.fonts.heavy, size: 10.2, color: C.pink });
    this.space(1);
  }

  /** Lignes « libellé : valeur » ; une valeur absente reste un blanc à compléter à la main. */
  fields(rows: [string, string | undefined | null][], opts: { labelWidth?: number } = {}) {
    const labelWidth = opts.labelWidth ?? 138;
    for (const [label, value] of rows) {
      const valueText = value && value.trim() ? value : "";
      const font = valueText ? this.fonts.bold : this.fonts.regular;
      const lines = wrapLines(sanitize(valueText, font), (s) => font.widthOfTextAtSize(s, 10), this.width - labelWidth - 4);
      const height = Math.max(1, lines.length) * 13.6 + 1.5;
      this.ensure(height + 2);
      const top = this.y;
      this.at(this.page, label, this.left, top - 11, { size: 9.2, color: C.muted });
      if (valueText) {
        let yy = top - 11;
        for (const line of lines) {
          this.page.drawText(line, { x: this.left + labelWidth, y: yy, size: 10, font: this.fonts.bold, color: C.deepNavy });
          yy -= 13.6;
        }
      } else {
        this.page.drawLine({ start: { x: this.left + labelWidth, y: top - 12.6 }, end: { x: this.left + this.width, y: top - 12.6 }, thickness: 0.6, color: C.line, dashArray: [2, 2.5] });
      }
      this.y = top - height;
    }
  }

  /** Encadré teinté avec barre d'accent à gauche. */
  callout(raw: string, tone: "navy" | "yellow" | "pink" = "navy", size = 9) {
    const font = this.fonts.regular;
    const padX = 14;
    const padY = 9;
    const lines = wrapLines(sanitize(raw, font), (s) => font.widthOfTextAtSize(s, size), this.width - padX * 2 - 4);
    const lineHeight = size * 1.45;
    const height = lines.length * lineHeight + padY * 2;
    this.ensure(height + 8);
    this.space(6);
    const top = this.y;
    const fill = tone === "yellow" ? C.yellowTint : tone === "pink" ? C.pinkTint : C.navyTint;
    const accent = tone === "yellow" ? C.yellow : tone === "pink" ? C.pink : C.navy;
    this.page.drawRectangle(rounded({ x: this.left, y: top - height, width: this.width, height, color: fill, borderRadius: 6 }));
    this.page.drawRectangle({ x: this.left, y: top - height + 3, width: 3.5, height: height - 6, color: accent });
    let yy = top - padY - size;
    for (const line of lines) {
      this.page.drawText(line, { x: this.left + padX + 3, y: yy + 2, size, font, color: C.ink });
      yy -= lineHeight;
    }
    this.y = top - height - 4;
  }

  /** Coche vectorielle (les polices ne contiennent pas « ✓ »). */
  check(page: PDFPage, x: number, y: number, size: number, color: RGB = C.green, thickness = 0.16) {
    page.drawLine({ start: { x, y: y + size * 0.45 }, end: { x: x + size * 0.38, y }, thickness: size * thickness, color });
    page.drawLine({ start: { x: x + size * 0.38, y }, end: { x: x + size, y: y + size * 0.85 }, thickness: size * thickness, color });
  }

  /** Case à cocher imprimée : cochée (vert) ou vide. */
  checkbox(label: string, checked: boolean, opts: { x?: number; width?: number } = {}) {
    const x = opts.x ?? this.left;
    const size = 9.6;
    const font = checked ? this.fonts.bold : this.fonts.regular;
    const lines = wrapLines(sanitize(label, font), (s) => font.widthOfTextAtSize(s, size), (opts.width ?? this.width) - 22);
    const height = lines.length * 13.5 + 3;
    this.ensure(height);
    const top = this.y;
    this.page.drawRectangle(rounded({ x, y: top - 12, width: 10.5, height: 10.5, borderColor: checked ? C.green : C.muted, borderWidth: 1, color: checked ? C.greenTint : C.white, borderRadius: 2.5 }));
    if (checked) this.check(this.page, x + 1.9, top - 9.6, 6.8);
    let yy = top - 10.2;
    for (const line of lines) {
      this.page.drawText(line, { x: x + 17, y: yy, size, font, color: C.ink });
      yy -= 13.5;
    }
    this.y = top - height;
  }

  /** Tableau : en-tête marine, lignes séparées, total en jaune. Jamais d'en-tête ni de total orphelin. */
  table(columns: { title: string; width: number; align?: "left" | "right" | "center" }[], rows: string[][], opts: { totalRow?: string[] } = {}) {
    const headH = 24;
    const pad = 8;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * this.width);
    const measureRow = (cells: string[], strong: boolean) => {
      const font = strong ? this.fonts.heavy : this.fonts.regular;
      const wrapped = cells.map((cell, i) => wrapLines(sanitize(cell, font), (s) => font.widthOfTextAtSize(s, 9.6), widths[i] - pad * 2));
      return { wrapped, height: Math.max(...wrapped.map((l) => l.length)) * 13.2 + 12, font };
    };
    const measured = rows.map((r) => measureRow(r, false));
    const totalMeasured = opts.totalRow ? measureRow(opts.totalRow, true) : null;
    const startBlock = headH + (measured[0]?.height ?? 0) + (measured[1]?.height ?? 0);
    this.ensure(startBlock + 6);

    const left = this.left;
    const drawHead = () => {
      this.ensure(headH + 30);
      const top = this.y;
      this.page.drawRectangle(rounded({ x: left, y: top - headH, width: this.width, height: headH, color: C.navy, borderRadius: 6 }));
      let x = left;
      columns.forEach((c, i) => {
        const align = c.align ?? "left";
        const cx = align === "right" ? x + widths[i] - pad : align === "center" ? x + widths[i] / 2 : x + pad;
        this.at(this.page, c.title, cx, top - 15.6, { size: 8.8, font: this.fonts.heavy, color: C.white, align });
        x += widths[i];
      });
      this.y = top - headH;
    };
    drawHead();
    const drawRow = (m: { wrapped: string[][]; height: number; font: PDFFont }, index: number, strong = false, keepAfter = 0) => {
      if (this.y - (m.height + keepAfter) < MARGIN.bottom) {
        this.newPage();
        drawHead();
      }
      const top = this.y;
      if (strong) this.page.drawRectangle({ x: left, y: top - m.height, width: this.width, height: m.height, color: C.yellowTint });
      else if (index % 2 === 1) this.page.drawRectangle({ x: left, y: top - m.height, width: this.width, height: m.height, color: C.navyTint });
      let x = left;
      m.wrapped.forEach((lines, i) => {
        const align = columns[i].align ?? "left";
        let yy = top - 15;
        for (const line of lines) {
          const w = m.font.widthOfTextAtSize(line, 9.6);
          const dx = align === "right" ? x + widths[i] - pad - w : align === "center" ? x + (widths[i] - w) / 2 : x + pad;
          this.page.drawText(line, { x: dx, y: yy, size: 9.6, font: m.font, color: strong ? C.deepNavy : C.ink });
          yy -= 13.2;
        }
        x += widths[i];
      });
      this.page.drawLine({ start: { x: left, y: top - m.height }, end: { x: left + this.width, y: top - m.height }, thickness: strong ? 1.2 : 0.5, color: strong ? C.yellow : C.line });
      this.y = top - m.height;
    };
    measured.forEach((m, i) => drawRow(m, i, false, i === measured.length - 1 ? (totalMeasured?.height ?? 0) : 0));
    if (totalMeasured) drawRow(totalMeasured, 0, true);
    this.space(4);
  }

  /** Pieds de page : filet, signature de la marque, référence, numéro. */
  footers(reference: string) {
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      page.drawLine({ start: { x: MARGIN.left, y: 40 }, end: { x: A4.width - MARGIN.right, y: 40 }, thickness: 0.7, color: C.line });
      page.drawRectangle({ x: MARGIN.left, y: 39.2, width: 36, height: 1.6, color: C.yellow });
      this.at(page, "Chez TaTa", MARGIN.left, 25, { size: 8.4, font: this.fonts.heavy, color: C.navy });
      this.at(page, "· L'application des assistantes maternelles & MAM", MARGIN.left + 44, 25, { size: 7.8, color: C.muted });
      this.at(page, reference, A4.width / 2 + 60, 25, { size: 7.8, color: C.muted, align: "center" });
      this.at(page, `Page ${i + 1} / ${total}`, A4.width - MARGIN.right, 25, { size: 8, font: this.fonts.bold, color: C.navy, align: "right" });
    });
  }
}

/** En-tête de première page : liseré tricolore, logo, titre, bloc de références encadré. */
export function drawBrandHeader(w: Writer, opts: { kicker: string; title: string; subtitle?: string; meta: [string, string][] }) {
  const { page } = w;
  const top = A4.height;
  page.drawRectangle({ x: 0, y: top - 9, width: A4.width, height: 9, color: C.navy });
  page.drawRectangle({ x: A4.width - 150, y: top - 9, width: 60, height: 9, color: C.yellow });
  page.drawRectangle({ x: A4.width - 90, y: top - 9, width: 90, height: 9, color: C.pink });

  const logo = 78;
  roundedClip(page, MARGIN.left, top - 28 - logo, logo, logo, 17, () => page.drawImage(w.logo, { x: MARGIN.left, y: top - 28 - logo, width: logo, height: logo }));
  page.drawRectangle({ x: MARGIN.left, y: top - 28 - logo, width: logo, height: logo, borderColor: C.line, borderWidth: 0.8, borderRadius: 17 } as Parameters<PDFPage["drawRectangle"]>[0]);
  const tx = MARGIN.left + logo + 18;
  w.at(page, opts.kicker.toUpperCase(), tx, top - 52, { size: 8.6, font: w.fonts.heavy, color: C.pink });
  w.at(page, opts.title, tx, top - 80, { size: 25, font: w.fonts.heavy, color: C.deepNavy });
  if (opts.subtitle) w.at(page, opts.subtitle, tx, top - 96, { size: 9.6, color: C.muted });
  page.drawRectangle(rounded({ x: tx, y: top - 108, width: 64, height: 3.6, color: C.yellow, borderRadius: 1.8 }));

  // Bloc de références
  const boxW = 168;
  const boxH = 18 + opts.meta.length * 27;
  const bx = A4.width - MARGIN.right - boxW;
  const by = top - 30 - boxH;
  page.drawRectangle(rounded({ x: bx, y: by, width: boxW, height: boxH, color: C.navyTint, borderColor: C.line, borderWidth: 1, borderRadius: 9 }));
  opts.meta.forEach(([label, value], i) => {
    const yy = by + boxH - 20 - i * 27;
    w.at(page, label.toUpperCase(), bx + 12, yy + 3, { size: 6.6, font: w.fonts.heavy, color: C.muted });
    w.at(page, value, bx + 12, yy - 8.5, { size: i === 0 ? 11.4 : 9.6, font: w.fonts.heavy, color: i === 0 ? C.pink : C.deepNavy });
  });
  w.y = top - 146;
}

/** Petit en-tête des pages suivantes. */
export function drawRunningHeader(w: Writer, label: string) {
  const { page } = w;
  const top = A4.height;
  page.drawRectangle({ x: 0, y: top - 6, width: A4.width, height: 6, color: C.navy });
  page.drawRectangle({ x: A4.width - 90, y: top - 6, width: 90, height: 6, color: C.pink });
  roundedClip(page, MARGIN.left, top - 40, 26, 26, 6, () => page.drawImage(w.logo, { x: MARGIN.left, y: top - 40, width: 26, height: 26 }));
  w.at(page, "Chez TaTa", MARGIN.left + 34, top - 31, { size: 11.4, font: w.fonts.heavy, color: C.deepNavy });
  w.at(page, label, A4.width - MARGIN.right, top - 31, { size: 8.6, color: C.muted, align: "right" });
  page.drawLine({ start: { x: MARGIN.left, y: top - 48 }, end: { x: A4.width - MARGIN.right, y: top - 48 }, thickness: 0.7, color: C.line });
  w.y = top - 62;
}

export const euro = (cents: number) => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  return `${sign}${whole},${String(abs % 100).padStart(2, "0")} €`;
};

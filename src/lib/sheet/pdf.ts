/**
 * Encapsule une image JPEG dans un PDF d'une page A4, sans dépendance.
 * Les valeurs sont dessinées dans l'image : le PDF est donc identique partout
 * (iPhone, Android, impression) et fonctionne hors ligne.
 */

const A4 = { width: 595.276, height: 841.89 };

export function jpegToPdf(jpeg: Uint8Array, pixelWidth: number, pixelHeight: number): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;

  const add = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string) => {
    offsets[id] = length;
    add(`${id} 0 obj\n${body}\nendobj\n`);
  };

  add("%PDF-1.4\n");
  add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
  );
  const content = `q\n${A4.width} 0 0 ${A4.height} 0 0 cm\n/Im0 Do\nQ\n`;
  object(4, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);

  offsets[5] = length;
  add(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  add(jpeg);
  add("\nendstream\nendobj\n");

  const xrefStart = length;
  add("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) add(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xrefStart}\n%%EOF`);

  const out = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}

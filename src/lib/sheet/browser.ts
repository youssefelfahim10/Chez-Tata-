import type { SheetData } from "./compute";
import { jpegToPdf } from "./pdf";
import { TEMPLATE } from "./layout";
import { drawSheet, type SheetContext } from "./render";

const SCALE = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image de la fiche inaccessible."));
    image.src = src;
  });
}

/** Génère la fiche A4 dans le navigateur (aucune donnée n'est envoyée au serveur). */
export async function createSheetPdf(data: SheetData): Promise<Blob> {
  const [template, parentsSignature, caregiverSignature] = await Promise.all([
    loadImage(TEMPLATE.src),
    data.parentsSignature ? loadImage(data.parentsSignature) : undefined,
    data.caregiverSignature ? loadImage(data.caregiverSignature) : undefined,
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = TEMPLATE.width * SCALE;
  canvas.height = TEMPLATE.height * SCALE;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Création du PDF impossible sur cet appareil.");
  ctx.scale(SCALE, SCALE);
  drawSheet(ctx as unknown as SheetContext, data, { template, parentsSignature, caregiverSignature });

  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
  if (!jpeg) throw new Error("Création du PDF impossible sur cet appareil.");
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  return new Blob([jpegToPdf(bytes, canvas.width, canvas.height) as BlobPart], { type: "application/pdf" });
}

export function sheetFileName(data: SheetData): string {
  const child = data.childName.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24);
  return `Chez_TaTa_${data.month}${child ? `_${child}` : ""}.pdf`;
}

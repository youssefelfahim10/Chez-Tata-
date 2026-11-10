import type { FontBytes } from "./kit";

let cached: Promise<FontBytes> | null = null;

/** Polices de la marque (servies par l'appli, gardées pour le hors ligne). */
export function loadFontBytes(): Promise<FontBytes> {
  if (!cached) {
    const get = async (file: string) => {
      const response = await fetch(`/fonts/${file}`);
      if (!response.ok) throw new Error("Polices du document inaccessibles.");
      return new Uint8Array(await response.arrayBuffer());
    };
    cached = Promise.all([get("nunito-latin-400-normal.woff"), get("nunito-latin-700-normal.woff"), get("nunito-latin-800-normal.woff")])
      .then(([regular, bold, heavy]) => ({ regular, bold, heavy }))
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

const asBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "application/pdf" });

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(asBlob(bytes));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Partage le PDF (feuille de partage du téléphone, WhatsApp compris). Sur un navigateur qui ne peut pas
 * partager un fichier, on télécharge le PDF et on ouvre WhatsApp avec le message : l'utilisatrice joint le fichier.
 * Rien n'est envoyé sans son geste.
 */
export async function sharePdf(bytes: Uint8Array, fileName: string, message: string, whatsappUrl: string): Promise<"shared" | "downloaded"> {
  const file = new File([bytes as BlobPart], fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message, title: fileName });
      return "shared";
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return "shared";
    }
  }
  downloadPdf(bytes, fileName);
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  return "downloaded";
}

export const safeFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);

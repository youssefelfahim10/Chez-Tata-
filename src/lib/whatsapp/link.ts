/**
 * Numéro au format attendu par wa.me (chiffres uniquement, indicatif pays inclus).
 * Renvoie null si le numéro n'est pas exploitable : on ne devine pas.
 */
export function toWhatsAppNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let national: string | null = null;
  if (trimmed.startsWith("+")) national = digits;
  else if (digits.startsWith("00")) national = digits.slice(2);
  else if (/^0[1-9]\d{8}$/.test(digits)) national = `33${digits.slice(1)}`; // numéro français
  else if (/^33[1-9]\d{8}$/.test(digits)) national = digits;
  if (!national) return null;
  return /^[1-9]\d{7,14}$/.test(national) ? national : null;
}

/** Lien d'ouverture de WhatsApp avec le message pré-rempli. Rien n'est envoyé : l'utilisateur appuie sur « Envoyer ». */
export function buildWhatsAppUrl(number: string | null, text: string): string {
  const encoded = encodeURIComponent(text);
  return number ? `https://wa.me/${number}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

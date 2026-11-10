import { createHash, timingSafeEqual } from "node:crypto";

/** Comparaison en temps constant (empreintes SHA-256) : ne révèle ni la longueur ni le contenu du secret. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

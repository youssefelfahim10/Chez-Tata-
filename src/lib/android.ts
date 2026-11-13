/** Digital Asset Links : lie le site à l'application Android (TWA) pour qu'elle s'ouvre sans barre d'adresse. */
export const DEFAULT_ANDROID_PACKAGE = "fr.cheztata.app";

const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const SHA256_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** Accepte « AA:BB:… », avec ou sans deux-points, en majuscules ou minuscules. Renvoie null si invalide. */
export function normalizeFingerprint(raw: string): string | null {
  const hex = raw.trim().replace(/:/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return null;
  const formatted = hex.match(/.{2}/g)!.join(":");
  return SHA256_RE.test(formatted) ? formatted : null;
}

export function buildAssetLinks(packageName: string | undefined, fingerprints: string | undefined) {
  const pkg = packageName && PACKAGE_RE.test(packageName.trim()) ? packageName.trim() : DEFAULT_ANDROID_PACKAGE;
  const prints = (fingerprints ?? "")
    .split(/[,\s;]+/)
    .map(normalizeFingerprint)
    .filter((f): f is string => f !== null);
  if (prints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: [...new Set(prints)] },
    },
  ];
}

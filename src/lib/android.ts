/**
 * Application Android (Trusted Web Activity) : l'appli Android est une coque qui ouvre ce site en plein écran.
 * Pour que Chrome l'affiche SANS barre d'adresse, le site doit publier un fichier « Digital Asset Links »
 * (/.well-known/assetlinks.json) qui déclare l'empreinte SHA-256 du certificat de signature de l'appli.
 *
 * Rien n'est inventé : l'empreinte vient de la Play Console (Intégrité de l'appli → Signature d'appli) et se
 * renseigne dans la variable d'environnement ANDROID_SHA256_CERT_FINGERPRINTS (plusieurs, séparées par des virgules).
 */
export const ANDROID_PACKAGE_DEFAULT = "app.cheztata.android";

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PACKAGE_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;

type Env = Record<string, string | undefined>;

export function androidPackageName(env: Env = process.env): string {
  const value = env.ANDROID_PACKAGE_NAME?.trim();
  return value && PACKAGE_NAME.test(value) ? value : ANDROID_PACKAGE_DEFAULT;
}

/** Empreintes valides (SHA-256, 32 octets en hexadécimal séparés par « : »), en majuscules, sans doublon. */
export function androidFingerprints(env: Env = process.env): string[] {
  const raw = env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "";
  const valid = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => FINGERPRINT.test(part));
  return [...new Set(valid)];
}

/** Contenu de /.well-known/assetlinks.json. Liste vide tant qu'aucune empreinte n'est renseignée. */
export function assetLinks(env: Env = process.env) {
  const fingerprints = androidFingerprints(env);
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: androidPackageName(env),
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

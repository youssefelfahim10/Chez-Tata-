/**
 * Logique de la dictée vocale, séparée de l'écran pour pouvoir être testée :
 *  - délai de sécurité adapté à l'état de l'autorisation du micro (la fenêtre « Autoriser » peut rester ouverte longtemps) ;
 *  - ajout d'une nouvelle dictée au texte déjà saisi (l'écoute s'arrête à chaque pause) ;
 *  - diagnostic lisible quand le micro ne marche pas.
 * Rien n'est envoyé nulle part.
 */
import type { SpeechEnv } from "./errors";

export type MicPermission = "granted" | "denied" | "prompt" | "unknown";

/** Délai d'attente d'un démarrage d'écoute quand le micro est déjà autorisé. */
export const WATCHDOG_MS = 7000;
/** Délai quand le navigateur est en train de demander l'autorisation : on laisse le temps de répondre. */
export const WATCHDOG_PROMPT_MS = 60000;

export const watchdogMs = (permission: MicPermission): number => (permission === "prompt" ? WATCHDOG_PROMPT_MS : WATCHDOG_MS);

/** Ajoute ce qui vient d'être dicté au texte déjà présent, sans rien écraser. */
export function mergeDictation(base: string, heard: string): string {
  const before = base.trim();
  const now = heard.trim();
  if (!now) return before;
  return before ? `${before} ${now}` : now;
}

/** État de l'autorisation du micro, sans jamais déclencher de fenêtre. « unknown » si le navigateur ne sait pas le dire (Safari). */
export async function readMicPermission(): Promise<MicPermission> {
  try {
    const permissions = typeof navigator === "undefined" ? undefined : navigator.permissions;
    if (!permissions?.query) return "unknown";
    const status = await permissions.query({ name: "microphone" as PermissionName });
    return status.state === "granted" || status.state === "denied" || status.state === "prompt" ? status.state : "unknown";
  } catch {
    return "unknown";
  }
}

export type MicCheck = { label: string; ok: boolean | null; detail: string };

type DiagnosticInput = { supported: boolean; secure: boolean; online: boolean; permission: MicPermission; env: SpeechEnv };

/** Liste de vérifications affichée sous « Le micro ne marche pas ? ». ok = null : information, pas un problème. */
export function diagnoseMic({ supported, secure, online, permission, env }: DiagnosticInput): MicCheck[] {
  const checks: MicCheck[] = [];

  checks.push(
    supported
      ? { label: "Dictée intégrée", ok: true, detail: "Disponible sur ce navigateur." }
      : { label: "Dictée intégrée", ok: false, detail: "Indisponible ici (Firefox, Brave ou navigateur intégré à une application). Ouvrez Chrome (Android) ou Safari (iPhone), ou utilisez le micro du clavier." },
  );

  checks.push(
    secure
      ? { label: "Connexion sécurisée", ok: true, detail: "HTTPS actif." }
      : { label: "Connexion sécurisée", ok: false, detail: "Le micro n'est autorisé que sur une page sécurisée (https)." },
  );

  checks.push(
    online
      ? { label: "Réseau", ok: true, detail: "Connecté. La reconnaissance vocale a besoin d'Internet." }
      : { label: "Réseau", ok: false, detail: "Hors ligne : la dictée est impossible, mais vous pouvez écrire le texte." },
  );

  if (permission === "granted") checks.push({ label: "Autorisation du micro", ok: true, detail: "Accordée." });
  else if (permission === "denied") {
    checks.push({
      label: "Autorisation du micro",
      ok: false,
      detail: env.ios
        ? "Refusée. Réglages › Safari › Micro, choisissez « Demander » ou « Autoriser », puis rechargez la page."
        : env.android && env.standalone
          ? "Refusée. Réglages Android › Applications › Chrome › Autorisations › Micro : autorisez-le, puis rouvrez l'application."
          : "Refusée. Touchez l'icône 🔒 à côté de l'adresse du site, autorisez le micro, puis rechargez la page.",
    });
  } else if (permission === "prompt") checks.push({ label: "Autorisation du micro", ok: null, detail: "Pas encore demandée : une fenêtre s'ouvrira au premier appui. Choisissez « Autoriser »." });
  else checks.push({ label: "Autorisation du micro", ok: null, detail: "Non vérifiable ici : elle sera demandée au premier appui." });

  if (env.ios && env.thirdParty) checks.push({ label: "Navigateur", ok: false, detail: "Sur iPhone, la dictée intégrée marche surtout dans Safari." });
  else if (env.ios && env.standalone) checks.push({ label: "Application installée", ok: false, detail: "Sur iPhone, l'application ajoutée à l'écran d'accueil bloque la dictée : ouvrez le site dans Safari ou utilisez le micro du clavier." });
  else if (env.android && env.standalone) checks.push({ label: "Application installée", ok: null, detail: "L'autorisation du micro est celle de Chrome (Réglages Android › Applications › Chrome)." });

  return checks;
}

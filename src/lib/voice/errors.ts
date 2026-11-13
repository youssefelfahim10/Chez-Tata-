/**
 * Messages d'aide quand la dictée vocale échoue. Chaque cas dit CE QUI se passe et QUOI faire,
 * en particulier sur iPhone, où la dictée dépend de réglages système (micro du navigateur, Dictée, Siri).
 * Purement textuel et testable ; aucune donnée n'est envoyée nulle part.
 */

export type SpeechEnv = {
  ios: boolean;
  /** Android : l'autorisation du micro de l'application installée est celle de Chrome (pas d'icône 🔒 à toucher). */
  android?: boolean;
  standalone: boolean;
  /** iPhone/iPad avec un navigateur autre que Safari (Chrome, Firefox, application…) : la dictée intégrée y est souvent bloquée. */
  thirdParty?: boolean;
};

const THIRD_PARTY_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|Brave|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|LinkedIn/;

export const SAFARI_ADVICE =
  "Sur iPhone, la dictée intégrée ne marche en général que dans Safari (pas dans Chrome, Firefox ni une application). Copiez le lien et ouvrez-le dans Safari, ou dictez avec le micro du clavier.";

export function detectSpeechEnv(nav: { userAgent: string; platform?: string; maxTouchPoints?: number; standalone?: boolean }, standaloneMedia = false): SpeechEnv {
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
  return {
    ios,
    android: !ios && /Android/.test(nav.userAgent),
    standalone: Boolean(nav.standalone) || standaloneMedia,
    thirdParty: ios && THIRD_PARTY_IOS.test(nav.userAgent),
  };
}

/** Astuce toujours valable : la dictée du clavier du téléphone marche sans permission particulière. */
export function keyboardTip(env: SpeechEnv): string {
  return env.ios
    ? "Astuce iPhone : touchez la zone de texte puis le micro 🎙️ en bas à droite du clavier pour dicter."
    : "Astuce : touchez la zone de texte puis le micro 🎙️ du clavier de votre téléphone pour dicter.";
}

/** Message pour un code d'erreur de la reconnaissance vocale (SpeechRecognitionErrorEvent.error). */
export function explainSpeechError(code: string, env: SpeechEnv): string {
  const standaloneNote = env.ios && env.standalone ? " Dans l’application ajoutée à l’écran d’accueil, iOS bloque la dictée : ouvrez le site dans Safari." : "";
  // Cause la plus fréquente sur iPhone : un navigateur autre que Safari.
  if (env.ios && env.thirdParty && (code === "not-allowed" || code === "service-not-allowed")) return SAFARI_ADVICE;
  switch (code) {
    case "not-allowed":
      return env.ios
        ? `Le micro est refusé. Sur iPhone : Réglages › Safari › Micro (choisir « Demander » ou « Autoriser »), puis rechargez la page et acceptez la fenêtre qui s’ouvre.${standaloneNote}`
        : env.android && env.standalone
          ? "Le micro est refusé. Sur Android : Réglages › Applications › Chrome › Autorisations › Micro, autorisez-le, puis rouvrez l’application."
          : "Le micro est refusé : autorisez-le (icône 🔒 à côté de l’adresse du site), puis réessayez.";
    case "service-not-allowed":
      return env.ios
        ? `La dictée n’est pas activée sur cet iPhone : Réglages › Général › Clavier › Activer la dictée (et Siri doit être actif).${standaloneNote}`
        : "Le service de dictée est indisponible sur ce navigateur. Utilisez le micro du clavier.";
    case "no-speech":
      return "Je n’ai rien entendu. Rapprochez-vous du micro, appuyez et parlez tout de suite.";
    case "audio-capture":
      return "Aucun micro détecté sur cet appareil.";
    case "network":
      return "La reconnaissance vocale n’a pas pu joindre son service. Vérifiez votre connexion et réessayez. Dans Firefox, Brave ou un navigateur intégré à une application, elle n’est pas disponible : ouvrez Chrome (Android) ou Safari (iPhone), ou utilisez le micro du clavier.";
    case "language-not-supported":
      return "Le français n’est pas disponible pour la dictée sur cet appareil. Utilisez le micro du clavier.";
    case "aborted":
      return "Dictée interrompue. Appuyez pour recommencer.";
    default:
      return `La dictée a échoué${code ? ` (code : ${code})` : ""}. Réessayez, ou utilisez le micro du clavier.`;
  }
}

export const NOTHING_HEARD = "Je n’ai rien entendu. Appuyez, attendez une seconde, puis parlez. Sinon, utilisez le micro du clavier.";
export const MIC_NO_ANSWER = "Le micro ne répond pas. Vérifiez l’autorisation du micro puis réessayez, ou utilisez le micro du clavier.";
/** Affiché pendant que le navigateur demande l'autorisation : sans cela on croit que l'appui n'a rien fait. */
export const PERMISSION_WAIT = "Autorisez le micro dans la fenêtre qui vient de s’ouvrir (choisissez « Autoriser »), puis parlez.";

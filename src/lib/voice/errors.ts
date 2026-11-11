/**
 * Messages d'aide quand la dictée vocale échoue. Chaque cas dit CE QUI se passe et QUOI faire,
 * en particulier sur iPhone, où la dictée dépend de réglages système (micro du navigateur, Dictée, Siri).
 * Purement textuel et testable ; aucune donnée n'est envoyée nulle part.
 */

export type SpeechEnv = { ios: boolean; standalone: boolean };

export function detectSpeechEnv(nav: { userAgent: string; platform?: string; maxTouchPoints?: number; standalone?: boolean }, standaloneMedia = false): SpeechEnv {
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
  return { ios, standalone: Boolean(nav.standalone) || standaloneMedia };
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
  switch (code) {
    case "not-allowed":
      return env.ios
        ? `Le micro est refusé. Sur iPhone : Réglages › Safari › Micro (choisir « Demander » ou « Autoriser »), puis rechargez la page et acceptez la fenêtre qui s’ouvre.${standaloneNote}`
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
      return "La reconnaissance vocale a besoin d’Internet. Réessayez quand le réseau est revenu.";
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

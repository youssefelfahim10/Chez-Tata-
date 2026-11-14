/** Scénario de la démonstration animée : chapitres, textes et durées (ms). Données entièrement fictives. */

export type SceneId = "arrivee" | "gestes" | "corriger" | "reseau" | "dictee" | "bilan" | "urgence" | "papiers" | "impots" | "fin";

export type Scene = { id: SceneId; chapter: string; title: string; text: string; duration: number };

export const SCENES: readonly Scene[] = [
  { id: "arrivee", chapter: "Pointer", title: "Une touche, la journée commence", text: "Un enfant arrive : vous touchez « Arrivée ». L’heure exacte est enregistrée, vous pouvez annuler d’un geste.", duration: 7000 },
  { id: "gestes", chapter: "Cocher", title: "Repas, sieste, change : un geste chacun", text: "De grands boutons, pensés pour une seule main. Chaque geste s’ajoute à la « Journée » de l’enfant, avec une précision à cocher : « tout mangé », « pipi », « bobo ».", duration: 8000 },
  { id: "corriger", chapter: "Corriger", title: "Une erreur ? Rien n’est perdu", text: "Modifiez l’heure ou la précision d’un geste. Annulé par erreur ? Il reste dans les archives du jour : un geste pour le rétablir.", duration: 9500 },
  { id: "reseau", chapter: "Sans réseau", title: "Pas de réseau ? Aucun souci", text: "Vos saisies restent sur le téléphone, avec l’heure réelle du geste, et partent toutes seules dès que la connexion revient.", duration: 8000 },
  { id: "dictee", chapter: "Dicter", title: "Dictez, l’appli propose", text: "« Noa a mangé toute son assiette » : l’appli comprend et vous propose la saisie. Vous pouvez la corriger ; rien n’est enregistré sans votre validation.", duration: 8000 },
  { id: "bilan", chapter: "Partager", title: "Le bilan du jour s’écrit tout seul", text: "Un message clair, fait uniquement de ce que vous avez saisi. Vous le relisez, le modifiez, puis l’envoyez vous-même sur WhatsApp.", duration: 8500 },
  { id: "urgence", chapter: "Urgence", title: "En cas d’urgence, tout est là", text: "Allergies, médecin, parents, personnes autorisées : sur un seul écran, avec les numéros à appeler en un geste.", duration: 7500 },
  { id: "papiers", chapter: "Papiers", title: "Fiche de présence et factures, prêtes", text: "La fiche du mois se remplit à partir du journal. La facture se fige quand le paiement est reçu : numéro continu, rien à retaper.", duration: 8500 },
  { id: "impots", chapter: "Impôts", title: "Les impôts se préparent tout seuls", text: "Chaque mois, les montants se remplissent d’après votre contrat et vos présences. Les mois estimés sont marqués et restent modifiables : une aide, jamais un document officiel.", duration: 8500 },
  { id: "fin", chapter: "À vous", title: "Moins d’administratif, plus de temps pour les enfants", text: "Essayez vous-même avec des enfants fictifs, ou créez votre espace en quelques secondes.", duration: 6000 },
];

export function totalDuration(): number {
  return SCENES.reduce((sum, s) => sum + s.duration, 0);
}

export type PlayerState = { index: number; elapsed: number; playing: boolean; runKey: number };

export type PlayerAction =
  | { type: "tick"; step: number }
  | { type: "go"; index: number; play?: boolean }
  | { type: "toggle" }
  | { type: "pause" }
  | { type: "play" };

const last = SCENES.length - 1;

export function initialPlayer(): PlayerState {
  return { index: 0, elapsed: 0, playing: false, runKey: 0 };
}

/** Machine à états du lecteur : pure, donc testable. Passe seule au chapitre suivant, s'arrête à la fin. */
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "tick": {
      if (!state.playing) return state;
      const elapsed = state.elapsed + action.step;
      if (elapsed < SCENES[state.index].duration) return { ...state, elapsed };
      if (state.index === last) return { ...state, elapsed: SCENES[last].duration, playing: false };
      return { ...state, index: state.index + 1, elapsed: 0, runKey: state.runKey + 1 };
    }
    case "go": {
      const index = Math.min(last, Math.max(0, action.index));
      return { index, elapsed: 0, playing: action.play ?? state.playing, runKey: state.runKey + 1 };
    }
    case "toggle": {
      const finished = state.index === last && state.elapsed >= SCENES[last].duration;
      if (finished) return { index: 0, elapsed: 0, playing: true, runKey: state.runKey + 1 };
      return { ...state, playing: !state.playing };
    }
    case "pause":
      return state.playing ? { ...state, playing: false } : state;
    case "play":
      return state.playing ? state : { ...state, playing: true };
  }
}

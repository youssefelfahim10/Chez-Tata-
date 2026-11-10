/**
 * Informations légales de l'éditeur. Elles viennent de variables d'environnement publiques : aucune valeur n'est inventée.
 * Tant qu'elles ne sont pas renseignées, les pages affichent « à compléter » (les stores exigent des coordonnées réelles).
 */
const pick = (value: string | undefined, fallback: string) => (value && value.trim() ? value.trim() : fallback);

export const LEGAL = {
  product: "Chez TaTa",
  publisher: pick(process.env.NEXT_PUBLIC_LEGAL_NAME, "À compléter : nom ou raison sociale de l'éditeur"),
  address: pick(process.env.NEXT_PUBLIC_LEGAL_ADDRESS, "À compléter : adresse de l'éditeur"),
  registration: pick(process.env.NEXT_PUBLIC_LEGAL_REGISTRATION, "À compléter : SIRET ou numéro d'immatriculation"),
  director: pick(process.env.NEXT_PUBLIC_LEGAL_DIRECTOR, "À compléter : directeur de la publication"),
  contactEmail: pick(process.env.NEXT_PUBLIC_CONTACT_EMAIL, ""),
  updatedOn: "10 novembre 2026",
} as const;

export const isLegalComplete = () => !LEGAL.publisher.startsWith("À compléter") && Boolean(LEGAL.contactEmail);

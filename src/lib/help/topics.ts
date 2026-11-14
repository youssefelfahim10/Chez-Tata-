/**
 * Explications de l'application, en mots simples. Une seule source pour les « ? » et pour les visites guidées.
 * Règles d'écriture : phrases courtes, vouvoiement, un exemple concret quand il aide, aucun terme technique.
 */

export type HelpTopic = {
  emoji: string;
  title: string;
  text: string;
  /** Exemple concret (facultatif). */
  example?: string;
};

export const HELP = {
  // ───────────────────────── Aujourd'hui
  "today.card": { emoji: "👶", title: "La carte de l’enfant", text: "Chaque enfant a sa carte : son prénom, s’il est arrivé ou parti, puis les boutons pour noter sa journée." },
  "today.actions": { emoji: "👆", title: "Les 6 boutons", text: "Touchez un bouton à chaque fois que ça arrive : arrivée, départ, repas, sieste, change ou soin. L’heure se note toute seule." },
  "today.feedback": { emoji: "✅", title: "Le message vert", text: "Il confirme ce que vous venez de noter. Une erreur ? Touchez « Annuler ». Vous pouvez aussi préciser.", example: "Après « Repas », touchez « Tout mangé »." },
  "today.journey": { emoji: "📒", title: "La journée de l’enfant", text: "C’est la liste de tout ce que vous avez noté aujourd’hui, dans l’ordre. Le bilan pour les parents est écrit avec elle." },
  "today.edit": { emoji: "✏️", title: "Modifier", text: "Une mauvaise heure ou une précision à changer ? Touchez « Modifier », corrigez, puis « Enregistrer »." },
  "today.cancel": { emoji: "↩️", title: "Annuler, puis rétablir", text: "« Annuler » enlève un geste de la journée. Il n’est pas supprimé : il reste dans « Annulés aujourd’hui ». Touchez « Rétablir » pour le remettre." },
  "today.voice": { emoji: "🎙️", title: "Dicter", text: "Les mains prises ? Touchez « Dicter » et parlez. L’appli propose, vous vérifiez, puis vous validez. Rien n’est noté sans votre accord.", example: "« Léa a mangé toute son assiette »" },
  "today.bilan": { emoji: "💬", title: "Le bilan du jour", text: "L’appli écrit un message pour les parents avec ce que vous avez noté. Vous le relisez, puis vous l’envoyez vous-même sur WhatsApp." },
  "today.urgence": { emoji: "🚨", title: "Urgence", text: "Un écran pour agir vite : allergies, médecin, parents, et les numéros à appeler en un toucher." },
  "today.offline": { emoji: "📴", title: "Sans réseau", text: "Pas de connexion ? Continuez à toucher les boutons. Tout est gardé sur le téléphone et envoyé quand le réseau revient." },

  // ───────────────────────── Factures
  "invoice.month": { emoji: "📅", title: "Le mois", text: "Choisissez le mois à facturer avec les flèches. La facture se prépare avec votre contrat et ce que vous avez noté." },
  "invoice.status": { emoji: "🏷️", title: "À facturer ou Payée", text: "« À facturer » : le paiement n’est pas encore noté. « Payée » : la facture est faite et ne change plus." },
  "invoice.lines": { emoji: "🧾", title: "Les lignes de la facture", text: "Chaque ligne est une partie de la somme demandée aux parents. Cochez celles à garder et corrigez un montant si besoin." },
  "invoice.base": { emoji: "📆", title: "Accueil mensualisé", text: "C’est votre salaire de base. Il est calculé sur l’année puis partagé en 12 : la somme est la même chaque mois.", example: "40 h par semaine × 52 semaines ÷ 12 mois × 4,50 € de l’heure." },
  "invoice.extra": { emoji: "⏱️", title: "Heures complémentaires", text: "Ce sont les heures en plus de ce qui est prévu au contrat, par exemple un parent qui arrive en retard. Elles se paient en plus.", example: "30 minutes en plus × 4,50 € de l’heure." },
  "invoice.maintenance": { emoji: "🧸", title: "Indemnité d’entretien", text: "Une somme par jour d’accueil pour vos frais : chauffage, eau, produits, jeux… Ce n’est pas du salaire." },
  "invoice.meal": { emoji: "🍽️", title: "Indemnité de repas", text: "Une somme pour chaque repas que vous fournissez. Si les parents apportent le repas, il n’y a pas cette ligne." },
  "invoice.add": { emoji: "➕", title: "Ajouter une ligne", text: "Pour un oubli ou un ajustement. Écrivez ce que c’est et le montant. Un montant avec « - » retire une somme : c’est une remise.", example: "-5 pour 5 € de remise." },
  "invoice.method": { emoji: "🏦", title: "Reçu par", text: "Comment les parents ont payé : virement, chèque, espèces… Cela s’écrit sur la facture." },
  "invoice.date": { emoji: "🗓️", title: "Date de réception", text: "Le jour où vous avez reçu l’argent. Cette date compte pour les impôts : c’est l’année où l’argent arrive qui compte." },
  "invoice.total": { emoji: "💶", title: "Le total", text: "C’est la somme de toutes les lignes cochées : le montant payé par les parents." },
  "invoice.pay": { emoji: "✅", title: "Paiement reçu", text: "Quand l’argent est arrivé, touchez ce bouton. La facture reçoit un numéro, puis elle ne peut plus être modifiée. Elle est prête à envoyer." },
  "invoice.number": { emoji: "🔢", title: "Numéro de facture", text: "Un numéro qui se suit (0001, 0002…) pour retrouver chaque facture. L’appli le donne toute seule." },
  "invoice.send": { emoji: "📤", title: "Envoyer la facture", text: "Cela ouvre WhatsApp avec un message et la facture en PDF. C’est vous qui envoyez : rien ne part tout seul." },
  "invoice.pdf": { emoji: "📄", title: "Le PDF", text: "Le fichier de la facture, à garder ou à imprimer. Il est créé sur votre téléphone." },

  // ───────────────────────── Contrat
  "contract.employee": { emoji: "👩‍🍼", title: "Vos informations", text: "Votre nom, votre adresse et votre agrément s’écrivent sur le contrat. Remplissez-les une fois dans « Profil » : elles se recopient toutes seules." },
  "contract.agrement": { emoji: "🪪", title: "Agrément", text: "C’est l’autorisation du département pour accueillir des enfants. Le numéro et la date sont sur votre courrier d’agrément." },
  "contract.insurance": { emoji: "🛡️", title: "Assurance", text: "L’assurance qui couvre votre activité d’assistante maternelle. Notez le nom de l’assureur et le numéro de contrat." },
  "contract.parents": { emoji: "👪", title: "Les parents", text: "Ce sont les parents qui signent le contrat avec vous. Le deuxième parent est facultatif." },
  "contract.phone": { emoji: "☎️", title: "Téléphone des parents", text: "Pour les joindre, et pour ouvrir WhatsApp quand vous envoyez un bilan ou une facture." },
  "contract.start": { emoji: "🗓️", title: "Début de l’accueil", text: "Le premier jour où l’enfant est accueilli avec ce contrat." },
  "contract.type": { emoji: "📆", title: "Année complète ou incomplète", text: "Année complète : l’enfant vient toute l’année (52 semaines). Année incomplète : moins de semaines, par exemple s’il part en vacances." },
  "contract.weeks": { emoji: "🔢", title: "Semaines par an", text: "Le nombre de semaines où l’enfant est accueilli dans l’année.", example: "46 semaines si la famille part 6 semaines." },
  "contract.adaptation": { emoji: "🤝", title: "Adaptation", text: "Les premiers jours, plus courts, pour que l’enfant se familiarise avec vous.", example: "1 semaine" },
  "contract.trial": { emoji: "🧪", title: "Période d’essai", text: "Un temps au début où chacun peut arrêter plus facilement si cela ne convient pas.", example: "1 mois" },
  "contract.notice": { emoji: "⏳", title: "Préavis", text: "Le temps à prévenir avant d’arrêter le contrat.", example: "1 mois" },
  "contract.schedule": { emoji: "🕗", title: "Planning d’accueil", text: "Les jours et les heures où l’enfant vient chaque semaine. L’appli en déduit le nombre d’heures par semaine." },
  "contract.weekly": { emoji: "⏱️", title: "Heures par semaine", text: "Le total des heures d’accueil sur une semaine normale. Il sert à calculer le salaire de chaque mois.", example: "40 h" },
  "contract.hourly": { emoji: "💶", title: "Salaire horaire net", text: "Ce que vous touchez pour 1 heure d’accueil, une fois les cotisations payées (c’est le « net »).", example: "4,50 €" },
  "contract.majoration": { emoji: "📈", title: "Heures majorées", text: "Certaines heures se paient plus cher. Indiquez de combien, en pourcentage.", example: "25 % : une heure à 4,50 € est payée 5,63 €." },
  "contract.overtime": { emoji: "⏱️", title: "Heures en plus au prix normal", text: "Cochez si les heures en plus du contrat sont payées au même prix que les autres heures." },
  "contract.meals": { emoji: "🍽️", title: "Repas et couches", text: "Notez qui fournit quoi : repas, goûter, couches. Cela évite les malentendus et s’écrit dans le contrat." },
  "contract.notes": { emoji: "📝", title: "Précisions et congés", text: "Facultatif : les allergies, les habitudes de l’enfant, et ce que vous avez décidé ensemble pour les congés." },

  // ───────────────────────── Impôts
  "tax.what": { emoji: "🏛️", title: "À quoi sert cet écran", text: "Il prépare vos chiffres pour la déclaration d’impôts. C’est une aide : vérifiez toujours sur impots.gouv.fr." },
  "tax.year": { emoji: "📅", title: "L’année", text: "Choisissez l’année à préparer. Ce qui compte, c’est l’année où l’argent a été reçu." },
  "tax.smic": { emoji: "💶", title: "Le SMIC horaire", text: "C’est le salaire minimum pour 1 heure, fixé chaque année. L’appli s’en sert pour calculer la somme forfaitaire.", example: "11,88 € en 2025. Pour une autre année, saisissez-le." },
  "tax.parentMeal": { emoji: "🍽️", title: "Repas fourni par les parents", text: "Quand les parents apportent le repas, l’administration le compte comme un petit revenu en plus, avec une valeur fixe par jour." },
  "tax.fullDays": { emoji: "📆", title: "Jours de 8 h ou plus", text: "Le nombre de jours où l’enfant est resté 8 heures ou plus. L’appli le compte avec votre journal : corrigez si besoin." },
  "tax.partialHours": { emoji: "⏱️", title: "Heures des autres jours", text: "Le total des heures des jours plus courts que 8 heures.", example: "42,5" },
  "tax.forfait": { emoji: "🧮", title: "La somme forfaitaire", text: "Pour chaque jour de garde, l’administration retire de vos revenus une somme fixe : 3 fois le SMIC horaire. Cela fait baisser la somme à déclarer." },
  "tax.multiplier": { emoji: "4️⃣", title: "3 ou 4 fois le SMIC", text: "Choisissez 3 dans la plupart des cas. Choisissez 4 si l’enfant ouvre droit à une majoration de salaire (handicap, maladie)." },
  "tax.adjust": { emoji: "➖", title: "Ajustement", text: "Une petite correction pour un cas particulier, comme des gardes de 24 h. Laissez vide si vous ne savez pas." },
  "tax.months": { emoji: "🗓️", title: "Le détail par mois", text: "Mois par mois, l’argent reçu : le salaire d’un côté, les indemnités de l’autre. Vous pouvez tout modifier." },
  "tax.estimated": { emoji: "✨", title: "Un mois « estimé »", text: "Pour ce mois, aucune facture n’est validée. L’appli a calculé avec votre contrat et vos présences. Corrigez, ou validez la facture pour le vrai montant." },
  "tax.result": { emoji: "🏛️", title: "À déclarer", text: "Le montant que l’appli propose : ce que vous avez reçu, moins la somme forfaitaire. C’est une aide, pas un document officiel." },
  "tax.outputs": { emoji: "📄", title: "Les documents", text: "Un PDF d’aide pour remplir votre déclaration, une attestation d’accueil à remettre aux parents, et un fichier pour tableur." },

  // ───────────────────────── Fiche santé
  "health.allergies": { emoji: "🥜", title: "Allergies", text: "Tout ce qui peut rendre l’enfant malade : un aliment, un médicament, une piqûre… Cela s’affiche en rouge sur sa carte et sur l’écran Urgence.", example: "arachides, œuf" },
  "health.diet": { emoji: "🥗", title: "Régime alimentaire", text: "Ce que l’enfant ne mange pas, pour une raison de santé ou de famille.", example: "sans porc" },
  "health.medication": { emoji: "💊", title: "Traitement en cours", text: "Les médicaments à donner et comment. Écrivez précisément : cela apparaît sur l’écran Urgence." },
  "health.doctor": { emoji: "🩺", title: "Médecin", text: "Le médecin ou pédiatre de l’enfant. Son numéro s’appelle d’un seul toucher depuis l’écran Urgence." },
  "health.emergency": { emoji: "☎️", title: "Contact d’urgence", text: "Une personne à prévenir si les parents ne répondent pas. Notez son nom, son lien avec l’enfant et son téléphone." },
  "health.pickup": { emoji: "🧑‍🤝‍🧑", title: "Personne autorisée", text: "Quelqu’un que les parents ont autorisé à venir chercher l’enfant. En cas de doute, appelez toujours les parents." },

  // ───────────────────────── Profil
  "profile.address": { emoji: "🏠", title: "Adresse du lieu d’accueil", text: "L’endroit où vous accueillez les enfants. Elle s’écrit sur les contrats et les attestations." },
  "profile.agrementEnd": { emoji: "⏰", title: "Fin de l’agrément", text: "La date où votre agrément doit être renouvelé. L’appli vous prévient avant, sur l’écran Aujourd’hui." },
  "profile.capacity": { emoji: "👶", title: "Enfants agréés", text: "Le nombre d’enfants que votre agrément vous permet d’accueillir en même temps (de 1 à 6)." },
  "profile.insuranceEnd": { emoji: "⏰", title: "Échéance de l’assurance", text: "La date où votre assurance se renouvelle. L’appli vous prévient avant qu’elle arrive." },

  // ───────────────────────── Gestion
  "gestion.month": { emoji: "📊", title: "Ce mois-ci", text: "Un résumé du mois : enfants, contrats, argent estimé et reçu, charges. Ce sont des repères." },
  "gestion.kids": { emoji: "👶", title: "Mes enfants", text: "La liste de vos enfants. Touchez un prénom pour voir sa famille, sa fiche santé, son contrat et son icône." },
  "gestion.money": { emoji: "💶", title: "Argent et papiers", text: "Vos factures, vos charges et les documents pour les impôts, au même endroit." },
  "child.icon": { emoji: "👧", title: "Icône fille ou garçon", text: "Choisissez 👧 ou 👦 : cela change seulement l’image de l’enfant à l’écran." },
} as const satisfies Record<string, HelpTopic>;

export type HelpId = keyof typeof HELP;

export const helpFor = (id: HelpId): HelpTopic => HELP[id];

/** Texte lu à voix haute : le titre, l'explication, puis l'exemple. */
export function spokenText(topic: HelpTopic): string {
  return [topic.title, topic.text, topic.example ? `Exemple : ${topic.example}` : ""].filter(Boolean).join(". ").replace(/\.\./g, ".");
}

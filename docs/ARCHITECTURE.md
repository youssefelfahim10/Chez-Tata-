# Architecture

## Vue d'ensemble

```
Navigateur / PWA ──► Next.js (Vercel) ──► Supabase (Auth + PostgreSQL + RLS)
                      │  src/proxy.ts : rafraîchit la session, première redirection
                      │  Server Components + Server Actions : revérifient la session
                      └─ aucune clé secrète : seule la clé « publishable » est utilisée
```

La sécurité repose sur la base : même si le code web contenait une erreur, la RLS empêche
de lire ou d'écrire les données d'un autre espace.

## Arborescence

| Chemin | Rôle |
|---|---|
| `supabase/migrations/` | Schéma, RLS, fonctions (source de vérité de la base) |
| `src/proxy.ts` | Session + redirection (pas un contrôle d'accès) |
| `src/lib/auth/session.ts` | Couche d'accès : utilisateur vérifié, adhésions, espace actif |
| `src/lib/journal/day.ts` | Logique pure du journal (fuseau Europe/Paris, résumé de journée) |
| `src/app/actions/` | Actions serveur (validation zod, session revérifiée à chaque appel) |
| `src/app/(auth)/`, `bienvenue/`, `invitation/` | Connexion, inscription, création d'espace, invitation |
| `src/app/(app)/` | Les 4 onglets : Aujourd'hui, Planning, Gestion, Profil (Espace et données depuis le profil) |
| `tests/db/` | Tests d'isolation RLS (PGlite + shim Supabase) |
| `tests/unit/` | Tests de logique métier |

## Multi-tenant et droits

- Une **organisation** = un espace (`independent` ou `mam`). Toute ligne métier porte `organization_id`.
- Clés étrangères composites `(id, organization_id)` : impossible de relier un enfant, une famille ou
  un contrat à une autre organisation, même en connaissant son identifiant.
- Rôles par organisation : `owner`, `admin`, `assmat`. Aucun rôle dans `profiles`
  (évite toute élévation de privilège par modification de profil).
- Les adhésions ne s'écrivent que par fonctions contrôlées :
  `create_organization`, `create_invitation`, `accept_invitation`, `set_member_status`.

| Donnée | Visible par |
|---|---|
| Enfants, familles, journal, présences | Tous les membres actifs de l'espace |
| Contrats, décomptes, paiements, dépenses, documents | Uniquement l'assistante concernée — y compris dans une MAM, y compris vis-à-vis de la propriétaire |
| Invitations, sauvegardes | Responsables (`owner`, `admin`) |
| Journal d'audit | Ses propres actions ; les responsables voient en plus les actions non financières |

Hypothèse à confirmer : dans une MAM, chaque assistante est salariée directement par les parents,
donc ses contrats et finances lui sont strictement personnels.

## Choix notables

- **Invitations** : jeton aléatoire renvoyé une seule fois, seule son empreinte SHA-256 est stockée ;
  valable 7 jours ; utilisable uniquement par le compte dont l'e-mail est celui invité.
  Le lien est transmis par l'utilisatrice elle-même (copie ou WhatsApp), jamais envoyé automatiquement.
- **Journal** : horodatage serveur ; `client_operation_id` unique par organisation (idempotence, base de la
  future synchronisation hors ligne) ; annulation = `deleted_at` ; chaque correction archive l'état
  précédent dans `daily_event_revisions` ; aucune suppression définitive par l'API.
- **Finances** : montants en centimes ; un décompte finalisé est figé par déclencheur.
- **Effacement** : supprimer une organisation efface en cascade toutes ses données (testé).
- **Parents** : non exposés à ce stade (phase ultérieure). L'**administration de la plateforme** existe : voir « Administration de la plateforme » en bas de ce document.

## Reste à faire côté sécurité

Stockage privé des documents (URLs temporaires), Content-Security-Policy avec nonce, limitation de débit
sur l'authentification, politique de conservation et registre RGPD, sauvegardes et test de restauration.
Chaque point fait l'objet d'une issue.

## Fiche de présence A4 (prototype intégré)

- **Thème** : palette du prototype « Présences sur téléphone » (vert, orange, crème, rose) dans `src/app/globals.css`.
- **Modèle illustré** : `public/fiche/modele-a4.jpg` (1055 × 1491), repris tel quel du prototype.
- **Calculs** : `src/lib/sheet/compute.ts` — minutes et centimes entiers ; additions de la saisie uniquement.
  Le salaire à verser est **saisi**, jamais calculé (« ne jamais présenter une estimation comme une paie officielle »).
- **Dessin** : `render.ts` écrit dans les cases mesurées de `layout.ts` ; une valeur absente n'écrit rien.
- **PDF** : `pdf.ts` (sans dépendance) ; généré **dans le navigateur**, donc hors ligne et sans envoi de données.
- **Données** : `attendance_records` (migration `…0002`) ; aucun montant en euros dans cette table partagée de la MAM :
  les montants d'indemnités viennent du contrat, privé à l'assistante.
- **Calage** : coordonnées relevées par mesure sur l'image ; celles du prototype étaient décalées de 10 à 17 px.

## Bilan du jour sur WhatsApp

- `src/lib/whatsapp/summary.ts` : texte construit **uniquement** à partir des événements enregistrés ; une rubrique sans donnée est omise
  (pas de repas saisi → pas de ligne « Repas »). Aucune présence calculée sans départ.
- `src/lib/whatsapp/link.ts` : numéro normalisé pour `wa.me` (numéros français et internationaux), `null` si inexploitable.
- Écran `/aujourdhui/bilan/[childId]` : aperçu **modifiable**, choix du destinataire (familles ayant un numéro valide, ou « Choisir dans WhatsApp »),
  case « J'ai relu ce message » obligatoire (réarmée à chaque modification), puis ouverture de WhatsApp. **Jamais d'envoi automatique** :
  l'utilisateur appuie lui-même sur « Envoyer » dans WhatsApp.
- `createClient()` appelle `connection()` : la session est propre à la requête (la vérification du jeton lit l'heure courante).

## Hors ligne d'abord, dictée, finances

- **Opérations** (`src/lib/offline/ops.ts`) : créer, fin de sieste, précision, annuler. Chacune porte un identifiant généré sur l'appareil
  (rejouer ne crée jamais de doublon) et **l'heure réelle du geste**. `applyOps` les applique à l'écran immédiatement.
- **File d'attente** : `localStorage`, liée au compte ET à l'espace (jamais d'envoi sous un autre compte). Annuler une action encore en attente
  l'efface sans que le serveur en entende parler. Synchronisation dans l'ordre, arrêt au premier échec réseau, rien n'est perdu.
- **Serveur** : `syncOperation` (idempotente, sans redirection : une session expirée n'efface rien), heure refusée si dans le futur (> 5 min) ou
  vieille de plus de 72 h. Les saisies faites hors ligne sont marquées `event_payload.offline = true`.
- **Service worker** (`public/sw.js`) : fichiers statiques en cache, pages de l'appli « réseau d'abord » avec dernière version vue, page `/hors-ligne`.
  Caches vidés à la déconnexion ; les saisies non envoyées restent liées au compte.
- **Dictée** (`src/lib/voice/parse.ts`, `voice-panel.tsx`) : transcription (Web Speech API) → interprétation → **proposition à confirmer**.
  Jamais d'enregistrement sans validation ; enfant incertain = à choisir ; phrase incomprise = aucune proposition.
- **Précisions à cocher** (`src/lib/journal/details.ts`) : quantité mangée, type de change, soin, note libre. Reprises dans le bilan WhatsApp si cochées.
- **Finances** : tableau de bord `/gestion` (enfants, contrats, revenus estimés par mensualisation, charges, solde indicatif), charges à cocher
  (`/gestion/charges`, catégorie « Autre » à préciser), export CSV protégé contre l'injection de formule. Montants en centimes entiers.

## Contrats et factures (PDF)

- **Moteur PDF** (`src/lib/pdf/`) : `pdf-lib` + police Nunito de la marque (`public/fonts`, licence OFL). Les PDF sont créés **dans le navigateur** :
  aucune donnée d'enfant n'est envoyée pour les fabriquer. Caractères non gérés (émojis…) retirés au lieu de faire échouer le document ;
  les champs absents restent des blancs à compléter à la main, rien n'est inventé.
- **Contrat d'accueil** : éditeur `/gestion/[enfant]/contrat` (choix à cocher, planning par jour, tarifs), détails privés dans `contracts.details`.
  Modèle à relire par les parties : il ne constitue pas un conseil juridique.
- **Facture** : `/gestion/factures`. « Paiement reçu » appelle `finalize_invoice` (une seule opération en base) : numéro continu propre à l'assistante
  (FAC-AAAA-0001), décompte figé, paiement enregistré. Double facturation d'un mois impossible, facture non modifiable.
- **Partage** : feuille de partage du téléphone avec le PDF (WhatsApp compris), sinon téléchargement + ouverture de WhatsApp. Jamais d'envoi automatique.

## Fiche santé, écran Urgence et messages aux parents

- **Fiche santé** (`child_health`, migration `…0008`) : allergies, régime, traitement, remarques, médecin, contacts d'urgence et personnes
  autorisées à récupérer l'enfant (6 au plus chacun). Données sensibles : tout est **saisi** par l'assistante, rien n'est déduit.
  Visible des membres actifs de l'espace (utile en MAM en cas d'urgence). L'audit ne conserve que qui / quoi / quand, jamais les valeurs.
  Contrainte d'unicité par `(organization_id, child_id)` : une erreur d'unicité ne révèle pas l'existence d'une fiche d'un autre espace.
  Validation : `src/lib/health/schema.ts` (zod) ; action `saveChildHealth` ; formulaire dans `/gestion/[enfant]#sante`.
- **Écran Urgence** `/aujourdhui/urgence/[enfant]` : 15 / 112 / 18, allergies mises en avant, médecin, parents, contacts, personnes autorisées,
  chaque numéro en lien `tel:`. Un numéro absent ou inexploitable n'est jamais deviné. Comme toute page de l'appli, il est gardé « réseau d'abord »
  par le service worker (disponible hors ligne s'il a déjà été ouvert ; oublié après 48 h et à la déconnexion).
- **Allergie** : badge sur la carte de l'enfant dans « Aujourd'hui » (uniquement ce qui est saisi).
- **Messages aux parents** `/aujourdhui/messages/[enfant]` : modèles dans `src/lib/messages/templates.ts` (absence, congés, horaire, venir chercher
  l'enfant, apporter quelque chose, rappel de règlement). Le texte est relu, modifiable, puis ouvert dans WhatsApp par l'utilisatrice
  (même composant que le bilan : case « J'ai relu », jamais d'envoi automatique). Un champ obligatoire manquant empêche tout texte ; aucun montant ni
  symptôme n'est inventé.

## Connexion avec Google

- Action `signInWithGoogle` (`src/app/actions/auth.ts`) → Google → Supabase → `/auth/callback` (échange du code PKCE contre la session).
  Destination de retour limitée aux chemins internes (`safeNextPath`) ; erreur ou refus → `/connexion?erreur=google`.
- Seuls nom et adresse e-mail sont reçus de Google. Le prénom alimente le profil (migration `…0009`), jamais une valeur inventée.
- L'e-mail et le mot de passe restent disponibles. Mise en service (Google Cloud + Supabase) : `docs/GOOGLE_SIGNIN.md`.

## Démonstration publique (`/demo`)

- **Aucune donnée, aucun compte, aucun appel serveur** : tout s'exécute dans le navigateur du visiteur, avec des enfants fictifs. Rien à nettoyer, rien à abuser,
  aucun risque de voir saisir de vraies données dans une base partagée. La page est publique (`PUBLIC_PATHS` dans `src/proxy.ts`).
- **Présentation animée** (« film » de 8 chapitres) : scénario et machine à états du lecteur dans `src/lib/demo/script.ts` (pure, testée) ; écrans dans
  `src/components/demo/screens.tsx`. Les animations sont en CSS (classes `d-*` dans `globals.css`, délais via `--d`) ; le lecteur gère pause, chapitres, clavier (← →).
  Mouvement réduit : pas de lecture automatique, contenu affiché dans son état final. L'onglet caché met en pause.
- **« Essayer vous-même »** (`src/components/demo/sandbox.tsx`) : les vrais gestes sur deux enfants fictifs. Les règles (une arrivée par présence, une sieste à la fois)
  et le **bilan** viennent du vrai code (`summarizeChildDay`, `buildDayReport`, `renderSummary`), donc ce que voit le visiteur est ce que produit l'application.
- **Urgence en démo** : numéros fictifs ; les boutons 15 / 112 / 18 ne composent jamais de numéro (`button`, pas `tel:`).
- L'ancien accès équipe (compte de démonstration protégé par code, `src/app/actions/demo.ts`) reste disponible, sous « Accès équipe » sur l'accueil.

## Couleurs fonctionnelles

- Une couleur = un sens, partout (écran du jour, démo, accueil, navigation) : **Arrivée** vert · **Départ** marine · **Repas** or · **Sieste/Réveil** violet doux ·
  **Change** turquoise · **Soins** rose. Jetons et classes dans `src/lib/ui/tones.ts` ; icône et teinte de chaque geste dans `src/lib/journal/labels.ts`
  (`ACTION_EMOJI`, `ACTION_TONE`). Pour changer une couleur : modifier ces deux fichiers (et les jetons `--color-*` de `globals.css`).
- **Règle d'accessibilité** : la couleur n'est jamais seule. Chaque bouton garde son émoji et son texte (en encre foncée, contraste élevé). Les alertes (allergie,
  urgence) restent en rose/rouge, réservé à l'attention.
- **Les émojis sont conservés** (choix du produit : ils parlent tout de suite) et accompagnés de leur teinte. Les icônes fines ne servent que pour les commandes (lecture, pause, flèches, coche).

## Profil de l'assistante et organisation de l'application

- **Onglets** : Aujourd'hui (journal) · Planning (fiche de présence) · Gestion (enfants, argent, papiers) · **Profil** (identité, impôts et documents, espace, données).
  L'ancien « Réglages » devient la page « Espace et données » (`/parametres`), accessible depuis le profil.
- **Profil** (`caregiver_profiles`, migration `…0010`) : identité, adresse du lieu d'accueil, agrément (numéro, dates, nombre d'enfants), assurance. **Strictement personnel** :
  la RLS ne laisse lire que son propre profil, y compris pour une responsable de MAM. Ni numéro de sécurité sociale ni coordonnées bancaires. Il pré-remplit contrats et factures
  (`fillEmployeeFromProfile` : il complète les blancs, n'écrase jamais) et alimente les **rappels d'échéance** (agrément, assurance ; bandeau sur « Aujourd'hui » et sur le profil).
- **Icône de l'enfant** : `children.gender` (`girl` / `boy`, facultatif, migration 0011) choisit l'icône 👧 / 👦 (`ChildAvatar`) ; sans choix, l'initiale. Jamais déduit du prénom ; choisi à la création ou sur la fiche de l'enfant.
- **Corriger sans rien perdre** (écran Aujourd'hui) : chaque geste de la « Journée de … » a « Modifier » (heure, réveil de sieste, précisions) et « Annuler ».
  Annuler = suppression logique (`deleted_at`) : le geste passe dans « Annulés aujourd'hui » et se **rétablit** d'un geste (opération `restore`). « Modifier » (opération `edit`) laisse la trace dans `daily_event_revisions`
  et propose « Annuler la modification ». Même un geste créé puis annulé hors ligne part au serveur avant d'être archivé.
- **Aide à la déclaration d'impôts** (`/profil/impots`, `src/lib/tax/`) : récapitulatif annuel par enfant, d'après les factures finalisées (année de **paiement**) et les présences du journal.
  Calcul du **régime de la somme forfaitaire** publié sur impots.gouv.fr : part imposable = rémunérations + indemnités − 3 × SMIC horaire × jours de garde (4 × avec majoration de salaire ;
  proratisé en dessous de 8 h ; jamais de déficit). L'exemple officiel (852 €) est un test. Le SMIC n'est prérempli que pour 2025 (11,88 €) : pour une autre année il est à saisir.
  **Tout est modifiable** avant génération (jours, heures, montants par mois, ajustement). Sorties : PDF (aide + attestation d'accueil par famille, générés dans le navigateur) et CSV.
  Ces documents sont une **aide**, jamais un justificatif officiel (bulletins, Pajemploi et déclaration pré-remplie font foi). Les règles et plafonds changent : à revérifier chaque année.
  **Remplissage automatique** (`src/lib/tax/estimate.ts`) : les mois terminés sans facture validée sont estimés d'après le contrat (mensualisation) et les présences pointées ; jamais le mois en cours.
  Ils sont marqués « estimé » (écran, PDF, CSV) et restent modifiables ; une facture validée remplace toujours l'estimation.
- **Dictée vocale** : chaque échec (autorisation, dictée iOS désactivée, silence, micro qui ne démarre pas) affiche un message et la marche à suivre ; la dictée du clavier du téléphone est toujours proposée.

## Administration de la plateforme (`/admin`)

Outil de l'éditeur : tableau de bord (comptes créés, connexions, comptes actifs, espaces, histogrammes sur 30 jours) et liste des comptes (recherche, méthode de connexion, suspension / réactivation).

- **Qui y accède** : les comptes listés dans `private.platform_admins` (migration 0012), **par identifiant de compte** — pas par e-mail, pas par rôle dans `profiles`. Table du schéma `private` (non exposée par l'API),
  alimentée à la main : `insert into private.platform_admins (user_id) select id from auth.users where email = '<adresse de l administrateur>';`
  Les autres visiteurs reçoivent une page « introuvable » (`requirePlatformAdmin`, `src/lib/auth/admin.ts`).
- **Pas de `service_role`** : toutes les lectures et actions passent par des fonctions `SECURITY DEFINER` (`admin_overview`, `admin_list_users`, `admin_set_user_suspended`) qui revérifient le droit à chaque appel
  (`private.require_platform_admin`). La page ne fait que de l'affichage ; la base décide.
- **Confidentialité** : l'administrateur ne voit que des comptes (prénom, e-mail, méthode, dates) et des **comptages** (espaces, enfants). Jamais un nom d'enfant, une fiche santé, un journal, un contrat ou une facture
  (test : les colonnes renvoyées sont figées). Le compte de démonstration (`DEMO_EMAIL`) est exclu des chiffres.
- **Connexions** : le journal d'audit de Supabase Auth est vide sur ce projet ; les connexions réussies (e-mail, Google) sont donc journalisées par `record_login` dans `private.login_events`
  (une ligne par minute et par compte au plus ; supprimées avec le compte). « Comptes actifs » s'appuie sur `auth.users.last_sign_in_at`. Jours comptés à l'heure de Paris.
- **Suspension** : `banned_until` + suppression des sessions ; l'accès en cours expire avec le jeton (au plus une heure), la reconnexion est refusée jusqu'à réactivation. On ne peut suspendre ni soi-même ni un autre administrateur.
  Chaque action est tracée dans `private.admin_actions`.
- **À venir** : visites du site (mesure sans cookies) et activation des comptes à l'abonnement (paiement).

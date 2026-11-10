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
| `src/app/(app)/` | Les 4 écrans : Aujourd'hui, Planning, Gestion, Réglages |
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
- **Parents et administration de la plateforme** : non exposés à ce stade (phase ultérieure).

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

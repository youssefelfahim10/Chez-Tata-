# Audit et sécurité

Dernière revue : 11 novembre 2026. Périmètre : dépôt, base Supabase réelle, application en production.

## Historique

Le 10 novembre 2026, le dépôt était **entièrement vide** (aucun commit, prototype ou thème). Tout a été construit depuis :
pointage, journal, contrats et factures PDF, fiche santé et Urgence, messages aux parents, profil et aide aux impôts,
démonstration publique, connexion Google. Le thème et les fiches A4 d'origine n'ont jamais été fournis : le thème actuel
(marine, rose, or, ivoire) est centralisé dans `src/app/globals.css`.

## Contrôles qui passent

- Aucun secret dans le dépôt ; `.env.local` ignoré ; `npm audit --omit=dev` : **0 vulnérabilité**.
- Aucune injection HTML (`dangerouslySetInnerHTML`, `innerHTML`, `eval`) ; aucun `console.log` applicatif.
- RLS activée sur **toutes** les tables, aucun droit `anon`, schéma `private` non exposé (test « active la RLS sur toutes les tables »).
- Attaque systématique d'un second compte sur l'API réelle (lecture, insertion, modification, suppression, fonctions, jeton falsifié) : tout est refusé.
- Toutes les Server Actions revérifient la session ; entrées validées par zod ; redirections filtrées.
- Cookies de session `httpOnly`, `sameSite=lax`, `secure` en production ; CSP, COOP `same-origin`.
- Saisies hors ligne oubliées après 48 h et vidées à la déconnexion.
- Accès démo : code serveur (comparaison en temps constant, délai sur échec), identifiants jamais exposés au navigateur.
- Corrections d'un geste tracées (`daily_event_revisions`) ; un geste annulé est archivé, jamais supprimé.

## Alertes connues et assumées

| Alerte (conseiller Supabase) | Pourquoi c'est voulu |
|---|---|
| `document_counters` : RLS sans politique | Aucun accès direct : seules les fonctions serveur numérotent les factures |
| 6 fonctions `SECURITY DEFINER` exécutables par `authenticated` (invitation, création d'espace, suppression du compte, facture…) | Ce sont les opérations sensibles, appelables uniquement par une personne connectée ; chacune revérifie ses droits (testé) |

## À décider ou à faire

- **Protection contre les mots de passe compromis** : réglage du tableau de bord Supabase (Auth), non activé à ce jour.
- CSP avec `'unsafe-inline'` pour les scripts (Next.js en injecte) : un nonce par requête rendrait toutes les pages dynamiques.
- Files de saisies hors ligne non chiffrées sur l'appareil.
- Pages légales (mentions, confidentialité, conditions) à faire relire par un professionnel ; registre RGPD à rédiger avant une ouverture large.
- Règles fiscales et SMIC : à revérifier chaque année (SMIC prérempli pour 2025 uniquement).
- Dépendances de développement : alertes modérées dans la chaîne ESLint (outils uniquement, non embarqués).
- Non testé sur appareil réel : dictée sur iPhone, connexion avec un vrai compte (les rendus ont été vérifiés avec des données fictives).

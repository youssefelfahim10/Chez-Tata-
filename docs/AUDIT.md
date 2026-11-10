# Audit du dépôt — 10 novembre 2026

## Constat principal

Le dépôt `youssefelfahim10/Chez-Tata-` était **entièrement vide** au moment de l'audit :
aucun commit, aucune branche, aucun fichier (ni README, ni AGENTS.md, ni prototype, ni fiches A4,
ni thème), aucune issue. Vérifié par `git ls-remote`, l'API GitHub (branches, issues) et le clone local.

Conséquences :

- Il n'y avait rien à réutiliser, corriger ou migrer ; rien n'a été supprimé ni réécrit.
- Aucune donnée n'était stockée dans le navigateur (pas de `localStorage` à migrer).
- **Le thème Chez TaTa et les fiches A4 existantes n'ont pas pu être repris** : ils ne sont pas dans le dépôt.
  Le thème actuel est provisoire et centralisé dans `src/app/globals.css` pour être remplacé en un seul endroit.

**Action attendue :** si un prototype existe ailleurs (autre dépôt, fichier local, outil no-code),
le pousser dans une branche `prototype` ou le transmettre, afin de reprendre le thème et les fiches A4
(issue « Importer le prototype »).

## État des lieux

| Élément | Existant | À conserver | À corriger | À créer |
|---|---|---|---|---|
| Prototype, thème, fiches A4 | Absent du dépôt | — | — | À importer dès réception |
| README / AGENTS.md | Absents | — | — | Créés |
| Structure Next.js + TypeScript + Tailwind | Absente | — | — | Créée |
| Authentification (inscription, connexion, confirmation) | Absente | — | — | Créée — à valider sur un projet Supabase |
| Organisations (indépendante / MAM), membres, invitations | Absentes | — | — | Créées (base testée ; écrans à valider en conditions réelles) |
| Schéma de données complet + RLS | Absent | — | — | Créé et testé (63 tests) |
| Écran Aujourd'hui (pointage, actions rapides, annulation) | Absent | — | — | Première version — à valider en conditions réelles |
| Planning et journal | Absent | — | — | À créer (semaine 2) |
| Contrats, finances, décomptes, PDF A4 | Absents | — | — | À créer (semaine 3) ; tables prêtes |
| Documents, archives, export, sauvegarde/restauration | Absents | — | — | À créer ; tables prêtes |
| Hors ligne (file d'attente, synchronisation) | Absent | — | — | À créer ; idempotence déjà en base |
| Partage WhatsApp du bilan, dictée vocale, assistant juridique | Absents | — | — | À créer (semaine 4) |
| Projet Supabase dédié, déploiement Vercel | Absents | — | — | En attente de validation |

## Dépendances et sécurité

- Dépendances de production : `npm audit --omit=dev` → **0 vulnérabilité**.
- Dépendances de développement : 8 alertes de gravité modérée dans la chaîne ESLint
  (`typescript-eslint`, via `eslint-config-next`) ; outils de développement uniquement, non embarqués
  dans l'application. À suivre lors des mises à jour.
- Aucun secret dans le dépôt ; `.env*` ignoré sauf `.env.example`.

## Audit de sécurité — 10 novembre 2026 (avant déploiement)

Périmètre : dépôt, base Supabase réelle, application construite en production.

**Contrôles qui passent**
- Aucun secret dans le dépôt ; `.env.local` ignoré ; `npm audit --omit=dev` : 0 vulnérabilité.
- Aucun `console.*`, aucune injection HTML (`dangerouslySetInnerHTML`, `innerHTML`, `eval`).
- 20 tables sur 20 avec RLS, 53 politiques, aucun droit `anon` (tables et fonctions), schéma `private` non exposé.
- Attaque systématique d'un second compte sur l'API réelle : 56 contrôles (lecture, insertion, modification, suppression sur toutes les
  tables, fonctions, schéma privé, administration Auth, jeton falsifié) — tous refusés.
- Toutes les Server Actions revérifient la session ; les entrées sont validées par zod ; les redirections sont filtrées.

**Écarts trouvés et corrigés**
| Écart | Correction |
|---|---|
| Cookies de session lisibles par JavaScript | `httpOnly`, `sameSite=lax`, `secure` en production (`src/lib/supabase/cookies.ts`) |
| Aucune politique de sécurité du contenu | CSP (connexions limitées à l'appli et Supabase, pas d'iframe ni de plugin), COOP `same-origin` |
| Routes de démonstration fictives `/apercu` | Supprimées (surface d'attaque inutile) |
| 15 clés étrangères sans index | Migration `20261110000004_fk_indexes.sql` |
| Pages gardées pour le hors ligne sans durée de vie | Oubliées après 48 h ; vidées à la déconnexion |
| Accès démo | Code d'accès serveur (comparaison en temps constant, délai sur échec) ; identifiants jamais exposés au navigateur |

**Écarts connus, non corrigés (à décider)**
- CSP avec `'unsafe-inline'` pour les scripts (Next.js en injecte) : un nonce par requête rendrait toutes les pages dynamiques.
- Protection contre les mots de passe compromis : option Supabase (dashboard) non activée ; la longueur minimale (10) est appliquée.
- Files de saisies hors ligne non chiffrées sur l'appareil.
- Mentions légales, politique de confidentialité, registre RGPD : à rédiger avant l'ouverture au public.

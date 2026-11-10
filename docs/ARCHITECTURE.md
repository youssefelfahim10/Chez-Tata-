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

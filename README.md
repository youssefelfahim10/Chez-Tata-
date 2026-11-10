# Chez TaTa

**Moins d'administratif, plus de temps pour les enfants.**
Application mobile-first pour les assistantes maternelles et les MAM en France.

> État : fondations (semaine 1). Voir [`docs/AUDIT.md`](docs/AUDIT.md) pour l'état des lieux
> et [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour les choix techniques.

## Pile technique

- Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4
- Supabase : Auth, PostgreSQL, Row Level Security
- Tests : Vitest + PGlite (vrai moteur PostgreSQL en mémoire, aucune installation requise)

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables Supabase
npm run dev
```

Appliquer le schéma sur un projet Supabase : `supabase db push` (CLI Supabase) ou exécuter
les fichiers de `supabase/migrations/` dans l'ordre.

Réglages Supabase Auth attendus : confirmation d'e-mail **activée**, mot de passe de 10 caractères
minimum, protection contre les mots de passe compromis activée, URL de redirection
`<site>/auth/confirm`. Modèle d'e-mail de confirmation :
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`.

## Vérifications

```bash
npm run lint
npm run typecheck
npm test          # isolation RLS (63 tests) + logique métier
npm run build
```

## Règles du projet

- Aucun secret dans le dépôt ni dans le navigateur. Jamais de clé `service_role` côté web.
- Toute nouvelle table : `organization_id`, RLS activée, privilèges explicites, tests d'isolation.
- Montants en centimes (entiers) ; aucune estimation n'est présentée comme une paie officielle.
- Aucune donnée personnelle réelle dans les tests.
- Aucun envoi automatique d'informations concernant un enfant (WhatsApp : toujours confirmé par l'utilisatrice).

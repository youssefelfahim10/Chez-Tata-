<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Chez TaTa — règles pour les agents

- Lire `docs/ARCHITECTURE.md` avant toute modification.
- Toute nouvelle table : colonne `organization_id`, RLS activée, privilèges explicites (rien pour `anon`),
  et tests dans `tests/db/isolation.test.ts`. Le test « active la RLS sur toutes les tables » doit rester vert.
- Ne jamais utiliser la clé `service_role` dans l'application web. Aucun secret dans le dépôt.
- Les Server Actions revérifient toujours la session (`requireUser` / `requireWorkspace`) et valident leurs entrées avec zod.
- Cache Components est activé : toute lecture de session se fait derrière un `<Suspense>`.
- Montants en centimes. Ne jamais présenter une estimation comme une paie officielle.
- Ne jamais inventer ni envoyer automatiquement une information concernant un enfant.
- Données de test fictives uniquement. Interface en français.
- Avant de livrer : `npm run lint && npm run typecheck && npm test && npm run build`.

# Accessibilité — audit WCAG 2.1 AA

Date : 13 novembre 2026. Méthode : axe-core (règles wcag2a/2aa/21a/21aa + best-practice) via Playwright, viewport mobile 390×844, sur le build de production local. Pages : accueil, connexion, confidentialité, conditions, mentions légales, suppression de compte, aide, et via la démo : Aujourd'hui, Gestion, Factures, éditeur de contrat, Réglages, Planning. Mesure manuelle des cibles tactiles (< 44 px).

## Constats et corrections

| # | Constat | Critère | Gravité | État |
|---|---------|---------|---------|------|
| 1 | Vert « leaf » `#2f8a18` sur fonds clairs : 4,0:1 (badges « Payée », notices de succès, « Présent ») | 1.4.3 | Sérieux | Corrigé : `#267012` (≥ 5,4:1 sur tous les fonds) |
| 2 | Or foncé « gold-deep » `#8f6f26` sur crème/sable : 4,3–4,4:1 (surtitres, pastilles) | 1.4.3 | Sérieux | Corrigé : `#7d5f1c` (≥ 5,5:1) |
| 3 | Squelette de chargement : `aria-label` sur un `div` sans rôle | 4.1.2 | Sérieux | Corrigé : `role="status"` |
| 4 | Accueil : section d'en-tête hors du landmark `main` | 1.3.1 / best-practice | Modéré | Corrigé : `main` englobe le hero |
| 5 | Liens du pied de page, du logo et « ← Retour » : hauteur 20–36 px | 2.5.5 (AAA, bonne pratique mobile) | Mineur | Corrigé : `min-h-11` (44 px) |
| 6 | Lien « Aide » : largeur 30 px (hauteur 44 px) | 2.5.5 | Mineur | Restant (espacement suffisant, critère AA 2.5.8 de WCAG 2.2 respecté) |
| 7 | Cases à cocher de l'éditeur de contrat 15–24 px | 2.5.5 | Mineur | Restant : elles sont dans un `label` cliquable plus grand ; à contrôler à la main |

Après correction : **0 violation axe** sur les 13 pages.

## Contrastes de la palette (texte normal ≥ 4,5:1)

- Marine `#06377c` sur blanc : 11,4:1. Encre `#0f1f3d` sur jaune `#fdb803` : 9,4:1.
- Gris doux `#5d6478` sur crème : ≥ 4,8:1. Danger `#b3261e` sur blanc : 6,5:1.
- Rose `#ed1359` : 4,3:1 sur blanc, **insuffisant pour du texte courant**. Il n'est utilisé que pour des éléments décoratifs ou un astérisque `aria-hidden`. Ne pas l'utiliser comme couleur de texte (utiliser `danger` ou `rose #c4104a`).
- Jaune `#fdb803` sur blanc : 1,7:1 → réservé aux fonds, jamais au texte.

## Restant (hors outils automatiques, à faire à la main avant publication)

- Test VoiceOver (iOS) et TalkBack (Android) sur le pointage et la dictée.
- Navigation clavier complète et zoom 200 %.
- Cases de l'éditeur de contrat (point 7).

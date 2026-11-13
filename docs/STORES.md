# Publication sur les stores — Chez TaTa

> Document de travail. Les valeurs marquées **TODO** sont à fournir par le propriétaire : rien n'est inventé.
> Domaine : `cheztata.app` · Package Android proposé : `fr.cheztata.app` (**définitif après publication — à confirmer**).

## 1. Google Play (Android) — en premier

### 1.1 Check-list de publication

- [ ] **Compte développeur Google Play** (25 $, paiement unique) — propriétaire uniquement. Vérification d'identité requise (personne ou organisation).
- [ ] Compte **personnel créé après nov. 2023** : Google impose un **test fermé** avant la production (au moins 12 testeurs inscrits pendant 14 jours consécutifs — vérifier les règles en vigueur dans la Play Console). Prévoir ce délai dans le calendrier.
- [ ] Créer l'application : nom, langue par défaut français (France), type « Application », gratuite/payante (**TODO : modèle économique**).
- [ ] **Play App Signing** : activer ; la clé d'import (upload key) est générée et gardée par le propriétaire, jamais dans le dépôt. Relever l'empreinte **SHA-256 de la clé de signature de l'application** (Console → Intégrité de l'application) et la fournir pour `/.well-known/assetlinks.json` (**TODO : empreinte**).
- [ ] Envoyer l'**AAB signé** (build TWA, workstream Android).
- [ ] **Digital Asset Links** : `https://cheztata.app/.well-known/assetlinks.json` doit référencer `fr.cheztata.app` + l'empreinte SHA-256 (sinon la barre d'URL s'affiche dans l'app).
- [ ] **Politique de confidentialité** : `https://cheztata.app/confidentialite` (le bloc éditeur doit être complété d'abord : voir `src/lib/legal.ts`, variables `NEXT_PUBLIC_LEGAL_*` et `NEXT_PUBLIC_CONTACT_EMAIL`).
- [ ] **Suppression de compte** — URL web : `https://cheztata.app/suppression-compte` ; en plus, suppression dans l'app (Réglages → Mes données). Les deux sont exigés par Google.
- [ ] **Classification du contenu** (questionnaire IARC) : aucune violence, contenu sexuel, jeu d'argent, achats… Catégorie attendue : « Utilitaires/Productivité ». Répondre honnêtement ; pas d'interaction entre utilisateurs publics.
- [ ] **Public cible** : adultes (professionnelles de l'accueil). **Ne pas cibler les enfants** (évite le programme « Familles »). Même si l'app traite des données d'enfants, ils n'en sont pas les utilisateurs.
- [ ] **Application de santé ?** : répondre « non » (ce n'est pas une app médicale), mais déclarer les données de santé saisies (voir 1.2).
- [ ] **Coordonnées du développeur** : e-mail public **TODO**, adresse postale **TODO** (obligatoire pour les comptes organisation / apps payantes).
- [ ] Captures d'écran téléphone (min. 2, ratio 9:16, 1080×1920 recommandé) : à produire depuis le compte démo.
- [ ] Icône 512×512 et image de présentation 1024×500 : fournies dans `store-assets/`.
- [ ] Pays de distribution (**TODO**, ex. France), tarification, déclarations (pubs : **aucune**, achats intégrés : **aucun** à ce jour).
- [ ] Test fermé → production : envoi pour examen (de quelques heures à plusieurs jours).

### 1.2 Fiche « Sécurité des données » (Data safety) — réponses proposées

Basées sur les données réellement traitées (voir `/confidentialite`). À revérifier avant envoi.

**Questions générales**
| Question | Réponse |
|---|---|
| L'application collecte ou partage-t-elle des données ? | Oui (collecte), **pas de partage** à des tiers à des fins propres (Supabase et Vercel agissent comme sous-traitants) |
| Données chiffrées en transit ? | **Oui** (HTTPS) |
| Les utilisateurs peuvent-ils demander la suppression ? | **Oui** (dans l'app + URL web) |

**Types de données collectées** (finalité : fonctionnalité de l'app ; non utilisées pour publicité ni analyse tierce)
| Catégorie Play | Donnée | Obligatoire | Remarque |
|---|---|---|---|
| Infos personnelles → Adresse e-mail | e-mail du compte | Oui | authentification |
| Infos personnelles → Nom | prénom affiché ; noms/prénoms des enfants et des parents saisis | Oui/Non | saisis par l'assistante |
| Infos personnelles → Adresse / Numéro de téléphone | contacts des familles | Non | optionnel |
| Infos personnelles → Autres | date de naissance des enfants | Non | saisie par l'assistante |
| Santé et forme physique → Informations de santé | soins, médicaments, allergies, notes | Non | optionnel, saisi par l'assistante |
| Infos financières → Autres | contrats, factures, paiements, charges | Non | modèles d'aide à la gestion |
| Identifiants de l'appareil/autres | **non collectés** | — | pas de traceur publicitaire |
| Audio | **non collecté** : la dictée utilise la reconnaissance vocale du téléphone ; aucun enregistrement n'est reçu ni conservé | — | à mentionner dans la description |
| Localisation, contacts du téléphone, photos, historique web | **non collectés** | — | |

Partage : « Non » pour toutes les catégories. Traitement éphémère : non. Données obligatoires pour utiliser l'app : e-mail.

### 1.3 Textes de la fiche (français)

**Titre (≤ 30 caractères)** — 20 car. :
```
Chez TaTa
```
Variante avec mots-clés (28 car.) : `Chez TaTa – Assistante mat.`

**Description courte (≤ 80 caractères)** — 79 car. :
```
Journal, planning, contrats et factures des assistantes maternelles et MAM.
```

**Description complète (≤ 4000 caractères)** :
```
Chez TaTa est le carnet de bord des assistantes maternelles et des MAM : on coche, on dicte, c'est noté.

POINTER LA JOURNÉE EN QUELQUES TOUCHES
• Arrivées, départs, repas, siestes, changes et soins : des cases à cocher plutôt que du texte à écrire.
• Dictée vocale : parlez, l'application vous propose ce qu'elle a compris et vous confirmez avant d'enregistrer. Rien n'est ajouté sans votre validation.
• Mode hors ligne : continuez à pointer sans réseau, tout est envoyé automatiquement au retour de la connexion.

PLANNING ET SUIVI
• Vue de la journée et du planning des enfants accueillis.
• Tableau de bord : nombre d'enfants, présences, heures.

CONTRATS ET FACTURES
• Générez un contrat d'accueil clair et professionnel, au format PDF.
• Dès que le paiement est reçu, un clic : la facture du mois est créée et numérotée.
• Partagez-la vous-même par WhatsApp ou autre, quand vous le décidez.

CHARGES ET FINANCES
• Cochez vos charges, suivez votre activité mois par mois.
• Les montants affichés sont des estimations d'aide à la gestion : ce ne sont ni un bulletin de salaire ni une déclaration officielle.

VOS DONNÉES, VOTRE CONTRÔLE
• Aucun envoi automatique d'information concernant un enfant : vous relisez et vous envoyez vous-même.
• Pas de publicité, pas de traceur publicitaire, aucune revente de données.
• Données hébergées dans l'Union européenne.
• Dans une MAM, enfants et journal sont partagés ; contrats et finances restent privés à chaque assistante.
• Téléchargez vos données ou supprimez votre compte à tout moment depuis Réglages → Mes données.

Pour toute question : contact@cheztata.app (TODO : confirmer l'adresse de contact).
```
*(≈ 1 900 caractères ; marge large sous la limite de 4000.)*

**Notes de version (≤ 500 car.)** : `Première version de Chez TaTa : journal, planning, contrats, factures et mode hors ligne.`

## 2. Apple App Store (iOS) — feuille de route (après Android)

1. **Apple Developer Program** : 99 €/an, propriétaire uniquement (identité, éventuellement numéro D-U-N-S si compte organisation).
2. **Encapsulation** : application native fine avec **Capacitor** (WKWebView) chargeant `https://cheztata.app`. Compilation sur Mac, ou **cloud CI** (Codemagic, Xcode Cloud, GitHub Actions `macos-*`) — pas de Mac local requis.
3. **Guideline 4.2 (fonctionnalité minimale) — risque élevé** pour un simple site encapsulé. Mitigations :
   - plugins natifs réels : partage natif (feuille de partage pour PDF/WhatsApp), reconnaissance vocale native, retour haptique, stockage sécurisé ;
   - mode hors ligne fonctionnel (file d'attente locale) ;
   - notifications locales (rappels), icône de badge ;
   - décrire la valeur métier dans les notes de revue ;
   - compte de démonstration fourni aux relecteurs (code d'accès de démo, **TODO : à transmettre en privé dans App Store Connect, jamais dans le dépôt**).
4. **Suppression de compte dans l'app** : obligatoire (guideline 5.1.1(v)) — déjà présent (Réglages → Mes données).
5. **Étiquettes de confidentialité (« nutrition labels »)** : « Données liées à l'utilisateur » : e-mail, nom, coordonnées, informations de santé, informations financières ; finalité : fonctionnement de l'app ; **aucun suivi (tracking)**, pas de SDK publicitaire.
6. **Autorisations** : texte d'usage du micro et de la reconnaissance vocale (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) en français.
7. **Connexion** : pas de réseaux sociaux (donc pas d'obligation « Sign in with Apple »).
8. **Captures d'écran** : iPhone 6,9" **1290×2796** (obligatoire), iPad si compatible (**TODO : décider**) ; textes marketing FR ; icône 1024×1024 sans transparence.
9. **Mentions** : URL de confidentialité `https://cheztata.app/confidentialite`, URL d'assistance `https://cheztata.app/aide`, notes de revue.
10. TestFlight (test interne) → soumission à la revue (24–48 h en général).

## 3. Ce que seul le propriétaire peut faire

- [ ] Créer et payer le compte Google Play (25 $) ; plus tard Apple Developer (99 €/an) ; vérification d'identité.
- [ ] Confirmer le **package** `fr.cheztata.app`.
- [ ] Fournir les **informations légales** : raison sociale/nom, adresse, SIRET, directeur de publication, e-mail de contact (variables `NEXT_PUBLIC_LEGAL_*`, `NEXT_PUBLIC_CONTACT_EMAIL` sur Vercel).
- [ ] Générer/garder la **clé d'import** (upload key) et fournir l'empreinte SHA-256 de la clé de signature Play.
- [ ] Recruter les **testeurs du test fermé** (si compte personnel récent).
- [ ] Déclarer pays, tarification, public cible, questionnaire de classification.
- [ ] Appliquer dans Supabase (confirmation) les migrations 0006 et 0007 et régler l'URL du site (`https://cheztata.app`) dans Authentication → URL Configuration.
- [ ] Appuyer sur « Envoyer pour examen » dans chaque console.

## 4. Visuels (dossier `store-assets/`)

| Fichier | Usage |
|---|---|
| `icon-512.png` | Icône Google Play (512×512) |
| `feature-graphic-1024x500.png` | Image de présentation Google Play (1024×500) |
| *(à produire)* captures 1080×1920 (Android), 1290×2796 (iOS) | depuis le compte démo |

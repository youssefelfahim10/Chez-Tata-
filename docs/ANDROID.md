# Application Android — Chez TaTa

L'application Android est une **Trusted Web Activity (TWA)** : une coque Android qui ouvre `https://chez-tata.vercel.app` en plein écran, sans barre d'adresse.
Il n'y a pas de seconde application à maintenir : chaque mise en ligne du site met à jour l'appli Android.

## Ce qui est déjà prêt dans le dépôt

| Exigence | Où |
|---|---|
| PWA installable (manifeste, icônes 192/512 dont « maskable », service worker hors ligne) | `src/app/manifest.ts`, `public/sw.js` |
| Lien de confiance site ↔ appli (`/.well-known/assetlinks.json`) | `src/lib/android.ts`, `src/app/.well-known/assetlinks.json/route.ts` |
| Politique de confidentialité (URL exigée par Google Play) | `/confidentialite` |
| Suppression de compte **dans l'appli** (Profil → Mes données) **et** par un **lien web** (exigé par Google Play) | `/suppression-compte` |
| Information sur les cookies et le stockage | `/cookies` |
| Conditions d'utilisation, mentions légales | `/conditions`, `/mentions-legales` |
| Acceptation des conditions à l'inscription | `src/components/auth-forms.tsx` |
| Aucun traceur, aucune mesure d'audience tierce : pas de bandeau de consentement nécessaire (cookies strictement nécessaires) | `/cookies` |

## Ce qu'il faut renseigner avant de publier (rien n'est inventé par le code)

Les pages légales lisent des variables d'environnement Vercel (Production). Tant qu'elles sont vides, elles affichent « À compléter », **ce que Google Play refuse**
(adresse de contact et identité de l'éditeur obligatoires) :

| Variable | Contenu |
|---|---|
| `NEXT_PUBLIC_LEGAL_NAME` | Nom de l'éditeur (votre nom ou la raison sociale) |
| `NEXT_PUBLIC_LEGAL_ADDRESS` | Adresse postale de l'éditeur |
| `NEXT_PUBLIC_LEGAL_REGISTRATION` | SIRET ou numéro d'immatriculation (ou mention « Particulier » si aucun) |
| `NEXT_PUBLIC_LEGAL_DIRECTOR` | Directeur de la publication |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Adresse e-mail de contact (affichée sur les pages légales et sur la page de suppression de compte) |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | Empreinte(s) SHA-256 du certificat de signature (voir étape 4) |
| `ANDROID_PACKAGE_NAME` | Facultatif. Par défaut `app.cheztata.android`. **Définitif après la première publication.** |

Ces variables sont publiques par nature (elles s'affichent sur le site) : rien de secret ici. Après modification, il faut redéployer.

## Marche à suivre

1. **Compte Google Play Console** (vous seul pouvez le créer : identité et frais d'inscription uniques). Un compte *personnel* créé après le 13 novembre 2023 doit,
   avant la production, avoir mené un **test fermé avec au moins 12 testeurs inscrits en continu pendant 14 jours**
   ([règle Google](https://support.google.com/googleplay/android-developer/answer/14151465)).
2. **Fabriquer le paquet** (`.aab`) : [pwabuilder.com](https://www.pwabuilder.com) → adresse `https://chez-tata.vercel.app` → *Package for stores* → *Android*.
   Nom de l'appli « Chez TaTa », identifiant de paquet `app.cheztata.android`, URL de démarrage `/aujourdhui`, notifications désactivées, localisation désactivée.
   **Conservez précieusement le fichier de clé (`.keystore`) et son mot de passe** : sans eux, impossible de publier une mise à jour. Ne les mettez jamais dans le dépôt.
3. **Envoyer le `.aab`** dans Play Console, piste *Test fermé*, et inscrire les testeurs (leurs adresses Google).
4. **Déclarer l'empreinte** : Play Console → *Intégrité de l'appli* → *Signature d'appli* → copier l'« Empreinte du certificat SHA-256 » de la **clé de signature**
   dans `ANDROID_SHA256_CERT_FINGERPRINTS` (Vercel → Settings → Environment Variables), redéployer, puis vérifier que
   `https://chez-tata.vercel.app/.well-known/assetlinks.json` affiche cette empreinte. Sans cela, l'appli s'ouvre avec une barre d'adresse.
5. **Fiche Play Store** (rubrique *Contenu de l'appli*) : voir les réponses proposées ci-dessous.
6. Après 14 jours et 12 testeurs : *Demander l'accès à la production*.

En attendant le Play Store, **l'installation directe fonctionne déjà** : sur Android, ouvrir le site dans Chrome → ⋮ → *Installer l'application*.

## Réponses proposées pour Play Console (à relire par vous)

- **URL de la politique de confidentialité** : `https://chez-tata.vercel.app/confidentialite`
- **URL de suppression de compte** : `https://chez-tata.vercel.app/suppression-compte` (cite « Chez TaTa », explique la suppression dans l'appli et par e-mail).
- **Public cible** : adultes (professionnelles de l'accueil du jeune enfant). Ne pas cibler les enfants.
- **Catégorie** : Productivité ou Affaires. **Publicités** : aucune.
- **Sécurité des données** :
  - Données collectées : *Informations personnelles* (nom, adresse e-mail) ; *Santé* (notes de santé des enfants saisies par l'assistante : allergies, soins) ;
    *Infos financières* (montants de contrats et de factures saisis) ; *Activité dans l'appli* (journal de connexion).
  - Partagées avec des tiers : **non** (Supabase et Vercel agissent comme prestataires techniques pour le compte de l'éditeur).
  - Chiffrement en transit : **oui** (HTTPS). Suppression possible par l'utilisateur : **oui** (dans l'appli et via le lien web).
  - Audio : non collecté par l'éditeur (la dictée vocale passe par la reconnaissance vocale du téléphone ; aucun enregistrement conservé).
- **Déclaration « applications de santé »** : l'appli enregistre des informations de santé saisies par l'utilisatrice sur des enfants ; répondre fidèlement au questionnaire
  (ce n'est pas un dispositif médical et aucun conseil de santé n'est donné).

> Ces textes et réponses sont des propositions fondées sur le fonctionnement réel de l'appli. Les obligations RGPD pour des données de santé d'enfants
> (registre des traitements, analyse d'impact, rôle de sous-traitant) méritent une relecture par un juriste ou la CNIL avant un lancement large.

## Mises à jour

Publier une nouvelle version du site suffit : la TWA charge le site à chaque ouverture. Un nouveau `.aab` n'est nécessaire que pour changer l'icône, le nom,
l'identifiant ou les raccourcis de l'appli Android, avec un numéro de version supérieur.

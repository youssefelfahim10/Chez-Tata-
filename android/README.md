# Application Android — Chez TaTa (Trusted Web Activity)

Coque Android qui ouvre le site en plein écran, sans barre d'adresse. Aucune logique métier ici : chaque mise en ligne du site met l'application à jour.
Le contexte Play Store (fiche, Data safety, règle des 12 testeurs) est dans [`docs/ANDROID.md`](../docs/ANDROID.md).

| | |
|---|---|
| Identifiant de l'application | `app.cheztata.android` (**définitif après la première publication**) |
| Site ouvert | `https://cheztata.app/aujourdhui` (hôte réglable : `-PtwaHost=…` ou variable `TWA_HOST`) |
| minSdk / targetSdk | 23 / 36 |
| Couleur | `#06377c` |
| Permissions | `INTERNET` seulement (la dictée est gérée par Chrome, pas par l'application) |

> L'identifiant doit être le même que `ANDROID_PACKAGE_NAME` sur Vercel (par défaut `app.cheztata.android`, valeur déjà prévue par `src/lib/android.ts`).

## Ce que vous devez faire (vous seul·e)

1. **Créer le compte Google Play Console** (identité + frais uniques).
2. **Générer votre clé d'envoi** (une seule fois, à garder précieusement : sans elle, plus de mises à jour) :
   ```bash
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Ne mettez **jamais** ce fichier dans le dépôt (`*.jks` est ignoré). Sauvegardez-le avec son mot de passe dans un gestionnaire de mots de passe.
3. **Ajouter 4 secrets** dans GitHub → *Settings → Secrets and variables → Actions* :
   - `KEYSTORE_BASE64` : `base64 -w0 upload.jks`
   - `KEYSTORE_PASSWORD` : mot de passe du fichier
   - `KEY_ALIAS` : `upload` (l'alias choisi ci-dessus)
   - `KEY_PASSWORD` : mot de passe de la clé
4. **Lancer le build** : GitHub → *Actions → Android (AAB signé) → Run workflow*. Récupérez l'artefact `cheztata-signe-aab` (fichier `.aab`).
   S'il s'appelle `cheztata-NON-signe-aab`, les secrets ne sont pas lus : le fichier est inutilisable sur Google Play.
5. **Envoyer le `.aab`** dans Play Console (piste *Test fermé*), en activant **Play App Signing**.
6. **Relier le site à l'application** (sinon une barre d'adresse reste visible) :
   Play Console → *Intégrité de l'appli* → *Signature d'appli* → copier l'**empreinte SHA-256 du certificat de signature** (celle de la *clé de signature d'appli*, pas de la clé d'envoi)
   → Vercel → *Settings → Environment Variables* → `ANDROID_SHA256_CERT_FINGERPRINTS` (plusieurs empreintes possibles, séparées par des virgules ; ajoutez aussi celle de la clé d'envoi si vous testez un `.aab` installé hors Play)
   → redéployer → vérifier que `https://cheztata.app/.well-known/assetlinks.json` affiche l'empreinte.

Rappel : le domaine `cheztata.app` doit être rattaché au projet Vercel avant la publication, sinon le lien de confiance et l'ouverture de l'application ne fonctionnent pas.

## Build local (facultatif)

Prérequis : JDK 17, Android SDK (plateforme 36), Gradle 8.14+.

```bash
gradle -p android bundleRelease -PtwaHost=cheztata.app
```

Pour signer en local, créez `android/keystore.properties` (ignoré par git) avec `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
Sans clé, le paquet est construit non signé.

## Versions

Le workflow utilise `GITHUB_RUN_NUMBER` comme `versionCode` (toujours croissant, exigé par Play). `versionName` se règle au lancement du workflow.
Un nouveau `.aab` n'est nécessaire que pour changer l'icône, le nom, l'identifiant ou l'hôte : les changements du site n'en demandent pas.

# Connexion avec Google — mise en service

Le code est prêt (bouton « Continuer avec Google », retour `/auth/callback`). Il reste la configuration chez Google et chez Supabase.
Aucun secret n'entre dans le dépôt : l'identifiant et le secret du client Google se saisissent uniquement dans Supabase.

## 1. Google Cloud Console
1. Créer (ou choisir) un projet, puis **API et services → Écran de consentement OAuth** : type « Externe », nom « Chez TaTa », e-mail d'assistance,
   logo facultatif. Champs (scopes) : seulement `email`, `profile`, `openid` (par défaut, rien de sensible).
2. **Identifiants → Créer des identifiants → ID client OAuth → Application Web.**
3. **URI de redirection autorisé** : `https://<REF-DU-PROJET>.supabase.co/auth/v1/callback` (la valeur exacte est affichée dans Supabase, page du fournisseur Google).
4. Noter l'**ID client** et le **secret client**.
5. Tant que l'écran de consentement est en mode « Test », seuls les comptes ajoutés comme « utilisateurs test » peuvent se connecter (ajoutez la tante).
   Pour ouvrir à tous, passer en « Production » (les scopes de base ne demandent pas de validation approfondie).

## 2. Supabase (projet de production)
1. **Authentication → Providers → Google** : activer, coller l'ID client et le secret client.
2. **Authentication → URL Configuration** :
   - **Site URL** : l'adresse publique de l'application ;
   - **Redirect URLs** : `https://<domaine>/auth/callback` (ajouter aussi `http://localhost:3000/auth/callback` pour le développement
     et, si besoin, le motif des préversions Vercel).
3. Vérifier que le projet est bien dans la région UE.

## 3. Application
- `NEXT_PUBLIC_SITE_URL` doit valoir l'adresse publique (sinon l'adresse de la requête est utilisée).
- Migration `…0009_google_display_name.sql` : reprend le prénom de Google pour « Bonjour {prénom} ! ».

## 4. Activer le bouton
Le bouton reste **invisible** tant que la variable `NEXT_PUBLIC_GOOGLE_SIGNIN` n'est pas égale à `on` (Vercel → Settings → Environment Variables, environnements
Production et Preview). Sa valeur est intégrée à la construction : après l'avoir ajoutée, **redéployer** le projet.

## 5. Test de bout en bout
1. Ouvrir `/connexion` sur téléphone → « Continuer avec Google » → choisir le compte.
2. Retour sur l'application : création de l'espace (`/bienvenue`) pour un nouveau compte, ou « Aujourd'hui » pour un compte existant.
3. Refuser l'accès chez Google : retour sur `/connexion` avec un message, sans erreur technique.

## À savoir
- Un compte Google = un compte Chez TaTa lié à cette adresse e-mail. Si la même adresse existe déjà par e-mail et mot de passe,
  Supabase peut les lier selon la configuration du projet (à vérifier dans Authentication → Settings).
- La suppression de compte (Réglages) fonctionne sans mot de passe : elle convient aux comptes Google.

/**
 * Le bouton « Continuer avec Google » n'apparaît que si la connexion Google est configurée
 * (Google Cloud + Supabase, voir docs/GOOGLE_SIGNIN.md) ET activée par la variable NEXT_PUBLIC_GOOGLE_SIGNIN=on.
 * Sans cela, aucun visiteur ne voit un bouton qui ne marcherait pas.
 * Variable « publique » : sa valeur est intégrée au site à la construction ; après changement, redéployer.
 */
export const GOOGLE_SIGNIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on";

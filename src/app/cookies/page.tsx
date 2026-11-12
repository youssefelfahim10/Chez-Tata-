import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookies et stockage sur votre appareil" };

export default function Page() {
  return (
    <LegalPage
      title="Cookies et stockage sur votre appareil"
      intro="Chez TaTa n'utilise que ce qui est indispensable pour que l'application fonctionne. Aucun cookie publicitaire, aucune mesure d'audience, aucun réseau social : c'est pourquoi vous ne voyez pas de bandeau à accepter."
    >
      <section>
        <h2>Ce qui est enregistré, et pourquoi</h2>
        <ul>
          <li>
            <b>Cookie de session</b> (noms commençant par <code>sb-</code>) : il vous garde connectée. Il est illisible par les scripts de la page, envoyé uniquement en HTTPS et
            jamais depuis un autre site. Il disparaît quand vous vous déconnectez.
          </li>
          <li>
            <b>Cookie d&apos;espace actif</b> (<code>ct_org</code>) : il retient l&apos;espace que vous avez choisi (par exemple votre espace ou celui de votre MAM). Il dure un an et ne contient
            qu&apos;un identifiant technique, jamais de nom ni de donnée d&apos;enfant.
          </li>
          <li>
            <b>Stockage de l&apos;appareil</b> (<code>ct_offline_queue_v1</code>) : quand vous n&apos;avez pas de réseau, vos saisies attendent sur votre téléphone et partent dès le retour de la connexion.
          </li>
          <li>
            <b>Mémoire hors ligne</b> (cache du navigateur) : les dernières pages vues sont gardées 48 heures pour rester consultables sans réseau. Elle est vidée quand vous vous déconnectez.
          </li>
        </ul>
        <p>
          Ces éléments sont <b>strictement nécessaires</b> au service que vous demandez : la réglementation ne demande donc pas votre accord préalable, mais exige de vous informer, ce que fait cette page.
        </p>
      </section>

      <section>
        <h2>Ce que nous n&apos;utilisons pas</h2>
        <ul>
          <li>Pas de cookie publicitaire ni de profilage.</li>
          <li>Pas de mesure d&apos;audience par un service tiers, ni de bouton de réseau social.</li>
          <li>Aucune donnée vendue ou cédée.</li>
        </ul>
        <p>
          Si nous ajoutons un jour une mesure de fréquentation, elle sera conçue pour ne déposer ni cookie ni identifiant, ou elle vous sera proposée avec un choix clair. Cette page serait alors mise à jour.
        </p>
      </section>

      <section>
        <h2>Connexion avec Google</h2>
        <p>
          Si vous choisissez « Continuer avec Google », vous passez par une page de Google, qui peut déposer ses propres cookies sur google.com selon sa politique. Chez TaTa n&apos;en dépose aucun de ce fait.
          Vous pouvez aussi vous connecter avec une adresse e-mail et un mot de passe.
        </p>
      </section>

      <section>
        <h2>Les effacer ou les bloquer</h2>
        <p>
          Se déconnecter supprime le cookie de session et vide la mémoire hors ligne. Vous pouvez aussi effacer les données du site depuis les réglages de votre navigateur ou de l&apos;application
          Android (Paramètres → Applications → Chez TaTa → Stockage). Bloquer le cookie de session vous empêchera de vous connecter.
        </p>
      </section>

      <section>
        <h2>Pour en savoir plus</h2>
        <p>
          Voir la <Link href="/confidentialite">politique de confidentialité</Link>. Une question : <Contact />.
        </p>
      </section>
    </LegalPage>
  );
}

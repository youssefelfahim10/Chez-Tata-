import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Supprimer mon compte" };

export default function Page() {
  return (
    <LegalPage title="Supprimer mon compte et mes données" intro="Vous pouvez supprimer votre compte vous-même, à tout moment, sans nous écrire.">
      <section>
        <h2>Dans l&apos;application (le plus rapide)</h2>
        <ol className="list-decimal pl-6">
          <li>Connectez-vous à Chez TaTa.</li>
          <li>Ouvrez l&apos;onglet <b>Réglages</b>, section <b>Mes données</b>.</li>
          <li>Appuyez sur <b>Supprimer mon compte</b>, tapez « SUPPRIMER » puis confirmez.</li>
        </ol>
        <p>Vous pouvez d&apos;abord <b>télécharger vos données</b> depuis la même section.</p>
      </section>
      <section>
        <h2>Ce qui est supprimé</h2>
        <ul>
          <li>Votre compte et votre profil.</li>
          <li>Si vous êtes seule dans votre espace : tous les enfants, familles, journaux, contrats, factures, paiements et charges de cet espace.</li>
          <li>Si vous faites partie d&apos;une MAM : vos contrats, factures, paiements et charges personnels ; vos saisies dans le journal des enfants restent pour la MAM mais deviennent anonymes.</li>
        </ul>
        <p>La suppression est <b>définitive</b> et immédiate pour le service. Les sauvegardes techniques sont renouvelées automatiquement par l&apos;hébergeur.</p>
      </section>
      <section>
        <h2>Vous ne pouvez plus vous connecter ?</h2>
        <p>Écrivez-nous depuis l&apos;adresse e-mail du compte : <Contact />. Nous traitons la demande sous un mois. Voir aussi la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
      </section>
    </LegalPage>
  );
}

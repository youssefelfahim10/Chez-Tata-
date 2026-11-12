import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Page() {
  return (
    <LegalPage title="Conditions d’utilisation" intro="En créant un compte, vous acceptez les règles simples ci-dessous.">
      <section>
        <h2>1. Le service</h2>
        <p>Chez TaTa est un carnet de bord pour assistantes maternelles et MAM : pointage de la journée, planning, charges, contrats et factures, partage de bilans. Le service évolue ; certaines fonctions peuvent changer.</p>
      </section>
      <section>
        <h2>2. Votre compte</h2>
        <ul>
          <li>Chez TaTa est destiné aux professionnelles de l&apos;accueil du jeune enfant (assistantes maternelles, MAM), majeures. Il n&apos;est pas destiné aux enfants.</li>
          <li>Vous êtes responsable de la confidentialité de votre mot de passe et de l&apos;usage de votre compte.</li>
          <li>Les informations que vous saisissez doivent être exactes et vous devez avoir le droit de les utiliser (notamment celles des familles et des enfants accueillis).</li>
          <li>Vous partagez des informations sur un enfant uniquement avec ses parents ou représentants, et vous restez responsable de ces envois.</li>
          <li>Vous n&apos;utilisez pas le service pour un usage illicite, pour porter atteinte à la sécurité du service ou à celle d&apos;autres utilisateurs, ni pour y enregistrer des contenus étrangers à l&apos;accueil des enfants.</li>
        </ul>
      </section>
      <section>
        <h2>3. Documents et calculs</h2>
        <p>
          Les contrats, factures, estimations de revenus et totaux sont des aides à la gestion. Ils ne remplacent ni un conseil juridique, ni la convention collective, ni le bulletin de salaire ou la déclaration Pajemploi, qui font foi.
          Vérifiez-les avant de les signer ou de les envoyer.
        </p>
      </section>
      <section>
        <h2>4. Disponibilité et responsabilité</h2>
        <p>Nous mettons tout en œuvre pour que le service soit disponible et sûr, sans garantie d&apos;absence d&apos;interruption. Notre responsabilité ne peut être engagée pour un usage contraire à ces conditions ni pour les décisions prises à partir d&apos;estimations.</p>
      </section>
      <section>
        <h2>5. Fin du service</h2>
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis <b>Profil → Mes données</b> (voir <a href="/suppression-compte">Supprimer mon compte</a>). Nous pouvons suspendre un compte en cas d&apos;usage abusif ou illicite :
          la personne ne peut alors plus se connecter, ses données restent intactes et elle peut nous écrire pour en discuter.
        </p>
      </section>
      <section>
        <h2>6. Évolution du service et des offres</h2>
        <p>
          Le service évolue. Des fonctions payantes pourront être proposées plus tard : aucun paiement ne vous sera demandé sans que vous l&apos;ayez accepté clairement. Si ces conditions changent de façon importante, vous en êtes informée
          dans l&apos;application. Voir aussi la <a href="/confidentialite">politique de confidentialité</a> et la page <a href="/cookies">Cookies</a>.
        </p>
      </section>
      <section>
        <h2>7. Droit applicable</h2>
        <p>Ces conditions sont régies par le droit français. Pour toute question : <Contact />.</p>
      </section>
    </LegalPage>
  );
}

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
          <li>Vous êtes responsable de la confidentialité de votre mot de passe et de l&apos;usage de votre compte.</li>
          <li>Les informations que vous saisissez doivent être exactes et vous devez avoir le droit de les utiliser (notamment celles des familles et des enfants accueillis).</li>
          <li>Vous partagez des informations sur un enfant uniquement avec ses parents ou représentants, et vous restez responsable de ces envois.</li>
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
        <p>Vous pouvez supprimer votre compte à tout moment depuis <b>Réglages → Mes données</b>. Nous pouvons suspendre un compte en cas d&apos;usage abusif ou illicite.</p>
      </section>
      <section>
        <h2>6. Droit applicable</h2>
        <p>Ces conditions sont régies par le droit français. Pour toute question : <Contact />.</p>
      </section>
    </LegalPage>
  );
}

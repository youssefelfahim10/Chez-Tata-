import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Aide et contact" };

export default function Page() {
  return (
    <LegalPage title="Aide et contact" intro="Une question, un problème, une idée ? Voici les réponses rapides.">
      <section>
        <h2>Nous contacter</h2>
        <p>Écrivez-nous : <Contact />. Précisez votre téléphone (Android ou iPhone) et ce que vous faisiez quand le problème est apparu.</p>
      </section>
      <section>
        <h2>Questions fréquentes</h2>
        <ul>
          <li><b>Puis-je pointer sans réseau ?</b> Oui : arrivées, repas, siestes, changes et soins sont gardés sur le téléphone et envoyés au retour du réseau.</li>
          <li><b>Le bilan WhatsApp part-il tout seul ?</b> Non, jamais. Vous relisez, vous choisissez le destinataire et vous envoyez vous-même.</li>
          <li><b>Mes contrats et mes finances sont-ils visibles par mes collègues de MAM ?</b> Non, ils restent privés à chaque assistante.</li>
          <li><b>Comment installer l&apos;application ?</b> Sur Android, depuis Google Play. Sinon, ouvrez le site dans votre navigateur et choisissez « Ajouter à l&apos;écran d&apos;accueil ».</li>
          <li><b>Comment supprimer mon compte ?</b> Profil → Mes données → Supprimer mon compte.</li>
        </ul>
      </section>
    </LegalPage>
  );
}

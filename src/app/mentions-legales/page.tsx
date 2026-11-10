import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <LegalPage title="Mentions légales">
      <section>
        <h2>Éditeur</h2>
        <p>
          {LEGAL.publisher}<br />
          {LEGAL.address}<br />
          {LEGAL.registration}<br />
          Directeur de la publication : {LEGAL.director}<br />
          Contact : <Contact />
        </p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <ul>
          <li>Application : Vercel Inc. (fonctions exécutées à Francfort, Union européenne).</li>
          <li>Base de données et authentification : Supabase (région Union européenne, Francfort).</li>
        </ul>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>La marque Chez TaTa, le logo, les textes, illustrations et le code de l&apos;application sont protégés. Toute reproduction sans autorisation est interdite. Vos données restent les vôtres.</p>
      </section>
      <section>
        <h2>Modèles de documents</h2>
        <p>Les contrats et factures générés sont des modèles d&apos;aide. Ils doivent être relus par les parties et ne constituent ni un conseil juridique ni un bulletin de salaire officiel.</p>
      </section>
    </LegalPage>
  );
}

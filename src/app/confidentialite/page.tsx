import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Chez TaTa aide les assistantes maternelles et les MAM à suivre l'accueil des enfants. Voici, simplement, quelles données nous traitons, pourquoi, et comment vous gardez la main."
    >
      <section>
        <h2>1. Qui est responsable de vos données ?</h2>
        <p>
          Le responsable de traitement est {LEGAL.publisher}, {LEGAL.address} ({LEGAL.registration}). Contact : <Contact />.
        </p>
        <p>
          Pour les informations sur les enfants et les familles que vous saisissez, vous êtes à la fois utilisatrice du service et, en tant que professionnelle, responsable de la
          manière dont vous les utilisez. Chez TaTa agit alors comme prestataire technique (sous-traitant) qui les héberge pour votre compte.
        </p>
      </section>

      <section>
        <h2>2. Quelles données traitons-nous ?</h2>
        <ul>
          <li><b>Votre compte</b> : adresse e-mail, mot de passe (jamais lisible : seule une empreinte est conservée), prénom affiché.</li>
          <li><b>Les enfants accueillis</b> : prénom, nom, date de naissance, jours et heures de présence, repas, siestes, changes, soins et notes que vous choisissez de saisir.</li>
          <li><b>Les familles</b> : noms des parents, téléphone, e-mail, adresse que vous renseignez.</li>
          <li><b>Contrats et finances</b> : horaires, tarifs, indemnités, factures, paiements reçus, charges.</li>
          <li><b>Données techniques</b> : adresse IP et journaux de connexion conservés brièvement par l&apos;hébergeur pour la sécurité ; un cookie de session strictement nécessaire.</li>
        </ul>
        <p>Certaines saisies (soins, médicaments, allergies) peuvent révéler des informations de santé. Saisissez uniquement ce qui est utile à l&apos;accueil de l&apos;enfant.</p>
        <p>Nous n&apos;utilisons <b>aucun traceur publicitaire</b>, aucune mesure d&apos;audience tierce et ne vendons aucune donnée.</p>
      </section>

      <section>
        <h2>3. Pourquoi et sur quelle base ?</h2>
        <ul>
          <li><b>Fournir le service</b> (pointage, planning, contrats, factures, bilans) : exécution du contrat d&apos;utilisation.</li>
          <li><b>Sécuriser le service</b> (authentification, prévention des abus) : intérêt légitime.</li>
          <li><b>Dictée vocale</b> : uniquement si vous appuyez sur le micro, avec votre accord (voir §6).</li>
          <li><b>Respecter la loi</b> (demandes d&apos;exercice de droits, obligations comptables du service) : obligation légale.</li>
        </ul>
      </section>

      <section>
        <h2>4. Qui voit vos données ?</h2>
        <p>
          Chaque assistante ne voit que ses propres données : cette séparation est appliquée par la base de données elle-même. Dans une MAM, les enfants et le journal sont partagés
          entre les membres de la MAM ; les contrats, factures, paiements et charges restent privés à chaque assistante.
        </p>
        <p>
          Le bilan WhatsApp et l&apos;envoi d&apos;un contrat ou d&apos;une facture ne partent <b>jamais automatiquement</b> : vous relisez, vous choisissez le destinataire et vous envoyez vous-même.
        </p>
      </section>

      <section>
        <h2>5. Nos prestataires et où sont les données</h2>
        <ul>
          <li><b>Supabase</b> : base de données et authentification, hébergées dans l&apos;Union européenne (Francfort).</li>
          <li><b>Vercel</b> : hébergement de l&apos;application ; les traitements s&apos;exécutent dans l&apos;Union européenne (Francfort). Le réseau de diffusion peut traiter l&apos;adresse IP hors de l&apos;UE, encadré par les garanties contractuelles du prestataire.</li>
        </ul>
        <p>Ces prestataires n&apos;ont le droit de traiter les données que pour nous fournir le service.</p>
      </section>

      <section>
        <h2>5 bis. Connexion avec Google</h2>
        <p>
          Si vous choisissez « Continuer avec Google », Google nous transmet votre <b>nom</b> et votre <b>adresse e-mail</b> pour créer votre compte. Chez TaTa n&apos;a accès ni à vos contacts, ni à vos e-mails, ni à vos
          fichiers. Google est informé que vous vous connectez à Chez TaTa, selon sa propre politique de confidentialité. Vous pouvez aussi vous inscrire sans Google, avec une adresse e-mail et un mot de passe.
        </p>
      </section>

      <section>
        <h2>6. Dictée vocale</h2>
        <p>
          Le bouton « Dicter » utilise la reconnaissance vocale de votre téléphone ou navigateur (selon l&apos;appareil : Google ou Apple). Le son est transmis à ce service pour être transcrit ;
          Chez TaTa ne reçoit ni ne conserve aucun enregistrement. Le texte reconnu vous est proposé et n&apos;est enregistré qu&apos;après votre validation.
        </p>
      </section>

      <section>
        <h2>7. Combien de temps ?</h2>
        <p>
          Vos données sont conservées tant que votre compte est actif. Quand vous supprimez votre compte, elles sont effacées (voir la page <a href="/suppression-compte">Supprimer mon compte</a>). Les journaux techniques de
          l&apos;hébergeur sont conservés brièvement. Les sauvegardes techniques sont renouvelées automatiquement.
        </p>
      </section>

      <section>
        <h2>8. Vos droits</h2>
        <p>
          Vous pouvez accéder à vos données, les corriger, les exporter, vous opposer à certains traitements ou demander leur effacement. Dans l&apos;application, <b>Réglages → Mes données</b> permet de télécharger vos données et
          de supprimer votre compte. Pour toute autre demande : <Contact />. Nous répondons dans un délai d&apos;un mois.
        </p>
        <p>
          Vous pouvez aussi saisir la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>) si vous estimez que vos droits ne sont pas respectés.
        </p>
      </section>

      <section>
        <h2>9. Sécurité</h2>
        <p>
          Connexion chiffrée (HTTPS), séparation stricte entre comptes, accès à la base limités par des règles de sécurité, mots de passe protégés, journal des actions et suppression de compte en libre-service. Aucun système n&apos;étant infaillible,
          nous vous informerons ainsi que l&apos;autorité compétente en cas de violation de données, dans les délais légaux.
        </p>
      </section>

      <section>
        <h2>10. Enfants et mineurs</h2>
        <p>Chez TaTa s&apos;adresse aux professionnelles de l&apos;accueil, pas aux enfants. Les données des enfants sont saisies par ces professionnelles et ne servent qu&apos;à l&apos;organisation de l&apos;accueil.</p>
      </section>

      <section>
        <h2>11. Évolutions</h2>
        <p>Cette politique peut évoluer ; la date de mise à jour figure en haut de la page. Les changements importants vous sont signalés dans l&apos;application.</p>
      </section>
    </LegalPage>
  );
}

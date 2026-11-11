import type { Metadata } from "next";
import { DemoExperience } from "@/components/demo/demo-experience";

export const metadata: Metadata = {
  title: "Démonstration",
  description: "Découvrez Chez TaTa en quelques secondes : pointage en une touche, bilan WhatsApp, fiche d'urgence, fiche de présence et factures. Données fictives.",
};

export default function Page() {
  return <DemoExperience />;
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chez TaTa",
    short_name: "Chez TaTa",
    description: "Moins d'administratif, plus de temps pour les enfants.",
    lang: "fr",
    // Identifiant stable : l'appli reste « la même » si l'adresse de démarrage change un jour.
    id: "/",
    scope: "/",
    start_url: "/aujourdhui",
    display: "standalone",
    display_override: ["standalone"],
    orientation: "portrait",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Aujourd'hui", short_name: "Aujourd'hui", url: "/aujourdhui", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Planning", short_name: "Planning", url: "/planning", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Gestion", short_name: "Gestion", url: "/gestion", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    background_color: "#ffffff",
    theme_color: "#06377c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chez TaTa",
    short_name: "Chez TaTa",
    description: "Moins d'administratif, plus de temps pour les enfants.",
    lang: "fr",
    start_url: "/aujourdhui",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#06377c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

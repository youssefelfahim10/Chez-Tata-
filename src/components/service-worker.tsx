"use client";

import { useEffect } from "react";

/** Enregistre le service worker (installation de l'appli et fonctionnement hors ligne). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
    navigator.serviceWorker.register(`/sw.js?env=${env}`, { scope: "/" }).catch(() => {
      /* sans service worker, l'appli reste utilisable en ligne */
    });
  }, []);
  return null;
}

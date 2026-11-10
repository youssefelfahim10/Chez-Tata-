/* Service worker Chez TaTa — hors ligne.
 * - Fichiers statiques : servis depuis le cache (production) ou le réseau d'abord (développement).
 * - Pages de l'application : réseau d'abord, puis dernière version vue si pas de réseau.
 * - Rien d'autre n'est mis en cache : pas de requêtes d'authentification, pas d'actions serveur.
 * - Les caches sont vidés à la déconnexion (appareil éventuellement partagé).
 */
const PROD = new URL(self.location.href).searchParams.get("env") === "prod";
const VERSION = "ct-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/hors-ligne", "/fiche/modele-a4.jpg", "/icon-192.png", "/icon-512.png"];
const MAX_AGE_MS = 48 * 3600 * 1000; // une page gardée hors ligne est oubliée après 48 h
const STAMP = "x-ct-cached-at";
const APP_PAGE = /^\/(aujourdhui|planning|gestion|parametres)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

async function networkFirst(request, cacheName, { timeout = 3500, store = true } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout)),
    ]);
    if (store && response.ok && !response.redirected && response.type === "basic") {
      const headers = new Headers(response.headers);
      headers.set(STAMP, String(Date.now()));
      const body = await response.clone().blob();
      await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) {
      const stamp = Number(cached.headers.get(STAMP) || 0);
      if (!stamp || Date.now() - stamp <= MAX_AGE_MS) return cached;
      await cache.delete(request);
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  // Fichiers statiques.
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    if (PROD) {
      event.respondWith(
        caches.open(STATIC).then(async (cache) => {
          const hit = await cache.match(request);
          if (hit) return hit;
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        }),
      );
    } else {
      event.respondWith(networkFirst(request, STATIC));
    }
    return;
  }

  // Pages de l'application (navigation).
  if (request.mode === "navigate") {
    event.respondWith(
      (APP_PAGE.test(url.pathname) ? networkFirst(request, PAGES) : fetch(request)).catch(async () => {
        const fallback = await caches.match("/hors-ligne");
        return fallback || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }),
    );
  }
});

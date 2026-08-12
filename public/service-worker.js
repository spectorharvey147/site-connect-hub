/* global self, caches, fetch, URL */
const CACHE_PREFIX = "site-connect-static-";
const CACHE = `${CACHE_PREFIX}v2`;
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];
const STATIC_EXTENSIONS = /\.(?:js|css|png|jpe?g|webp|ico|woff2?)$/i;

function isApprovedStaticRequest(request) {
  if (request.method !== "GET" || request.headers.has("authorization")) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/supabase/")) return false;
  return url.pathname === "/" || url.pathname === "/index.html" ||
    url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") || STATIC_EXTENSIONS.test(url.pathname);
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const cacheControl = response.headers.get("cache-control") ?? "";
  return !/(?:no-store|private)/i.test(cacheControl);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (!isApprovedStaticRequest(event.request)) return;
  event.respondWith(caches.match(event.request).then(async (cached) => {
    try {
      const response = await fetch(event.request);
      if (isCacheableResponse(response)) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      if (event.request.mode === "navigate") return caches.match("/index.html");
      throw error;
    }
  }));
});

const CACHE_NAME = "myowndex-shell-v9.12.1";
const CACHE_PREFIX = "myowndex-shell-";
const ROOT_FALLBACK = "/";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon-v91.svg",
  "/icons/myowndex-icon-v91.svg",
  "/icons/myowndex-app-192-v91.png",
  "/icons/myowndex-app-512-v91.png",
  "/icons/myowndex-maskable-512-v91.png",
  "/icons/apple-touch-icon-v91.png",
  "/icons/myowndex-shortcut-96-v91.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      CORE_ASSETS.map(asset => fetch(asset)
        .then(response => response.ok ? cache.put(asset, response) : undefined)
        .catch(() => undefined))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

const canStore = response => response && (response.ok || response.type === "opaque");

const remember = async (request, response) => {
  if (!canStore(response)) return response;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // O cache offline é complementar e nunca deve interromper a navegação.
  }
  return response;
};

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async response => {
          await remember(ROOT_FALLBACK, response);
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(ROOT_FALLBACK)))
    );
    return;
  }

  const reusableAsset = sameOrigin
    || url.hostname === "raw.githubusercontent.com";
  if (!reusableAsset) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => remember(request, response));
    })
  );
});

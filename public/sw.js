const CACHE_NAME = "myowndex-shell-v7";
const CACHE_PREFIX = "myowndex-shell-";
const ROOT_FALLBACK = "/";

self.addEventListener("install", () => {
  self.skipWaiting();
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

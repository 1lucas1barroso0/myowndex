const CACHE_NAME = "myowndex-shell-v11.3.0";
const CACHE_PREFIX = "myowndex-shell-";
const ASSET_CACHE_NAME = "myowndex-assets-v1";
const ASSET_CACHE_PREFIX = "myowndex-assets-";
const ASSET_CACHE_LIMIT = 500;
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
  "/fonts/VT323-Regular.ttf",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      CORE_ASSETS.map(asset => fetch(asset)
        .then(response => response.ok ? cache.put(asset, response) : undefined)
        .catch(() => undefined))
    ))
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          || (key.startsWith(ASSET_CACHE_PREFIX) && key !== ASSET_CACHE_NAME))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Opaque cross-origin responses have inflated browser quota costs. Public
// sprite hosting supports CORS, so keep inspectable successful responses only.
const canStore = response => response && response.ok;

const fetchAsset = request => {
  if (new URL(request.url).origin === self.location.origin) return fetch(request);
  return fetch(request, { mode: "cors", credentials: "omit" }).catch(() => fetch(request));
};

const rememberPage = async response => {
  if (!canStore(response)) return response;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(ROOT_FALLBACK, response);
  } catch {
    // O cache offline é complementar e nunca deve interromper a navegação.
  }
  return response;
};

let assetQueue = Promise.resolve();
const rememberAsset = (request, response) => {
  const task = assetQueue.then(async () => {
    if (!canStore(response)) return;
    const cache = await caches.open(ASSET_CACHE_NAME);
    // Cache insertion order supplies recency. Reads and writes share a queue,
    // so one tab cannot make concurrent eviction remove another pending put.
    const latest = await cache.match(request);
    await cache.delete(request);
    await cache.put(request, latest || response);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - ASSET_CACHE_LIMIT))) await cache.delete(key);
  }).catch(() => {
    // Only regenerated images/build assets are evicted; Boxes are never here.
  });
  assetQueue = task;
  return task;
};

// Keep cache work in the worker's lifetime, without holding up the response.
const respondAndMaintain = (event, task) => {
  event.respondWith(task.then(result => result.response));
  event.waitUntil(task.then(result => result.maintenance).catch(() => undefined));
};

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && (url.pathname.startsWith("/api/") || request.headers.get("RSC") === "1" || url.searchParams.has("_rsc"))) return;

  if (request.mode === "navigate") {
    respondAndMaintain(event,
      fetch(request)
        .then(response => ({ response, maintenance: rememberPage(response.clone()) }))
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return { response: (await cache.match(request)) || (await cache.match(ROOT_FALLBACK)) };
        })
    );
    return;
  }

  const reusableAsset = (sameOrigin && (/^\/(?:_next\/static|icons|fonts|sprites)\//.test(url.pathname) || /^\/favicon[^/]*\.svg$/.test(url.pathname)))
    || (url.hostname === "raw.githubusercontent.com" && /^\/PokeAPI\/sprites\/(?:master|main)\/sprites\//.test(url.pathname));
  if (!reusableAsset) return;

  respondAndMaintain(event, (async () => {
    const core = await (await caches.open(CACHE_NAME)).match(request);
    if (core) return { response: core };
    const cached = await (await caches.open(ASSET_CACHE_NAME)).match(request);
    if (cached) return { response: cached, maintenance: rememberAsset(request, cached.clone()) };
    const response = await fetchAsset(request);
    return { response, maintenance: rememberAsset(request, response.clone()) };
  })());
});

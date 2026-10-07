const CACHE_NAME = "myowndex-shell-v2.0.15";
const CACHE_PREFIX = "myowndex-shell-";
const ASSET_CACHE_NAME = "myowndex-assets-v1";
const ASSET_CACHE_PREFIX = "myowndex-assets-";
const ASSET_CACHE_LIMIT = 500;
const ASSET_CACHE_BYTES = 16 * 1024 * 1024;
const ASSET_ENTRY_BYTES = 4 * 1024 * 1024;
const ROOT_FALLBACK = "/";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/myowndex-rotomdex-v101.svg",
  "/icons/myowndex-rotomdex-v101.svg",
  "/icons/myowndex-rotomdex-v101.svg",
  "/fonts/VT323-Regular.ttf",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      CORE_ASSETS.map(asset => fetch(asset)
        .then(response => response.ok ? cache.put(asset, response) : undefined)
        .catch(() => undefined))
    )).catch(() => undefined)
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

let capacityExpiresAt = 0;
let capacityAllowsCaching = true;
const hasCacheHeadroom = async bytes => {
  const storage = self.navigator?.storage;
  if (typeof storage?.estimate !== "function") return true;
  if (Date.now() < capacityExpiresAt) return capacityAllowsCaching;
  try {
    const { usage, quota } = await storage.estimate();
    const reserve = Math.min(16 * 1024 * 1024, quota * 0.2);
    capacityAllowsCaching = !Number.isFinite(quota) || quota <= 0
      || (usage + bytes < quota * 0.8 && quota - usage - bytes >= reserve);
    capacityExpiresAt = Date.now() + 30000;
  } catch { /* CacheStorage errors remain optional too. */ }
  return capacityAllowsCaching;
};

const budgetedResponse = async response => {
  const known = Number(response.headers.get("x-myowndex-bytes"));
  if (known > 0) return known <= ASSET_ENTRY_BYTES ? { response, bytes: known } : null;
  const announced = Number(response.headers.get("content-length"));
  if (announced > ASSET_ENTRY_BYTES) return null;
  const reader = response.body?.getReader();
  if (!reader) return { response, bytes: 0 };
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > ASSET_ENTRY_BYTES) { void reader.cancel(); return null; }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const headers = new Headers(response.headers);
  headers.set("x-myowndex-bytes", String(bytes));
  return { response: new Response(body, { status: response.status, statusText: response.statusText, headers }), bytes };
};

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
    const prepared = await budgetedResponse(response);
    if (!prepared || !await hasCacheHeadroom(prepared.bytes)) return;
    const cache = await caches.open(ASSET_CACHE_NAME);
    // Cache insertion order supplies recency. Reads and writes share a queue,
    // so one tab cannot make concurrent eviction remove another pending put.
    const latest = await cache.match(request);
    await cache.delete(request);
    await cache.put(request, latest || prepared.response);
    const keys = await cache.keys();
    const weights = await Promise.all(keys.map(async key => {
      const cached = await cache.match(key);
      const bytes = Number(cached?.headers.get("x-myowndex-bytes"));
      return bytes > 0 && Number.isFinite(bytes) ? bytes : ASSET_ENTRY_BYTES;
    }));
    let bytes = weights.reduce((total, weight) => total + weight, 0);
    let count = keys.length;
    for (let index = 0; index < keys.length && (count > ASSET_CACHE_LIMIT || bytes > ASSET_CACHE_BYTES); index++) {
      await cache.delete(keys[index]);
      bytes -= weights[index];
      count -= 1;
    }
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
          try {
            const cache = await caches.open(CACHE_NAME);
            const response = (await cache.match(request)) || (await cache.match(ROOT_FALLBACK));
            if (response) return { response };
          } catch { /* Browser storage may be disabled. */ }
          return { response: new Response("O MyOwnDex está offline. Reconecte para abrir esta página.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }) };
        })
    );
    return;
  }

  const reusableAsset = (sameOrigin && (/^\/(?:_next\/static|icons|fonts|sprites|catalog\/v1)\//.test(url.pathname) || /^\/favicon[^/]*\.svg$/.test(url.pathname)))
    || (url.hostname === "raw.githubusercontent.com" && /^\/PokeAPI\/sprites\/(?:master|main)\/sprites\//.test(url.pathname));
  if (!reusableAsset) return;

  respondAndMaintain(event, (async () => {
    try {
      const core = await (await caches.open(CACHE_NAME)).match(request);
      if (core) return { response: core };
      const cached = await (await caches.open(ASSET_CACHE_NAME)).match(request);
      if (cached) return { response: cached, maintenance: rememberAsset(request, cached.clone()) };
    } catch { /* Optional offline caches never prevent a network response. */ }
    const response = await fetchAsset(request);
    return { response, maintenance: rememberAsset(request, response.clone()) };
  })());
});

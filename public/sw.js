const CACHE_NAME = "myowndex-shell-v2.2.0";
const CACHE_PREFIX = "myowndex-shell-";
const ASSET_CACHE_NAME = "myowndex-assets-v3";
const ASSET_CACHE_PREFIX = "myowndex-assets-";
const ASSET_CACHE_LIMIT = 500;
const ASSET_CACHE_BYTES = 16 * 1024 * 1024;
const ASSET_ENTRY_BYTES = 4 * 1024 * 1024;
const ROOT_FALLBACK = "/";
const CORE_ASSETS = [
  "/manifest.webmanifest",
  "/manifest-resgate.webmanifest",
  "/reinstalar?abrir=aventura",
  "/icons/myowndex-dex-v105-r4-live.svg?v=2.2.0",
  "/icons/myowndex-dex-v105-r4-32.png",
  "/icons/myowndex-dex-v105-r4-192.png",
  "/icons/myowndex-dex-v105-r4-app-512.png",
  "/icons/myowndex-dex-v105-r4-180.png",
  "/icons/myowndex-dex-v105-r4-96.png",
  "/icons/myowndex-dex-v105-r4-maskable-512.png",
  "/fonts/VT323-Regular.ttf",
];

const SHELL_VERSION = CACHE_NAME.slice(CACHE_PREFIX.length + 1);
const SHELL_READY = "/__myowndex-offline-ready";
let shellPreparation = null;

const shellNames = async () => [CACHE_NAME, ...(await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).reverse()];
const matchShell = async request => {
  for (const name of await shellNames()) {
    const cached = await (await caches.open(name)).match(request);
    if (cached) return cached;
  }
};
const shellReady = async () => Boolean(await (await caches.open(CACHE_NAME)).match(SHELL_READY));
const usablePreviousShell = async name => {
  const cache = await caches.open(name);
  const page = await cache.match(ROOT_FALLBACK);
  if (!page) return false;
  if (await cache.match(SHELL_READY)) return true;
  // Releases before the completion marker: retain only a root whose linked
  // scripts/styles are actually present, never an empty or partial update.
  const references = [...(await page.text()).matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1]).filter(url => url.startsWith("/_next/static/"));
  return references.length > 0 && (await Promise.all(references.map(url => cache.match(url)))).every(Boolean);
};
const prepareShell = page => {
  if (shellPreparation) return shellPreparation;
  shellPreparation = (async () => {
    if (await shellReady()) return;
    const manifestResponse = await fetch("/offline-assets.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("Código offline indisponível.");
    const manifest = await manifestResponse.json();
    if (manifest.version !== SHELL_VERSION || !Array.isArray(manifest.assets) || !manifest.assets.length || manifest.assets.length > 256
      || !Number.isSafeInteger(manifest.bytes) || manifest.bytes > 12 * 1024 * 1024
      || manifest.assets.some(asset => !/^\/_next\/static\/[a-zA-Z0-9_./-]+\.(?:js|css)$/.test(asset.path)
        || asset.path.includes("..") || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || asset.bytes > 4 * 1024 * 1024)
      || manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0) !== manifest.bytes) throw new Error("Código offline incompatível.");
    const response = page || await fetch(ROOT_FALLBACK, { cache: "no-store" });
    if (!response.ok) throw new Error("Abertura offline indisponível.");
    const html = await response.clone().text();
    const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]).filter(url => url.startsWith("/_next/static/"));
    if (!references.length || references.some(url => !manifest.assets.some(asset => asset.path === url.split("?")[0]))) throw new Error("Abertura e código pertencem a builds diferentes.");
    const cache = await caches.open(CACHE_NAME);
    // Four downloads at a time; a failed/partial release never replaces the
    // last complete offline opening. Dynamic feature chunks are pinned too.
    for (let index = 0; index < manifest.assets.length; index += 4) {
      await Promise.all(manifest.assets.slice(index, index + 4).map(async asset => {
        const result = await fetch(asset.path, { cache: "no-store" });
        if (!result.ok) throw new Error("Arquivo offline indisponível.");
        const bytes = await result.arrayBuffer();
        if (bytes.byteLength !== asset.bytes) throw new Error("Arquivo offline incompleto.");
        await cache.put(asset.path, new Response(bytes, { status: result.status, headers: result.headers }));
      }));
    }
    await cache.put(ROOT_FALLBACK, response);
    await cache.put(SHELL_READY, new Response(SHELL_VERSION));
  })().finally(() => { shellPreparation = null; });
  return shellPreparation;
};

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      await prepareShell();
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(CORE_ASSETS.map(asset => fetch(asset, { cache: "no-store" })
        .then(response => response.ok ? cache.put(asset, response) : undefined)
        .catch(() => undefined)));
    } catch { /* Keep the previous complete shell when offline, denied or full. */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const ready = await shellReady().catch(() => false);
    const keys = await caches.keys();
    const previous = keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
    // Several consecutive interrupted updates must not evict the last usable
    // release merely because an incomplete cache was created more recently.
    let retained = null;
    if (!ready) for (const name of previous.reverse()) {
      if (await usablePreviousShell(name)) { retained = name; break; }
    }
    await Promise.all(keys.filter(key => (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== retained)
      || (key.startsWith(ASSET_CACHE_PREFIX) && key !== ASSET_CACHE_NAME)).map(key => caches.delete(key)));
    await self.clients.claim();
  })().catch(() => self.clients.claim()));
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
  if (new URL(request.url).origin === self.location.origin) return fetch(request, { cache: "no-store" });
  return fetch(request, { mode: "cors", credentials: "omit", cache: "no-store" })
    .catch(() => fetch(request, { cache: "no-store" }));
};

const rememberPage = async (response, request) => {
  if (!canStore(response)) return response;
  try {
    if (new URL(request.url).pathname === "/") {
      await prepareShell(response.clone());
      return response;
    }
    const cache = await caches.open(CACHE_NAME);
    // Never poison the game's offline root fallback with the opt-in installer
    // or another HTML route: each separate page caches under its own URL.
    const key = new URL(request.url).pathname === "/" ? ROOT_FALLBACK : request;
    await cache.put(key, response);
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
    await cache.delete(request);
    // Online revalidation must overwrite old bytes, even at the same URL.
    await cache.put(request, prepared.response);
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
        .then(response => ({ response, maintenance: rememberPage(response.clone(), request) }))
        .catch(async () => {
          try {
            const response = (await matchShell(request)) || (await matchShell(ROOT_FALLBACK));
            if (response) return { response };
          } catch { /* Browser storage may be disabled. */ }
          return { response: new Response("O MyOwnDex está offline. Reconecte para abrir esta página.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }) };
        })
    );
    return;
  }

  const reusableAsset = (sameOrigin && (/^\/(?:_next\/static|icons|fonts|sprites|scenes|catalog\/v1)\//.test(url.pathname) || /^\/favicon[^/]*\.svg$/.test(url.pathname)))
    || (url.hostname === "raw.githubusercontent.com" && (
      (/^\/PokeAPI\/sprites\/(?:[a-f0-9]{40}|master|main)\/sprites\//.test(url.pathname)
        && !/\/other\/(?:showdown|home|official-artwork)\//.test(url.pathname))
      || /^\/smogon\/sprites\/[a-f0-9]{40}\/src\/(?:bw|pixels)\//.test(url.pathname)
    ));
  if (!reusableAsset) return;

  const immutable = sameOrigin && (
      url.pathname.startsWith("/_next/static/")
      || /^\/sprites\/native\/2d-[a-f0-9]{24}\.(?:gif|png|apng)$/.test(url.pathname)
    ) || url.hostname === "raw.githubusercontent.com" && (/^\/PokeAPI\/sprites\/[a-f0-9]{40}\//.test(url.pathname)
      || /^\/smogon\/sprites\/[a-f0-9]{40}\//.test(url.pathname));
  respondAndMaintain(event, (async () => {
    // Hash-addressed build files and commit-pinned images never change.
    // Everything else is network-first, avoiding permanently stale sprites,
    // fonts and icons when the origin publishes new bytes at the same path.
    if (immutable) {
      try {
        const core = await matchShell(request);
        if (core) return { response: core };
        const cached = await (await caches.open(ASSET_CACHE_NAME)).match(request);
        if (cached) return { response: cached };
      } catch { /* CacheStorage is optional. */ }
    }
    try {
      const response = await fetchAsset(request);
      return { response, maintenance: rememberAsset(request, response.clone()) };
    } catch (error) {
      try {
        const cached = (await (await caches.open(ASSET_CACHE_NAME)).match(request))
          || (await matchShell(request));
        if (cached) return { response: cached };
      } catch { /* Never swallow the original network failure. */ }
      throw error;
    }
  })());
});

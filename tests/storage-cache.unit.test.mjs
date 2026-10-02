import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { apiCache, API_CACHE_LIMIT, clearApiCache, fetchCached } from "../src/core/mechanics.js";
import { compactPokemon, hydrateTeam, hydrateTeams, loadTeams, mergeHydratedTeams, normalizePokemon, saveTeams, STAT_KEYS, TEAM_HYDRATION_CONCURRENCY, TEAM_STORAGE_KEY } from "../src/core/team.js";
import { createScheduledSave } from "../src/core/scheduledSave.js";

const origin = "https://myowndex.vercel.app";
const catalogue = "https://pokeapi.co/api/v2/pokemon/";
const flushUrl = catalogue + "_flush_test";
const requestKey = request => new URL(typeof request === "string" ? request : request.url, origin).href;
class MemoryCache {
  entries = new Map();
  async match(request) { return this.entries.get(requestKey(request))?.clone(); }
  async put(request, response) {
    this.entries.set(requestKey(request), new Response(await response.text(), { status: response.status, headers: response.headers }));
  }
  async delete(request) { return this.entries.delete(requestKey(request)); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}
class MemoryCaches {
  entries = new Map();
  async open(name) {
    if (!this.entries.has(name)) this.entries.set(name, new MemoryCache());
    return this.entries.get(name);
  }
  async delete(name) { return this.entries.delete(name); }
  async keys() { return [...this.entries.keys()]; }
}
class MemoryStorage {
  entries = new Map();
  getItem(key) { return this.entries.get(key) ?? null; }
  setItem(key, value) { this.entries.set(key, String(value)); }
  removeItem(key) { this.entries.delete(key); }
}
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

async function withCatalogue(t, fetcher, caches = new MemoryCaches()) {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const storage = new MemoryStorage();
  globalThis.window = { caches, localStorage: storage };
  globalThis.fetch = url => url === flushUrl ? Promise.resolve(new Response("not found", { status: 404 })) : fetcher(url);
  await clearApiCache();
  t.after(async () => {
    await clearApiCache();
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  return { caches, storage, settle: () => fetchCached(flushUrl, { forceRefresh: true }) };
}

// Static PokeAPI-shaped data keeps the storage budget check independent of the network.
const spritePaths = {
  front_default: "", front_shiny: "shiny/", front_female: "female/", front_shiny_female: "shiny/female/",
  back_default: "back/", back_shiny: "back/shiny/", back_female: "back/female/", back_shiny_female: "back/shiny/female/",
};
const spriteFrames = (prefix = "", extension = "png") => Object.fromEntries(Object.entries(spritePaths)
  .map(([key, path]) => [key, `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${prefix}${path}25.${extension}`]));
const offlineSpecies = () => ({
  id: 25, name: "pikachu", species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
  abilities: [
    { ability: { name: "static", url: "https://pokeapi.co/api/v2/ability/9/" }, is_hidden: false, slot: 1 },
    { ability: { name: "lightning-rod", url: "https://pokeapi.co/api/v2/ability/31/" }, is_hidden: true, slot: 3 },
  ],
  stats: STAT_KEYS.map((name, index) => ({ base_stat: [35, 55, 40, 50, 50, 90][index], effort: index === 5 ? 2 : 0,
    stat: { name, url: `https://pokeapi.co/api/v2/stat/${index + 1}/` } })),
  types: [{ slot: 1, type: { name: "electric", url: "https://pokeapi.co/api/v2/type/13/" } }],
  height: 4, weight: 60, gender_rate: 4,
  sprites: {
    ...spriteFrames(),
    other: {
      home: spriteFrames("other/home/"),
      "official-artwork": {
        front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
        front_shiny: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/25.png",
        versions: { "generation-i": { "red-and-blue": { front_default: "regenerable older artwork" } } },
      },
    },
    versions: {
      "generation-i": { "red-blue": spriteFrames("versions/generation-i/red-blue/") },
      "generation-iv": { "heartgold-soulsilver": spriteFrames("versions/generation-iv/heartgold-soulsilver/") },
      "generation-v": { "black-white": {
        ...spriteFrames("versions/generation-v/black-white/"),
        animated: spriteFrames("versions/generation-v/black-white/animated/", "gif"),
      } },
    },
  },
});

test("compact Boxes preserve every player field and all used offline sprites while removing regenerable generations", async t => {
  await withCatalogue(t, async () => new Response("offline", { status: 404 }));
  const species = offlineSpecies();
  species.sprites.front_female = null;
  species.sprites.versions["generation-v"]["black-white"].animated.back_female = null;
  const source = {
    id: "offline-partner", species, nickname: "Faísca ⚡", level: 88, item: "light-ball", ability: "static", nature: "timid",
    moves: ["thunderbolt", "surf", "nuzzle", "protect"],
    ivs: { hp: 31, attack: 0, defense: 30, "special-attack": 31, "special-defense": 29, speed: 31 },
    evs: { hp: 4, attack: 0, defense: 0, "special-attack": 252, "special-defense": 0, speed: 252 },
    canGMax: true, shiny: true, dynamaxLevel: 10, teraType: "electric", friendship: 255, gender: "F", genderRate: 4, genderLocked: true,
    customStats: { hp: 50, attack: 51, defense: 52, "special-attack": 53, "special-defense": 54, speed: 55 },
    customTypes: ["electric", "fairy"],
    rpg: { xp: 22.5, currentHp: 7, status: "sleep", sleepTurns: 2, caughtWith: "luxury-ball", originalTrainer: "Lucas",
      notes: "N".repeat(2000), animeNotes: "A".repeat(1000), pp: [10, 15, 20, 5] },
  };
  const originalSprites = structuredClone(species.sprites);
  const compact = compactPokemon(source);
  const expected = normalizePokemon(source);
  for (const key of Object.keys(expected).filter(key => key !== "species")) assert.deepEqual(compact[key], expected[key], key);
  for (const key of Object.keys(expected.species).filter(key => key !== "sprites")) assert.deepEqual(compact.species[key], expected.species[key], key);
  const sprites = compact.species.sprites;
  for (const key of Object.keys(spritePaths)) assert.equal(sprites[key], originalSprites[key], key);
  assert.deepEqual(sprites.other, { "official-artwork": {
    front_default: originalSprites.other["official-artwork"].front_default,
    front_shiny: originalSprites.other["official-artwork"].front_shiny,
  } });
  assert.deepEqual(sprites.versions, { "generation-v": { "black-white": {
    animated: originalSprites.versions["generation-v"]["black-white"].animated,
  } } });
  assert.deepEqual(species.sprites, originalSprites, "compaction never mutates the in-memory catalogue");
  const box = { id: "offline-box", shareId: "offline-shared-box", name: "Minha Box", versionGroup: "black-2-white-2", updatedAt: 1, pokemon: [source] };
  assert.equal(saveTeams([box]), true);
  const saved = loadTeams()[0];
  for (const key of ["id", "shareId", "name", "versionGroup", "updatedAt"]) assert.equal(saved[key], box[key], key);
  assert.deepEqual(saved.pokemon[0], compact);
  const hydrated = await hydrateTeam(saved);
  assert.deepEqual(hydrated.pokemon[0], compact, "offline hydration preserves stats, moves, EVs, notes and every usable image");
});

test("480 partners fit below a four-MiB UTF-16 localStorage budget without dropping Boxes or player data", async t => {
  const { storage } = await withCatalogue(t, async () => new Response("offline", { status: 404 }));
  const species = offlineSpecies();
  const teams = Array.from({ length: 80 }, (_, box) => ({
    id: `box-${box}`, shareId: `shared-box-${box}`, name: `Box ${box}`, versionGroup: "black-2-white-2", updatedAt: 1,
    pokemon: Array.from({ length: 6 }, (_, slot) => ({
      id: `partner-${box}-${slot}`, species, nickname: `Faísca ${box}-${slot} ⚡`, level: 88,
      item: "light-ball", ability: "static", nature: "timid", gender: "F", genderRate: 4,
      moves: ["thunderbolt", "surf", "nuzzle", "protect"],
      evs: { hp: 4, "special-attack": 252, speed: 252 },
      rpg: { xp: 22.5, currentHp: 7, status: "paralysis", caughtWith: "luxury-ball", originalTrainer: "Lucas",
        notes: "Parceira principal", animeNotes: "Pode usar o campo como para-raios.", pp: [10, 15, 20, 5] },
    })),
  }));
  assert.equal(saveTeams(teams), true);
  const persisted = storage.getItem(TEAM_STORAGE_KEY);
  const payload = JSON.parse(persisted);
  assert.equal(payload.schema, 4);
  assert.equal(typeof payload.savedAt, "number");
  assert.equal(payload.teams.length, 80);
  assert.equal(payload.teams.reduce((sum, box) => sum + box.pokemon.length, 0), 480);
  assert.ok(persisted.length * 2 < 4 * 1024 * 1024, `${persisted.length * 2} UTF-16 bytes`);
  for (const [box, saved] of loadTeams().entries()) {
    assert.equal(saved.shareId, teams[box].shareId);
    assert.equal(saved.updatedAt, 1);
    for (const [slot, partner] of saved.pokemon.entries()) assert.deepEqual(partner, compactPokemon(teams[box].pokemon[slot]));
  }
});

test("catalogue caches evict the least recently used entry while preserving every Box and unrelated cache", async t => {
  const calls = new Map();
  const { caches, storage, settle } = await withCatalogue(t, async url => {
    calls.set(url, (calls.get(url) || 0) + 1);
    return Response.json({ name: url.split("/").at(-1) });
  });
  storage.setItem(TEAM_STORAGE_KEY, JSON.stringify({ schema: 4, teams: [{ id: "old-box", updatedAt: 1 }] }));
  const savedBoxes = storage.getItem(TEAM_STORAGE_KEY);
  const privateCache = await caches.open("unrelated-private-cache");
  await privateCache.put("/private", new Response("keep"));
  for (let id = 1; id <= API_CACHE_LIMIT; id++) await fetchCached(catalogue + id);
  await settle();
  await fetchCached(catalogue + 1); // Recent use protects the oldest insertion.
  await fetchCached(catalogue + (API_CACHE_LIMIT + 1));
  await settle();
  assert.equal(apiCache.size, API_CACHE_LIMIT);
  assert.equal(apiCache.has(catalogue + 1), true);
  assert.equal(apiCache.has(catalogue + 2), false);
  const disk = await caches.open("myowndex-api-v5");
  assert.equal((await disk.keys()).length, API_CACHE_LIMIT);
  assert.ok(await disk.match(catalogue + 1));
  assert.equal(await disk.match(catalogue + 2), undefined);
  assert.equal(calls.get(catalogue + 1), 1);
  assert.equal(storage.getItem(TEAM_STORAGE_KEY), savedBoxes);
  assert.equal(await (await privateCache.match("/private")).text(), "keep");
  await clearApiCache();
  assert.equal(storage.getItem(TEAM_STORAGE_KEY), savedBoxes);
  assert.equal(await (await privateCache.match("/private")).text(), "keep");
});

test("eviction never removes the promise shared by concurrent catalogue callers", async t => {
  const waiting = deferred();
  const started = deferred();
  const heldUrl = catalogue + "held";
  let heldCalls = 0;
  const { settle } = await withCatalogue(t, async url => {
    if (url === heldUrl) { heldCalls++; started.resolve(); await waiting.promise; }
    return Response.json({ url });
  });
  const first = fetchCached(heldUrl);
  const second = fetchCached(heldUrl);
  await started.promise;
  for (let id = 0; id <= API_CACHE_LIMIT; id++) await fetchCached(catalogue + id);
  const third = fetchCached(heldUrl);
  waiting.resolve();
  const values = await Promise.all([first, second, third]);
  assert.equal(heldCalls, 1);
  assert.strictEqual(values[0], values[1]);
  assert.strictEqual(values[0], values[2]);
  await settle();
  assert.equal(apiCache.size, API_CACHE_LIMIT);
  assert.equal(apiCache.has(heldUrl), true);
});

test("clearing during a request cannot restore its old cache or delete a newer same-URL request", async t => {
  const oldGate = deferred();
  const newGate = deferred();
  const oldStarted = deferred();
  const newStarted = deferred();
  const url = catalogue + "concurrent";
  let calls = 0;
  const { settle, caches } = await withCatalogue(t, async () => {
    const revision = ++calls;
    if (revision === 1) { oldStarted.resolve(); await oldGate.promise; }
    else { newStarted.resolve(); await newGate.promise; }
    return Response.json({ revision });
  });
  const oldRequest = fetchCached(url);
  await oldStarted.promise;
  await clearApiCache();
  const newRequest = fetchCached(url);
  await newStarted.promise;
  oldGate.resolve();
  assert.deepEqual(await oldRequest, { revision: 1 });
  assert.equal(apiCache.has(url), false);
  const additionalCaller = fetchCached(url);
  newGate.resolve();
  assert.deepEqual(await newRequest, { revision: 2 });
  assert.deepEqual(await additionalCaller, { revision: 2 });
  assert.equal(calls, 2);
  await settle();
  assert.deepEqual(apiCache.get(url).data, { revision: 2 });
  assert.deepEqual(await (await (await caches.open("myowndex-api-v5")).match(url)).json(), { revision: 2 });
});

test("cache quota failure is optional and private API URLs never enter the catalogue disk cache", async t => {
  const caches = new MemoryCaches();
  const { settle, storage } = await withCatalogue(t, async url => Response.json({ url }), caches);
  const disk = await caches.open("myowndex-api-v5");
  disk.put = async () => { throw new Error("QuotaExceededError"); };
  storage.setItem(TEAM_STORAGE_KEY, "existing-boxes");
  assert.deepEqual(await fetchCached(catalogue + 1), { url: catalogue + 1 });
  await settle();
  assert.equal(apiCache.has(catalogue + 1), true);
  assert.equal(storage.getItem(TEAM_STORAGE_KEY), "existing-boxes");
  assert.equal((await disk.keys()).length, 0);
  disk.put = MemoryCache.prototype.put;
  await fetchCached(origin + "/api/rooms/private?token=secret");
  await tick();
  assert.equal((await disk.keys()).length, 0);
});

test("Box hydration shares four network slots across simultaneous callers and preserves order and offline edits", async t => {
  let active = 0;
  let maximum = 0;
  await withCatalogue(t, async url => {
    active++;
    maximum = Math.max(maximum, active);
    const name = url.split("/").at(-1);
    await new Promise(resolve => setTimeout(resolve, name.endsWith("0") ? 4 : 1));
    active--;
    if (name === "offline-partner") return new Response("not found", { status: 404 });
    if (url.includes("pokemon-species/")) return Response.json({ gender_rate: 4 });
    return Response.json({ name, id: 1, species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${name}` }, stats: [], types: [] });
  });
  const teams = Array.from({ length: 3 }, (_, box) => ({
    id: `box-${box}`, shareId: `box-${box}`, name: `Box ${box}`, updatedAt: 1,
    pokemon: Array.from({ length: 6 }, (_, index) => ({
      id: `partner-${box}-${index}`, species: { name: box === 2 && index === 5 ? "offline-partner" : `hydrate-${box}-${index}` },
      nickname: `Meu parceiro ${box}-${index}`, level: 42, genderRate: 3, rpg: { notes: "Editei durante a aventura", xp: 9 },
    })),
  }));
  const [first, last] = await Promise.all([hydrateTeams(teams.slice(0, 2)), hydrateTeam(teams[2])]);
  assert.equal(maximum, TEAM_HYDRATION_CONCURRENCY);
  for (const [box, team] of [...first, last].entries()) {
    assert.equal(team.id, teams[box].id);
    assert.equal(team.updatedAt, 1);
    assert.deepEqual(team.pokemon.map(partner => partner.id), teams[box].pokemon.map(partner => partner.id));
    for (const [index, partner] of team.pokemon.entries()) {
      assert.equal(partner.nickname, teams[box].pokemon[index].nickname);
      assert.equal(partner.level, 42);
      assert.equal(partner.rpg.notes, "Editei durante a aventura");
      assert.equal(partner.rpg.xp, 9);
    }
  }
  assert.equal(last.pokemon[5].species.name, "offline-partner");
  assert.equal(last.pokemon[5].genderRate, 3);
});

test("late hydration cannot replace a newly added partner or undo a changed form", () => {
  const hydrated = [{ id: "box", shareId: "box", pokemon: [
    { id: "old-pikachu", species: { name: "pikachu", id: 25 }, genderRate: 4 },
    { id: "rotom", species: { name: "rotom", id: 479 }, genderRate: -1 },
  ] }];
  const current = [{ id: "box", shareId: "box", pokemon: [
    { id: "new-eevee", species: { name: "eevee", id: 133 }, nickname: "Meu novo parceiro", rpg: { notes: "Acabou de chegar" } },
    { id: "rotom", species: { name: "rotom-wash", id: 10009 }, nickname: "Forma escolhida agora" },
  ] }];
  const merged = mergeHydratedTeams(current, hydrated);
  assert.deepEqual(merged, current);
  assert.strictEqual(merged[0].pokemon[0], current[0].pokemon[0]);
  assert.strictEqual(merged[0].pokemon[1], current[0].pokemon[1]);
});

test("hydration follows partner identity after reordering and retains edits made while loading", () => {
  const current = [{ id: "box", shareId: "box", name: "Editei a Box", updatedAt: 99, pokemon: [
    { id: "eevee", species: { name: "eevee" }, nickname: "Editado", level: 60, moves: ["quick-attack"], rpg: { notes: "Anotação recente" } },
    { id: "pikachu", species: { name: "pikachu" }, nickname: "Outro parceiro", level: 70 },
  ] }];
  const catalogue = [{ id: "box", shareId: "box", name: "Nome antigo", updatedAt: 1, pokemon: [
    { id: "pikachu", species: { name: "pikachu", id: 25 }, genderRate: 4, level: 5 },
    { id: "eevee", species: { name: "eevee", id: 133 }, genderRate: 1, nickname: "Nome antigo", level: 5 },
  ] }];
  const [merged] = mergeHydratedTeams(current, catalogue);
  assert.equal(merged.name, "Editei a Box");
  assert.equal(merged.updatedAt, 99);
  assert.deepEqual(merged.pokemon.map(partner => partner.species.id), [133, 25]);
  assert.equal(merged.pokemon[0].nickname, "Editado");
  assert.equal(merged.pokemon[0].level, 60);
  assert.deepEqual(merged.pokemon[0].moves, ["quick-attack"]);
  assert.deepEqual(merged.pokemon[0].rpg, { notes: "Anotação recente" });
  assert.equal(merged.pokemon[0].genderRate, 1);
  assert.equal(merged.pokemon[1].level, 70);
});

test("scheduled saving writes the latest edit once, bounds continuous typing and flushes before leaving", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const saved = [];
  const results = [];
  const saver = createScheduledSave({ save: value => { saved.push(value); return true; }, onResult: value => results.push(value) });
  saver.schedule("first");
  t.mock.timers.tick(200);
  saver.schedule("second");
  t.mock.timers.tick(200);
  saver.schedule("third");
  t.mock.timers.tick(299);
  assert.deepEqual(saved, []);
  t.mock.timers.tick(1);
  assert.deepEqual(saved, ["third"]);
  for (let index = 0; index < 5; index++) { saver.schedule(index); t.mock.timers.tick(200); }
  assert.deepEqual(saved, ["third", 4]);
  saver.schedule("pagehide");
  assert.equal(saver.flush(), true);
  saver.cancel();
  t.mock.timers.tick(5000);
  assert.deepEqual(saved, ["third", 4, "pagehide"]);
  assert.deepEqual(results, [true, true, true]);
});

test("failed saving retains the last persisted Boxes and retries the latest pending edit without expiry", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const previousWindow = globalThis.window;
  const storage = new MemoryStorage();
  globalThis.window = { localStorage: storage };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const original = [{ id: "permanent-box", shareId: "permanent-box", name: "Antiga", updatedAt: 1, pokemon: [] }];
  assert.equal(saveTeams(original), true);
  const persisted = storage.getItem(TEAM_STORAGE_KEY);
  const results = [];
  const saver = createScheduledSave({ save: saveTeams, onResult: result => results.push(result) });
  const write = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  saver.schedule([{ ...original[0], name: "Nova edição" }]);
  t.mock.timers.tick(300);
  assert.deepEqual(results, [false]);
  assert.equal(storage.getItem(TEAM_STORAGE_KEY), persisted);
  saver.cancel();
  storage.setItem = write;
  assert.equal(saver.flush(), true);
  assert.equal(loadTeams()[0].name, "Nova edição");
  assert.equal(loadTeams()[0].updatedAt, 1, "old Boxes never expire from this cache policy");
  assert.deepEqual(results, [false, true]);
});

test("a save completion cannot discard an edit scheduled while that save was running", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const values = [];
  let saver;
  saver = createScheduledSave({ save: value => {
    values.push(value);
    if (value === "older") saver.schedule("newer");
    return true;
  } });
  saver.schedule("older");
  assert.equal(saver.flush(), true);
  t.mock.timers.tick(300);
  assert.deepEqual(values, ["older", "newer"]);
});

async function serviceWorker(fetcher) {
  const callbacks = new Map();
  const caches = new MemoryCaches();
  let calls = 0;
  const context = vm.createContext({
    URL, Response, Promise, caches,
    fetch: async (request, options) => { calls++; return fetcher ? fetcher(request, options) : new Response(requestKey(request)); },
    self: { location: { origin }, addEventListener: (name, fn) => callbacks.set(name, fn), clients: { claim: async () => {} } },
  });
  vm.runInContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), context);
  const asset = async url => {
    let response;
    const maintenance = [];
    callbacks.get("fetch")({ request: new Request(url), respondWith: value => { response = value; }, waitUntil: value => maintenance.push(value) });
    const result = await response;
    await Promise.all(maintenance);
    return result;
  };
  return { callbacks, caches, asset, calls: () => calls };
}

test("offline asset LRU is bounded across concurrent tabs, pins the shell, and ignores private traffic", async () => {
  const worker = await serviceWorker();
  const pinned = await worker.caches.open("myowndex-shell-v11.1.0");
  await pinned.put("/", new Response("offline shell"));
  await pinned.put("/fonts/VT323-Regular.ttf", new Response("pinned font"));
  const unrelated = await worker.caches.open("private-upload-cache");
  await unrelated.put("/private", new Response("private upload"));
  for (let start = 0; start < 500; start += 20) {
    await Promise.all(Array.from({ length: 20 }, (_, offset) => worker.asset(`${origin}/sprites/pokemon/${start + offset}.png`)));
  }
  assert.equal(await (await worker.asset(`${origin}/sprites/pokemon/0.png`)).text(), `${origin}/sprites/pokemon/0.png`);
  const requests = worker.calls();
  await worker.asset(`${origin}/sprites/pokemon/500.png`);
  const cache = await worker.caches.open("myowndex-assets-v1");
  assert.equal((await cache.keys()).length, 500);
  assert.ok(await cache.match(`${origin}/sprites/pokemon/0.png`));
  assert.equal(await cache.match(`${origin}/sprites/pokemon/1.png`), undefined);
  assert.equal(worker.calls(), requests + 1);
  assert.equal(await (await worker.asset(`${origin}/fonts/VT323-Regular.ttf`)).text(), "pinned font");
  assert.equal(await (await pinned.match("/")).text(), "offline shell");
  for (const url of [`${origin}/api/rooms/private`, "https://raw.githubusercontent.com/other/private/main/secret.txt"]) {
    let intercepted = false;
    worker.callbacks.get("fetch")({ request: new Request(url), respondWith: () => { intercepted = true; }, waitUntil: () => {} });
    assert.equal(intercepted, false);
  }
  assert.equal(await (await unrelated.match("/private")).text(), "private upload");
});

test("worker activation removes only obsolete MyOwnDex shell and asset caches", async () => {
  const worker = await serviceWorker();
  for (const name of ["myowndex-shell-v10.0.0", "myowndex-shell-v11.1.0", "myowndex-assets-v0", "myowndex-assets-v1", "myowndex-api-v5", "another-app-cache"]) await worker.caches.open(name);
  let activation;
  worker.callbacks.get("activate")({ waitUntil: task => { activation = task; } });
  await activation;
  assert.deepEqual(await worker.caches.keys(), ["myowndex-shell-v11.1.0", "myowndex-assets-v1", "myowndex-api-v5", "another-app-cache"]);
});

test("public sprites use credential-free CORS and opaque fallbacks never consume offline quota", async () => {
  const calls = [];
  const worker = await serviceWorker(async (request, options) => {
    calls.push({ request, options });
    return new Response("public sprite");
  });
  const url = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png";
  assert.equal(await (await worker.asset(url)).text(), "public sprite");
  assert.equal(calls[0].options.mode, "cors");
  assert.equal(calls[0].options.credentials, "omit");
  assert.ok(await (await worker.caches.open("myowndex-assets-v1")).match(url));

  const opaque = { ok: false, type: "opaque", clone() { return this; } };
  const fallback = await serviceWorker(async (_request, options) => {
    if (options?.mode === "cors") throw new TypeError("CORS unavailable");
    return opaque;
  });
  assert.strictEqual(await fallback.asset(url), opaque, "the browser can still display the original response");
  assert.equal(fallback.calls(), 2);
  assert.equal((await (await fallback.caches.open("myowndex-assets-v1")).keys()).length, 0);
});

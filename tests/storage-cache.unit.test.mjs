import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { apiCache, API_CACHE_LIMIT, API_CACHE_ENTRY_BYTES, API_DISK_CACHE_BYTES, API_MEMORY_CACHE_BYTES, clearApiCache, fetchCached } from "../src/core/mechanics.js";
import { compactPokemon, hydrateTeam, hydrateTeams, loadTeams, loadTeamsDurable, mergeHydratedTeams, normalizePokemon, saveTeams, saveTeamsDurable, STAT_KEYS, TEAM_HYDRATION_CONCURRENCY, TEAM_STORAGE_KEY } from "../src/core/team.js";
import { createScheduledSave } from "../src/core/scheduledSave.js";
import { clearStorageScope, getStorageScope, listStoredAccountScopes, readDurableStorage, readStorage, removeDurableStorage, resolveStorageKey, setStorageScope, writeDurableStorage } from "../src/core/storage.js";

const origin = "https://myowndex.vercel.app";
const shellCacheName = `myowndex-shell-v${JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version}`;
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
  get length() { return this.entries.size; }
  key(index) { return [...this.entries.keys()][index] ?? null; }
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
  assert.equal(payload.schema, 5);
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
    { id: "eevee", species: { name: "eevee" }, nickname: "Editado", level: 60, moves: ["quick-attack"], rpg: {
      scaleVersion: 2, notes: "Anotação recente", xp: 9, currentHp: 2, status: "sleep", sleepTurns: 1,
      caughtWith: "luxury-ball", originalTrainer: "Treinador atual", animeNotes: "Plano atual", pp: [1, 2, null, 4],
    } },
    { id: "pikachu", species: { name: "pikachu" }, nickname: "Outro parceiro", level: 70 },
  ] }];
  const catalogue = [{ id: "box", shareId: "box", name: "Nome antigo", updatedAt: 1, pokemon: [
    { id: "pikachu", species: { name: "pikachu", id: 25 }, genderRate: 4, level: 5 },
    { id: "eevee", species: { name: "eevee", id: 133 }, genderRate: 1, nickname: "Nome antigo", level: 5,
      rpg: { scaleVersion: 1, notes: "Anotação antiga", xp: 0, currentHp: 1, status: "freeze", freezeTurns: 2, pp: [20, 20, 20, 20] } },
  ] }];
  const [merged] = mergeHydratedTeams(current, catalogue);
  assert.equal(merged.name, "Editei a Box");
  assert.equal(merged.updatedAt, 99);
  assert.deepEqual(merged.pokemon.map(partner => partner.species.id), [133, 25]);
  assert.equal(merged.pokemon[0].nickname, "Editado");
  assert.equal(merged.pokemon[0].level, 60);
  assert.deepEqual(merged.pokemon[0].moves, ["quick-attack"]);
  // Normalization adds the current schema defaults while every explicit live
  // edit survives; no RPG field captured by the old request may replace it.
  assert.deepEqual(merged.pokemon[0].rpg, normalizePokemon(current[0].pokemon[0]).rpg);
  assert.equal(merged.pokemon[0].rpg.scaleVersion, 2);
  assert.equal(merged.pokemon[0].rpg.currentHp, 2);
  assert.equal(merged.pokemon[0].rpg.sleepTurns, 1);
  assert.equal(merged.pokemon[0].rpg.freezeTurns, null);
  assert.deepEqual(mergeHydratedTeams([merged], catalogue)[0].pokemon[0].rpg, merged.pokemon[0].rpg);
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
    URL, Response, Headers, Promise, caches,
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
  const pinned = await worker.caches.open(shellCacheName);
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
  for (const name of ["myowndex-shell-v10.0.0", shellCacheName, "myowndex-assets-v0", "myowndex-assets-v1", "myowndex-api-v5", "another-app-cache"]) await worker.caches.open(name);
  let activation;
  worker.callbacks.get("activate")({ waitUntil: task => { activation = task; } });
  await activation;
  assert.deepEqual(await worker.caches.keys(), [shellCacheName, "myowndex-assets-v1", "myowndex-api-v5", "another-app-cache"]);
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

class MemoryIndexedDB {
  values = new Map();
  failWrites = false;
  open() {
    const { values } = this;
    const shouldFail = () => this.failWrites;
    const database = {
      objectStoreNames: { contains: () => true },
      close() {},
      transaction() {
        const transaction = { objectStore: () => ({
          get(key) {
            const request = {};
            queueMicrotask(() => {
              request.result = structuredClone(values.get(key));
              transaction.oncomplete?.();
            });
            return request;
          },
          getAllKeys() {
            const request = {};
            queueMicrotask(() => {
              request.result = [...values.keys()];
              request.onsuccess?.();
              queueMicrotask(() => transaction.oncomplete?.());
            });
            return request;
          },
          delete(key) {
            if (shouldFail()) { queueMicrotask(() => transaction.onabort?.()); return {}; }
            values.delete(key);
            return {};
          },
          put(value) {
            const request = {};
            queueMicrotask(() => {
              if (shouldFail()) { transaction.onabort?.(); return; }
              values.set(value.key, structuredClone(value));
              transaction.oncomplete?.();
            });
            return request;
          },
        }) };
        return transaction;
      },
    };
    const request = { result: database };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }
}

async function withDurableStorage(t) {
  const previousWindow = globalThis.window;
  const storage = new MemoryStorage();
  const indexedDB = new MemoryIndexedDB();
  const events = [];
  globalThis.window = { localStorage: storage, indexedDB, CustomEvent: class {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }, dispatchEvent: event => { events.push(event); } };
  setStorageScope(null);
  t.after(async () => {
    await readDurableStorage('_flush_storage_test');
    setStorageScope(null);
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  });
  return { storage, indexedDB, events };
}

test('durable Boxes restore the latest IndexedDB commit beyond localStorage quota without dropping any Box', async t => {
  const { storage, indexedDB } = await withDurableStorage(t);
  const savedAt = Date.now();
  t.mock.method(Date, 'now', () => savedAt);
  const original = [{ id: 'old', shareId: 'old', name: 'Primeira Box', updatedAt: 1, pokemon: [] }];
  assert.equal(await saveTeamsDurable(original), true);
  const previous = storage.getItem(TEAM_STORAGE_KEY);
  const write = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const grown = Array.from({ length: 120 }, (_, i) => ({ ...original[0], id: `box-${i}`, shareId: `box-${i}`, name: `Box ${i}` }));
  assert.equal(await saveTeamsDurable(grown), true);
  assert.equal(storage.getItem(TEAM_STORAGE_KEY), previous, 'the smaller synchronous snapshot remains intact');
  setStorageScope(null); // Simulates a new scope/bootstrap without in-memory mirrors.
  assert.equal((await loadTeamsDurable()).length, 120);
  assert.equal(readStorage(TEAM_STORAGE_KEY).teams.length, 120, 'synchronous consumers see the confirmed durable snapshot');
  indexedDB.failWrites = true;
  assert.equal(await saveTeamsDurable([{ ...original[0], name: 'Não foi salvo' }]), false);
  assert.equal((await loadTeamsDurable()).length, 120, 'a failed transaction leaves the committed PC intact');
  storage.setItem = write;
});

test('explicit device-copy deletion removes both stores, isolates accounts and blocks stale pending saves', async t => {
  const { storage, indexedDB } = await withDurableStorage(t);
  const key = TEAM_STORAGE_KEY;
  await writeDurableStorage(key, { name: 'Guest Box' }, { scope: null });
  await writeDurableStorage(key, { name: 'Account B Box' }, { scope: 'account-b' });
  setStorageScope('account-a');
  await writeDurableStorage(key, { name: 'Account A Box' });
  await writeDurableStorage('myowndex_generator_v1', { results: ['durable-only'] });
  const draftKey = resolveStorageKey('myowndex_generator_v1');
  storage.removeItem(draftKey);
  storage.setItem('foreign-app-data', 'preserve');
  assert.deepEqual((await listStoredAccountScopes()).sort(), ['account-a', 'account-b']);
  const staleSave = writeDurableStorage(key, { name: 'Late stale save' });
  await clearStorageScope('account-a');
  assert.equal(await staleSave, false);
  assert.equal(await readDurableStorage(key, null, { scope: 'account-a' }), null);
  assert.equal(await readDurableStorage('myowndex_generator_v1', null, { scope: 'account-a' }), null);
  assert.equal(await writeDurableStorage(key, { name: 'Stale pagehide recreation' }, { scope: 'account-a' }), false);
  assert.equal([...indexedDB.values.keys()].some(saved => saved.startsWith('myowndex_account:account-a:')), false);
  assert.equal([...storage.entries.keys()].some(saved => saved.includes('myowndex_account:account-a:')), false);
  assert.equal((await readDurableStorage(key, null, { scope: null })).name, 'Guest Box');
  assert.equal((await readDurableStorage(key, null, { scope: 'account-b' })).name, 'Account B Box');
  assert.equal(storage.getItem('foreign-app-data'), 'preserve');
  setStorageScope('account-a');
  assert.equal(await writeDurableStorage(key, { name: 'Deliberate fresh login' }), true);
  assert.equal((await readDurableStorage(key)).name, 'Deliberate fresh login');
});

test('clearing the guest copy preserves account data and fails safely before any erase if invalidation is denied', async t => {
  const { storage } = await withDurableStorage(t);
  await writeDurableStorage(TEAM_STORAGE_KEY, { name: 'Guest Box' });
  await writeDurableStorage(TEAM_STORAGE_KEY, { name: 'Account Box' }, { scope: 'account-a' });
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key.startsWith('myowndex_copy_epoch:')) throw new Error('QuotaExceededError');
    write(key, value);
  };
  await assert.rejects(clearStorageScope(null), /não permitiu apagar/);
  assert.equal((await readDurableStorage(TEAM_STORAGE_KEY)).name, 'Guest Box');
  storage.setItem = write;
  await clearStorageScope(null);
  assert.equal(await readDurableStorage(TEAM_STORAGE_KEY), null);
  assert.equal((await readDurableStorage(TEAM_STORAGE_KEY, null, { scope: 'account-a' })).name, 'Account Box');
});

test('a failed metadata update cannot make an old local mirror override a later database-only save', async t => {
  const { storage } = await withDurableStorage(t);
  const key = 'myowndex_preferences_v1';
  await writeDurableStorage(key, { view: 'guide' });
  const metadataKey = `myowndex_snapshot_meta:${key}`;
  const oldMetadata = storage.getItem(metadataKey);
  const write = storage.setItem.bind(storage);
  storage.setItem = (storageKey, value) => {
    if (storageKey.startsWith('myowndex_snapshot_meta:')) throw new Error('QuotaExceededError');
    write(storageKey, value);
  };
  assert.equal(await writeDurableStorage(key, { view: 'pokedex' }), true);
  assert.equal(storage.getItem(metadataKey), oldMetadata);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(await writeDurableStorage(key, { view: 'teambuilder' }), true);
  setStorageScope(null);
  assert.deepEqual(await readDurableStorage(key), { view: 'teambuilder' });
  assert.deepEqual(readStorage(key), { view: 'teambuilder' });
});

test('a newer local-only save survives reload even when its metadata and database writes fail', async t => {
  const { storage, indexedDB } = await withDurableStorage(t);
  const savedAt = Date.now();
  t.mock.method(Date, 'now', () => savedAt);
  const original = [{ id: 'old', shareId: 'old', name: 'Primeira Box', updatedAt: 1, pokemon: [] }];
  await saveTeamsDurable(original);
  await writeDurableStorage('myowndex_dex_favorites_v1', ['1']);
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key.startsWith('myowndex_snapshot_meta:')) throw new Error('QuotaExceededError');
    write(key, value);
  };
  indexedDB.failWrites = true;
  assert.equal(await saveTeamsDurable([{ ...original[0], name: 'Box editada' }]), true);
  assert.equal(await writeDurableStorage('myowndex_dex_favorites_v1', ['1', '25']), true);
  setStorageScope(null);
  assert.equal((await loadTeamsDurable())[0].name, 'Box editada');
  assert.deepEqual(await readDurableStorage('myowndex_dex_favorites_v1'), ['1', '25']);
});

test('durable preferences and favorites restore newer database-only saves and preserve English names', async t => {
  const { storage } = await withDurableStorage(t);
  const key = 'myowndex_dex_favorites_v1';
  assert.equal(await writeDurableStorage(key, ['1']), true);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(await writeDurableStorage(key, ['1', '25', '999']), true);
  assert.deepEqual(readStorage(key), ['1', '25', '999']);
  setStorageScope(null);
  assert.deepEqual(await readDurableStorage(key), ['1', '25', '999'], 'arrays do not need their own savedAt field');
  assert.deepEqual(readStorage(key), ['1', '25', '999']);
  await writeDurableStorage('myowndex_preferences_v1', { view: 'teambuilder', label: 'Light That Burns the Sky' });
  setStorageScope(null);
  assert.deepEqual(await readDurableStorage('myowndex_preferences_v1'), { view: 'teambuilder', label: 'Light That Burns the Sky' });
});

test('guest and account snapshots, private room tokens and histories stay isolated during in-flight saves', async t => {
  const { storage, events } = await withDurableStorage(t);
  await writeDurableStorage('myowndex_preferences_v1', { view: 'guide' });
  await writeDurableStorage('myowndex_live_room_v1', { token: 'guest-private-token' });
  setStorageScope('account-a');
  const saving = writeDurableStorage('myowndex_preferences_v1', { view: 'teambuilder' });
  setStorageScope('account-b');
  await saving;
  assert.equal(getStorageScope(), 'account-b');
  assert.equal(await readDurableStorage('myowndex_preferences_v1'), null);
  await writeDurableStorage('myowndex_preferences_v1', { view: 'pokedex' });
  setStorageScope('account-a');
  assert.deepEqual(await readDurableStorage('myowndex_preferences_v1'), { view: 'teambuilder' });
  assert.equal(await readDurableStorage('myowndex_live_room_v1'), null);
  await writeDurableStorage('myowndex_live_room_v1', { token: 'a-private-token' });
  assert.equal(JSON.parse(storage.getItem(resolveStorageKey('myowndex_live_room_v1'))).token, 'a-private-token');
  setStorageScope(null);
  assert.deepEqual(await readDurableStorage('myowndex_preferences_v1'), { view: 'guide' });
  assert.deepEqual(await readDurableStorage('myowndex_live_room_v1'), { token: 'guest-private-token' });
  assert.ok(events.some(event => event.type === 'myowndex:storage' && event.detail.scope === 'account-a' && event.detail.key === 'myowndex_preferences_v1'));
  assert.equal(storage.getItem('myowndex_preferences_v1'), JSON.stringify({ view: 'guide' }));
});

test('durable removals cannot revive old data from the other storage backend', async t => {
  const { indexedDB } = await withDurableStorage(t);
  const key = 'myowndex_local_room_v1';
  await writeDurableStorage(key, { name: 'Aventura terminada' });
  assert.equal(await removeDurableStorage(key), true);
  setStorageScope(null);
  assert.equal(await readDurableStorage(key), null);
  assert.equal(indexedDB.values.get(key).deleted, true);
});

test('durable deletion rejects its stale local mirror and still permits a later local-only recreation', async t => {
  const { storage, indexedDB } = await withDurableStorage(t);
  const key = 'myowndex_local_room_v1';
  await writeDurableStorage(key, { name: 'Aventura antiga' });
  const remove = storage.removeItem.bind(storage);
  storage.removeItem = () => { throw new Error('StorageUnavailable'); };
  assert.equal(await removeDurableStorage(key), true);
  setStorageScope(null);
  assert.equal(await readDurableStorage(key), null, 'the failed local deletion cannot resurrect the old adventure');
  indexedDB.failWrites = true;
  const write = storage.setItem.bind(storage);
  storage.setItem = (storageKey, value) => {
    if (storageKey.startsWith('myowndex_snapshot_meta:')) throw new Error('QuotaExceededError');
    write(storageKey, value);
  };
  assert.equal(await writeDurableStorage(key, { name: 'Nova aventura' }), true);
  setStorageScope(null);
  assert.deepEqual(await readDurableStorage(key), { name: 'Nova aventura' });
  storage.removeItem = remove;
});

test('asynchronous save results never clear a newer failed edit and flushing does not duplicate transactions', async () => {
  const older = deferred();
  const newer = deferred();
  const calls = [];
  const results = [];
  let retry = false;
  const saver = createScheduledSave({ save: value => {
    calls.push(value);
    return retry ? Promise.resolve(true) : value === 'older' ? older.promise : newer.promise;
  }, onResult: saved => results.push(saved) });
  saver.schedule('older');
  const first = saver.flush();
  assert.strictEqual(saver.flush(), first);
  saver.schedule('newer');
  const second = saver.flush();
  newer.resolve(false);
  assert.equal(await second, false);
  older.resolve(true);
  assert.equal(await first, true);
  assert.deepEqual(results, [false]);
  retry = true;
  assert.equal(await saver.flush(), true);
  assert.deepEqual(calls, ['older', 'newer', 'newer']);
  assert.deepEqual(results, [false, true]);
  saver.cancel();
});

test('catalogue caches obey byte budgets as well as entry counts and skip oversized responses', async t => {
  const { caches, settle } = await withCatalogue(t, async url => Response.json({ url, body: 'x'.repeat(url.endsWith('/oversized') ? 2 * 1024 * 1024 : 600 * 1024) }));
  for (let index = 0; index < 20; index++) await fetchCached(catalogue + index);
  await settle();
  let memoryBytes = 0;
  for (const entry of apiCache.values()) memoryBytes += new TextEncoder().encode(JSON.stringify(entry.data)).byteLength;
  assert.ok(memoryBytes <= API_MEMORY_CACHE_BYTES);
  const cache = await caches.open('myowndex-api-v5');
  const weights = await Promise.all((await cache.keys()).map(async key => Number((await cache.match(key)).headers.get('x-myowndex-bytes'))));
  assert.ok(weights.reduce((sum, bytes) => sum + bytes, 0) <= API_DISK_CACHE_BYTES);
  assert.ok(apiCache.size < 20, 'count limits alone would keep all large responses');
  const url = catalogue + '/oversized';
  assert.ok((await fetchCached(url)).body.length > API_CACHE_ENTRY_BYTES, 'the caller still receives useful network data');
  await settle();
  assert.equal(apiCache.has(url), false);
  assert.equal(await cache.match(url), undefined);
});

test('catalogue caching stops under disk pressure while Boxes and network requests remain available', async t => {
  const { caches, storage, settle } = await withCatalogue(t, async url => Response.json({ url }));
  globalThis.window.navigator = { storage: { estimate: async () => ({ usage: 95 * 1024 * 1024, quota: 100 * 1024 * 1024 }) } };
  storage.setItem(TEAM_STORAGE_KEY, 'committed-player-boxes');
  assert.deepEqual(await fetchCached(catalogue + 'pressure'), { url: catalogue + 'pressure' });
  await settle();
  assert.equal((await (await caches.open('myowndex-api-v5')).keys()).length, 0);
  assert.equal(storage.getItem(TEAM_STORAGE_KEY), 'committed-player-boxes');
});

test('worker asset caching bounds bytes, includes warmed language catalogues, and works with storage disabled', async () => {
  const worker = await serviceWorker(async request => new Response(requestKey(request).includes('huge') ? 'x'.repeat(5 * 1024 * 1024) : 'x'.repeat(3 * 1024 * 1024)));
  for (let index = 0; index < 6; index++) await worker.asset(`${origin}/catalog/v1/species-${index}.json`);
  const cache = await worker.caches.open('myowndex-assets-v1');
  assert.equal((await cache.keys()).length, 5);
  assert.ok(await cache.match(`${origin}/catalog/v1/species-5.json`));
  assert.equal(await cache.match(`${origin}/catalog/v1/species-0.json`), undefined);
  await worker.asset(`${origin}/catalog/v1/huge.json`);
  assert.equal(await cache.match(`${origin}/catalog/v1/huge.json`), undefined);
  worker.caches.open = async () => { throw new Error('Storage unavailable'); };
  assert.equal((await worker.asset(`${origin}/sprites/pokemon/25.png`)).status, 200);
});

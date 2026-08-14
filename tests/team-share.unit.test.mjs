import assert from "node:assert/strict";
import test from "node:test";
import { insertImportedPokemon, mergeHydratedTeams, mergeImportedTeam, normalizeTeam, removeTeamById, restoreTeamAt } from "../src/core/team.js";
import { decodeShare, decodeTeam, encodePokemonBundle, encodeTeam, LEGACY_SHARE_PREFIX } from "../src/core/teamShare.js";

const completeTeam = normalizeTeam({
  id: "local-box",
  shareId: "shared-box",
  updatedAt: 12345,
  name: "Equipe São João ✨",
  versionGroup: "champions",
  pokemon: [{
    speciesName: "pikachu",
    formName: "pikachu-gmax",
    nickname: "Faísca ⚡",
    level: 88,
    item: "light-ball",
    ability: "static",
    nature: "timid",
    moves: ["thunderbolt", "surf", "nuzzle", "protect"],
    ivs: { hp: 31, attack: 0, defense: 30, "special-attack": 31, "special-defense": 29, speed: 31 },
    evs: { hp: 4, attack: 0, defense: 0, "special-attack": 252, "special-defense": 0, speed: 252 },
    canGMax: true,
    shiny: true,
    dynamaxLevel: 10,
    teraType: "electric",
    friendship: 255,
    gender: "F",
    genderRate: 4,
    genderLocked: true,
    customStats: { hp: 50, attack: 51, defense: 52, "special-attack": 53, "special-defense": 54, speed: 55 },
    customTypes: ["electric", "fairy"],
    rpg: {
      xp: 22.5,
      currentHp: 7,
      status: "paralysis",
      caughtWith: "luxury-ball",
      originalTrainer: "Lucas",
      notes: "Parceira principal",
      animeNotes: "Pode usar o campo como para-raios.",
      pp: [10, 15, 20, 5],
    },
  }],
});

test("V4 share code round-trips Unicode and every editable factor", async () => {
  const decoded = await decodeTeam(await encodeTeam(completeTeam));
  assert.equal(decoded.name, completeTeam.name);
  assert.equal(decoded.versionGroup, "champions");
  assert.equal(decoded.pokemon[0].nickname, "Faísca ⚡");
  assert.equal(decoded.pokemon[0].species.name, "pikachu-gmax");
  assert.equal(decoded.pokemon[0].shiny, true);
  assert.equal(decoded.pokemon[0].genderLocked, true);
  assert.equal(decoded.pokemon[0].dynamaxLevel, 10);
  assert.deepEqual(decoded.pokemon[0].moves, completeTeam.pokemon[0].moves);
  assert.deepEqual(decoded.pokemon[0].customTypes, ["electric", "fairy"]);
  assert.equal(decoded.pokemon[0].rpg.currentHp, 7);
  assert.equal(decoded.pokemon[0].rpg.status, "paralysis");
  assert.equal(decoded.pokemon[0].rpg.animeNotes, "Pode usar o campo como para-raios.");
  assert.deepEqual(decoded.pokemon[0].rpg.pp, [10, 15, 20, 5]);
});

test("legacy V3 codes remain importable", async () => {
  const payload = {
    boxName: "Legacy",
    partners: [{
      sp: "bulbasaur",
      nk: "Buba",
      lv: 5,
      iv: [31, 31, 31, 31, 31, 31],
      ev: [0, 0, 0, 0, 0, 0],
      gd: "M",
      gr: 1,
    }],
  };
  const legacy = LEGACY_SHARE_PREFIX + btoa(encodeURIComponent(JSON.stringify(payload)));
  const decoded = await decodeTeam(legacy);
  assert.equal(decoded.name, "Legacy");
  assert.equal(decoded.pokemon[0].species.name, "bulbasaur");
});

test("one or more selected Pokémon round-trip without exporting the whole Box", async () => {
  const second = normalizeTeam({ pokemon: [{ formName: "shellder", nickname: "Concha", level: 12 }] }).pokemon[0];
  const code = await encodePokemonBundle([completeTeam.pokemon[0], second], completeTeam);
  const decoded = await decodeShare(code);
  assert.equal(decoded.kind, "pokemon");
  assert.equal(decoded.sourceName, completeTeam.name);
  assert.equal(decoded.versionGroup, "champions");
  assert.deepEqual(decoded.pokemon.map(partner => partner.speciesName), ["pikachu", "shellder"]);
  assert.equal(decoded.pokemon[0].nickname, "Faísca ⚡");
  assert.equal(decoded.pokemon[0].rpg.notes, "Parceira principal");
  await assert.rejects(() => decodeTeam(code), /Pokémon avulsos/);
});

test("Link Cable remains portable without browser Base64 or Compression Streams", async () => {
  const saved = {
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    CompressionStream: globalThis.CompressionStream,
    DecompressionStream: globalThis.DecompressionStream,
  };
  try {
    globalThis.atob = undefined;
    globalThis.btoa = undefined;
    globalThis.CompressionStream = undefined;
    globalThis.DecompressionStream = undefined;
    const code = await encodePokemonBundle([completeTeam.pokemon[0]], completeTeam);
    const decoded = await decodeShare(code);
    assert.equal(decoded.kind, "pokemon");
    assert.equal(decoded.pokemon[0].nickname, "Faísca ⚡");
  } finally {
    Object.assign(globalThis, saved);
  }
});

test("imported Pokémon fill a chosen existing Box and receive local identities", () => {
  const destination = normalizeTeam({
    id: "destination",
    shareId: "destination",
    name: "Riolu e Luvdisc",
    pokemon: [{ id: "riolu", formName: "riolu" }, { id: "luvdisc", formName: "luvdisc" }],
  });
  const incoming = normalizeTeam({
    pokemon: [{ id: "remote-shellder", formName: "shellder" }, { id: "remote-eevee", formName: "eevee" }],
  }).pokemon;
  const result = insertImportedPokemon([destination], destination.id, incoming);
  assert.equal(result.status, "added");
  assert.equal(result.team.id, destination.id);
  assert.deepEqual(result.team.pokemon.map(partner => partner.species.name), ["riolu", "luvdisc", "shellder", "eevee"]);
  assert.notEqual(result.added[0].id, "remote-shellder");
  assert.equal(result.rejected.length, 0);
});

test("destination capacity is explicit and never overwrites existing partners", () => {
  const destination = normalizeTeam({
    id: "almost-full",
    pokemon: ["a", "b", "c", "d", "e"].map((name, index) => ({ id: `old-${index}`, formName: name })),
  });
  const incoming = normalizeTeam({ pokemon: [{ formName: "shellder" }, { formName: "eevee" }] }).pokemon;
  const result = insertImportedPokemon([destination], destination.id, incoming);
  assert.equal(result.status, "partial");
  assert.equal(result.added.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.team.pokemon.slice(0, 5).map(partner => partner.id), destination.pokemon.map(partner => partner.id));
});

test("import merge keeps one copy and lets only the newest revision win", () => {
  const oldTeam = normalizeTeam({ ...completeTeam, updatedAt: 100 });
  const newer = normalizeTeam({ ...completeTeam, id: "remote", updatedAt: 200, name: "Newer" });
  const replaced = mergeImportedTeam([oldTeam], newer);
  assert.equal(replaced.status, "replaced");
  assert.equal(replaced.teams.length, 1);
  assert.equal(replaced.teams[0].name, "Newer");
  const ignored = mergeImportedTeam(replaced.teams, oldTeam);
  assert.equal(ignored.status, "ignored");
  assert.equal(ignored.teams.length, 1);
});

test("late API hydration enriches species without overwriting live edits", () => {
  const stored = normalizeTeam({
    id: "box-1",
    shareId: "shared-1",
    pokemon: [{ id: "partner-1", formName: "pikachu", nickname: "Before" }],
  });
  const live = {
    ...stored,
    pokemon: [{ ...stored.pokemon[0], nickname: "Edited while loading", item: "light-ball" }],
  };
  const hydrated = {
    ...stored,
    pokemon: [{
      ...stored.pokemon[0],
      species: { name: "pikachu", moves: [{ move: { name: "thunderbolt" } }] },
      genderRate: 4,
    }],
  };
  const merged = mergeHydratedTeams([live], [hydrated]);
  assert.equal(merged[0].pokemon[0].nickname, "Edited while loading");
  assert.equal(merged[0].pokemon[0].item, "light-ball");
  assert.equal(merged[0].pokemon[0].species.moves[0].move.name, "thunderbolt");
});

test("partial custom base stats stay partial after normalization", () => {
  const team = normalizeTeam({
    pokemon: [{ formName: "mew", customStats: { attack: 123 } }],
  });
  assert.deepEqual(team.pokemon[0].customStats, { attack: 123 });
});

test("box deletion returns an undo-safe snapshot and restoration keeps its position", () => {
  const first = normalizeTeam({ id: "one", shareId: "one", name: "One" });
  const second = normalizeTeam({ id: "two", shareId: "two", name: "Two" });
  const third = normalizeTeam({ id: "three", shareId: "three", name: "Three" });
  const deleted = removeTeamById([first, second, third], second.id);
  assert.deepEqual(deleted.teams.map(team => team.id), ["one", "three"]);
  assert.equal(deleted.removed.id, "two");
  assert.equal(deleted.index, 1);
  const restored = restoreTeamAt(deleted.teams, deleted.removed, deleted.index);
  assert.deepEqual(restored.map(team => team.id), ["one", "two", "three"]);
});

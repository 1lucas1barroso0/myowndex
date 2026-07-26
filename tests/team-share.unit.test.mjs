import assert from "node:assert/strict";
import test from "node:test";
import { mergeHydratedTeams, mergeImportedTeam, normalizeTeam } from "../src/core/team.js";
import { decodeTeam, encodeTeam, LEGACY_SHARE_PREFIX } from "../src/core/teamShare.js";

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

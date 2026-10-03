import assert from "node:assert/strict";
import test from "node:test";
import { checkActionConditions } from "../src/core/battleConditions.js";
import { createRoomSnapshot, normalizeRoomSnapshot } from "../src/core/room.js";
import { loadTeams, loadTeamsDurable, mergeHydratedTeams, normalizePokemon, normalizeTeam, RPG_SCALE_VERSION, saveTeamsDurable, TEAM_STORAGE_KEY } from "../src/core/team.js";
import { decodeShare, decodeTeam, encodePokemonBundle, encodeTeam } from "../src/core/teamShare.js";
import { getStorageScope, resolveStorageKey, setStorageScope } from "../src/core/storage.js";
import { normalizeAuthoritativeRequest, resolveAuthoritativeAction } from "../server/authoritativeActions.js";

const hpSpecies = {
  name: "bulbasaur", species: { name: "bulbasaur", url: "" },
  stats: [{ stat: { name: "hp" }, base_stat: 45 }],
};

test("late species hydration migrates current HP once and preserves concurrent journey edits", () => {
  const stored = normalizeTeam({ id: "late-box", updatedAt: 1, pokemon: [{
    id: "late-partner", speciesName: "bulbasaur", rpg: { currentHp: 1, xp: 2.9 },
  }] });
  assert.equal(stored.pokemon[0].rpg.scaleVersion, 1);
  const hydrated = normalizeTeam({ ...stored, pokemon: [{ ...stored.pokemon[0], species: hpSpecies }] });
  assert.equal(hydrated.pokemon[0].rpg.currentHp, 2);
  const current = { ...stored, pokemon: [{ ...stored.pokemon[0],
    nickname: "Editado agora", item: "oran-berry", rpg: { ...stored.pokemon[0].rpg, xp: 8, notes: "Nota nova" },
  }] };
  const merged = mergeHydratedTeams([current], [hydrated])[0];
  assert.equal(merged.pokemon[0].rpg.currentHp, 2);
  assert.equal(merged.pokemon[0].rpg.scaleVersion, RPG_SCALE_VERSION);
  assert.equal(merged.pokemon[0].rpg.xp, 8);
  assert.equal(merged.pokemon[0].rpg.notes, "Nota nova");
  assert.equal(merged.pokemon[0].nickname, "Editado agora");
  assert.equal(merged.pokemon[0].item, "oran-berry");
  assert.deepEqual(normalizeTeam(normalizeTeam(merged)), merged);

  const fainted = { ...current, pokemon: [{ ...current.pokemon[0], rpg: { ...current.pokemon[0].rpg, currentHp: 0 } }] };
  assert.equal(mergeHydratedTeams([fainted], [hydrated])[0].pokemon[0].rpg.currentHp, 0);
});

test("new scale markers survive export/import and wounded or fainted HP never migrates twice", async () => {
  for (const currentHp of [0, 1, 2]) {
    const team = normalizeTeam({ id: `scale-${currentHp}`, updatedAt: 1, pokemon: [{
      species: hpSpecies, level: 5, rpg: { scaleVersion: RPG_SCALE_VERSION, currentHp },
    }] });
    const decoded = await decodeTeam(await encodeTeam(team));
    assert.equal(decoded.pokemon[0].rpg.scaleVersion, RPG_SCALE_VERSION);
    assert.equal(normalizePokemon(decoded.pokemon[0]).rpg.currentHp, currentHp);
  }
});

test("an individual legacy partner export retains the deferred scale marker until species stats arrive", async () => {
  const bundle = await decodeShare(await encodePokemonBundle([{ speciesName: "bulbasaur", rpg: { currentHp: 1 } }]));
  const deferred = normalizePokemon(bundle.pokemon[0]);
  assert.equal(deferred.rpg.scaleVersion, 1);
  assert.equal(deferred.rpg.currentHp, 1);
  assert.equal(normalizePokemon({ ...deferred, species: hpSpecies }).rpg.currentHp, 2);
});

test("schema4 Boxes load through sync and durable scoped storage then save as schema5 without touching guest data", async t => {
  const previousWindow = globalThis.window, previousScope = getStorageScope();
  const values = new Map();
  globalThis.window = { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } };
  setStorageScope("migration-account");
  t.after(() => { setStorageScope(previousScope); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const guest = JSON.stringify({ schema: 4, teams: [{ id: "guest-box", updatedAt: 1 }] });
  values.set(TEAM_STORAGE_KEY, guest);
  values.set(resolveStorageKey(TEAM_STORAGE_KEY), JSON.stringify({ schema: 4, teams: [{
    id: "old-account-box", updatedAt: 1, pokemon: [{ id: "old-partner", species: hpSpecies, rpg: { currentHp: 1, xp: 4.9 } }],
  }] }));
  const sync = loadTeams();
  const durable = await loadTeamsDurable();
  assert.deepEqual(durable, sync);
  assert.equal(durable[0].pokemon[0].rpg.currentHp, 2);
  assert.equal(durable[0].pokemon[0].rpg.xp, 4);
  assert.equal(await saveTeamsDurable(durable), true);
  assert.equal(JSON.parse(values.get(resolveStorageKey(TEAM_STORAGE_KEY))).schema, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(await loadTeamsDurable())), JSON.parse(JSON.stringify(durable)));
  assert.equal(values.get(TEAM_STORAGE_KEY), guest);
});

test("legacy room and reserves migrate proportionally exactly once including saved effects and condition counters", () => {
  const oldToken = {
    id: "old-token", maxHp: 5, currentHp: 2, status: "freeze", freezeTurns: 2,
    stats: { hp: 5, attack: 3 }, originalStats: { hp: 100, attack: 60 },
    volatileEffects: [{ id: "wish", amount: 2 }],
  };
  const old = { ...createRoomSnapshot("Migração"), schema: 7, tokens: [oldToken], benchTokens: [{ ...oldToken, id: "old-reserve", currentHp: 0 }] };
  const migrated = normalizeRoomSnapshot(old);
  assert.equal(migrated.tokens[0].maxHp, 10);
  assert.equal(migrated.tokens[0].currentHp, 4);
  assert.equal(migrated.tokens[0].freezeTurns, 2);
  assert.equal(migrated.tokens[0].volatileEffects[0].amount, 5);
  assert.equal(migrated.benchTokens[0].currentHp, 0);
  assert.deepEqual(normalizeRoomSnapshot(normalizeRoomSnapshot(migrated)), migrated);
});

test("a five-opportunity confusion survives normalization and ends before its fifth action", () => {
  let token = normalizeRoomSnapshot({ ...createRoomSnapshot("Confusion"), tokens: [{
    id: "confused", maxHp: 10, currentHp: 10, volatileEffects: [{ id: "confusion", turns: 5 }],
  }] }).tokens[0];
  for (const expectedTurns of [4, 3, 2, 1]) {
    const result = checkActionConditions({ token, move: { name: "tackle" }, random: () => 0.99 });
    assert.equal(result.canAct, true);
    assert.equal(result.rolls[0].kind, "confusion");
    assert.equal(result.token.volatileEffects[0].turns, expectedTurns);
    token = result.token;
  }
  const ended = checkActionConditions({ token, move: { name: "tackle" }, random: () => { throw new Error("Expired confusion must not roll"); } });
  assert.equal(ended.canAct, true);
  assert.equal(ended.token.volatileEffects.length, 0);
});

test("remote quick modifiers share the finite range used by local dice and never truncate a valid modifier", () => {
  for (const modifier of [-99999, -50, 150, 99999]) {
    const request = normalizeAuthoritativeRequest({ requestId: "modificador-12345", action: "quick-attribute", mode: "normal", attribute: modifier });
    const result = resolveAuthoritativeAction({ request, snapshot: {}, role: "player", random: () => 0 });
    assert.equal(result.audit.result, 2 + modifier);
    assert.equal(result.audit.modifiers.modifier, modifier);
  }
  assert.throws(() => normalizeAuthoritativeRequest({ requestId: "modificador-12345", action: "quick-attribute", attribute: Infinity }), /modificador/);
});

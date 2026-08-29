import assert from "node:assert/strict";
import test from "node:test";
import { formatCount, formatPokemonInScene, formatRemainingPp } from "../src/core/copy.js";
import { normalizeRoomSnapshot } from "../src/core/room.js";
import { normalizePokemon, normalizeTeam } from "../src/core/team.js";

const assertFiniteTree = (value, path = "root") => {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteTree(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => assertFiniteTree(entry, `${path}.${key}`));
  }
};

test("malformed Pokémon and Box numbers normalize to finite capped state", () => {
  const pokemon = normalizePokemon({
    id: "malformed",
    level: Infinity,
    friendship: -Infinity,
    dynamaxLevel: Number.NaN,
    genderRate: null,
    ivs: { hp: Infinity, attack: -5 },
    evs: { hp: "", attack: "999999999999999999999" },
    rpg: { xp: 4.99, currentHp: 7.8, pp: [Infinity, -2, 4.8] },
  });
  assert.equal(pokemon.level, 5);
  assert.equal(pokemon.friendship, 70);
  assert.equal(pokemon.ivs.hp, 31);
  assert.equal(pokemon.ivs.attack, 0);
  assert.equal(pokemon.evs.attack, 252);
  assert.equal(pokemon.rpg.xp, 4.5);
  assert.equal(pokemon.rpg.currentHp, 7);
  assert.deepEqual(pokemon.rpg.pp.slice(0, 3), [null, 0, 4]);
  assertFiniteTree(normalizeTeam({ updatedAt: Infinity, pokemon: [pokemon] }));
});

test("malformed adventure snapshots cannot preserve fractional HP or non-finite mechanics", () => {
  const snapshot = normalizeRoomSnapshot({
    round: Infinity,
    turnIndex: -Infinity,
    audio: { volume: Infinity, offset: -5, startedAt: Number.NaN },
    tokens: [{
      id: "broken",
      maxHp: Infinity,
      currentHp: 6.9,
      level: null,
      xp: 1.99,
      priority: 999,
      x: "",
      y: "invalid",
      stats: { attack: Infinity, defense: -5, speed: 0.9 },
      originalStats: { attack: Number.NaN },
      pp: [Infinity, -1, 2.8],
    }],
  });
  const token = snapshot.tokens[0];
  assert.equal(token.maxHp, 1);
  assert.equal(token.currentHp, 1);
  assert.equal(token.level, 5);
  assert.equal(token.xp, 1.5);
  assert.equal(token.priority, 7);
  assert.equal(Number.isInteger(token.currentHp), true);
  assertFiniteTree(snapshot);
});

test("count formatters never expose technical numeric states", () => {
  for (const value of [Number.NaN, Infinity, -Infinity, null, undefined, {}, "not-a-number"]) {
    for (const formatted of [formatCount(value, "hit"), formatPokemonInScene(value), formatRemainingPp(value)]) {
      assert.doesNotMatch(formatted, /NaN|Infinity|undefined|null|\[object Object\]/);
    }
  }
});

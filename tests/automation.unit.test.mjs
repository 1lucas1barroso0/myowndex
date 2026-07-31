import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMoveConsequences,
  applyHitKillProtection,
  applyStageChange,
  getDefensiveTypes,
  getMovePpState,
  getMoveStab,
  normalizePpSlots,
  stageMultiplier,
} from "../src/core/automation.js";

const attacker = {
  id: "attacker",
  name: "Brasa",
  maxHp: 6,
  currentHp: 2,
  status: "",
  priority: 1,
  declaredMove: "ember",
  types: ["fire", "flying"],
  originalTypes: ["fire", "flying"],
  teraType: "fire",
  teraActive: false,
  moves: ["ember", "", "", ""],
  pp: [null, null, null, null],
  stages: {},
  stats: { attack: 3, defense: 3, "special-attack": 3, "special-defense": 3, speed: 4 },
  originalStats: { attack: 60, defense: 60, "special-attack": 60, "special-defense": 60, speed: 80 },
};

const defender = {
  ...attacker,
  id: "defender",
  name: "Folha",
  maxHp: 10,
  currentHp: 10,
  types: ["grass", "poison"],
  originalTypes: ["grass", "poison"],
  teraType: "water",
  moves: ["tackle", "", "", ""],
  declaredMove: "",
  priority: 0,
};

test("PP starts at the official maximum and decrements on first use", () => {
  assert.deepEqual(normalizePpSlots([]), [null, null, null, null]);
  const state = getMovePpState(attacker, { name: "ember", pp: 25 });
  assert.equal(state.index, 0);
  assert.equal(state.remaining, 25);
  assert.equal(state.maximum, 25);
});

test("Tera changes defensive typing and preserves offensive STAB correctly", () => {
  assert.deepEqual(getDefensiveTypes({ ...defender, teraActive: false }), ["grass", "poison"]);
  assert.deepEqual(getDefensiveTypes({ ...defender, teraActive: true }), ["water"]);
  assert.equal(getMoveStab(attacker, "fire"), 1.5);
  assert.equal(getMoveStab({ ...attacker, teraActive: true }, "fire"), 2);
  assert.equal(getMoveStab({ ...attacker, teraActive: true }, "flying"), 1.5);
  assert.equal(getMoveStab({ ...attacker, teraActive: true }, "water"), 1);
});

test("stat stages use VGC multipliers and recalculate the RPG value from the original stat", () => {
  assert.equal(stageMultiplier(2), 2);
  assert.equal(stageMultiplier(-2), 0.5);
  const raised = applyStageChange(attacker, "special-attack", 2);
  assert.equal(raised.stages["special-attack"], 2);
  assert.equal(raised.stats["special-attack"], 6);
});

test("one resolved Move applies PP, HP, drain, status and stages together", () => {
  const move = {
    name: "ember",
    pp: 25,
    damage_class: { name: "special" },
    target: { name: "selected-pokemon" },
    meta: {
      drain: 50,
      healing: 0,
      ailment: { name: "burn" },
      ailment_chance: 100,
      stat_chance: 100,
    },
    stat_changes: [{ stat: { name: "special-attack" }, change: 1 }],
  };
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    defenderId: defender.id,
    move,
    resolution: { hit: true, damage: 4 },
  });
  const nextAttacker = result.tokens.find(token => token.id === attacker.id);
  const nextDefender = result.tokens.find(token => token.id === defender.id);
  assert.equal(nextAttacker.pp[0], 24);
  assert.equal(nextAttacker.currentHp, 4);
  assert.equal(nextAttacker.declaredMove, "");
  assert.equal(nextAttacker.priority, 0);
  assert.equal(nextDefender.stages["special-attack"], 1);
  assert.equal(nextDefender.currentHp, 6);
  assert.equal(nextDefender.status, "burn");
  assert.equal(result.consequences.healed, 2);
  assert.equal(result.consequences.appliedStatus, "burn");
});

test("hit kill protection covers damage below, equal to and above three times current HP", () => {
  const below = applyHitKillProtection({ damage: 29, currentHp: 10 });
  assert.equal(below.protectedFromKnockout, true);
  assert.equal(below.appliedDamage, 9);
  assert.equal(below.remainingHp, 1);
  assert.equal(below.threshold, 30);

  const equal = applyHitKillProtection({ damage: 30, currentHp: 10 });
  assert.equal(equal.protectedFromKnockout, false);
  assert.equal(equal.appliedDamage, 10);
  assert.equal(equal.remainingHp, 0);

  const above = applyHitKillProtection({ damage: 31, currentHp: 10 });
  assert.equal(above.protectedFromKnockout, false);
  assert.equal(above.remainingHp, 0);
});

test("critical hits and declared knockout moves bypass hit kill protection", () => {
  const critical = applyHitKillProtection({ damage: 10, currentHp: 10, critical: true });
  const direct = applyHitKillProtection({ damage: 10, currentHp: 10, directKnockout: true });
  assert.equal(critical.protectedFromKnockout, false);
  assert.equal(direct.protectedFromKnockout, false);
  assert.equal(critical.remainingHp, 0);
  assert.equal(direct.remainingHp, 0);
});

test("battle consequences record calculated damage when protection leaves one HP", () => {
  const fragile = { ...defender, currentHp: 4, maxHp: 10 };
  const result = applyMoveConsequences({
    tokens: [attacker, fragile],
    attackerId: attacker.id,
    defenderId: fragile.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} },
    resolution: { hit: true, damage: 8, attackTest: { critical: false } },
  });
  const target = result.tokens.find(token => token.id === fragile.id);
  assert.equal(target.currentHp, 1);
  assert.equal(result.consequences.calculatedDamage, 8);
  assert.equal(result.consequences.damage, 3);
  assert.equal(result.consequences.hitKillProtected, true);
  assert.equal(result.consequences.hitKillThreshold, 12);
});

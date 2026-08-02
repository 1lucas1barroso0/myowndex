import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMoveConsequences,
  applyHitKillProtection,
  applyStageChange,
  accuracyStageMultiplier,
  getDefensiveTypes,
  getAffectedMoveTargets,
  getMoveResolutionProfile,
  getMovePpState,
  getSelectableMoveTargets,
  getMoveStab,
  normalizePpSlots,
  STAGE_STAT_KEYS,
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

test("all seven stat stages use the correct multipliers and preserve original values", () => {
  assert.deepEqual(STAGE_STAT_KEYS, ["attack", "defense", "special-attack", "special-defense", "speed", "accuracy", "evasion"]);
  assert.equal(stageMultiplier(2), 2);
  assert.equal(stageMultiplier(-2), 0.5);
  assert.equal(accuracyStageMultiplier(2), 5 / 3);
  assert.equal(accuracyStageMultiplier(-2), 3 / 5);
  const raised = applyStageChange(attacker, "special-attack", 2);
  assert.equal(raised.stages["special-attack"], 2);
  assert.equal(raised.stats["special-attack"], 6);
  const accuracy = applyStageChange(attacker, "accuracy", 2);
  assert.equal(accuracy.stages.accuracy, 2);
  assert.deepEqual(accuracy.stats, attacker.stats);
});

test("move targets distinguish self, allies, opponents and groups", () => {
  const ally = { ...attacker, id: "ally", side: "ally", currentHp: 5 };
  const user = { ...attacker, side: "ally" };
  const opponent = { ...defender, side: "opponent" };
  const tokens = [user, ally, opponent];
  const recover = { target: { name: "user" }, damage_class: { name: "status" }, accuracy: null };
  const helpingHand = { target: { name: "ally" }, damage_class: { name: "status" }, accuracy: null };
  const growl = { target: { name: "all-opponents" }, damage_class: { name: "status" }, accuracy: 100 };
  assert.equal(getMoveResolutionProfile(recover).resolutionKind, "declaration");
  assert.deepEqual(getAffectedMoveTargets(tokens, user, null, recover).map(token => token.id), [user.id]);
  assert.deepEqual(getSelectableMoveTargets(tokens, user, helpingHand).map(token => token.id), [ally.id]);
  assert.deepEqual(getAffectedMoveTargets(tokens, user, null, growl).map(token => token.id), [opponent.id]);
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

test("a connected move keeps secondary effects when the damage contest is lost", () => {
  const move = {
    name: "ember",
    pp: 25,
    damage_class: { name: "special" },
    target: { name: "selected-pokemon" },
    meta: { ailment: { name: "burn" }, ailment_chance: 100 },
  };
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    targetId: defender.id,
    move,
    resolution: { moveConnected: true, damageHit: false, damage: 4 },
  });
  const target = result.tokens.find(token => token.id === defender.id);
  assert.equal(target.currentHp, defender.currentHp);
  assert.equal(target.status, "burn");
  assert.equal(result.consequences.damage, 0);
  assert.equal(result.consequences.appliedStatus, "burn");
});

test("a margin above one grants the second d100 to a secondary effect", () => {
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    targetId: defender.id,
    move: {
      name: "ember",
      pp: 25,
      damage_class: { name: "special" },
      target: { name: "selected-pokemon" },
      meta: { ailment: { name: "burn" }, ailment_chance: 50 },
    },
    resolution: {
      moveConnected: true,
      damageHit: true,
      damage: 1,
      attackTest: { total: 12, critical: false },
      defenseTest: { total: 8 },
    },
    random: (() => {
      const values = [0.9, 0.1];
      return () => values.shift() ?? 0;
    })(),
  });
  assert.equal(result.consequences.statusRoll.rolls.length, 2);
  assert.equal(result.consequences.statusRoll.success, true);
});

test("self declarations heal and modify the user without requiring an opponent", () => {
  const user = {
    ...attacker,
    currentHp: 1,
    moves: ["swords-dance", "", "", ""],
    declaredMove: "swords-dance",
  };
  const swordsDance = {
    name: "swords-dance",
    pp: 20,
    accuracy: null,
    damage_class: { name: "status" },
    target: { name: "user" },
    meta: { healing: 0 },
    stat_changes: [{ stat: { name: "attack" }, change: 2 }],
  };
  const boosted = applyMoveConsequences({
    tokens: [user],
    attackerId: user.id,
    targetId: user.id,
    move: swordsDance,
    resolution: { moveConnected: true, damageHit: false, damage: 0 },
  });
  assert.equal(boosted.tokens[0].stages.attack, 2);
  assert.equal(boosted.tokens[0].pp[0], 19);
  assert.equal(boosted.tokens[0].declaredMove, "");

  const recovered = applyMoveConsequences({
    tokens: [{ ...user, moves: ["recover", "", "", ""], pp: [null, null, null, null] }],
    attackerId: user.id,
    targetId: user.id,
    move: {
      name: "recover",
      pp: 5,
      accuracy: null,
      damage_class: { name: "status" },
      target: { name: "user" },
      meta: { healing: 50 },
      stat_changes: [],
    },
    resolution: { moveConnected: true, damageHit: false, damage: 0 },
  });
  assert.equal(recovered.tokens[0].currentHp, 4);
});

test("Yawn is tracked separately until the end-of-round resolver applies sleep", () => {
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    targetId: defender.id,
    move: {
      name: "yawn",
      pp: 10,
      damage_class: { name: "status" },
      target: { name: "selected-pokemon" },
      meta: { ailment: { name: "none" } },
    },
    resolution: { moveConnected: true, damageHit: false, damage: 0 },
  });
  const target = result.tokens.find(token => token.id === defender.id);
  assert.equal(target.status, "");
  assert.deepEqual(target.volatileEffects, [{ id: "yawn", sourceMove: "yawn", turns: 2 }]);
  assert.equal(result.consequences.trackedEffect, "yawn");
});

test("Protect is a declaration and remains visible until the round ends", () => {
  const user = { ...attacker, moves: ["protect", "", "", ""], declaredMove: "protect" };
  const result = applyMoveConsequences({
    tokens: [user],
    attackerId: user.id,
    targetId: user.id,
    move: {
      name: "protect",
      pp: 10,
      accuracy: null,
      damage_class: { name: "status" },
      target: { name: "user" },
      meta: {},
    },
    resolution: { moveConnected: true, damageHit: false, damage: 0 },
  });
  assert.deepEqual(result.tokens[0].volatileEffects, [{ id: "protection", sourceMove: "protect", turns: 1 }]);
  assert.equal(result.consequences.trackedEffect, "protect");
});

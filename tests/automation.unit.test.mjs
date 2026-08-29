import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMoveConsequences,
  applyHitKillProtection,
  applyStageChange,
  accuracyStageMultiplier,
  calculateStagedStats,
  getDefensiveTypes,
  getAffectedMoveTargets,
  getHitKillProtectionKey,
  hasHitKillSurvivalGrace,
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

  const tiny = { ...attacker, originalStats: { ...attacker.originalStats, attack: 20 }, stats: { ...attacker.stats, attack: 1 } };
  assert.equal(calculateStagedStats({ ...tiny, stages: { attack: 1 } }).attack, 2);
  assert.equal(calculateStagedStats({ ...tiny, stages: { attack: -1 } }).attack, 0);
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
  assert.deepEqual(result.hitKillProtectionUsed, []);
});

test("hit kill protection only saves full HP below three times maximum HP", () => {
  const below = applyHitKillProtection({ damage: 29, currentHp: 10, maxHp: 10 });
  assert.equal(below.protectedFromKnockout, true);
  assert.equal(below.appliedDamage, 9);
  assert.equal(below.remainingHp, 1);
  assert.equal(below.threshold, 30);

  const equal = applyHitKillProtection({ damage: 30, currentHp: 10, maxHp: 10 });
  assert.equal(equal.protectedFromKnockout, false);
  assert.equal(equal.appliedDamage, 10);
  assert.equal(equal.remainingHp, 0);

  const above = applyHitKillProtection({ damage: 31, currentHp: 10, maxHp: 10 });
  assert.equal(above.protectedFromKnockout, false);
  assert.equal(above.remainingHp, 0);

  const injured = applyHitKillProtection({ damage: 9, currentHp: 9, maxHp: 10 });
  assert.equal(injured.atMaximumHp, false);
  assert.equal(injured.protectedFromKnockout, false);
  assert.equal(injured.remainingHp, 0);

  const spent = applyHitKillProtection({ damage: 10, currentHp: 10, maxHp: 10, protectionUsed: true });
  assert.equal(spent.protectedFromKnockout, false);
  assert.equal(spent.remainingHp, 0);

  const normalized = applyHitKillProtection({ damage: 10.9, currentHp: 10.9, maxHp: 10.9 });
  assert.equal(normalized.maximumHp, 10);
  assert.equal(normalized.calculatedDamage, 10);
  assert.equal(normalized.remainingHp, 1);

  const invalid = applyHitKillProtection({ damage: Infinity, currentHp: Number.NaN, maxHp: null });
  assert.equal(invalid.remainingHp, 0);
  assert.equal(invalid.protectedFromKnockout, false);
});

test("sequential reactive damage sources use the centralized hit kill state one source at a time", () => {
  const fragileAttacker = {
    ...attacker,
    id: "reactive-attacker",
    teamId: "team-reactive",
    pokemonId: "pokemon-reactive",
    maxHp: 1,
    currentHp: 1,
    moves: ["tackle", "", "", ""],
  };
  const reactiveDefender = {
    ...defender,
    id: "reactive-defender",
    ability: "rough-skin",
    item: "rocky-helmet",
  };
  const result = applyMoveConsequences({
    tokens: [fragileAttacker, reactiveDefender],
    attackerId: fragileAttacker.id,
    defenderId: reactiveDefender.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} },
    resolution: { hit: true, damage: 1, damagePerHit: 1, hitCount: 1, attackTest: {}, defenseTest: {} },
  });
  assert.equal(result.tokens.find(token => token.id === fragileAttacker.id).currentHp, 0);
  assert.deepEqual(result.hitKillProtectionUsed, [getHitKillProtectionKey(fragileAttacker)]);
  assert.equal(result.consequences.indirectHitKillProtections.length, 1);
  assert.match(result.consequences.specialNarratives.join(" "), /Proteção contra Hit Kill manteve/);
});

test("attacker criticals, defender critical failures and declared knockout moves bypass hit kill protection", () => {
  const critical = applyHitKillProtection({ damage: 10, currentHp: 10, critical: true });
  const defenderFumble = applyHitKillProtection({ damage: 10, currentHp: 10, defenderFumble: true });
  const direct = applyHitKillProtection({ damage: 10, currentHp: 10, directKnockout: true });
  assert.equal(critical.protectedFromKnockout, false);
  assert.equal(defenderFumble.protectedFromKnockout, false);
  assert.equal(direct.protectedFromKnockout, false);
  assert.equal(critical.remainingHp, 0);
  assert.equal(defenderFumble.remainingHp, 0);
  assert.equal(direct.remainingHp, 0);
});

test("general hit kill protection resolves before Sturdy and preserves exactly one later chance", () => {
  const move = { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} };
  const sturdyDefender = {
    ...defender,
    teamId: "team-sturdy",
    pokemonId: "pokemon-sturdy",
    ability: "sturdy",
  };
  const first = applyMoveConsequences({
    tokens: [attacker, sturdyDefender],
    attackerId: attacker.id,
    defenderId: sturdyDefender.id,
    move,
    resolution: { hit: true, damage: 10, hitCount: 1, attackTest: {}, defenseTest: {} },
  });
  const protectionKey = getHitKillProtectionKey(sturdyDefender);
  assert.equal(first.consequences.hitKillProtected, true);
  assert.equal(first.consequences.traitProtected, false);
  assert.equal(first.consequences.survivalGraceGranted, true);
  assert.equal(first.tokens.find(token => token.id === sturdyDefender.id).currentHp, 1);
  assert.equal(first.tokens.find(token => token.id === sturdyDefender.id).traitState.history.length, 0);
  assert.ok(hasHitKillSurvivalGrace(first.hitKillSurvivalGrace, sturdyDefender));

  const returnedDefender = {
    ...first.tokens.find(token => token.id === sturdyDefender.id),
    id: "defender-returned",
  };
  const returnedTokens = first.tokens.map(token => token.id === sturdyDefender.id ? returnedDefender : token);
  assert.ok(hasHitKillSurvivalGrace(first.hitKillSurvivalGrace, returnedDefender));

  const second = applyMoveConsequences({
    tokens: returnedTokens,
    attackerId: attacker.id,
    defenderId: returnedDefender.id,
    move,
    resolution: { hit: true, damage: 1, hitCount: 1, attackTest: {}, defenseTest: {} },
    hitKillProtectionUsed: first.hitKillProtectionUsed,
    hitKillSurvivalGrace: first.hitKillSurvivalGrace,
    consumePp: false,
  });
  assert.deepEqual(second.hitKillProtectionUsed, [protectionKey]);
  assert.equal(second.consequences.hitKillProtected, false);
  assert.equal(second.consequences.traitProtected, true);
  assert.equal(second.consequences.survivalGraceUsed, true);
  assert.equal(second.tokens.find(token => token.id === returnedDefender.id).currentHp, 1);
  assert.equal(second.tokens.find(token => token.id === returnedDefender.id).traitState.history.at(-1).sourceId, "sturdy");
  assert.deepEqual(second.hitKillSurvivalGrace, []);

  const third = applyMoveConsequences({
    tokens: second.tokens,
    attackerId: attacker.id,
    defenderId: returnedDefender.id,
    move,
    resolution: { hit: true, damage: 1, hitCount: 1, attackTest: {}, defenseTest: {} },
    hitKillProtectionUsed: second.hitKillProtectionUsed,
    hitKillSurvivalGrace: second.hitKillSurvivalGrace,
    consumePp: false,
  });
  assert.equal(third.tokens.find(token => token.id === returnedDefender.id).currentHp, 0);
  assert.equal(third.consequences.traitProtected, false);
});

test("Focus Sash remains unconsumed on the general protection turn and is consumed on the next damaging chance", () => {
  const move = { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} };
  const sashDefender = {
    ...defender,
    teamId: "team-sash",
    pokemonId: "pokemon-sash",
    item: "focus-sash",
  };
  const first = applyMoveConsequences({
    tokens: [attacker, sashDefender],
    attackerId: attacker.id,
    defenderId: sashDefender.id,
    move,
    resolution: { hit: true, damage: 10, hitCount: 1, attackTest: {}, defenseTest: {} },
  });
  assert.equal(first.tokens.find(token => token.id === sashDefender.id).item, "focus-sash");
  assert.deepEqual(first.consequences.consumedItems, []);
  assert.ok(hasHitKillSurvivalGrace(first.hitKillSurvivalGrace, sashDefender));

  const second = applyMoveConsequences({
    tokens: first.tokens,
    attackerId: attacker.id,
    defenderId: sashDefender.id,
    move,
    resolution: { hit: true, damage: 1, hitCount: 1, attackTest: {}, defenseTest: {} },
    hitKillProtectionUsed: first.hitKillProtectionUsed,
    hitKillSurvivalGrace: first.hitKillSurvivalGrace,
    consumePp: false,
  });
  const protectedTarget = second.tokens.find(token => token.id === sashDefender.id);
  assert.equal(protectedTarget.currentHp, 1);
  assert.equal(protectedTarget.item, "");
  assert.equal(protectedTarget.traitState.item.consumed, true);
  assert.deepEqual(second.consequences.consumedItems, ["focus-sash"]);
  assert.deepEqual(second.hitKillSurvivalGrace, []);
});

test("nonfatal first damage neither spends general protection nor preserves a survival trait", () => {
  const move = { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} };
  const sashDefender = { ...defender, item: "focus-sash" };
  const first = applyMoveConsequences({
    tokens: [attacker, sashDefender],
    attackerId: attacker.id,
    defenderId: sashDefender.id,
    move,
    resolution: { hit: true, damage: 9, hitCount: 1, attackTest: {}, defenseTest: {} },
  });
  assert.equal(first.tokens.find(token => token.id === sashDefender.id).currentHp, 1);
  assert.deepEqual(first.hitKillProtectionUsed, []);
  assert.deepEqual(first.hitKillSurvivalGrace, []);

  const second = applyMoveConsequences({
    tokens: first.tokens,
    attackerId: attacker.id,
    defenderId: sashDefender.id,
    move,
    resolution: { hit: true, damage: 1, hitCount: 1, attackTest: {}, defenseTest: {} },
    consumePp: false,
  });
  assert.equal(second.tokens.find(token => token.id === sashDefender.id).currentHp, 0);
  assert.equal(second.tokens.find(token => token.id === sashDefender.id).item, "focus-sash");
  assert.equal(second.consequences.traitProtected, false);
});

test("critical bypasses only the general rule while an independent survival trait can still act", () => {
  const sturdyDefender = { ...defender, ability: "sturdy" };
  const result = applyMoveConsequences({
    tokens: [attacker, sturdyDefender],
    attackerId: attacker.id,
    defenderId: sturdyDefender.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} },
    resolution: {
      hit: true,
      damage: 10,
      hitCount: 1,
      attackTest: { critical: false },
      defenseTest: { fumble: true },
    },
  });
  assert.equal(result.consequences.hitKillProtected, false);
  assert.equal(result.consequences.hitKillBypassedByDefenderFumble, true);
  assert.equal(result.consequences.traitProtected, true);
  assert.equal(result.tokens.find(token => token.id === sturdyDefender.id).currentHp, 1);
  assert.deepEqual(result.hitKillProtectionUsed, []);
  assert.deepEqual(result.hitKillSurvivalGrace, []);
});

test("multi-hit damage resolves each real hit and can break the general protection in the same move", () => {
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    defenderId: defender.id,
    move: { name: "double-slap", pp: 10, damage_class: { name: "physical" }, meta: {} },
    resolution: {
      hit: true,
      damage: 20,
      damagePerHit: 10,
      hitCount: 2,
      attackTest: {},
      defenseTest: {},
    },
  });
  const target = result.tokens.find(token => token.id === defender.id);
  assert.equal(target.currentHp, 0);
  assert.equal(result.consequences.hitKillProtected, true);
  assert.deepEqual(result.consequences.hitKillProtectedHits, [1]);
  assert.equal(result.consequences.faintedOnHit, 2);
  assert.equal(result.consequences.damage, 10);
});

test("a three-hit move can use general protection, then Focus Sash, then knock out", () => {
  const protectedDefender = {
    ...defender,
    teamId: "team-chain",
    pokemonId: "pokemon-chain",
    item: "focus-sash",
  };
  const result = applyMoveConsequences({
    tokens: [attacker, protectedDefender],
    attackerId: attacker.id,
    defenderId: protectedDefender.id,
    move: { name: "triple-kick", pp: 10, damage_class: { name: "physical" }, meta: {} },
    resolution: {
      hit: true,
      damage: 30,
      damagePerHit: 10,
      hitCount: 3,
      attackTest: {},
      defenseTest: {},
    },
  });
  const target = result.tokens.find(token => token.id === protectedDefender.id);
  assert.equal(target.currentHp, 0);
  assert.equal(target.item, "");
  assert.deepEqual(result.consequences.hitKillProtectedHits, [1]);
  assert.deepEqual(result.consequences.traitProtectedHits, [2]);
  assert.equal(result.consequences.faintedOnHit, 3);
  assert.deepEqual(result.consequences.consumedItems, ["focus-sash"]);
});

test("a naturally nonfatal first hit gives no free protection to a later hit", () => {
  const protectedDefender = { ...defender, item: "focus-sash" };
  const result = applyMoveConsequences({
    tokens: [attacker, protectedDefender],
    attackerId: attacker.id,
    defenderId: protectedDefender.id,
    move: { name: "double-hit", pp: 10, damage_class: { name: "physical" }, meta: {} },
    resolution: {
      hit: true,
      damage: 12,
      damagePerHit: 6,
      hitCount: 2,
      attackTest: {},
      defenseTest: {},
    },
  });
  const target = result.tokens.find(token => token.id === protectedDefender.id);
  assert.equal(target.currentHp, 0);
  assert.equal(target.item, "focus-sash");
  assert.deepEqual(result.hitKillProtectionUsed, []);
  assert.deepEqual(result.consequences.hitKillProtectedHits, []);
  assert.deepEqual(result.consequences.traitProtectedHits, []);
});

test("a multi-hit move only checks protection on hits that really pass the Substitute", () => {
  const substituted = {
    ...defender,
    volatileEffects: [{ id: "substitute", amount: 5 }],
  };
  const result = applyMoveConsequences({
    tokens: [attacker, substituted],
    attackerId: attacker.id,
    defenderId: substituted.id,
    move: { name: "double-hit", pp: 10, damage_class: { name: "physical" }, meta: {} },
    resolution: {
      hit: true,
      damage: 12,
      damagePerHit: 6,
      hitCount: 2,
      attackTest: {},
      defenseTest: {},
    },
  });
  const target = result.tokens.find(token => token.id === substituted.id);
  assert.equal(target.currentHp, 4);
  assert.equal(target.volatileEffects.some(effect => effect.id === "substitute"), false);
  assert.equal(result.consequences.substituteDamage, 5);
  assert.equal(result.consequences.calculatedDamage, 6);
  assert.deepEqual(result.hitKillProtectionUsed, []);
});

test("only HP actually paid by the user disables its protection for the whole battle", () => {
  const recoilUser = {
    ...defender,
    id: "recoil-user",
    teamId: "team-self",
    pokemonId: "pokemon-self",
    moves: ["take-down", "", "", ""],
  };
  const target = { ...defender, id: "recoil-target", currentHp: 9 };
  const recoil = applyMoveConsequences({
    tokens: [recoilUser, target],
    attackerId: recoilUser.id,
    defenderId: target.id,
    move: { name: "take-down", pp: 20, damage_class: { name: "physical" }, meta: { drain: -100 } },
    resolution: { hit: true, damage: 1, damagePerHit: 1, hitCount: 1, attackTest: {}, defenseTest: {} },
  });
  const key = getHitKillProtectionKey(recoilUser);
  assert.equal(recoil.tokens.find(token => token.id === recoilUser.id).currentHp, 9);
  assert.deepEqual(recoil.hitKillProtectionDisabled, [key]);

  const healed = recoil.tokens.map(token => token.id === recoilUser.id ? { ...token, currentHp: token.maxHp } : token);
  const fatal = applyMoveConsequences({
    tokens: healed,
    attackerId: target.id,
    defenderId: recoilUser.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} },
    resolution: { hit: true, damage: 10, damagePerHit: 10, hitCount: 1, attackTest: {}, defenseTest: {} },
    hitKillProtectionDisabled: recoil.hitKillProtectionDisabled,
    consumePp: false,
  });
  assert.equal(fatal.tokens.find(token => token.id === recoilUser.id).currentHp, 0);
  assert.equal(fatal.consequences.hitKillProtected, false);

  const failedSubstitute = applyMoveConsequences({
    tokens: [{ ...recoilUser, currentHp: 1, maxHp: 4 }],
    attackerId: recoilUser.id,
    move: { name: "substitute", pp: 10, damage_class: { name: "status" }, meta: {} },
    resolution: { moveConnected: true, damageHit: false, damage: 0 },
  });
  assert.deepEqual(failedSubstitute.hitKillProtectionDisabled, []);
});

test("a failed attempt changes nothing unless the move actually causes crash damage", () => {
  const user = {
    ...defender,
    id: "attempt-user",
    teamId: "team-attempt",
    pokemonId: "pokemon-attempt",
  };
  const missed = applyMoveConsequences({
    tokens: [user, attacker],
    attackerId: user.id,
    defenderId: attacker.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} },
    resolution: { moveConnected: false, damageHit: false, damage: 0 },
  });
  assert.deepEqual(missed.hitKillProtectionUsed, []);
  assert.deepEqual(missed.hitKillProtectionDisabled, []);
  assert.equal(missed.tokens.find(token => token.id === user.id).currentHp, user.currentHp);

  const crashed = applyMoveConsequences({
    tokens: [user, attacker],
    attackerId: user.id,
    defenderId: attacker.id,
    move: { name: "high-jump-kick", pp: 10, damage_class: { name: "physical" }, meta: {} },
    resolution: { moveConnected: false, damageHit: false, damage: 0 },
  });
  assert.equal(crashed.tokens.find(token => token.id === user.id).currentHp, 5);
  assert.deepEqual(crashed.hitKillProtectionDisabled, [getHitKillProtectionKey(user)]);
});

test("battle consequences consume hit kill protection once and healing cannot restore it", () => {
  const move = { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} };
  const first = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    defenderId: defender.id,
    move,
    resolution: { hit: true, damage: 10, attackTest: { critical: false } },
  });
  const protectionKey = getHitKillProtectionKey(defender);
  assert.equal(first.tokens.find(token => token.id === defender.id).currentHp, 1);
  assert.equal(first.consequences.calculatedDamage, 10);
  assert.equal(first.consequences.damage, 9);
  assert.equal(first.consequences.hitKillProtected, true);
  assert.equal(first.consequences.hitKillThreshold, 30);
  assert.deepEqual(first.hitKillProtectionUsed, [protectionKey]);

  const healedTokens = first.tokens.map(token => token.id === defender.id
    ? { ...token, currentHp: token.maxHp }
    : token);
  const second = applyMoveConsequences({
    tokens: healedTokens,
    attackerId: attacker.id,
    defenderId: defender.id,
    move,
    resolution: { hit: true, damage: 10, attackTest: { critical: false } },
    hitKillProtectionUsed: first.hitKillProtectionUsed,
    consumePp: false,
  });
  assert.equal(second.tokens.find(token => token.id === defender.id).currentHp, 0);
  assert.equal(second.consequences.hitKillProtected, false);
  assert.deepEqual(second.hitKillProtectionUsed, [protectionKey]);
});

test("an injured Pokémon can be knocked out normally before protection is used", () => {
  const fragile = { ...defender, currentHp: 4, maxHp: 10 };
  const result = applyMoveConsequences({
    tokens: [attacker, fragile],
    attackerId: attacker.id,
    defenderId: fragile.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, meta: {} },
    resolution: { hit: true, damage: 8, attackTest: { critical: false } },
  });
  assert.equal(result.tokens.find(token => token.id === fragile.id).currentHp, 0);
  assert.equal(result.consequences.hitKillProtected, false);
  assert.deepEqual(result.hitKillProtectionUsed, []);
});

test("hit kill use follows the Pokémon rather than its temporary scene token", () => {
  const original = { ...defender, teamId: "team-a", pokemonId: "pokemon-a", id: "token-one" };
  const switchedBack = { ...original, id: "token-two" };
  assert.equal(getHitKillProtectionKey(original), getHitKillProtectionKey(switchedBack));
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

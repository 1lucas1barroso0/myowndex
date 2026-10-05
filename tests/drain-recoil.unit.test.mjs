import assert from "node:assert/strict";
import test from "node:test";
import { applyMoveConsequences, getHitKillProtectionKey } from "../src/core/automation.js";
import { consumeHeldItem, setAbilitySuppressed } from "../src/core/traitMechanics.js";

const token = (id, patch = {}) => ({
  id,
  name: id === "user" ? "Bulbasaur" : "Tentacruel",
  side: id === "user" ? "ally" : "opponent",
  maxHp: 40,
  currentHp: 40,
  moves: ["giga-drain", "take-down", "struggle", ""],
  pp: [20, 20, 1, null],
  ability: "",
  item: "",
  types: ["normal"],
  originalTypes: ["normal"],
  stages: {},
  volatileEffects: [],
  stats: { attack: 4, defense: 4, "special-attack": 4, "special-defense": 4, speed: 4 },
  originalStats: { attack: 40, defense: 40, "special-attack": 40, "special-defense": 40, speed: 40 },
  ...patch,
});

const resolve = ({ user = token("user", { currentHp: 10 }), target = token("target"), name = "giga-drain", drain = 50, damage = 10, hit = true, ...patch } = {}) => applyMoveConsequences({
  tokens: [user, target],
  attackerId: user.id,
  defenderId: target.id,
  move: {
    name,
    pp: 20,
    damage_class: { name: "physical" },
    target: { name: "selected-pokemon" },
    meta: { drain, healing: 0, ailment: { name: "none" } },
    stat_changes: [],
  },
  resolution: { hit, moveConnected: hit, damageHit: hit, damage, profile: { damaging: true } },
  round: 1,
  ...patch,
});
const userAfter = result => result.tokens.find(entry => entry.id === "user");

test("active Rock Head and Magic Guard prevent move recoil without spending protection", () => {
  for (const ability of ["rock-head", "magic-guard"]) {
    const user = token("user", { ability });
    const result = resolve({ user, name: "take-down", drain: -50 });
    assert.equal(userAfter(result).currentHp, 40, ability);
    assert.equal(userAfter(result).pp[1], 19, ability);
    assert.equal(result.consequences.recoil, 0, ability);
    assert.deepEqual(result.hitKillProtectionDisabled, [], ability);
    assert.ok(result.consequences.traitActivations.some(entry => entry.sourceId === ability && entry.effect === "blocked"), ability);
  }
});

test("suppressed recoil abilities provide no protection and Rock Head does not block Liquid Ooze", () => {
  for (const ability of ["rock-head", "magic-guard"]) {
    const user = setAbilitySuppressed(token("user", { ability }), true);
    const result = resolve({ user, name: "take-down", drain: -50 });
    assert.equal(userAfter(result).currentHp, 35, ability);
    assert.equal(result.consequences.recoil, 5, ability);
    assert.deepEqual(result.hitKillProtectionDisabled, [getHitKillProtectionKey(user)], ability);
  }
  const result = resolve({ user: token("user", { ability: "rock-head", currentHp: 10 }), target: token("target", { ability: "liquid-ooze" }) });
  assert.equal(userAfter(result).currentHp, 5);
  assert.equal(result.consequences.abilityDamage, 5);
});

test("Struggle still costs twenty-five percent of maximum HP with either recoil ability", () => {
  for (const ability of ["rock-head", "magic-guard", ""]) {
    const user = token("user", { ability });
    const result = resolve({ user, name: "struggle", drain: -25, damage: 4 });
    assert.equal(result.consequences.damage, 4, ability);
    assert.equal(userAfter(result).currentHp, 30, ability);
    assert.equal(result.consequences.recoil, 10, ability);
    assert.deepEqual(result.hitKillProtectionDisabled, [getHitKillProtectionKey(user)], ability);
  }
  const result = resolve({ user: token("user", { ability: "magic-guard", maxHp: 3, currentHp: 3 }), name: "struggle", drain: -25, damage: 1 });
  assert.equal(userAfter(result).currentHp, 2);
  assert.equal(result.consequences.recoil, 1);
});

test("Big Root increases drain healing by thirty percent, floors it and leaves outgoing damage unchanged", () => {
  const result = resolve({ user: token("user", { item: "big-root", currentHp: 10 }) });
  assert.equal(userAfter(result).currentHp, 16);
  assert.equal(result.consequences.healed, 6);
  assert.equal(result.consequences.damage, 10);
  assert.equal(userAfter(result).item, "big-root");
  assert.ok(result.consequences.traitActivations.some(entry => entry.sourceId === "big-root" && entry.multiplier === 1.3));
  const small = resolve({ user: token("user", { item: "big-root", currentHp: 10 }), damage: 1 });
  assert.equal(small.consequences.healed, 1);
  const almostFull = resolve({ user: token("user", { item: "big-root", currentHp: 39 }) });
  assert.equal(almostFull.consequences.healed, 1);
  assert.equal(userAfter(almostFull).currentHp, 40);
});

test("consumed, suppressed and Klutz-disabled Big Root do not boost drain healing", () => {
  const held = token("user", { item: "big-root", currentHp: 10 });
  const cases = [
    consumeHeldItem(held).token,
    { ...held, volatileEffects: [{ id: "embargo" }] },
    { ...held, volatileEffects: [{ id: "magic-room" }] },
    { ...held, ability: "klutz" },
  ];
  for (const user of cases) {
    const result = resolve({ user });
    assert.equal(result.consequences.healed, 5);
    assert.equal(userAfter(result).currentHp, 15);
    assert.equal(result.consequences.traitActivations.some(entry => entry.sourceId === "big-root"), false);
  }
  const result = resolve({ user: setAbilitySuppressed({ ...held, ability: "klutz" }, true) });
  assert.equal(result.consequences.healed, 6);
});

test("active Liquid Ooze replaces healing with indirect damage, including Big Root's increase", () => {
  const target = token("target", { ability: "liquid-ooze" });
  const result = resolve({ target });
  assert.equal(userAfter(result).currentHp, 5);
  assert.equal(result.consequences.healed, 0);
  assert.equal(result.consequences.recoil, 0);
  assert.equal(result.consequences.abilityDamage, 5);
  assert.equal(result.tokens.find(entry => entry.id === target.id).currentHp, 30);
  assert.ok(result.consequences.specialNarratives.some(entry => /Liquid Ooze/.test(entry)));
  const boosted = resolve({ user: token("user", { item: "big-root", currentHp: 10 }), target });
  assert.equal(userAfter(boosted).currentHp, 4);
  assert.equal(boosted.consequences.abilityDamage, 6);
  assert.equal(boosted.consequences.healed, 0);
});

test("Liquid Ooze uses actual HP damage even when the target faints", () => {
  const result = resolve({ target: token("target", { ability: "liquid-ooze", currentHp: 2 }) });
  assert.equal(result.consequences.damage, 2);
  assert.equal(result.consequences.abilityDamage, 1);
  assert.equal(userAfter(result).currentHp, 9);
  assert.equal(result.tokens.find(entry => entry.id === "target").currentHp, 0);
});

test("suppressed Liquid Ooze allows healing and active Magic Guard blocks its damage without restoring healing", () => {
  const target = token("target", { ability: "liquid-ooze" });
  const suppressedTarget = resolve({ target: setAbilitySuppressed(target, true) });
  assert.equal(suppressedTarget.consequences.healed, 5);
  assert.equal(userAfter(suppressedTarget).currentHp, 15);
  const protectedUser = token("user", { ability: "magic-guard", currentHp: 10 });
  const blocked = resolve({ user: protectedUser, target });
  assert.equal(userAfter(blocked).currentHp, 10);
  assert.equal(blocked.consequences.healed, 0);
  assert.equal(blocked.consequences.abilityDamage, 0);
  assert.deepEqual(blocked.hitKillProtectionDisabled, []);
  assert.deepEqual(blocked.hitKillProtectionUsed, []);
  assert.ok(blocked.consequences.specialNarratives.includes("Magic Guard impediu o dano de Liquid Ooze."));
  const unprotected = resolve({ user: setAbilitySuppressed(protectedUser, true), target });
  assert.equal(userAfter(unprotected).currentHp, 5);
  assert.equal(unprotected.consequences.abilityDamage, 5);
});

test("Liquid Ooze may use general protection but never activates Sturdy or consumes Focus Sash", () => {
  for (const patch of [{ ability: "sturdy" }, { item: "focus-sash" }]) {
    const user = token("user", { maxHp: 4, currentHp: 4, ...patch });
    const target = token("target", { ability: "liquid-ooze" });
    const saved = resolve({ user, target, damage: 8 });
    assert.equal(userAfter(saved).currentHp, 1);
    assert.equal(saved.consequences.abilityDamage, 3);
    assert.equal(saved.consequences.indirectHitKillProtections[0].sourceId, "liquid-ooze");
    assert.deepEqual(saved.consequences.consumedItems, []);
    assert.deepEqual(saved.hitKillProtectionUsed, [getHitKillProtectionKey(user)]);
    const fatal = resolve({ user, target, damage: 8, hitKillProtectionUsed: [getHitKillProtectionKey(user)] });
    assert.equal(userAfter(fatal).currentHp, 0);
    assert.equal(fatal.consequences.abilityDamage, 4);
    assert.deepEqual(fatal.consequences.consumedItems, []);
    assert.equal(userAfter(fatal).item, user.item);
    assert.equal(fatal.consequences.traitActivations.some(entry => entry.effect === "survival"), false);
  }
});

test("Big Root's full Liquid Ooze damage is compared with the hit kill threshold before HP clipping", () => {
  const result = resolve({
    user: token("user", { maxHp: 40000, currentHp: 40000, item: "big-root" }),
    target: token("target", { maxHp: 99999, currentHp: 99000, ability: "liquid-ooze" }),
    damage: 99000,
    drain: 100,
  });
  assert.equal(result.consequences.damage, 99000);
  assert.equal(userAfter(result).currentHp, 0);
  assert.equal(result.consequences.abilityDamage, 40000);
  assert.deepEqual(result.hitKillProtectionUsed, []);
});

test("misses and zero HP damage cause no drain, recoil or Liquid Ooze effect", () => {
  for (const patch of [{ hit: false }, { damage: 0 }]) {
    const result = resolve({ user: token("user", { item: "big-root", currentHp: 10 }), target: token("target", { ability: "liquid-ooze" }), ...patch });
    assert.equal(userAfter(result).currentHp, 10);
    assert.equal(result.consequences.healed, 0);
    assert.equal(result.consequences.abilityDamage, 0);
    assert.equal(result.consequences.traitActivations.length, 0);
    const recoil = resolve({ name: "take-down", drain: -50, ...patch });
    assert.equal(recoil.consequences.recoil, 0);
    assert.equal(userAfter(recoil).currentHp, 10);
  }
});

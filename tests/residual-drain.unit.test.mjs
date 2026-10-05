import assert from "node:assert/strict";
import test from "node:test";
import { getHitKillProtectionKey } from "../src/core/automation.js";
import { applyEndOfRoundEffects, createRoomSnapshot } from "../src/core/room.js";
import { consumeHeldItem, setAbilitySuppressed } from "../src/core/traitMechanics.js";

const token = (id, patch = {}) => ({
  id,
  name: id === "source" ? "Bulbasaur" : "Tentacruel",
  side: id === "source" ? "ally" : "opponent",
  maxHp: 80,
  currentHp: 80,
  level: 20,
  ability: "",
  item: "",
  status: "",
  types: ["normal"],
  originalTypes: ["normal"],
  moves: ["leech-seed", "aqua-ring", "ingrain", ""],
  pp: [10, 10, 10, null],
  stats: { attack: 4, defense: 4, "special-attack": 4, "special-defense": 4, speed: 4 },
  originalStats: { attack: 40, defense: 40, "special-attack": 40, "special-defense": 40, speed: 40 },
  volatileEffects: [],
  ...patch,
});
const seed = { id: "leech-seed", sourceMove: "leech-seed", sourceTokenId: "source", sourceName: "Bulbasaur", turns: null };
const seeded = (id = "target", patch = {}) => token(id, { volatileEffects: [seed], ...patch });
const end = (tokens, patch = {}) => applyEndOfRoundEffects({ ...createRoomSnapshot("Leech Seed"), phase: "batalha", round: 1, tokens, ...patch });
const partner = (result, id = "source") => result.room.tokens.find(entry => entry.id === id);

test("Leech Seed with Big Root heals thirty percent more from HP actually removed, with floor and HP cap", () => {
  const source = token("source", { item: "big-root", currentHp: 20 });
  const result = end([source, seeded()]);
  assert.equal(partner(result).currentHp, 33);
  assert.equal(partner(result, "target").currentHp, 70);
  assert.equal(result.effects.find(effect => effect.kind === "heal").healed, 13);
  const clipped = end([source, seeded("target", { currentHp: 7 })]);
  assert.equal(partner(clipped, "target").currentHp, 0);
  assert.equal(partner(clipped).currentHp, 29);
  const capped = end([token("source", { item: "big-root", currentHp: 79 }), seeded()]);
  assert.equal(partner(capped).currentHp, 80);
  assert.equal(capped.effects.find(effect => effect.kind === "heal").healed, 1);
});

test("Big Root improves Aqua Ring and Ingrain individually while unrelated recovery remains unchanged", () => {
  for (const id of ["aqua-ring", "ingrain"]) {
    const result = end([token("source", { item: "big-root", currentHp: 20, volatileEffects: [{ id, turns: null }] })]);
    assert.equal(partner(result).currentHp, 26, id);
    assert.equal(result.effects.find(effect => effect.kind === "heal").healed, 6, id);
    assert.ok(result.effects.find(effect => effect.kind === "heal").sources.some(source => /Aqua Ring|Ingrain/.test(source)), id);
  }
  const both = end([token("source", { item: "big-root", currentHp: 20, volatileEffects: [{ id: "aqua-ring" }, { id: "ingrain" }] })]);
  assert.equal(partner(both).currentHp, 32);
  const wish = end([token("source", { item: "big-root", currentHp: 20, volatileEffects: [{ id: "wish", turns: 1, amount: 5 }] })]);
  assert.equal(partner(wish).currentHp, 25);
  const small = end([token("source", { item: "big-root", maxHp: 3, currentHp: 1, volatileEffects: [{ id: "aqua-ring" }] })]);
  assert.equal(partner(small).currentHp, 2);
});

test("Big Root healing respects item consumption, Embargo, Magic Room, Klutz and ability suppression", () => {
  const original = token("source", { item: "big-root", currentHp: 20 });
  const cases = [
    consumeHeldItem(original).token,
    { ...original, volatileEffects: [{ id: "embargo" }] },
    { ...original, volatileEffects: [{ id: "magic-room" }] },
    { ...original, ability: "klutz" },
  ];
  for (const source of cases) {
    const result = end([source, seeded()]);
    assert.equal(partner(result).currentHp, 30);
    const ring = end([{ ...source, volatileEffects: [...source.volatileEffects, { id: "aqua-ring" }] }]);
    assert.equal(partner(ring).currentHp, 25);
  }
  const restored = end([setAbilitySuppressed({ ...original, ability: "klutz" }, true), seeded()]);
  assert.equal(partner(restored).currentHp, 33);
});

test("Liquid Ooze reverses Leech Seed healing into indirect damage and Big Root increases that damage", () => {
  const result = end([token("source", { currentHp: 20 }), seeded("target", { ability: "liquid-ooze" })]);
  assert.equal(partner(result).currentHp, 10);
  assert.equal(partner(result, "target").currentHp, 70);
  assert.equal(result.effects.some(effect => effect.kind === "heal"), false);
  const returnedDamage = result.effects.find(effect => effect.tokenId === "source" && effect.kind === "damage");
  assert.equal(returnedDamage.damage, 10);
  assert.ok(returnedDamage.sources.includes("Liquid Ooze"));
  const boosted = end([token("source", { currentHp: 20, item: "big-root" }), seeded("target", { ability: "liquid-ooze" })]);
  assert.equal(partner(boosted).currentHp, 7);
});

test("Magic Guard blocks Liquid Ooze's return without healing, while suppressed abilities follow normal drain", () => {
  const source = token("source", { currentHp: 20, ability: "magic-guard", item: "big-root" });
  const target = seeded("target", { ability: "liquid-ooze" });
  const blocked = end([source, target]);
  assert.equal(partner(blocked).currentHp, 20);
  assert.equal(partner(blocked, "target").currentHp, 70);
  assert.equal(blocked.effects.some(effect => effect.kind === "heal"), false);
  assert.deepEqual(blocked.room.hitKillProtectionUsed, []);
  assert.deepEqual(blocked.room.hitKillProtectionDisabled, []);
  const inactiveGuard = end([setAbilitySuppressed(source, true), target]);
  assert.equal(partner(inactiveGuard).currentHp, 7);
  const inactiveOoze = end([token("source", { currentHp: 20 }), setAbilitySuppressed(target, true)]);
  assert.equal(partner(inactiveOoze).currentHp, 30);
});

test("Liquid Ooze's Seed damage may consume general protection but never Sturdy or Focus Sash", () => {
  for (const patch of [{ ability: "sturdy" }, { item: "focus-sash" }]) {
    const source = token("source", { maxHp: 10, currentHp: 10, ...patch });
    const target = seeded("target", { ability: "liquid-ooze" });
    const key = getHitKillProtectionKey(source);
    const saved = end([source, target]);
    assert.equal(partner(saved).currentHp, 1);
    assert.deepEqual(saved.room.hitKillProtectionUsed, [key]);
    assert.equal(saved.effects.find(effect => effect.tokenId === source.id && effect.kind === "damage").traitProtected, false);
    assert.equal(partner(saved).item, source.item);
    const fatal = end([source, target], { hitKillProtectionUsed: [key] });
    assert.equal(partner(fatal).currentHp, 0);
    assert.equal(partner(fatal).item, source.item);
    assert.equal(fatal.effects.some(effect => effect.traitProtected), false);
  }
});

test("each Liquid Ooze source resolves separately and cannot reuse general protection in one round", () => {
  const source = token("source", { maxHp: 2, currentHp: 2, item: "focus-sash" });
  const targets = ["first", "second"].map(id => seeded(id, { maxHp: 16, currentHp: 16, ability: "liquid-ooze" }));
  const result = end([source, ...targets]);
  const returns = result.effects.filter(effect => effect.tokenId === source.id && effect.kind === "damage");
  assert.deepEqual(returns.map(effect => effect.remainingHp), [1, 0]);
  assert.deepEqual(returns.map(effect => effect.protectedFromKnockout), [true, false]);
  assert.deepEqual(result.room.hitKillProtectionUsed, [getHitKillProtectionKey(source)]);
  assert.equal(partner(result).currentHp, 0);
  assert.equal(partner(result).item, "focus-sash");
});

test("Big Root's Liquid Ooze return bypasses general protection when the full damage reaches three times HP", () => {
  const source = token("source", { maxHp: 5000, currentHp: 5000, item: "big-root" });
  const result = end([source, seeded("target", { maxHp: 99999, currentHp: 99999, ability: "liquid-ooze" })]);
  assert.equal(partner(result).currentHp, 0);
  assert.deepEqual(result.room.hitKillProtectionUsed, []);
});

test("Magic Guard on a seeded target prevents drain, and residual healing never revives a fainted caster", () => {
  const source = token("source", { currentHp: 20, item: "big-root" });
  const blocked = end([source, seeded("target", { ability: "magic-guard" })]);
  assert.equal(partner(blocked).currentHp, 20);
  assert.equal(partner(blocked, "target").currentHp, 80);
  assert.deepEqual(blocked.effects, []);
  const fainted = end([token("source", { currentHp: 0, item: "big-root", volatileEffects: [{ id: "aqua-ring" }] }), seeded()]);
  assert.equal(partner(fainted).currentHp, 0);
  assert.equal(fainted.effects.some(effect => effect.tokenId === "source" && effect.kind === "heal"), false);
});

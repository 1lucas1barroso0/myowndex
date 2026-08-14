import assert from "node:assert/strict";
import test from "node:test";
import { applyMoveConsequences } from "../src/core/automation.js";
import {
  addTeamToSnapshot,
  applyEndOfRoundEffects,
  buildInitiative,
  createRoomSnapshot,
  normalizeRoomSnapshot,
} from "../src/core/room.js";
import {
  consumeHeldItem,
  getAccuracyTraitModifiers,
  getDamageTraitModifiers,
  getMultiHitTraitState,
  getSurvivalTrait,
  getTraitMoveBlock,
  normalizeTraitState,
  restoreHeldItem,
  setAbilitySuppressed,
  setChoiceLock,
} from "../src/core/traitMechanics.js";

const token = (patch = {}) => ({
  id: patch.id || "token",
  name: patch.name || "Teste",
  side: patch.side || "ally",
  maxHp: 16,
  currentHp: 16,
  status: "",
  types: ["normal"],
  originalTypes: ["normal"],
  moves: ["tackle", "growl", "", ""],
  pp: [null, null, null, null],
  stages: {},
  stats: { attack: 4, defense: 4, "special-attack": 4, "special-defense": 4, speed: 4 },
  originalStats: { attack: 80, defense: 80, "special-attack": 80, "special-defense": 80, speed: 80 },
  ability: "",
  item: "",
  volatileEffects: [],
  ...patch,
});

const physicalMove = {
  name: "tackle",
  power: 40,
  accuracy: 100,
  type: { name: "normal" },
  damage_class: { name: "physical" },
  target: { name: "selected-pokemon" },
  meta: { min_hits: null, max_hits: null, drain: 0, ailment_chance: 0, stat_chance: 0, ailment: { name: "none" } },
  stat_changes: [],
};

const connectedResolution = patch => ({
  hit: true,
  moveConnected: true,
  damageHit: true,
  damage: 4,
  hitCount: 1,
  effectiveness: 1,
  profile: { damaging: true },
  traitModifiers: { entries: [], suppressTargetSecondaries: false, blockTargetSecondaries: false },
  ...patch,
});

test("held items have a reversible scene lifecycle without losing their origin", () => {
  const source = token({ item: "sitrus-berry", ability: "unburden" });
  const consumed = consumeHeldItem(source, { reason: "HP baixo", round: 3 });
  assert.equal(consumed.applied, true);
  assert.equal(consumed.token.item, "");
  assert.equal(consumed.token.traitState.item.originalId, "sitrus-berry");
  assert.equal(consumed.token.traitState.item.consumed, true);
  assert.equal(consumed.token.traitState.history.at(-1).round, 3);
  const restored = restoreHeldItem(consumed.token, { round: 4 });
  assert.equal(restored.token.item, "sitrus-berry");
  assert.equal(restored.token.traitState.item.consumed, false);
});

test("damage and accuracy list every ability, item and environment multiplier", () => {
  const attacker = token({ ability: "adaptability", item: "life-orb", types: ["water"], originalTypes: ["water"] });
  const defender = token({ id: "target", side: "opponent", ability: "multiscale" });
  const move = { ...physicalMove, name: "aqua-jet", power: 40, type: { name: "water" } };
  const state = getDamageTraitModifiers({ attacker, defender, move, effectiveness: 2, stab: 1.5, weather: "chuva" });
  assert.equal(state.stab, 2);
  assert.ok(state.entries.some(entry => entry.sourceId === "adaptability"));
  assert.ok(state.entries.some(entry => entry.sourceId === "life-orb"));
  assert.ok(state.entries.some(entry => entry.sourceId === "multiscale"));
  assert.ok(state.entries.some(entry => entry.sourceId === "chuva"));

  const accuracy = getAccuracyTraitModifiers({ attacker: token({ ability: "compound-eyes", item: "wide-lens" }), defender, move });
  assert.equal(accuracy.entries.length, 2);
  assert.ok(accuracy.multiplier > 1.4);
});

test("restrictions explain Assault Vest, choice lock and Air Balloon before spending PP", () => {
  const statusMove = { ...physicalMove, name: "growl", damage_class: { name: "status" } };
  assert.match(getTraitMoveBlock({ attacker: token({ item: "assault-vest" }), defender: token({ id: "target" }), move: statusMove }).reason, /Assault Vest/);
  const locked = setChoiceLock(token({ item: "choice-band" }), "tackle", 1);
  assert.match(getTraitMoveBlock({ attacker: locked, defender: token({ id: "target" }), move: { ...physicalMove, name: "body-slam" } }).reason, /tackle/);
  const groundMove = { ...physicalMove, type: { name: "ground" } };
  assert.match(getTraitMoveBlock({ attacker: token(), defender: token({ id: "target", item: "air-balloon" }), move: groundMove }).reason, /Air Balloon/);
});

test("Sturdy and Focus Sash are explicit survival sources and Focus Sash is consumed", () => {
  const sturdy = getSurvivalTrait(token({ ability: "sturdy" }), { damage: 99, round: 1 });
  assert.equal(sturdy.appliedDamage, 15);
  assert.equal(sturdy.sourceId, "sturdy");
  const sash = getSurvivalTrait(token({ item: "focus-sash" }), { damage: 99, round: 1 });
  assert.equal(sash.appliedDamage, 15);
  assert.equal(sash.token.item, "");
  assert.equal(sash.token.traitState.item.consumed, true);
});

test("Loaded Dice and Skill Link make multi-hit behavior deterministic", () => {
  assert.equal(getMultiHitTraitState({ attacker: token({ item: "loaded-dice" }), move: physicalMove, minimumHits: 2, maximumHits: 5 }).minimumHits, 4);
  assert.equal(getMultiHitTraitState({ attacker: token({ ability: "skill-link" }), move: physicalMove, minimumHits: 2, maximumHits: 5 }).minimumHits, 5);
});

test("contact, reactive items, berries and knockout abilities resolve in the same action", () => {
  const attacker = token({ id: "attacker", name: "Atacante", ability: "moxie", item: "life-orb", currentHp: 16 });
  const defender = token({ id: "defender", name: "Alvo", side: "opponent", maxHp: 4, currentHp: 4, ability: "rough-skin", item: "weakness-policy" });
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    targetId: defender.id,
    move: physicalMove,
    resolution: connectedResolution({ damage: 8, effectiveness: 2 }),
    round: 2,
  });
  const nextAttacker = result.tokens.find(entry => entry.id === attacker.id);
  const nextDefender = result.tokens.find(entry => entry.id === defender.id);
  assert.equal(nextDefender.currentHp, 1);
  assert.equal(nextDefender.item, "");
  assert.ok(nextAttacker.currentHp < attacker.currentHp);
  assert.ok(result.consequences.consumedItems.includes("weakness-policy"));
  assert.ok(result.consequences.traitActivations.some(entry => entry.sourceId === "rough-skin"));

  const finisher = applyMoveConsequences({
    tokens: [nextAttacker, token({ id: "finisher-target", side: "opponent", maxHp: 1, currentHp: 1 })],
    attackerId: nextAttacker.id,
    targetId: "finisher-target",
    move: physicalMove,
    resolution: connectedResolution({ damage: 3 }),
    round: 2,
  });
  assert.equal(finisher.tokens.find(entry => entry.id === nextAttacker.id).stages.attack, 1);
});

test("end-of-round effects connect Leftovers, Poison Heal, Speed Boost and status orbs", () => {
  const room = normalizeRoomSnapshot({
    ...createRoomSnapshot("Traços"),
    weather: "chuva",
    tokens: [
      token({ id: "leftovers", currentHp: 8, item: "leftovers" }),
      token({ id: "poison-heal", currentHp: 8, ability: "poison-heal", status: "poison" }),
      token({ id: "speed", ability: "speed-boost" }),
      token({ id: "orb", item: "flame-orb", types: ["normal"] }),
    ],
  });
  const ended = applyEndOfRoundEffects(room, () => 0);
  assert.ok(ended.room.tokens.find(entry => entry.id === "leftovers").currentHp > 8);
  assert.ok(ended.room.tokens.find(entry => entry.id === "poison-heal").currentHp > 8);
  assert.equal(ended.room.tokens.find(entry => entry.id === "speed").stages.speed, 1);
  assert.equal(ended.room.tokens.find(entry => entry.id === "orb").status, "burn");
  assert.ok(ended.effects.some(effect => effect.sources.includes("Leftovers")));
});

test("entry abilities and terrain seeds change the shared room state once", () => {
  const team = {
    id: "traits-team",
    name: "Traits",
    pokemon: [{
      id: "lead",
      nickname: "Lead",
      level: 10,
      ability: "drizzle",
      item: "electric-seed",
      moves: ["tackle", "", "", ""],
      customTypes: ["water"],
      species: { id: 7, name: "squirtle", stats: [], sprites: {} },
    }],
  };
  const created = addTeamToSnapshot({ ...createRoomSnapshot("Entrada"), terrain: "eletrico" }, team, "ally");
  assert.equal(created.room.weather, "chuva");
  assert.equal(created.tokens[0].item, "");
  assert.equal(created.tokens[0].stages.defense, 1);
});

test("initiative applies weather, Choice Scarf, Unburden and suppression safely", () => {
  const consumed = consumeHeldItem(token({ id: "swift", ability: "unburden", item: "oran-berry" }), { round: 1 }).token;
  const scarf = token({ id: "scarf", item: "choice-scarf", side: "opponent" });
  const room = normalizeRoomSnapshot({ ...createRoomSnapshot("Ordem"), tokens: [consumed, scarf] });
  const result = buildInitiative(room, () => 0.5);
  assert.ok(result.results.every(entry => entry.traitState.multiplier > 1));
  const suppressed = setAbilitySuppressed(consumed, true, "Neutralizing Gas");
  assert.equal(normalizeTraitState(suppressed.traitState, suppressed.item, suppressed.ability).ability.suppressed, true);
});

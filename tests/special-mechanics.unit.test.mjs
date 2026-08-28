import assert from "node:assert/strict";
import test from "node:test";
import { applyMoveConsequences, getMovePpState } from "../src/core/automation.js";
import {
  applyEndOfRoundEffects,
  calculateMoveResolution,
  createRoomSnapshot,
  normalizeRoomSnapshot,
  ROOM_SCHEMA_VERSION,
} from "../src/core/room.js";
import {
  applyBattleIllusion,
  calculateDynamicMovePower,
  copyObservedMove,
  getAbilityMoveBlock,
  getBattleDisplayIdentity,
  getMoveStatProfile,
  getSpecialMoveBlockReason,
  normalizeSpecialState,
  recordBattleMove,
  revertBattleTransform,
  revertTemporaryMoveCopies,
  transformBattleToken,
} from "../src/core/specialMechanics.js";

const sequence = values => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
};

const token = (overrides = {}) => ({
  id: "one",
  name: "Um",
  speciesName: "ditto",
  speciesId: 132,
  sprite: "ditto.png",
  side: "ally",
  maxHp: 12,
  currentHp: 9,
  level: 20,
  item: "choice-scarf",
  ability: "limber",
  weight: 40,
  types: ["normal"],
  originalTypes: ["normal"],
  stats: { hp: 12, attack: 2, defense: 2, "special-attack": 2, "special-defense": 2, speed: 3 },
  originalStats: { hp: 220, attack: 45, defense: 48, "special-attack": 48, "special-defense": 48, speed: 48 },
  stages: { attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0, accuracy: 0, evasion: 0 },
  moves: ["transform", "", "", ""],
  pp: [9, null, null, null],
  status: "",
  toxicCounter: 0,
  volatileEffects: [],
  specialState: normalizeSpecialState(),
  ...overrides,
});

test("Transform copies the battle identity while preserving HP, level and item, then reverts cleanly", () => {
  const ditto = token();
  const target = token({
    id: "target",
    name: "Dragão",
    speciesName: "dragonite",
    speciesId: 149,
    sprite: "dragonite.png",
    side: "opponent",
    maxHp: 30,
    currentHp: 25,
    level: 55,
    item: "leftovers",
    ability: "multiscale",
    weight: 2100,
    types: ["dragon", "flying"],
    originalTypes: ["dragon", "flying"],
    stats: { hp: 30, attack: 7, defense: 5, "special-attack": 4, "special-defense": 5, speed: 4 },
    originalStats: { hp: 350, attack: 300, defense: 220, "special-attack": 200, "special-defense": 230, speed: 180 },
    stages: { attack: 2, defense: -1, "special-attack": 0, "special-defense": 1, speed: 0, accuracy: 1, evasion: -2 },
    moves: ["dragon-claw", "roost", "extreme-speed", "hurricane"],
    pp: [12, 8, 5, 6],
  });

  const transformed = transformBattleToken(ditto, target, { via: "transform", round: 4 });
  assert.equal(transformed.applied, true);
  assert.equal(transformed.token.speciesName, "dragonite");
  assert.equal(transformed.token.currentHp, 9);
  assert.equal(transformed.token.maxHp, 12);
  assert.equal(transformed.token.level, 20);
  assert.equal(transformed.token.item, "choice-scarf");
  assert.equal(transformed.token.ability, "multiscale");
  assert.equal(transformed.token.stats.hp, 12);
  assert.equal(transformed.token.stats.attack, 7);
  assert.deepEqual(transformed.token.moves, target.moves);
  assert.deepEqual(transformed.token.pp, [5, 5, 5, 5]);
  assert.equal(transformed.token.specialState.transform.base.speciesName, "ditto");

  const reverted = revertBattleTransform({ ...transformed.token, currentHp: 3, status: "burn" });
  assert.equal(reverted.applied, true);
  assert.equal(reverted.token.speciesName, "ditto");
  assert.equal(reverted.token.currentHp, 3);
  assert.equal(reverted.token.status, "burn");
  assert.equal(reverted.token.item, "choice-scarf");
  assert.deepEqual(reverted.token.moves, ditto.moves);
  assert.deepEqual(reverted.token.pp, ditto.pp);
});

test("Transform refuses protected identities instead of corrupting either token", () => {
  const target = token({
    id: "target",
    side: "opponent",
    volatileEffects: [{ id: "substitute", amount: 3 }],
  });
  const result = transformBattleToken(token(), target);
  assert.equal(result.applied, false);
  assert.match(result.reason, /Substitute/);
  assert.equal(result.token.speciesName, "ditto");
});

test("Sketch is permanent while Mimic receives 5 temporary PP and restores its own PP", () => {
  const observer = recordBattleMove(token({
    id: "observed",
    name: "Observado",
    speciesName: "pikachu",
    moves: ["thunderbolt", "", "", ""],
  }), { moveName: "thunderbolt", round: 2, connected: true });

  const smeargle = token({
    id: "smeargle",
    name: "Pincel",
    speciesName: "smeargle",
    moves: ["sketch", "spore", "", ""],
    pp: [0, 15, null, null],
  });
  const sketched = copyObservedMove(smeargle, observer, "sketch");
  assert.equal(sketched.applied, true);
  assert.equal(sketched.token.moves[0], "thunderbolt");
  assert.equal(sketched.token.specialState.moveOverrides[0].permanent, true);
  assert.equal(revertTemporaryMoveCopies(sketched.token).applied, false);

  const mimicker = token({
    id: "mimic",
    name: "Mímico",
    speciesName: "mr-mime",
    moves: ["mimic", "barrier", "", ""],
    pp: [9, 20, null, null],
  });
  const mimicked = copyObservedMove(mimicker, observer, "mimic");
  assert.equal(mimicked.applied, true);
  assert.equal(mimicked.token.moves[0], "thunderbolt");
  assert.equal(mimicked.token.pp[0], 5);
  assert.equal(getMovePpState(mimicked.token, { name: "thunderbolt", pp: 15 }).maximum, 5);
  assert.equal(mimicked.token.specialState.moveOverrides[0].permanent, false);
  const restored = revertTemporaryMoveCopies(mimicked.token);
  assert.equal(restored.applied, true);
  assert.equal(restored.token.moves[0], "mimic");
  assert.equal(restored.token.pp[0], 9);
});

test("all copied Transform moves expose 5 as their real maximum PP", () => {
  const transformed = transformBattleToken(token(), token({
    id: "target",
    side: "opponent",
    speciesName: "charizard",
    moves: ["flamethrower", "air-slash", "roost", "protect"],
    pp: [12, 10, 8, 7],
  }));
  const state = getMovePpState(transformed.token, { name: "flamethrower", pp: 15 });
  assert.equal(state.remaining, 5);
  assert.equal(state.maximum, 5);
});

test("Illusion changes only the public identity and can be revealed without changing the ficha", () => {
  const zoroark = token({ id: "zoroark", name: "Sombra", speciesName: "zoroark", ability: "illusion" });
  const ally = token({ id: "ally", name: "Companheiro", speciesName: "lucario", speciesId: 448, sprite: "lucario.png", types: ["fighting", "steel"] });
  const result = applyBattleIllusion(zoroark, ally);
  const display = getBattleDisplayIdentity(result.token);
  assert.equal(result.applied, true);
  assert.equal(result.token.speciesName, "zoroark");
  assert.equal(display.name, "Companheiro");
  assert.equal(display.sprite, "lucario.png");
  assert.equal(display.disguised, true);
});

test("situational power and exceptional stat sources use the current battle state", () => {
  const attacker = token({ currentHp: 6, maxHp: 12, weight: 1000, stats: { attack: 3, defense: 7, "special-attack": 5, "special-defense": 2, speed: 20 }, stages: { attack: 2, speed: 1 } });
  const defender = token({ id: "target", currentHp: 5, maxHp: 10, weight: 300, stats: { attack: 8, defense: 4, "special-attack": 2, "special-defense": 3, speed: 100 } });

  assert.deepEqual(calculateDynamicMovePower({ move: { name: "eruption", power: 150 }, attacker, defender }), { power: 75, explanation: "HP do usuário: 50%" });
  assert.equal(calculateDynamicMovePower({ move: { name: "gyro-ball" }, attacker, defender }).power, 126);
  assert.equal(calculateDynamicMovePower({ move: { name: "low-kick" }, attacker, defender }).power, 60);
  assert.equal(calculateDynamicMovePower({ move: { name: "stored-power" }, attacker, defender }).power, 80);
  assert.equal(calculateDynamicMovePower({ move: { name: "facade", power: 70 }, attacker: { ...attacker, status: "burn" }, defender }).power, 140);
  assert.equal(getMoveStatProfile({ move: { name: "body-press", damage_class: { name: "physical" } }, attacker, defender }).attackKey, "defense");
  assert.equal(getMoveStatProfile({ move: { name: "foul-play", damage_class: { name: "physical" } }, attacker, defender }).attackSource, "defender");
  assert.equal(getMoveStatProfile({ move: { name: "psyshock", damage_class: { name: "special" } }, attacker, defender }).defenseKey, "defense");
});

test("ability immunities, first-hit shields and Mold Breaker are explicit", () => {
  const move = { name: "tackle", type: { name: "normal" }, damage_class: { name: "physical" } };
  const wonder = token({ id: "wonder", ability: "wonder-guard" });
  assert.match(getAbilityMoveBlock({ move, attacker: token(), defender: wonder, effectiveness: 1 }).reason, /Wonder Guard/);
  assert.equal(getAbilityMoveBlock({ move, attacker: token(), defender: wonder, effectiveness: 2 }), null);
  assert.equal(getAbilityMoveBlock({ move, attacker: token({ ability: "mold-breaker" }), defender: wonder, effectiveness: 1 }), null);

  const disguise = token({ id: "mimikyu", ability: "disguise" });
  const first = getAbilityMoveBlock({ move, attacker: token(), defender: disguise, effectiveness: 1 });
  assert.equal(first.marker, "disguise-broken");
  const marked = { ...disguise, specialState: { ...normalizeSpecialState(), markers: ["disguise-broken"] } };
  assert.equal(getAbilityMoveBlock({ move, attacker: token(), defender: marked, effectiveness: 1 }), null);
});

test("Disguise pays its HP cost and snow restores a broken Ice Face", () => {
  const attacker = token({ id: "attacker", moves: ["tackle", "", "", ""], pp: [35, null, null, null] });
  const mimikyu = token({ id: "mimikyu", side: "opponent", ability: "disguise", currentHp: 8, maxHp: 16 });
  const blocked = applyMoveConsequences({
    tokens: [attacker, mimikyu],
    attackerId: attacker.id,
    targetId: mimikyu.id,
    move: { name: "tackle", pp: 35, type: { name: "normal" }, damage_class: { name: "physical" }, target: { name: "selected-pokemon" }, meta: {} },
    resolution: {
      moveConnected: false,
      damageHit: false,
      damage: 0,
      abilityBlock: { ability: "disguise", reason: "Disguise absorveu o primeiro golpe", marker: "disguise-broken" },
    },
  });
  const changed = blocked.tokens.find(candidate => candidate.id === mimikyu.id);
  assert.equal(changed.currentHp, 6);
  assert.equal(changed.specialState.markers.includes("disguise-broken"), true);
  assert.equal(blocked.consequences.abilityDamage, 2);

  const eiscue = token({
    id: "eiscue",
    ability: "ice-face",
    specialState: { ...normalizeSpecialState(), markers: ["ice-face-broken"] },
  });
  const room = { ...createRoomSnapshot("Neve"), weather: "neve", tokens: [eiscue] };
  const round = applyEndOfRoundEffects(room);
  assert.equal(round.room.tokens[0].specialState.markers.includes("ice-face-broken"), false);
  assert.equal(round.effects.some(effect => effect.kind === "state"), true);
});

test("Mold Breaker resolution bypasses Wonder Guard and Scrappy reaches Ghost", () => {
  const physical = { name: "tackle", power: 40, accuracy: null, type: { name: "normal" }, damage_class: { name: "physical" }, target: { name: "selected-pokemon" } };
  const ghost = token({ id: "ghost", side: "opponent", ability: "wonder-guard", types: ["ghost"], stats: { defense: 0 } });
  const result = calculateMoveResolution({
    attacker: token({ ability: "mold-breaker", types: ["normal"], stats: { attack: 5 } }),
    defender: ghost,
    move: physical,
    random: sequence([0.9, 0.9, 0, 0]),
  });
  assert.equal(result.typeBlocked, true);
  assert.equal(result.abilityBlock, null);

  const scrappy = calculateMoveResolution({
    attacker: token({ ability: "scrappy", types: ["normal"], stats: { attack: 5 } }),
    defender: { ...ghost, ability: "" },
    move: physical,
    random: sequence([0.9, 0.9, 0, 0]),
  });
  assert.equal(scrappy.typeBlocked, false);
  assert.equal(scrappy.effectiveness, 1);
  assert.equal(scrappy.damageHit, true);
});

test("Substitute absorbs damage and breaks without reducing the owner's HP", () => {
  const attacker = token({ id: "attacker", name: "Atacante", moves: ["tackle", "", "", ""], pp: [35, null, null, null] });
  const defender = token({ id: "defender", name: "Defensor", side: "opponent", currentHp: 8, maxHp: 12, volatileEffects: [{ id: "substitute", amount: 3 }] });
  const result = applyMoveConsequences({
    tokens: [attacker, defender],
    attackerId: attacker.id,
    targetId: defender.id,
    move: { name: "tackle", pp: 35, damage_class: { name: "physical" }, target: { name: "selected-pokemon" }, meta: {} },
    resolution: { moveConnected: true, damageHit: true, damage: 4 },
  });
  const target = result.tokens.find(candidate => candidate.id === defender.id);
  assert.equal(target.currentHp, 8);
  assert.equal(target.volatileEffects.some(effect => effect.id === "substitute"), false);
  assert.equal(result.consequences.substituteDamage, 3);
  assert.equal(result.consequences.substituteBroken, true);
});

test("Substitute blocks directed status effects unless Infiltrator bypasses it", () => {
  const move = { name: "toxic", damage_class: { name: "status" }, target: { name: "selected-pokemon" } };
  const target = token({ id: "target", volatileEffects: [{ id: "substitute", amount: 3 }] });
  assert.match(getSpecialMoveBlockReason({ move, attacker: token(), defender: target }), /Substitute/);
  assert.equal(getSpecialMoveBlockReason({ move, attacker: token({ ability: "infiltrator" }), defender: target }), "");
});

test("Future Sight, Wish, Leech Seed and Perish Song advance deterministically by round", () => {
  const source = token({ id: "source", name: "Fonte", currentHp: 4, maxHp: 12 });
  const target = token({
    id: "target",
    name: "Alvo",
    side: "opponent",
    currentHp: 10,
    maxHp: 12,
    volatileEffects: [
      { id: "future-sight", sourceMove: "future-sight", sourceTokenId: "source", sourceName: "Fonte", turns: 2, amount: 3 },
      { id: "leech-seed", sourceMove: "leech-seed", sourceTokenId: "source", sourceName: "Fonte", turns: null },
      { id: "perish-song", sourceMove: "perish-song", turns: 3 },
    ],
  });
  const wisher = token({ id: "wisher", name: "Desejo", currentHp: 2, maxHp: 12, volatileEffects: [{ id: "wish", sourceMove: "wish", turns: 2, amount: 6 }] });
  let room = { ...createRoomSnapshot("Exceções"), tokens: [source, target, wisher] };

  const first = applyEndOfRoundEffects(room);
  room = first.room;
  assert.equal(room.tokens.find(candidate => candidate.id === "target").currentHp, 9);
  assert.equal(room.tokens.find(candidate => candidate.id === "source").currentHp, 5);
  assert.equal(room.tokens.find(candidate => candidate.id === "wisher").currentHp, 2);

  const second = applyEndOfRoundEffects(room);
  room = second.room;
  assert.equal(room.tokens.find(candidate => candidate.id === "target").currentHp, 5);
  assert.equal(room.tokens.find(candidate => candidate.id === "source").currentHp, 6);
  assert.equal(room.tokens.find(candidate => candidate.id === "wisher").currentHp, 8);

  const third = applyEndOfRoundEffects(room);
  assert.equal(third.room.tokens.find(candidate => candidate.id === "target").currentHp, 0);
  assert.equal(third.effects.some(effect => effect.kind === "perish"), true);
});

test("old room snapshots gain safe special-state defaults and keep a temporary third type", () => {
  const room = normalizeRoomSnapshot({
    schema: 1,
    title: "Sala antiga",
    tokens: [{
      id: "legacy",
      name: "Legado",
      maxHp: 5,
      currentHp: 5,
      types: ["grass", "ghost", "fire"],
      moves: ["forest's-curse", "", "", ""],
      stats: {},
      originalStats: {},
    }],
  });
  assert.equal(room.schema, ROOM_SCHEMA_VERSION);
  assert.equal(room.schema, 6);
  assert.deepEqual(room.tokens[0].types, ["grass", "ghost", "fire"]);
  assert.deepEqual(room.tokens[0].specialState, normalizeSpecialState());
  assert.equal(getSpecialMoveBlockReason({ move: { name: "sketch" }, attacker: room.tokens[0], defender: token() }), "o alvo ainda não possui um último movimento registrado");
});

import assert from "node:assert/strict";
import test from "node:test";
import { convertToTTRPG } from "../src/core/mechanics.js";
import {
  addTeamToSnapshot,
  applyEndOfRoundEffects,
  buildInitiative,
  calculateMoveResolution,
  createRoomSnapshot,
  mergeRoomConflictSnapshot,
  normalizeRoomSnapshot,
  ROOM_PHASES,
  ROOM_SCENARIOS,
  syncTeamsWithRoomProgress,
} from "../src/core/room.js";
import { EXPERIENCE_MODES } from "../src/core/rpgRules.js";
import { normalizeTeam } from "../src/core/team.js";

const sequence = values => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
};

const team = normalizeTeam({
  id: "box-test",
  name: "Equipe de teste",
  pokemon: [{
    id: "partner-one",
    formName: "charizard",
    nickname: "Brasa",
    level: 10,
    nature: "hardy",
    moves: ["ember", "growl", "", ""],
    customTypes: ["fire", "flying"],
    rpg: { xp: 2.5, currentHp: 3 },
    species: {
      id: 6,
      name: "charizard",
      stats: [
        { stat: { name: "hp" }, base_stat: 78 },
        { stat: { name: "attack" }, base_stat: 84 },
        { stat: { name: "defense" }, base_stat: 78 },
        { stat: { name: "special-attack" }, base_stat: 109 },
        { stat: { name: "special-defense" }, base_stat: 85 },
        { stat: { name: "speed" }, base_stat: 100 },
      ],
      sprites: { front_default: "https://example.com/charizard.png" },
    },
  }],
});

test("the experience is named RPG without the old compound label", () => {
  assert.equal(EXPERIENCE_MODES.rpg.label, "RPG");
  assert.notEqual(EXPERIENCE_MODES.rpg.label, "RPG Anime");
});

test("RPG division uses the written 0.55 and 0.56 boundary exactly", () => {
  assert.equal(convertToTTRPG(11), 0);
  assert.equal(convertToTTRPG(12), 1);
  assert.equal(convertToTTRPG(51), 2);
  assert.equal(convertToTTRPG(52), 3);
  assert.equal(convertToTTRPG(11, true), 1);
});

test("room snapshots normalize phases, scenes and unsafe token positions", () => {
  const room = normalizeRoomSnapshot({
    ...createRoomSnapshot("Sinnoh"),
    phase: "invalid",
    scenario: "invalid",
    audio: { playing: true, volume: 2, offset: -5 },
    tokens: [{ id: "one", name: "Teste", x: 500, y: -100, maxHp: 5, currentHp: 10 }],
  });
  assert.equal(room.phase, ROOM_PHASES[0].id);
  assert.equal(room.scenario, ROOM_SCENARIOS[0].id);
  assert.equal(room.tokens[0].x, 96);
  assert.equal(room.tokens[0].y, 8);
  assert.equal(room.tokens[0].currentHp, 5);
  assert.equal(room.audio.volume, 1);
  assert.equal(room.audio.offset, 0);
});

test("room conflicts preserve a Player move while applying the Narrator change", () => {
  const source = addTeamToSnapshot(createRoomSnapshot("Teste"), team, "ally").room;
  const token = source.tokens[0];
  const base = {
    ...source,
    tokens: [
      token,
      { ...token, id: "removed", name: "Retirado" },
    ],
  };
  const desired = {
    ...base,
    sceneNotes: "Mudança do Narrador",
    tokens: [{ ...token, currentHp: Math.max(0, token.currentHp - 1) }],
  };
  const latest = {
    ...base,
    tokens: [
      { ...token, x: 72, y: 41 },
      base.tokens[1],
      { ...token, id: "remote-new", name: "Novo remoto", x: 80 },
    ],
  };
  const merged = mergeRoomConflictSnapshot(base, desired, latest);
  const mergedToken = merged.tokens.find(candidate => candidate.id === token.id);
  assert.equal(merged.sceneNotes, "Mudança do Narrador");
  assert.equal(mergedToken.currentHp, desired.tokens[0].currentHp);
  assert.equal(mergedToken.x, 72);
  assert.equal(mergedToken.y, 41);
  assert.equal(merged.tokens.some(candidate => candidate.id === "removed"), false);
  assert.equal(merged.tokens.some(candidate => candidate.id === "remote-new"), true);
});

test("adding a Box creates linked battlefield tokens with calculated RPG stats", () => {
  const result = addTeamToSnapshot(createRoomSnapshot("Teste"), team, "ally", "player-one");
  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].pokemonId, "partner-one");
  assert.equal(result.tokens[0].teamId, "box-test");
  assert.equal(result.tokens[0].teamShareId, "box-test");
  assert.equal(result.tokens[0].name, "Brasa");
  assert.equal(result.tokens[0].side, "ally");
  assert.equal(result.tokens[0].ownerPlayerId, "player-one");
  assert.equal(result.tokens[0].xp, 2.5);
  assert.ok(result.tokens[0].maxHp >= 1);
  assert.ok(result.tokens[0].stats.speed >= 0);
});

test("battle progress returns to the linked Box without erasing journey details", () => {
  const created = addTeamToSnapshot(createRoomSnapshot("Teste"), team, "ally", "player-one");
  const changedToken = {
    ...created.tokens[0],
    currentHp: 1,
    status: "burn",
    xp: 5.5,
    level: 11,
    pp: [12, 30, null, null],
  };
  const synchronized = syncTeamsWithRoomProgress(
    [team],
    { ...created.room, tokens: [changedToken] },
    "player-one",
  );
  assert.equal(synchronized[0].pokemon[0].level, 11);
  assert.equal(synchronized[0].pokemon[0].rpg.currentHp, 1);
  assert.equal(synchronized[0].pokemon[0].rpg.status, "burn");
  assert.equal(synchronized[0].pokemon[0].rpg.xp, 5.5);
  assert.deepEqual(synchronized[0].pokemon[0].rpg.pp, [12, 30, null, null]);

  const original = [team];
  const untouched = syncTeamsWithRoomProgress(original, created.room, "another-player");
  assert.equal(untouched, original);
  assert.equal(untouched[0], team);
});

test("initiative is derived from the same 2d6 plus Speed rule", () => {
  const first = addTeamToSnapshot(createRoomSnapshot("Teste"), team, "ally").room;
  const second = {
    ...first,
    tokens: [
      ...first.tokens,
      { ...first.tokens[0], id: "slower", name: "Lento", stats: { ...first.tokens[0].stats, speed: 0 } },
    ],
  };
  const result = buildInitiative(second, sequence([0.999, 0.999, 0, 0]));
  assert.equal(result.room.initiative[0], first.tokens[0].id);
  assert.equal(result.results[0].total, 12 + first.tokens[0].stats.speed);
});

test("Move priority is resolved before Speed and ties use a quick roll", () => {
  const base = addTeamToSnapshot(createRoomSnapshot("Teste"), team, "ally").room;
  const fast = { ...base.tokens[0], id: "fast", name: "Rápido", priority: 0, stats: { ...base.tokens[0].stats, speed: 20 } };
  const priority = { ...base.tokens[0], id: "priority", name: "Prioritário", priority: 1, stats: { ...base.tokens[0].stats, speed: 0 } };
  const result = buildInitiative({ ...base, tokens: [fast, priority] }, sequence([0.999, 0.999, 0, 0, 0, 0.999]));
  assert.equal(result.room.initiative[0], "priority");
});

test("Pokémon without HP leave the next initiative automatically", () => {
  const base = addTeamToSnapshot(createRoomSnapshot("Teste"), team, "ally").room;
  const active = { ...base.tokens[0], id: "active", currentHp: 1 };
  const fainted = { ...base.tokens[0], id: "fainted", currentHp: 0 };
  const result = buildInitiative({ ...base, tokens: [active, fainted] }, sequence([0, 0, 0]));
  assert.deepEqual(result.room.initiative, ["active"]);
});

test("end-of-round residual damage is separate from hit kill protection and stays recorded", () => {
  const snapshot = createRoomSnapshot("Condições");
  snapshot.weather = "areia";
  snapshot.tokens = [
    {
      id: "burned",
      name: "Queimado",
      maxHp: 16,
      currentHp: 2,
      status: "burn",
      types: ["water"],
      stats: {},
      originalStats: {},
    },
    {
      id: "poisoned",
      name: "Envenenado",
      maxHp: 16,
      currentHp: 1,
      status: "poison",
      types: ["rock"],
      stats: {},
      originalStats: {},
    },
  ];
  const result = applyEndOfRoundEffects(snapshot);
  assert.equal(result.room.tokens.find(token => token.id === "burned").currentHp, 0);
  assert.equal(result.room.tokens.find(token => token.id === "poisoned").currentHp, 0);
  assert.equal(result.effects.length, 2);
  assert.deepEqual(result.effects[0].sources, ["queimadura", "tempestade de areia"]);
  assert.equal(result.effects[0].fainted, true);
});

test("move resolution honors defender ties, STAB, typing and level ceiling", () => {
  const attacker = {
    id: "attacker",
    name: "Atacante",
    level: 10,
    types: ["fire"],
    stats: { attack: 2, "special-attack": 3 },
  };
  const defender = {
    id: "defender",
    name: "Defensor",
    types: ["grass"],
    stats: { defense: 1, "special-defense": 1 },
  };
  const move = {
    name: "ember",
    power: 40,
    accuracy: 100,
    type: { name: "fire" },
    damage_class: { name: "special" },
  };
  const success = calculateMoveResolution({
    attacker,
    defender,
    move,
    random: sequence([0.8, 0.8, 0, 0]),
  });
  assert.equal(success.hit, true);
  assert.equal(success.baseDamage, 2);
  assert.equal(success.stab, 1.5);
  assert.equal(success.effectiveness, 2);
  assert.equal(success.damage, 5);

  const tie = calculateMoveResolution({
    attacker: { ...attacker, stats: { ...attacker.stats, "special-attack": 0 } },
    defender: { ...defender, stats: { ...defender.stats, "special-defense": 0 } },
    move,
    random: sequence([0, 0, 0, 0]),
  });
  assert.equal(tie.attackTest.total, tie.defenseTest.total);
  assert.equal(tie.hit, true);
  assert.equal(tie.moveConnected, true);
  assert.equal(tie.damageHit, false);
  assert.equal(tie.damage, 0);

  const inaccurate = calculateMoveResolution({
    attacker,
    defender,
    move: { ...move, accuracy: 50 },
    random: sequence([0.999, 0.999, 0, 0, 0.999, 0.999]),
  });
  assert.equal(inaccurate.accuracyTest.automatic, false);
  assert.equal(inaccurate.accuracyTest.rolls.length, 2);
  assert.equal(inaccurate.accuracyTest.success, false);
  assert.equal(inaccurate.hit, false);
  assert.equal(inaccurate.damage, 0);

  const fractionalCeiling = calculateMoveResolution({
    attacker: { ...attacker, level: 11 },
    defender,
    move: { ...move, power: 100 },
    random: sequence([0.8, 0.8, 0, 0]),
  });
  assert.equal(fractionalCeiling.ceiling, 5.5);
  assert.equal(fractionalCeiling.damage, 5.5);

  const firstLevelMinimum = calculateMoveResolution({
    attacker: { ...attacker, level: 1 },
    defender,
    move,
    random: sequence([0.8, 0.8, 0, 0]),
  });
  assert.equal(firstLevelMinimum.ceiling, 1);
  assert.equal(firstLevelMinimum.damage, 1);

  const critical = calculateMoveResolution({
    attacker,
    defender,
    move: { ...move, power: 100 },
    random: sequence([0.999, 0.999, 0, 0]),
  });
  assert.equal(critical.attackTest.critical, true);
  assert.ok(critical.damage > critical.ceiling);

  const multiHit = calculateMoveResolution({
    attacker,
    defender,
    move: { ...move, power: 20, meta: { min_hits: 2, max_hits: 5 } },
    random: sequence([0.8, 0.8, 0, 0, 0.999]),
  });
  assert.equal(multiHit.hitCount, 5);
  assert.equal(multiHit.damage, multiHit.damagePerHit * 5);
});

test("status, declaration and always-hit moves follow distinct resolution paths", () => {
  const user = {
    id: "user",
    name: "Usuário",
    level: 10,
    types: ["normal"],
    stages: {},
    stats: { attack: 3, defense: 2, "special-attack": 2, "special-defense": 2 },
  };
  const target = {
    id: "target",
    name: "Alvo",
    types: ["normal"],
    stages: {},
    stats: { attack: 2, defense: 1, "special-attack": 2, "special-defense": 1 },
  };
  const growl = calculateMoveResolution({
    attacker: user,
    defender: target,
    move: {
      name: "growl",
      accuracy: 100,
      damage_class: { name: "status" },
      target: { name: "all-opponents" },
      type: { name: "normal" },
    },
    random: sequence([0.49]),
  });
  assert.equal(growl.resolutionKind, "target-effect");
  assert.equal(growl.attackTest, null);
  assert.equal(growl.accuracyTest.automatic, false);
  assert.equal(growl.moveConnected, true);
  assert.equal(growl.damageHit, false);
  assert.equal(growl.manualDamage, false);

  const recover = calculateMoveResolution({
    attacker: user,
    defender: null,
    move: {
      name: "recover",
      accuracy: null,
      damage_class: { name: "status" },
      target: { name: "user" },
      type: { name: "normal" },
    },
  });
  assert.equal(recover.resolutionKind, "declaration");
  assert.equal(recover.accuracyTest.automatic, true);
  assert.equal(recover.hit, true);

  const swift = calculateMoveResolution({
    attacker: user,
    defender: target,
    move: {
      name: "swift",
      power: 60,
      accuracy: null,
      damage_class: { name: "special" },
      target: { name: "all-opponents" },
      type: { name: "normal" },
    },
    random: sequence([0.8, 0.8, 0, 0]),
  });
  assert.equal(swift.resolutionKind, "attack");
  assert.equal(swift.accuracyTest.automatic, true);
  assert.equal(swift.damageHit, true);
});

test("accuracy and evasion stages adjust even a numeric 100 percent move", () => {
  const move = {
    name: "tackle",
    power: 40,
    accuracy: 100,
    damage_class: { name: "physical" },
    target: { name: "selected-pokemon" },
    type: { name: "normal" },
  };
  const result = calculateMoveResolution({
    attacker: {
      id: "attacker",
      level: 10,
      types: ["normal"],
      stages: { accuracy: -1 },
      stats: { attack: 4 },
    },
    defender: {
      id: "defender",
      types: ["normal"],
      stages: { evasion: 1 },
      stats: { defense: 0 },
    },
    move,
    random: sequence([0.8, 0.8, 0, 0, 0.6, 0.6]),
  });
  assert.equal(result.accuracyState.baseAccuracy, 100);
  assert.equal(result.adjustedAccuracy, 60);
  assert.equal(result.accuracyTest.rolls.length, 2);
  assert.equal(result.accuracyTest.success, false);
  assert.equal(result.moveConnected, false);
});

test("Yawn becomes sleep at end of the following round", () => {
  const snapshot = createRoomSnapshot("Bocejo");
  snapshot.tokens = [
    {
      id: "sleepy",
      name: "Sonolento",
      maxHp: 8,
      currentHp: 8,
      status: "",
      volatileEffects: [{ id: "yawn", turns: 1 }],
      types: ["normal"],
      stats: {},
      originalStats: {},
    },
    {
      id: "protected",
      name: "Protegido",
      maxHp: 8,
      currentHp: 8,
      status: "",
      volatileEffects: [{ id: "protection", sourceMove: "protect", turns: 1 }],
      types: ["normal"],
      stats: {},
      originalStats: {},
    },
  ];
  const result = applyEndOfRoundEffects(snapshot);
  assert.equal(result.room.tokens[0].status, "sleep");
  assert.deepEqual(result.room.tokens[0].volatileEffects, []);
  assert.deepEqual(result.room.tokens[1].volatileEffects, []);
  assert.equal(result.effects[0].kind, "status");
  assert.deepEqual(result.effects[0].sources, ["bocejo"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAuthoritativeMovePriorities,
  createAuditedSecureRandom,
  normalizeAuthoritativeRequest,
  requestFingerprintPayload,
  resolveAuthoritativeAction,
} from "../server/authoritativeActions.js";
import { createRoomSnapshot, normalizeRoomSnapshot } from "../src/core/room.js";

const requestId = "room-action-1234567890";

const uint32Source = values => {
  let index = 0;
  const draws = [];
  return {
    draws,
    nextUint32: () => values[index++] ?? values.at(-1) ?? 0,
    onInt: draw => draws.push(draw),
    onUnit: draw => draws.push(draw),
  };
};

const quick = (input, values, role = "player") => {
  const request = normalizeAuthoritativeRequest({ requestId, ...input });
  return resolveAuthoritativeAction({ request, snapshot: {}, role, random: uint32Source(values) });
};

test("shared requests accept choices only and reject every client-supplied outcome", () => {
  const forbidden = ["dice", "rolls", "kept", "result", "success", "critical", "fumble", "random", "seed"];
  for (const field of forbidden) {
    assert.throws(
      () => normalizeAuthoritativeRequest({
        requestId,
        action: "quick-attribute",
        mode: "normal",
        attribute: 2,
        [field]: field === "dice" ? [6, 6] : true,
      }),
      /não aceita dados de resultado/,
    );
  }
  assert.deepEqual(requestFingerprintPayload(normalizeAuthoritativeRequest({
    requestId,
    action: "quick-percent",
    mode: "normal",
    chance: 50,
  })), { action: "quick-percent", mode: "normal", chance: 50 });
});

test("server mapping preserves normal 2d6 and both 3d6 keep rules", () => {
  const normal = quick({ action: "quick-attribute", mode: "normal", attribute: 2 }, [0, 5]);
  assert.deepEqual(normal.audit.rawDice, [1, 6]);
  assert.deepEqual(normal.audit.keptDice, [1, 6]);
  assert.equal(normal.audit.result, 9);

  const advantage = quick({ action: "quick-attribute", mode: "advantage", attribute: 0 }, [0, 2, 5]);
  assert.deepEqual(advantage.audit.rawDice, [1, 3, 6]);
  assert.deepEqual(advantage.audit.keptDice, [3, 6]);
  assert.equal(advantage.audit.result, 9);

  const disadvantage = quick({ action: "quick-attribute", mode: "disadvantage", attribute: 0 }, [0, 2, 5]);
  assert.deepEqual(disadvantage.audit.rawDice, [1, 3, 6]);
  assert.deepEqual(disadvantage.audit.keptDice, [1, 3]);
  assert.equal(disadvantage.audit.result, 4);
});

test("server mapping preserves d100 normal, advantage and disadvantage", () => {
  const normal = quick({ action: "quick-percent", mode: "normal", chance: 30 }, [29]);
  assert.deepEqual(normal.audit.rawDice, [30]);
  assert.equal(normal.audit.result, 30);
  assert.equal(normal.audit.success, true);

  const advantage = quick({ action: "quick-percent", mode: "advantage", chance: 30 }, [79, 29]);
  assert.deepEqual(advantage.audit.rawDice, [80, 30]);
  assert.equal(advantage.audit.result, 30);
  assert.equal(advantage.audit.success, true);

  const disadvantage = quick({ action: "quick-percent", mode: "disadvantage", chance: 80 }, [9, 89]);
  assert.deepEqual(disadvantage.audit.rawDice, [10, 90]);
  assert.equal(disadvantage.audit.result, 90);
  assert.equal(disadvantage.audit.success, false);
});

test("critical and fumble flags plus the fumble choice are produced on the server", () => {
  const critical = quick({ action: "quick-attribute", mode: "normal", attribute: 0 }, [5, 5]);
  assert.equal(critical.audit.critical, true);
  assert.equal(critical.result.title, "Acerto crítico");

  const fumble = quick({ action: "quick-attribute", mode: "normal", attribute: 0 }, [0, 0, 2]);
  assert.equal(fumble.audit.fumble, true);
  assert.equal(fumble.result.title, "Erro crítico");
  assert.ok(fumble.audit.fumbleSuggestion);
  assert.equal(fumble.result.detail, fumble.audit.fumbleSuggestion);
});

test("the authoritative result is identical for narrator, player and device metadata cannot enter", () => {
  const input = { action: "quick-percent", mode: "advantage", chance: 42 };
  const narrator = quick(input, [40, 90], "narrator");
  const player = quick(input, [40, 90], "player");
  assert.deepEqual(narrator, player);
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, ...input, device: "xiaomi" }), /não aceita dados de resultado/);
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, ...input, userAgent: "browser-a" }), /não aceita dados de resultado/);
});

test("audited production draws retain rejection sampling without exposing entropy words", () => {
  let filled = false;
  const audited = createAuditedSecureRandom({
    getRandomValues(values) {
      values.fill(0);
      if (!filled) {
        values[0] = 0xffffffff;
        values[1] = 5;
        values[2] = 0;
        filled = true;
      }
      return values;
    },
  });
  const request = normalizeAuthoritativeRequest({
    requestId,
    action: "quick-attribute",
    mode: "normal",
    attribute: 0,
  });
  const resolution = resolveAuthoritativeAction({ request, snapshot: {}, role: "player", random: audited.source });
  assert.deepEqual(resolution.audit.rawDice, [6, 1]);
  assert.deepEqual(audited.draws, [
    { kind: "integer", outcomes: 6, zeroBasedOutcome: 5 },
    { kind: "integer", outcomes: 6, zeroBasedOutcome: 0 },
  ]);
  assert.doesNotMatch(JSON.stringify(audited.draws), /4294967295|uint32|entropy|seed/i);
});

const battleRoom = () => normalizeRoomSnapshot({
  ...createRoomSnapshot("Autoridade"),
  phase: "batalha",
  tokens: [
    {
      id: "attacker",
      name: "Brasa",
      side: "ally",
      level: 10,
      maxHp: 10,
      currentHp: 10,
      types: ["fire"],
      originalTypes: ["fire"],
      moves: ["ember", "", "", ""],
      pp: [25, null, null, null],
      stats: { attack: 2, defense: 2, "special-attack": 3, "special-defense": 2, speed: 4 },
      originalStats: { attack: 40, defense: 40, "special-attack": 60, "special-defense": 40, speed: 80 },
    },
    {
      id: "defender",
      name: "Folha",
      side: "opponent",
      level: 10,
      maxHp: 10,
      currentHp: 10,
      types: ["grass"],
      originalTypes: ["grass"],
      moves: ["tackle", "", "", ""],
      stats: { attack: 2, defense: 2, "special-attack": 2, "special-defense": 1, speed: 2 },
      originalStats: { attack: 40, defense: 40, "special-attack": 40, "special-defense": 20, speed: 40 },
    },
  ],
});

const ember = {
  name: "ember",
  pp: 25,
  power: 40,
  accuracy: 100,
  priority: 0,
  type: { name: "fire" },
  damage_class: { name: "special" },
  target: { name: "selected-pokemon" },
  meta: { ailment: { name: "none" }, ailment_chance: 0, min_hits: null, max_hits: null, drain: 0, healing: 0 },
  stat_changes: [],
};

test("initiative, combat consequences and round transitions are calculated from canonical state", () => {
  const room = battleRoom();
  const initiativeRequest = normalizeAuthoritativeRequest({ requestId, action: "initiative", expectedRevision: 7 });
  const formed = resolveAuthoritativeAction({ request: initiativeRequest, snapshot: room, role: "narrator", random: uint32Source([0, 0, 1, 1]) });
  assert.equal(formed.nextSnapshot.initiative.length, 2);
  assert.equal(formed.audit.type, "initiative");
  assert.equal(formed.audit.rawDice.length, 2);

  const combatRequest = normalizeAuthoritativeRequest({
    requestId,
    action: "combat",
    expectedRevision: 7,
    attackerId: "attacker",
    defenderId: "defender",
    moveName: "ember",
    calledMoveName: "",
    mode: "normal",
  });
  const combat = resolveAuthoritativeAction({
    request: combatRequest,
    snapshot: room,
    role: "narrator",
    move: ember,
    random: uint32Source([5, 5, 0, 0]),
  });
  assert.equal(combat.audit.type, "combat");
  assert.equal(combat.audit.critical, true);
  assert.ok(combat.result.consequences.damage > 0);
  assert.ok(combat.nextSnapshot.tokens.find(token => token.id === "defender").currentHp < 10);
  assert.equal(combat.eventType, "move");

  const endRoom = { ...room, initiative: ["attacker"], turnIndex: 0 };
  const advanceRequest = normalizeAuthoritativeRequest({ requestId, action: "advance-turn", expectedRevision: 7 });
  const advanced = resolveAuthoritativeAction({ request: advanceRequest, snapshot: endRoom, role: "narrator", random: uint32Source([0]) });
  assert.equal(advanced.result.closingRound, true);
  assert.equal(advanced.nextSnapshot.round, room.round + 1);
  assert.deepEqual(advanced.nextSnapshot.initiative, []);
});

test("initiative discards client priority and uses the server-confirmed move priority", () => {
  const room = battleRoom();
  room.tokens[0].declaredMove = "ember";
  room.tokens[0].priority = 7;
  room.tokens[1].declaredMove = "move-not-owned";
  room.tokens[1].priority = -7;
  const secured = applyAuthoritativeMovePriorities(room, new Map([["ember", 1]]));
  assert.equal(secured.tokens[0].priority, 1);
  assert.equal(secured.tokens[1].declaredMove, "");
  assert.equal(secured.tokens[1].priority, 0);
});

test("players can simulate server-side combat but cannot mutate initiative or rounds", () => {
  const room = battleRoom();
  const combatRequest = normalizeAuthoritativeRequest({
    requestId,
    action: "combat",
    expectedRevision: 2,
    attackerId: "attacker",
    defenderId: "defender",
    moveName: "ember",
    mode: "normal",
  });
  const preview = resolveAuthoritativeAction({
    request: combatRequest,
    snapshot: room,
    role: "player",
    move: ember,
    random: uint32Source([5, 5, 0, 0]),
  });
  assert.equal(preview.nextSnapshot, null);
  assert.equal(preview.result.consequences, null);
  assert.equal(preview.eventType, "roll");
  for (const action of ["initiative", "advance-turn"]) {
    const protectedRequest = normalizeAuthoritativeRequest({ requestId, action, expectedRevision: 2 });
    assert.throws(
      () => resolveAuthoritativeAction({ request: protectedRequest, snapshot: room, role: "player", random: uint32Source([0]) }),
      /Só o Narrador/,
    );
  }
});

test("invalid ranges, modes, stale shapes and unowned moves fail closed before a roll", () => {
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, action: "quick-percent", chance: 101 }), /entre 0 e 100/);
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, action: "quick-attribute", attribute: 0, mode: "lucky" }), /forma válida/);
  assert.throws(() => normalizeAuthoritativeRequest({ requestId: "short", action: "quick-attribute", attribute: 0 }), /identificador válido/);
  const request = normalizeAuthoritativeRequest({
    requestId,
    action: "combat",
    expectedRevision: 0,
    attackerId: "attacker",
    defenderId: "defender",
    moveName: "hydro-pump",
    mode: "normal",
  });
  assert.throws(
    () => resolveAuthoritativeAction({ request, snapshot: battleRoom(), role: "narrator", move: { ...ember, name: "hydro-pump" }, random: uint32Source([0]) }),
    /pertença/,
  );
});

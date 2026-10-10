import assert from "node:assert/strict";
import test from "node:test";
import { applyMaxMoveSecondary } from "../src/core/battleMoveEffects.js";

const make = (id, side, extra = {}) => ({
  id, side, name: id, currentHp: 30, maxHp: 30, hidden: false, captured: false,
  status: "", types: ["normal"], ability: "", volatileEffects: [], ...extra,
});
const run = (label, { foes = [make("foe", "opponent")], random = () => 0, connected = true, targetId = "foe" } = {}) =>
  applyMaxMoveSecondary({
    tokens: [make("user", "ally"), ...foes], attackerId: "user",
    presentation: { kind: "gmax-move", label }, connected, random, targetId,
  });

test("G-Max Befuddle rolls independent primary statuses and checks immunities", () => {
  const results = [0, 0.4, 0.99].map(value => run("G-Max Befuddle", { random: () => value }));
  assert.deepEqual(results.map(x => x.tokens[1].status), ["poison", "paralysis", "sleep"]);
  const immune = run("G-Max Befuddle", { foes: [make("foe", "opponent", { types: ["steel"] })] });
  assert.equal(immune.tokens[1].status, "", "Steel blocks poison without rerolling");
  assert.equal(run("G-Max Befuddle", { foes: [make("foe", "opponent", { status: "burn" })] }).tokens[1].status, "burn");
  assert.equal(run("G-Max Befuddle", { connected: false }).tokens[1].status, "");
});

test("G-Max Stun Shock chooses one legal status per eligible opponent", () => {
  let roll = 0;
  const result = run("G-Max Stun Shock", {
    foes: [make("p", "opponent"), make("q", "opponent")],
    random: () => (roll++ === 0 ? 0 : 0.9),
  });
  assert.deepEqual(result.tokens.slice(1).map(t => t.status), ["poison", "paralysis"]);
  assert.equal(result.tokens[0].status, "");
});

test("G-Max Smite and Gold Rush inflict confusion, respecting Own Tempo", () => {
  for (const name of ["G-Max Smite", "G-Max Gold Rush"]) {
    const result = run(name, {
      foes: [make("foe", "opponent"), make("immune", "opponent", { ability: "own-tempo" })],
    });
    assert.equal(result.tokens[1].volatileEffects[0]?.id, "confusion");
    assert.equal(result.tokens[1].volatileEffects[0]?.turns, 2);
    assert.deepEqual(result.tokens[2].volatileEffects, []);
    assert.deepEqual(result.tokens[0].volatileEffects, []);
    assert.equal(run(name, { connected: false }).tokens[1].volatileEffects.length, 0);
  }
  assert.match(run("G-Max Gold Rush").notes.join(" "), /Narrador/);
});

test("G-Max Snooze applies a 50% delayed sleep chance, never instant sleep", () => {
  const success = run("G-Max Snooze", { random: () => 0 });
  assert.equal(success.tokens[1].volatileEffects[0]?.id, "yawn");
  assert.equal(success.tokens[1].volatileEffects[0]?.turns, 2);
  assert.equal(success.tokens[1].status, "");
  const two = run("G-Max Snooze", { random: () => 0, foes: [make("foe", "opponent"), make("other", "opponent")] });
  assert.deepEqual(two.tokens[2].volatileEffects, [], "Only the selected target can become drowsy");
  assert.deepEqual(run("G-Max Snooze", { random: () => 0.99 }).tokens[1].volatileEffects, []);
  assert.deepEqual(run("G-Max Snooze", { random: () => 0,
    foes: [make("foe", "opponent", { status: "sleep" })] }).tokens[1].volatileEffects, []);
});

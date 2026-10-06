import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAuthoritativeRequest, resolveAuthoritativeAction } from "../server/authoritativeActions.js";
import {
  LOCAL_DICE_SIDES,
  localRollOdds,
  normalizeLocalRollReceipt,
  performLocalRoll,
} from "../src/core/localRolls.js";
import { rollAttributeTest, rollPercentTest } from "../src/core/rpgRules.js";

const requestId = "dice-contract-123456";
const unitFaces = (faces, sides) => {
  let index = 0;
  return () => {
    const face = faces[index++];
    assert.ok(Number.isInteger(face) && face >= 1 && face <= sides, `invalid d${sides} fixture face`);
    return (face - 0.5) / sides;
  };
};
const uintFaces = faces => {
  let index = 0;
  return {
    nextUint32: () => {
      assert.ok(index < faces.length, "unexpected authoritative entropy draw");
      return faces[index++] - 1;
    },
  };
};

test("percent tests have exact advertised probabilities in every mode", () => {
  for (const chance of [0, 1, 25, 50, 75, 99, 100]) {
    for (const mode of ["normal", "advantage", "disadvantage"]) {
      let successes = 0;
      let outcomes = 0;
      if (mode === "normal") {
        for (let a = 1; a <= 100; a += 1) {
          successes += Number(rollPercentTest({ chance, mode, random: unitFaces([a], 100) }).success);
          outcomes += 1;
        }
      } else {
        for (let a = 1; a <= 100; a += 1) for (let b = 1; b <= 100; b += 1) {
          successes += Number(rollPercentTest({ chance, mode, random: unitFaces([a, b], 100) }).success);
          outcomes += 1;
        }
      }
      assert.ok(Math.abs(successes / outcomes - localRollOdds({ kind: "percent", chance, mode }).success) < 1e-12, `${chance}% ${mode}`);
    }
  }
});

test("2d6 tests, Vantagem and Desvantagem match the exact odds calculator", () => {
  for (const mode of ["normal", "advantage", "disadvantage"]) {
    for (const [attribute, opposition] of [[0, 7], [3, 9], [-2, 5]]) {
      let outcomes = 0, successes = 0, criticals = 0, fumbles = 0;
      const thirdFaces = mode === "normal" ? [1] : [1, 2, 3, 4, 5, 6];
      for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) for (const c of thirdFaces) {
        const faces = mode === "normal" ? [a, b] : [a, b, c];
        const result = rollAttributeTest({ mode, attribute, opposition, random: unitFaces(faces, 6) });
        outcomes += 1;
        successes += Number(result.success);
        criticals += Number(result.critical);
        fumbles += Number(result.fumble);
      }
      const odds = localRollOdds({ kind: "attribute", mode, attribute, opposition });
      assert.equal(successes / outcomes, odds.success, `success ${mode} ${attribute}/${opposition}`);
      assert.equal(criticals / outcomes, odds.critical, `critical ${mode}`);
      assert.equal(fumbles / outcomes, odds.fumble, `fumble ${mode}`);
    }
  }
});

test("every free die exposes every face once and never creates an impossible face", () => {
  for (const sides of LOCAL_DICE_SIDES) {
    const seen = [];
    for (let face = 1; face <= sides; face += 1) {
      const receipt = performLocalRoll(
        { kind: "free", sides, quantity: 1, modifier: 0 },
        { id: `d${sides}-${face}`, createdAt: face, random: unitFaces([face], sides) },
      );
      assert.deepEqual(receipt.values, [face]);
      assert.equal(receipt.total, face);
      seen.push(receipt.values[0]);
    }
    assert.deepEqual(seen, Array.from({ length: sides }, (_, index) => index + 1));
  }

  const twenty = performLocalRoll(
    { kind: "free", sides: 20, quantity: 20, modifier: -7 },
    { id: "twenty-d20", createdAt: 1, random: unitFaces(Array.from({ length: 20 }, (_, index) => index + 1), 20) },
  );
  assert.equal(twenty.values.length, 20);
  assert.equal(twenty.total, 210 - 7);
});

test("local Dados and authoritative Adventure Dados resolve the same choices with the same dice", () => {
  const cases = [
    {
      local: { kind: "attribute", mode: "advantage", attribute: 2, opposition: 8 },
      action: { action: "quick-attribute", mode: "advantage", attribute: 2, opposition: 8 },
      faces: [2, 6, 4],
      sides: 6,
    },
    {
      local: { kind: "percent", mode: "disadvantage", chance: 65 },
      action: { action: "quick-percent", mode: "disadvantage", chance: 65 },
      faces: [12, 83],
      sides: 100,
    },
    {
      local: { kind: "free", sides: 12, quantity: 3, modifier: 4 },
      action: { action: "quick-free", sides: 12, quantity: 3, modifier: 4 },
      faces: [1, 7, 12],
      sides: 12,
    },
  ];

  for (const [index, item] of cases.entries()) {
    const local = performLocalRoll(item.local, {
      id: `parity-${index}`,
      createdAt: index + 1,
      random: unitFaces(item.faces, item.sides),
    });
    const request = normalizeAuthoritativeRequest({ requestId: `${requestId}-${index}`, ...item.action });
    const authoritative = resolveAuthoritativeAction({
      request,
      snapshot: {},
      role: "player",
      random: uintFaces(item.faces),
    });
    assert.deepEqual(authoritative.audit.rawDice, [...local.values]);
    assert.deepEqual(authoritative.audit.keptDice, [...local.kept]);
    assert.equal(authoritative.audit.result, local.total);
    assert.equal(authoritative.audit.success, local.success);
  }
});

test("invalid dice choices fail before consuming any entropy", () => {
  const invalid = [
    { kind: "unknown" },
    { kind: "percent", chance: -1 },
    { kind: "percent", chance: 101 },
    { kind: "attribute", mode: "lucky" },
    { kind: "free", sides: 7 },
    { kind: "free", sides: 20, quantity: 0 },
    { kind: "free", sides: 20, quantity: 21 },
  ];
  let calls = 0;
  const random = () => { calls += 1; return 0.5; };
  for (const [index, spec] of invalid.entries()) {
    assert.throws(() => performLocalRoll(spec, { id: `invalid-${index}`, createdAt: 1, random }));
  }
  assert.equal(calls, 0);

  assert.throws(() => normalizeAuthoritativeRequest({ requestId, action: "quick-free", sides: 7, quantity: 1, modifier: 0 }));
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, action: "quick-percent", chance: -1, mode: "normal" }));
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, action: "quick-percent", chance: 101, mode: "normal" }));
  assert.throws(() => normalizeAuthoritativeRequest({ requestId, action: "quick-attribute", attribute: 0, mode: "lucky" }));
});

test("corrupted or impossible saved dice receipts fail closed", () => {
  const valid = performLocalRoll(
    { kind: "percent", mode: "advantage", chance: 50 },
    { id: "valid-percent", createdAt: 1, random: unitFaces([25, 75], 100) },
  );
  assert.ok(normalizeLocalRollReceipt(valid));
  assert.equal(normalizeLocalRollReceipt({ ...valid, values: [0, 75] }), null);
  assert.equal(normalizeLocalRollReceipt({ ...valid, values: [25, 101] }), null);
  assert.equal(normalizeLocalRollReceipt({ ...valid, values: [25] }), null);
  assert.equal(normalizeLocalRollReceipt({ ...valid, total: 99 }), null);
  assert.equal(normalizeLocalRollReceipt({ ...valid, success: !valid.success }), null);

  assert.throws(() => normalizeAuthoritativeRequest({
    requestId,
    action: "quick-percent",
    mode: "normal",
    chance: 50,
    result: 1,
  }), /não aceita dados de resultado/);
});

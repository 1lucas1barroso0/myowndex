import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDirectionalIntegerModifier,
  clampFinite,
  finiteNumber,
  finiteNumberOrNull,
  finiteProduct,
  floorInteger,
  integerInRange,
  MAX_SAFE_GAME_INTEGER,
  quantizePositiveHpChange,
  quantizeStepDown,
  roundRpgScaledValue,
  safeDivide,
} from "../src/core/math.js";

test("numeric normalization rejects empty, null, boolean and non-finite inputs", () => {
  for (const value of [null, undefined, "", "   ", true, false, [], {}, Number.NaN, Infinity, -Infinity]) {
    assert.equal(finiteNumberOrNull(value), null);
    assert.equal(finiteNumber(value, 7), 7);
  }
  assert.equal(finiteNumber("12.75", 0), 12.75);
  assert.equal(clampFinite("999999999999999999999", 0, 100, 0), 100);
  assert.equal(integerInRange(-4.8, 0, 10, 3), 0);
  assert.equal(integerInRange(10.9, 0, 10, 3), 10);
  assert.equal(floorInteger(Number.MAX_VALUE), MAX_SAFE_GAME_INTEGER);
});

test("division and products never emit NaN or Infinity", () => {
  assert.equal(safeDivide(10, 0, 4), 4);
  assert.equal(safeDivide(null, undefined, 3), 3);
  assert.equal(finiteProduct([Number.MAX_VALUE, Number.MAX_VALUE]), MAX_SAFE_GAME_INTEGER);
  assert.equal(finiteProduct([4, "bad", 2], { fallback: 0 }), 0);
});

test("RPG rounding keeps its explicit boundary and floors the unspecified fallback", () => {
  assert.equal(roundRpgScaledValue(1.55), 1);
  assert.equal(roundRpgScaledValue(1.559), 1);
  assert.equal(roundRpgScaledValue(1.56), 2);
  assert.equal(roundRpgScaledValue(0.4), 0);
  assert.equal(roundRpgScaledValue(0.4, { minimumWhenPositive: 1 }), 1);
});

test("real HP changes and step values keep mechanical floors without inventing fractions", () => {
  assert.equal(quantizePositiveHpChange(0), 0);
  assert.equal(quantizePositiveHpChange(0.01), 1);
  assert.equal(quantizePositiveHpChange(9.99), 9);
  assert.equal(quantizePositiveHpChange(Infinity), 0);
  assert.equal(quantizeStepDown(1.99, 0.5), 1.5);
  assert.equal(quantizeStepDown(-5, 0.5, { minimum: 0, maximum: 10 }), 0);
  assert.equal(quantizeStepDown(999, 0.5, { minimum: 0, maximum: 10 }), 10);
});

test("directional integer modifiers preserve buffs and nerfs until a cap or floor", () => {
  assert.equal(applyDirectionalIntegerModifier(1, 1.01, { minimum: 0, maximum: 100 }), 2);
  assert.equal(applyDirectionalIntegerModifier(1, 0.99, { minimum: 0, maximum: 100 }), 0);
  assert.equal(applyDirectionalIntegerModifier(100, 2, { minimum: 0, maximum: 100 }), 100);
  assert.equal(applyDirectionalIntegerModifier(0, 2, { minimum: 0, maximum: 100 }), 0);
  assert.equal(applyDirectionalIntegerModifier(0, 0.5, { minimum: 0, maximum: 100 }), 0);
  assert.equal(applyDirectionalIntegerModifier(Number.NaN, 2, { minimum: 0, maximum: 100 }), 0);
});

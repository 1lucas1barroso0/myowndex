import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createSecureUint32Source,
  randomChance,
  randomIntFromUint32,
  randomUnitFromUint32,
  roll2D6,
  rollD100,
  rollD6,
  SecureRandomError,
  secureRandomInt,
  secureRandomString,
} from "../src/core/random.js";

const countOutcomes = (draws, maximum) => {
  let nextValue = 0;
  const counts = Array.from({ length: maximum }, () => 0);
  for (let index = 0; index < draws; index += 1) {
    counts[randomIntFromUint32(maximum, () => nextValue++)] += 1;
  }
  return counts;
};

test("every bounded range used by the Guide and Adventure maps complete cycles evenly", () => {
  [3, 6, 8, 10, 32, 57, 100].forEach(maximum => {
    assert.deepEqual(
      countOutcomes(maximum * 100, maximum),
      Array.from({ length: maximum }, () => 100),
      `the range 0…${maximum - 1} must not favor any outcome`,
    );
  });
});

test("bounded draws reject the uneven tail and fail closed for a broken source", () => {
  const values = [0xffffffff, 5];
  let index = 0;
  assert.equal(randomIntFromUint32(6, () => values[index++]), 5);
  assert.equal(index, 2);

  let attempts = 0;
  assert.throws(
    () => randomIntFromUint32(6, () => { attempts += 1; return 0xffffffff; }),
    SecureRandomError,
  );
  assert.equal(attempts, 128);
  assert.throws(() => randomIntFromUint32(6, () => -1), RangeError);
  assert.throws(() => randomIntFromUint32(6, () => 1.5), RangeError);
});

test("secure source pools small batches and never falls back when Web Crypto is absent", () => {
  let fills = 0;
  let cursor = 0;
  const source = createSecureUint32Source({
    getRandomValues(values) {
      fills += 1;
      for (let index = 0; index < values.length; index += 1) values[index] = cursor++;
      return values;
    },
  }, 8);

  assert.deepEqual(Array.from({ length: 17 }, () => source()), Array.from({ length: 17 }, (_, index) => index));
  assert.equal(fills, 3, "17 values in batches of 8 should require only three Web Crypto calls");
  assert.throws(() => createSecureUint32Source(null)(), SecureRandomError);
});

test("unit draws use 53 random bits and stay inside the half-open interval", () => {
  assert.equal(randomUnitFromUint32(() => 0), 0);
  assert.equal(randomUnitFromUint32(() => 0xffffffff), (0x20000000000000 - 1) / 0x20000000000000);
});

test("exact chances and random strings preserve every configured outcome", () => {
  const tenths = Array.from({ length: 10 }, (_, index) => (index + 0.5) / 10);
  let index = 0;
  const outcomes = tenths.map(() => randomChance(3, 10, () => tenths[index++]));
  assert.equal(outcomes.filter(Boolean).length, 3);

  const alphabet = "ABCDEFG";
  index = 0;
  const generated = secureRandomString(alphabet.length, alphabet, () => (index++ + 0.5) / alphabet.length);
  assert.equal(generated, alphabet);
});

test("inclusive dice primitives preserve their endpoints and 2d6 samples exactly twice", () => {
  assert.equal(secureRandomInt(-2, 2, () => 0), -2);
  assert.equal(secureRandomInt(-2, 2, () => 0.999999999999), 2);
  assert.equal(rollD6(() => 0), 1);
  assert.equal(rollD6(() => 0.999999999999), 6);
  assert.equal(rollD100(() => 0), 1);
  assert.equal(rollD100(() => 0.999999999999), 100);

  const samples = [0, 0.999999999999];
  let calls = 0;
  const result = roll2D6(() => samples[calls++]);
  assert.equal(calls, 2);
  assert.deepEqual(result, { dice: [1, 6], dieA: 1, dieB: 6, total: 7 });
});

const withinStandardDeviations = (actual, samples, probability, deviations = 7) => {
  const expected = samples * probability;
  const deviation = Math.sqrt(samples * probability * (1 - probability));
  assert.ok(
    Math.abs(actual - expected) <= deviations * deviation + 1,
    `${actual} must remain within ${deviations}σ of ${expected}`,
  );
};

test("large secure audits converge to uniform d6, uniform d100 and the natural 2d6 curve", () => {
  const d6Samples = 120_000;
  const d6 = Array(7).fill(0);
  for (let index = 0; index < d6Samples; index += 1) d6[rollD6()] += 1;
  for (let face = 1; face <= 6; face += 1) withinStandardDeviations(d6[face], d6Samples, 1 / 6);

  const d100Samples = 200_000;
  const d100 = Array(101).fill(0);
  for (let index = 0; index < d100Samples; index += 1) d100[rollD100()] += 1;
  for (let face = 1; face <= 100; face += 1) withinStandardDeviations(d100[face], d100Samples, 1 / 100);

  const twoDiceSamples = 180_000;
  const sums = Array(13).fill(0);
  for (let index = 0; index < twoDiceSamples; index += 1) sums[roll2D6().total] += 1;
  const combinations = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
  for (let total = 2; total <= 12; total += 1) {
    withinStandardDeviations(sums[total], twoDiceSamples, combinations[total] / 36);
  }
});

const collectSourceFiles = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(target);
    return /\.(?:js|jsx|ts|tsx|mjs)$/.test(entry.name) ? [target] : [];
  }));
  return files.flat();
};

test("production source contains no Math.random downgrade", async () => {
  const roots = ["app", "server", "src"];
  const files = (await Promise.all(roots.map(collectSourceFiles))).flat();
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (source.includes("Math.random")) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

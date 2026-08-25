import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createSecureUint32Source,
  randomChance,
  randomIntFromUint32,
  randomUnitFromUint32,
  SecureRandomError,
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

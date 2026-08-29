import assert from "node:assert/strict";
import test from "node:test";
import {
  getDamageCeiling,
  getNextLevelXp,
  getRpgScale,
  rollAttributeTest,
  rollPercentTest,
  RPG_RULE_SECTIONS,
} from "../src/core/rpgRules.js";
import { randomIntFromUint32 } from "../src/core/random.js";

const sequence = values => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
};

test("trainer guide contains every canonical rule chapter", () => {
  assert.deepEqual(RPG_RULE_SECTIONS.map(section => section.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0) >= 32);
  assert.equal(RPG_RULE_SECTIONS[2].rules.some(rule => rule.title === "Proteção contra hit kill"), true);
});

test("attribute tests implement normal, advantage and defender-wins-ties", () => {
  const critical = rollAttributeTest({
    mode: "normal",
    attribute: 2,
    opposition: 14,
    random: sequence([0.999, 0.999]),
  });
  assert.deepEqual(critical.dice, [6, 6]);
  assert.equal(critical.total, 14);
  assert.equal(critical.critical, true);
  assert.equal(critical.success, false);

  const advantage = rollAttributeTest({
    mode: "advantage",
    attribute: 0,
    random: sequence([0, 0.5, 0.999]),
  });
  assert.deepEqual(advantage.dice, [1, 4, 6]);
  assert.deepEqual(advantage.kept, [4, 6]);
  assert.equal(advantage.total, 10);
  assert.equal(advantage.mode, "advantage");

  const unexpectedMode = rollAttributeTest({
    mode: "unexpected",
    random: sequence([0.999, 0.999, 0.999]),
  });
  assert.equal(unexpectedMode.mode, "normal");
  assert.deepEqual(unexpectedMode.dice, [6, 6]);
  assert.equal(unexpectedMode.total, 12, "an unknown mode must never become an accidental 3d6 total");
});

test("percent advantage keeps the most favorable d100 and respects equal-or-lower", () => {
  const result = rollPercentTest({
    chance: 30,
    advantage: true,
    random: sequence([0.79, 0.295]),
  });
  assert.deepEqual(result.rolls, [80, 30]);
  assert.equal(result.result, 30);
  assert.equal(result.advantage, true);
  assert.equal(result.success, true);

  const stringFlag = rollPercentTest({
    chance: 100,
    advantage: "false",
    random: sequence([0.99, 0]),
  });
  assert.equal(stringFlag.advantage, false);
  assert.deepEqual(stringFlag.rolls, [100]);

  const disadvantage = rollPercentTest({
    chance: 80,
    mode: "disadvantage",
    random: sequence([0.09, 0.89]),
  });
  assert.deepEqual(disadvantage.rolls, [10, 90]);
  assert.equal(disadvantage.result, 90);
  assert.equal(disadvantage.disadvantage, true);
  assert.equal(disadvantage.success, false);
});

test("RPG scale, XP and damage ceiling follow the guide", () => {
  assert.equal(getRpgScale(50), 2);
  assert.equal(getRpgScale(51), 2);
  assert.equal(getRpgScale(52), 3);
  assert.equal(getNextLevelXp(10), 5.5);
  assert.equal(getDamageCeiling(1), 1);
  assert.equal(getDamageCeiling(11), 5);
  assert.equal(getDamageCeiling(Infinity), 1);
});

test("secure dice reject the uneven uint32 tail instead of introducing modulo bias", () => {
  const values = [4294967295, 5];
  let index = 0;
  assert.equal(randomIntFromUint32(6, () => values[index++]), 5);
  assert.equal(index, 2, "the out-of-range uint32 value must be rejected");

  const hundredValues = [4294967295, 99];
  index = 0;
  assert.equal(randomIntFromUint32(100, () => hundredValues[index++]), 99);
  assert.equal(index, 2, "d100 must use the same unbiased rejection sampling");
});

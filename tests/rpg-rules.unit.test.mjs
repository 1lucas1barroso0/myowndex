import assert from "node:assert/strict";
import test from "node:test";
import {
  getDamageCeiling,
  getNextLevelXp,
  getRpgScale,
  rollAttributeTest,
  rollPercentTest,
  rollProportionalAttributeTest,
  RPG_RULE_SECTIONS,
} from "../src/core/rpgRules.js";
import { randomIntFromUint32 } from "../src/core/random.js";

const sequence = values => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
};

test("trainer guide contains exactly 40 distinct rules across every canonical chapter", () => {
  assert.deepEqual(RPG_RULE_SECTIONS.map(section => section.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  const expectedIds = [4, 5, 7, 4, 4, 5, 6, 5].flatMap((count, chapter) =>
    Array.from({ length: count }, (_, rule) => `${chapter + 1}.${rule + 1}`)
  );
  const rules = RPG_RULE_SECTIONS.flatMap(section => section.rules);
  assert.equal(rules.length, 40);
  assert.equal(new Set(rules.map(rule => rule.id)).size, 40);
  assert.equal(new Set(rules.map(rule => rule.title)).size, 40);
  assert.deepEqual(rules.map(rule => rule.id), expectedIds);
  for (const rule of rules) assert.ok(rule.body || rule.bullets?.length, `${rule.id} must contain its rule`);
  assert.equal(RPG_RULE_SECTIONS[2].rules.some(rule => rule.title === "Proteção contra hit kill"), true);
});

test("volatile effects have their own rule without changing the current condition mechanics", () => {
  const conditions = RPG_RULE_SECTIONS.find(section => section.id === "condicoes");
  const principal = conditions.rules.find(rule => rule.id === "6.1");
  const volatile = conditions.rules.find(rule => rule.id === "6.5");
  assert.equal(principal.bullets.length, 5);
  assert.doesNotMatch(principal.bullets.join(" "), /Confusão:|Hesitação:/);
  assert.equal(volatile.title, "Efeitos voláteis");
  assert.equal(volatile.bullets.length, 2);
  assert.match(volatile.body, /separados da condição principal/);
  assert.match(volatile.bullets[0], /Dura de 2 a 5 oportunidades próprias/);
  assert.match(volatile.bullets[0], /1 em 3 de chance/);
  assert.match(volatile.bullets[0], /ataque físico sem tipo de poder 40/);
  assert.match(volatile.bullets[0], /sem STAB, efetividade, crítico ou disputa adicional/);
  assert.match(volatile.bullets[0], /Sturdy, Focus Sash/);
  assert.match(volatile.bullets[1], /apenas a próxima ação da mesma rodada/);
  assert.match(volatile.bullets[1], /Trocar encerra o efeito/);
});

test("proportional attribute tests preserve every point without a hard cap", () => {
  const low = rollProportionalAttributeTest({ attribute: 10, random: sequence([0.5, 0.5]) });
  const high = rollProportionalAttributeTest({ attribute: 40, random: sequence([0.5, 0.5]) });
  assert.equal(low.diceTotal, high.diceTotal);
  assert.equal(low.total, low.diceTotal * 10);
  assert.equal(high.total, high.diceTotal * 40);
  assert.equal(high.total, low.total * 4);

  const advantage = rollProportionalAttributeTest({
    mode: "advantage",
    attribute: 25,
    random: sequence([0, 0.5, 0.999]),
  });
  assert.deepEqual(advantage.kept, [4, 6]);
  assert.equal(advantage.total, 250);
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
  assert.equal(getRpgScale(50), 5);
  assert.equal(getRpgScale(51), 5);
  assert.equal(getRpgScale(55), 5);
  assert.equal(getRpgScale(56), 6);
  assert.equal(getRpgScale(55, true), 6);
  assert.equal(getNextLevelXp(10), 5);
  assert.equal(getDamageCeiling(1), 1);
  assert.equal(getDamageCeiling(11), 11);
  assert.equal(getDamageCeiling(Infinity), 1);
});

test("XP goals floor the upcoming level consistently through both level caps", () => {
  for (const [level, goal] of [[1, 1], [2, 1], [9, 5], [10, 5], [11, 6], [99, 50], [100, 50], [199, 100], [200, 100], [999, 100]]) {
    assert.equal(getNextLevelXp(level), goal, `level ${level}`);
  }
  assert.equal(getNextLevelXp("10.9"), 5);
  assert.equal(getNextLevelXp(Infinity), 1);
  const rule = RPG_RULE_SECTIONS.flatMap(section => section.rules).find(rule => rule.id === "2.5");
  const wording = rule.bullets.join(" ");
  assert.match(wording, /XP recebida já é inteira/);
  assert.match(wording, /divisão padrão é igual, com resultado arredondado para baixo/);
  assert.match(wording, /contagem volta a zero/);
  assert.doesNotMatch(wording, /Meio ponto de XP é válido/);
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

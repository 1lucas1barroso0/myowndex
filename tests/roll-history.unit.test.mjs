import assert from "node:assert/strict";
import test from "node:test";
import {
  createRollRecord,
  MAX_ROLL_HISTORY,
  normalizeRollHistory,
  prependRollHistory,
} from "../src/core/rollHistory.js";

const entry = (id, sequence, result = 7) => createRollRecord({
  kind: "attribute",
  mode: "normal",
  label: "Teste",
  values: [3, 4],
  kept: [3, 4],
  result,
  detail: `Total ${result}`,
  context: "teste",
}, { id, sequence, createdAt: sequence });

test("completed rolls preserve an unambiguous identity, raw dice and selected dice", () => {
  const record = entry("roll-fixed", 8);
  assert.equal(record.id, "roll-fixed");
  assert.equal(record.sequence, 8);
  assert.deepEqual(record.values, [3, 4]);
  assert.deepEqual(record.kept, [3, 4]);
  assert.equal(record.result, 7);
});

test("history deduplicates repeated callbacks without mutating an earlier result", () => {
  const original = entry("same-roll", 1, 7);
  const first = prependRollHistory([], original, { id: original.id, sequence: 1, createdAt: 1 });
  const duplicate = prependRollHistory(first, { ...original, result: 12 }, { id: original.id, sequence: 1, createdAt: 1 });
  assert.equal(duplicate.length, 1);
  assert.equal(first[0].result, 7, "a later write must not mutate the completed record already held by the UI");
  assert.equal(duplicate[0].result, 7, "a duplicate callback cannot replace a completed roll retroactively");
});

test("corrupted values are discarded, legacy records migrate and history remains bounded", () => {
  const normalized = normalizeRollHistory([
    { sequence: 2, kind: "attribute", values: [null, "", 2, 5], kept: [2, 5], result: 7 },
    { sequence: 3, kind: "percent", values: [Infinity, 40], kept: [40], result: 40, chance: 50 },
  ]);
  assert.deepEqual(normalized[0].values, [2]);
  assert.deepEqual(normalized[1].values, [40]);
  assert.match(normalized[0].id, /^legacy-roll-/);

  let history = [];
  for (let sequence = 1; sequence <= MAX_ROLL_HISTORY + 8; sequence += 1) {
    history = prependRollHistory(history, entry(`roll-${sequence}`, sequence), {
      id: `roll-${sequence}`,
      sequence,
      createdAt: sequence,
    });
  }
  assert.equal(history.length, MAX_ROLL_HISTORY);
  assert.equal(history[0].id, `roll-${MAX_ROLL_HISTORY + 8}`);
});

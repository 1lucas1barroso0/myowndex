import assert from "node:assert/strict";
import test from "node:test";
import {
  VERSION_GROUPS,
  convertToTTRPG,
  filterMovesByLatestVersion,
  formatNumberPtBr,
  formatType,
  preferredLocalizedEntry,
} from "../src/core/mechanics.js";

const move = (name, groups) => ({
  move: { name, url: `https://pokeapi.co/api/v2/move/${name}` },
  version_group_details: groups.map(([group, method = "level-up", level = 1]) => ({
    level_learned_at: level,
    move_learn_method: { name: method },
    version_group: { name: group, url: `https://pokeapi.co/api/v2/version-group/${group}` },
  })),
});

test("lists current games from Champions through Red/Blue", () => {
  assert.equal(VERSION_GROUPS[1].value, "champions");
  assert.equal(VERSION_GROUPS.at(-1).value, "red-blue");
  assert.ok(VERSION_GROUPS.some(group => group.value === "mega-dimension"));
  assert.ok(VERSION_GROUPS.some(group => group.value === "legends-za"));
});

test("filters moves to one exact version group without old fallbacks", () => {
  const result = filterMovesByLatestVersion([
    move("old-only", [["red-blue"]]),
    move("current", [["red-blue"], ["champions", "machine", 0]]),
  ], "champions");
  assert.deepEqual(result.map(entry => entry.move.name), ["current"]);
  assert.equal(result[0].version_group, "champions");
});

test("uses the MyOwnDex tabletop half-down rounding rule", () => {
  assert.equal(convertToTTRPG(50), 2);
  assert.equal(convertToTTRPG(51), 2);
  assert.equal(convertToTTRPG(52), 3);
  assert.equal(convertToTTRPG(49), 2);
  assert.equal(convertToTTRPG(1, true), 1);
});

test("formats calculated values and type labels for Brazilian Portuguese", () => {
  assert.equal(formatNumberPtBr(5.5), "5,5");
  assert.equal(formatType("electric"), "Elétrico");
  assert.equal(formatType("fairy"), "Fada");
  assert.equal(preferredLocalizedEntry([
    { language: { name: "en" }, effect: "English" },
    { language: { name: "pt-br" }, effect: "Português" },
  ]).effect, "Português");
});

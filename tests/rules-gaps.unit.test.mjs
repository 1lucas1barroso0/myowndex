import assert from "node:assert/strict";
import test from "node:test";
import { applyMoveConsequences } from "../src/core/automation.js";
import { calculateMoveResolution } from "../src/core/room.js";

const sequence = values => {
    let index = 0;
    return () => {
        assert.ok(index < values.length, "only the expected dice may be consumed");
        return values[index++];
    };
};

const token = (id, specialStat) => ({
    id, name: id, level: 20, maxHp: 50, currentHp: 50, types: ["normal"],
    originalTypes: ["normal"], moves: ["ember"], pp: [25], status: "", stages: {},
    stats: { "special-attack": Math.floor(specialStat / 10), "special-defense": Math.floor(specialStat / 10) },
    originalStats: { "special-attack": specialStat, "special-defense": specialStat },
});

const ember = {
    name: "ember", power: 40, accuracy: 100, pp: 25,
    type: { name: "fire" }, damage_class: { name: "special" },
    target: { name: "selected-pokemon" },
    meta: { ailment: { name: "burn" }, ailment_chance: 50 }, stat_changes: [],
};

test("precision and secondary advantage share the kept-dice margin, independently of stat scale", () => {
    const cases = [
        { label: "winning attributes with lower dice", dice: [3, 4, 4, 4], attack: 200, defense: 20, advantage: false },
        { label: "winning attributes with tied dice", dice: [4, 4, 4, 4], attack: 200, defense: 20, advantage: false },
        { label: "one point in the kept dice", dice: [4, 4, 3, 4], attack: 200, defense: 20, advantage: false },
        { label: "two points and a won contest", dice: [5, 4, 3, 4], attack: 200, defense: 20, advantage: true },
        { label: "two points but a lost contest", dice: [5, 4, 3, 4], attack: 20, defense: 200, advantage: false },
    ];
    for (const scale of [1, 100]) {
        for (const item of cases) {
            const attacker = token("attacker", item.attack * scale);
            const defender = token("defender", item.defense * scale);
            const resolution = calculateMoveResolution({
                attacker, defender, move: ember,
                random: sequence([...item.dice.map(die => (die - 0.5) / 6), 0, ...(item.advantage ? [0] : [])]),
            });
            assert.equal(resolution.accuracyTest.rolls.length, item.advantage ? 2 : 1, `${item.label}: precision`);
            assert.equal(resolution.moveConnected, true);
            const outcome = applyMoveConsequences({
                tokens: [attacker, defender], attackerId: attacker.id, targetId: defender.id,
                move: ember, resolution, random: sequence(item.advantage ? [0.9, 0.1] : [0.9]),
            });
            assert.equal(outcome.consequences.statusRoll.rolls.length, item.advantage ? 2 : 1, `${item.label}: secondary`);
            assert.equal(outcome.consequences.appliedStatus, item.advantage ? "burn" : "", item.label);
        }
    }
});

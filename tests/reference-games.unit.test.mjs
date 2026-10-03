import assert from 'node:assert/strict';
import test from 'node:test';
import { getLearnsetGames, getMoveAtVersion, resolveLearnsetGame } from '../src/core/referenceGames.js';
import { filterMovesByLatestVersion } from '../src/core/mechanics.js';

const group = (name, id) => ({ name, url: `https://pokeapi.co/api/v2/version-group/${id}/` });
const learned = (name, version, method, level = 0) => ({ move: { name }, version_group_details: [{ version_group: version, move_learn_method: { name: method }, level_learned_at: level }] });

test('each offered game owns an actual learnset, with the latest available as default', () => {
    const red = group('red-blue', 1);
    const scarlet = group('scarlet-violet', 25);
    const moves = [learned('tackle', red, 'level-up', 1), learned('growl', scarlet, 'level-up', 1), learned('tackle', scarlet, 'machine')];
    assert.deepEqual(getLearnsetGames(moves).map(game => game.value), ['scarlet-violet', 'red-blue']);
    assert.equal(resolveLearnsetGame(moves), 'scarlet-violet');
    assert.deepEqual(filterMovesByLatestVersion(moves, 'red-blue').map(move => move.move.name), ['tackle']);
    assert.deepEqual(filterMovesByLatestVersion(moves, 'scarlet-violet').map(move => move.move.name), ['growl', 'tackle']);
    assert.deepEqual(getLearnsetGames([]), []);
});

test('Tackle retains official historical power and accuracy without mutating its current record', () => {
    const current = {
        name: 'tackle', power: 40, accuracy: 100, pp: 35, effect_entries: [],
        past_values: [
            { power: 35, accuracy: 95, pp: null, version_group: group('black-white', 11) },
            { power: 50, accuracy: null, pp: null, version_group: group('sun-moon', 17) },
        ],
        flavor_text_entries: [
            { flavor_text: 'Old physical attack.', version_group: group('red-blue', 1) },
            { flavor_text: 'Newest physical attack.', version_group: group('scarlet-violet', 25) },
        ],
    };
    const untouched = structuredClone(current);
    const old = getMoveAtVersion(current, 10);
    assert.equal(old.power, 35);
    assert.equal(old.accuracy, 95);
    assert.equal(old.pp, 35);
    assert.equal(old.flavor_text_entries[0].flavor_text, 'Old physical attack.');
    assert.equal(getMoveAtVersion(current, 11).power, 50);
    assert.equal(getMoveAtVersion(current, 17).power, 40);
    assert.equal(getMoveAtVersion(current, 'red-blue').power, 35);
    assert.equal(getMoveAtVersion(current, { value: 'red-blue' }).power, 35);
    assert.deepEqual(current, untouched);
});

test('historical effects and types are applied only before their recorded change', () => {
    const oldEffects = [{ effect: 'Old effect.' }];
    const move = { power: null, type: { name: 'fairy' }, effect_entries: [{ effect: 'Current effect.' }], past_values: [{ version_group: group('x-y', 15), type: { name: 'normal' }, effect_entries: oldEffects }] };
    const old = getMoveAtVersion(move, 14);
    assert.equal(old.type.name, 'normal');
    assert.deepEqual(old.effect_entries, oldEffects);
    assert.equal(getMoveAtVersion(move, 15).type.name, 'fairy');
    assert.equal(getMoveAtVersion(move, 0), move);
});

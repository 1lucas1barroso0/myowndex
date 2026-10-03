import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { getCurrentMoveReference } from '../src/core/championsMoves.js';
import { getMoveReferenceForMode } from '../src/core/referenceGames.js';
import { getSpecialMoveBlockReason } from '../src/core/specialMechanics.js';
import { changeRoomPhase, createRoomSnapshot, normalizeRoomSnapshot } from '../src/core/room.js';
import { resolveAuthoritativeAction } from '../server/authoritativeActions.js';

const random = { nextUint32: () => 2 };
const fixture = (name, target = 'selected-pokemon') => ({ name, pp: 10, power: 40, accuracy: 100,
    type: { name: 'normal' }, damage_class: { name: target === 'user' ? 'status' : 'special' },
    target: { name: target }, meta: { ailment: { name: 'none' }, drain: 0, healing: 0 }, stat_changes: [] });
const scene = name => normalizeRoomSnapshot({ ...createRoomSnapshot(), phase: 'batalha', round: 2, tokens: [
    { id: 'user', name: 'Parceiro', side: 'ally', level: 50, maxHp: 50, currentHp: 50,
        types: ['normal'], moves: [name, 'tackle'], pp: [null, 35], enteredRound: 1, activeMoveActions: 0,
        originalStats: { attack: 100, defense: 50, 'special-attack': 100, 'special-defense': 50, speed: 100 } },
    { id: 'target', name: 'Alvo', side: 'opponent', level: 50, maxHp: 100, currentHp: 100,
        types: ['normal'], moves: ['tackle'], originalStats: { attack: 10, defense: 10, 'special-attack': 10, 'special-defense': 10, speed: 10 } },
] });
const resolve = (move, snapshot = scene(move.name)) => resolveAuthoritativeAction({ snapshot, role: 'narrator', move, random,
    request: { action: 'combat', attackerId: 'user', defenderId: 'target', moveName: move.name, mode: 'normal' } });

test('current move deltas match the pinned catalogue and leave API data and English text intact', async () => {
    const catalogue = JSON.parse(await fs.readFile(new URL('../public/catalog/v1/move.json', import.meta.url), 'utf8'));
    const overrides = JSON.parse(await fs.readFile(new URL('../src/data/champions-move-overrides.json', import.meta.url), 'utf8'));
    const deltas = Object.entries(catalogue.entries).filter(([, entry]) => entry.battleData?.champions);
    assert.equal(deltas.length, 45);
    assert.deepEqual(overrides.moves, Object.fromEntries(deltas.map(([name, entry]) => [name, entry.battleData.champions])));
    const raw = { ...fixture('protect', 'user'), effect_entries: [{ language: { name: 'en' }, effect: 'Original official text.' }] };
    const old = structuredClone(raw);
    const current = getCurrentMoveReference(raw);
    assert.equal(current.pp, 5);
    assert.deepEqual(getCurrentMoveReference(current), current);
    assert.deepEqual(raw, old);
    assert.deepEqual(current.effect_entries, old.effect_entries);
    assert.equal(getMoveReferenceForMode(raw, { id: 1, value: 'red-blue' }, 'rpg').pp, 5);
    assert.equal(getMoveReferenceForMode(raw, { id: 25, value: 'scarlet-violet' }, 'game').pp, 10);
    assert.equal(getCurrentMoveReference(fixture('milk-drink')).target.name, 'user-or-ally');
});

test('the authoritative battle consumes current Protect PP even when the API still returns ten', () => {
    const result = resolve(fixture('protect', 'user'));
    assert.equal(result.nextSnapshot.tokens.find(token => token.id === 'user').pp[0], 4);
});

test('Make It Rain applies the verified two-stage self drop once for a spread attack', () => {
    const move = { ...fixture('make-it-rain', 'all-opponents'), power: 120, type: { name: 'steel' },
        stat_changes: [{ stat: { name: 'special-attack' }, change: -1 }] };
    const result = resolve(move);
    assert.equal(result.nextSnapshot.tokens.find(token => token.id === 'user').stages['special-attack'], -2);
    assert.equal(move.stat_changes[0].change, -1);
});

test('First Impression uses actual movement attempts since entry, survives persistence and resets for a new battle', () => {
    const move = getCurrentMoveReference(fixture('first-impression'));
    const snapshot = scene('first-impression');
    assert.equal(getSpecialMoveBlockReason({ move, attacker: snapshot.tokens[0], defender: snapshot.tokens[1], round: 2 }), '');
    const used = resolve(move, snapshot).nextSnapshot;
    assert.equal(used.tokens[0].activeMoveActions, 1);
    assert.equal(normalizeRoomSnapshot(JSON.parse(JSON.stringify(used))).tokens[0].activeMoveActions, 1);
    assert.match(getSpecialMoveBlockReason({ move, attacker: used.tokens[0], defender: used.tokens[1], round: 2 }), /primeiro movimento/);
    assert.equal(changeRoomPhase(changeRoomPhase(used, 'exploracao'), 'batalha').tokens[0].activeMoveActions, 0);
});

test('an attempted movement blocked by Sleep still prevents a later First Impression', () => {
    const snapshot = scene('tackle');
    snapshot.tokens[0].status = 'sleep'; snapshot.tokens[0].sleepTurns = 1;
    const result = resolve(fixture('tackle'), snapshot);
    assert.equal(result.result.blockedByCondition, true);
    assert.equal(result.nextSnapshot.tokens[0].activeMoveActions, 1);
});

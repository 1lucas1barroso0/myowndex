import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { getCurrentMoveReference } from '../src/core/championsMoves.js';
import { getMoveReferenceForMode } from '../src/core/referenceGames.js';
import { getSpecialMoveBlockReason } from '../src/core/specialMechanics.js';
import { moveLearnMethodLabel, isOrdinaryLevelUpMove } from '../src/core/moveLearnMethods.js';
import { applyMoveConsequences } from '../src/core/automation.js';

test('a source callback change blocks unattended refresh before changing any pin', () => {
    const result = spawnSync('python3', ['-c', `
import importlib.util, json, pathlib, sys, tempfile
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('refresh', 'scripts/atualizar-dados.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    module.ROOT = pathlib.Path(directory)
    (module.ROOT / 'scripts').mkdir()
    source = "SHOWDOWN_PIN = '" + 'a' * 40 + "'\\n"
    script = module.ROOT / 'scripts/atualizar-catalogo-bilingue.py'
    script.write_text(source)
    args = ['refresh', '--pokeapi', 'b' * 40, '--showdown', 'c' * 40, '--go', 'd' * 40]
    response = json.dumps({'files': [{'filename': 'data/mods/champions/abilities.ts'}]}).encode()
    with patch.object(sys, 'argv', args), patch.object(module, 'download', return_value=response):
        try:
            module.main()
        except RuntimeError as error:
            assert 'implementation review required' in str(error)
        else:
            raise AssertionError('An unaudited behavior change was accepted')
    assert script.read_text() == source
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('announced December changes retain their source, scope and pre-patch runtime values', async () => {
    const manifest = JSON.parse(await readFile(new URL('../docs/pending-game-updates.json', import.meta.url), 'utf8'));
    const patch = manifest.updates.find(value => value.id === 'champions-2026-12-02');
    if (patch.status !== 'announced') return; // Activation replaces this regression with the confirmed patch tests.
    assert.equal(patch.effectiveAt, null);
    assert.equal(patch.scheduledMaintenanceDate, '2026-12-02');
    assert.equal(patch.learnsetAdditions['psych-up'].length, 22);
    assert.equal(patch.learnsetAdditions['play-rough'].length, 7);
    for (const [name, delta] of Object.entries(patch.moves)) {
        const raw = { name, accuracy: delta.accuracy.before, meta: { flinch_chance: name === 'rock-slide' ? 30 : 0 } };
        const current = getCurrentMoveReference(raw);
        assert.equal(current.accuracy, delta.accuracy.before);
        assert.equal(getMoveReferenceForMode(raw, 'scarlet-violet', 'game').accuracy, delta.accuracy.before);
        assert.deepEqual(raw.meta, current.meta);
    }
});

test('Last Resort fails as the sole move, and succeeds only after the other move was used', () => {
    const move = { name: 'last-resort' };
    assert.match(getSpecialMoveBlockReason({ move, attacker: { moves: ['last-resort'] } }), /outros movimentos/);
    assert.match(getSpecialMoveBlockReason({ move, attacker: { moves: ['last-resort', 'tackle'] } }), /outros movimentos/);
    assert.equal(getSpecialMoveBlockReason({ move, attacker: { moves: ['last-resort', 'tackle'], specialState: { history: [{ moveName: 'tackle' }] } } }), '');
});

test('explicit Champions has current PP even before the fetched prose catalogue is loaded', () => {
    const move = { name: 'protect', pp: 10, accuracy: null };
    assert.equal(getMoveReferenceForMode(move, 'champions', 'game').pp, 5);
    assert.equal(getMoveReferenceForMode(move, 'scarlet-violet', 'game').pp, 10);
    assert.equal(move.pp, 10);
});

test('Struggle still causes fixed recoil after a connected zero-damage hit, but not after a miss', () => {
    const tokens = ['user', 'target'].map(id => ({ id, name: id, currentHp: 100, maxHp: 100, moves: ['struggle'] }));
    const move = { name: 'struggle', meta: { drain: -25 } };
    const resolve = (hit, name = 'struggle') => applyMoveConsequences({ tokens, attackerId: 'user', defenderId: 'target',
        move: { ...move, name }, resolution: { hit, damage: 0 }, random: { nextUint32: () => 2 }, consumePp: false });
    assert.equal(resolve(true).tokens.find(token => token.id === 'user').currentHp, 75);
    assert.equal(resolve(false).tokens.find(token => token.id === 'user').currentHp, 100);
    assert.equal(resolve(true, 'take-down').tokens.find(token => token.id === 'user').currentHp, 100);
    assert.equal(tokens[0].currentHp, 100);
});

test('the newly catalogued reminder method does not grant automatic level-up moves', () => {
    const detail = { move_learn_method: { name: 'reminder' }, level_learned_at: 0 };
    assert.equal(moveLearnMethodLabel(detail), 'Relembrar movimento');
    assert.equal(isOrdinaryLevelUpMove(detail, 100), false);
});

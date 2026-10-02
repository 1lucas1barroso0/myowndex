import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import entries from '../src/data/pokedex-entries.json' with { type: 'json' };
import proof from '../docs/pokedex-entries-provenance.json' with { type: 'json' };
import { getPokedexRecord } from '../src/core/pokedexRecord.js';

test('every National Pokédex species has a real paired English and Portuguese entry with provenance', () => {
    assert.deepEqual(Object.keys(entries).map(Number), Array.from({ length: 1025 }, (_, index) => index + 1));
    const count = { 'official-localization': 0, editorial: 0 };
    for (const [id, entry] of Object.entries(entries)) {
        for (const language of ['en', 'pt']) {
            assert.ok(entry[language].trim().length > 20, `${id}: missing ${language}`);
            assert.doesNotMatch(entry[language], /RESOURCE ID:|\{[A-Za-z]|<[^>]+>/, `${id}: source artifacts`);
        }
        assert.notEqual(entry.en, entry.pt, `${id}: original cannot masquerade as a translation`);
        assert.ok(entry.resourceId);
        assert.ok(Object.hasOwn(count, entry.sourceKind));
        count[entry.sourceKind]++;
        if (entry.sourceKind === 'editorial') assert.equal(entry.version, 'scarlet');
    }
    assert.equal(count['official-localization'], proof.officialLocalizedPairs);
    assert.equal(count.editorial, proof.editorialLocalizedPairs);
    assert.equal(createHash('sha256').update(readFileSync(new URL('../src/data/pokedex-entries.json', import.meta.url))).digest('hex'), proof.output.sha256);
});

test('record selection uses both texts from the same source and preserves English names without mutating the catalogue', () => {
    const before = JSON.stringify(entries);
    for (const id of Object.keys(entries)) {
        const record = getPokedexRecord(id, entries, { text: 'Unrelated old game entry', code: 'en' });
        assert.ok(record.original && record.portuguese);
        assert.equal(record.originalLanguage, 'en');
        assert.notEqual(record.original, 'Unrelated old game entry');
        assert.doesNotMatch(record.original + record.portuguese, /\b\d+\s*\/\s*\d+\b|[¼½¾⅓⅔⅛⅜⅝⅞]/);
    }
    assert.match(getPokedexRecord(1007, entries).portuguese, /Winged King/);
    assert.match(getPokedexRecord(1008, entries).portuguese, /Iron Serpent/);
    assert.match(getPokedexRecord(1010, entries).portuguese, /Virizion/);
    assert.match(getPokedexRecord(1025, entries).portuguese, /Pecharunt/);
    assert.equal(JSON.stringify(entries), before);
});

test('Gimmighoul pairs follow its actual form and future unsupported species keep the original without inventing a translation', () => {
    const chest = getPokedexRecord(999, entries, {}, 'gimmighoul');
    const roaming = getPokedexRecord(999, entries, {}, 'gimmighoul-roaming');
    assert.equal(chest.sourceKind, 'editorial');
    assert.match(chest.original, /1,500 years/);
    assert.match(chest.portuguese, /1\.500 anos/);
    assert.equal(roaming.sourceKind, 'official-localization');
    assert.match(roaming.original, /wanders/);
    assert.notEqual(chest.original, roaming.original);
    assert.deepEqual(getPokedexRecord(9999, entries, { text: '  A new Pokémon.\n', code: 'en' }), {
        original: 'A new Pokémon.', originalLanguage: 'en', portuguese: '', source: null, version: null, sourceKind: null,
    });
});

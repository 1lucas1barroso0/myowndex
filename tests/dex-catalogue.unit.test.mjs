import assert from 'node:assert/strict';
import test from 'node:test';
import species from '../src/data/species.json' with { type: 'json' };
import forms from '../src/data/forms.json' with { type: 'json' };
import metadata from '../src/data/generator-species.json' with { type: 'json' };
import { buildDexCatalogue, findDexCatalogueChoice } from '../src/core/dexCatalogue.js';
import { dexEntryFavoriteKey, dexEntryFavoriteKeys, selectDexSpecies } from '../src/core/dexCollection.js';
import { getGeneratorDexEntryGroups, getGeneratorRandomCandidates, getGeneratorSpeciesPool } from '../src/core/pokemonGenerator.js';

const catalogue = buildDexCatalogue(species, forms, metadata);

test('the separated catalogue has exactly one row for each real encounter identity', () => {
    assert.equal(catalogue.filter(entry => entry.isPrimarySpecies).length, 1025);
    assert.equal(selectDexSpecies(catalogue).length, 1025);
    assert.equal(selectDexSpecies(catalogue, { variantMode: 'separate' }).length, catalogue.length);
    assert.equal(new Set(catalogue.map(entry => entry.formKey || entry.pokemonName)).size, catalogue.length);
    const bySpecies = id => catalogue.filter(entry => entry.speciesId === id).map(entry => entry.formKey || entry.pokemonName);
    assert.deepEqual(bySpecies(413), ['wormadam-plant', 'wormadam-sandy', 'wormadam-trash']);
    assert.deepEqual(bySpecies(849), ['toxtricity-amped', 'toxtricity-low-key']);
    assert.deepEqual(bySpecies(892), ['urshifu-single-strike', 'urshifu-rapid-strike']);
    assert.deepEqual(bySpecies(876), ['indeedee-male', 'indeedee-female']);
    assert.deepEqual(bySpecies(925), ['maushold'], 'cosmetic family size remains grouped');
    assert.deepEqual(bySpecies(869), ['alcremie'], 'cosmetic finishes do not receive encounter rows');
});

test('a named original retains its canonical resource while both original and old form favorites remain valid', () => {
    const original = catalogue.find(entry => entry.speciesId === 892 && entry.isPrimarySpecies);
    assert.equal(original.name, 'urshifu');
    assert.equal(original.pokemonName, 'urshifu-single-strike');
    assert.equal(original.formId, 892);
    assert.equal(original.choiceKey, 'species:892');
    assert.equal(dexEntryFavoriteKey(original), '892');
    assert.deepEqual(dexEntryFavoriteKeys(original), ['892', 'form:urshifu-single-strike']);
    for (const favorite of dexEntryFavoriteKeys(original)) {
        assert.deepEqual(selectDexSpecies(catalogue, { favorites: [favorite], onlyFavorites: true }).map(entry => entry.formKey), ['urshifu-single-strike']);
    }
    assert.deepEqual(selectDexSpecies(catalogue, { favorites: ['form:urshifu-rapid-strike'], onlyFavorites: true }).map(entry => entry.formKey), ['urshifu-rapid-strike']);
    assert.equal(findDexCatalogueChoice(catalogue, 'species:892'), original);
    assert.equal(findDexCatalogueChoice(catalogue, 'form:urshifu-single-strike'), original);
    assert.equal(getGeneratorSpeciesPool(catalogue, { speciesId: 892 }, null, metadata)[0].formKey, original.formKey);
    assert.equal(getGeneratorSpeciesPool(catalogue, { speciesId: 892, formKey: 'urshifu-single-strike' }, null, metadata)[0].pokemonName, original.pokemonName);
});

test('the Generator draws each original form once and preserves one ticket per National entry', () => {
    const pool = getGeneratorSpeciesPool(catalogue, {}, null, metadata);
    assert.equal(getGeneratorDexEntryGroups(pool).length, 1025);
    const toxtricity = pool.filter(entry => entry.speciesId === 849);
    assert.equal(toxtricity.length, 2, 'the original must not receive a second position in the form draw');
    assert.equal(getGeneratorRandomCandidates(toxtricity, () => 0)[0].formKey, 'toxtricity-amped');
    assert.equal(getGeneratorRandomCandidates(toxtricity, () => 0.999)[0].formKey, 'toxtricity-low-key');
    const later = getGeneratorSpeciesPool(catalogue, { generation: 7, type: 'dark' }, null, metadata);
    assert.ok(later.some(entry => entry.formKey === 'rattata-alola'));
    assert.ok(!later.some(entry => entry.speciesId === 19 && entry.isPrimarySpecies));
});

test('building the shared catalogue never changes the bundled species or accepted form classification', () => {
    const before = JSON.stringify({ species, forms, metadata });
    const rebuilt = buildDexCatalogue(species, forms, metadata);
    assert.deepEqual(rebuilt, catalogue);
    assert.equal(JSON.stringify({ species, forms, metadata }), before);
    assert.equal(catalogue.filter(entry => entry.isPrimarySpecies && entry.formKey).length, 14);
    assert.ok(!catalogue.some(entry => entry.formKey === 'rotom-wash'));
    assert.ok(!catalogue.some(entry => entry.formKey === 'pikachu-alola-cap'));
    assert.deepEqual(buildDexCatalogue(null), []);
});

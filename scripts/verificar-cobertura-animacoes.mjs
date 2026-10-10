#!/usr/bin/env node
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import nativeSprites from '../src/data/native-sprites.json' with { type: 'json' };
import snapshot from '../src/data/native-sprite-coverage.json' with { type: 'json' };
import species from '../src/data/species.json' with { type: 'json' };
import forms from '../src/data/forms.json' with { type: 'json' };
import { buildDexCatalogue } from '../src/core/dexCatalogue.js';
import { getPokemonSpriteSources, isPokemonSpriteSource2D } from '../src/core/pokemonSpriteSources.js';

const front = (key, view = '') => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${view ? `${view}/` : ''}${key}.png`;
const missingResources = [];
const missingStaticResources = [];
for (const [id, name] of Object.entries(nativeSprites.pokemonResources)) for (const view of ['', 'shiny', 'back', 'back/shiny']) {
    const choices = getPokemonSpriteSources({ pokemonId: Number(id), src: front(id, view) });
    assert.ok([...choices.animated, ...choices.static].every(isPokemonSpriteSource2D), `${id}/${view}: unverified art`);
    if (!choices.animated.length) missingResources.push({ id, name, view });
    if (!choices.static.length) missingStaticResources.push({ id, name, view });
}
const missingForms = [];
const missingStaticForms = [];
for (const [formId, key] of Object.entries(nativeSprites.formKeys)) for (const view of ['', 'shiny']) {
    const choices = getPokemonSpriteSources({ spriteKey: key, src: front(`forms/${view ? `${view}/` : ''}${formId}`) });
    assert.ok([...choices.animated, ...choices.static].every(isPokemonSpriteSource2D), `${formId}/${view}: unverified art`);
    if (!choices.animated.length) missingForms.push({ formId, key, view });
    if (!choices.static.length) missingStaticForms.push({ formId, key, view });
}
const catalogue = buildDexCatalogue(species, forms);
const missingDex = [];
for (const entry of catalogue) for (const shiny of [false, true]) {
    if (!getPokemonSpriteSources({ pokemonId: entry.pokemonId, spriteKey: entry.spriteKey, shiny }).animated.length) missingDex.push({ id: entry.pokemonId, name: entry.name, shiny });
}
const record = {
    schemaVersion: 2,
    artPolicy: 'verified-authored-2d-only',
    catalogueCommit: nativeSprites.catalogueCommit,
    nationalSpecies: species.length,
    dexEntries: catalogue.length,
    pokemonResources: Object.keys(nativeSprites.pokemonResources).length,
    formIds: Object.keys(nativeSprites.formKeys).length,
    missingResources,
    missingForms,
    missingDex,
    resourceCombinations: Object.keys(nativeSprites.pokemonResources).length * 4,
    animatedResourceCombinations: Object.keys(nativeSprites.pokemonResources).length * 4 - missingResources.length,
    formCombinations: Object.keys(nativeSprites.formKeys).length * 2,
    animatedFormCombinations: Object.keys(nativeSprites.formKeys).length * 2 - missingForms.length,
    missingStaticResources,
    missingStaticForms,
};
assert.deepEqual(missingDex, [], 'Every exposed Dex choice must retain exact animation in both palettes');
if (process.argv.includes('--write')) await writeFile(new URL('../src/data/native-sprite-coverage.json', import.meta.url), `${JSON.stringify(record, null, 2)}\n`);
else assert.deepEqual(record, snapshot, 'Animation coverage changed; inspect identities before updating the snapshot');
console.log(`Audited verified authored 2D for ${record.pokemonResources} Pokémon resources and ${record.formIds} form identities; ${missingResources.length} technical angle/palette gaps, ${missingForms.length} form angle/palette gaps, ${missingDex.length} exposed Dex gaps.`);

import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePokemon, getGeneratorSpeciesPool, normalizeGeneratorOptions } from '../src/core/pokemonGenerator.js';
import { getPokemonRecordForms } from '../src/core/pokemonRecordForms.js';
import { STAT_KEYS } from '../src/core/team.js';
import { decodeShare, encodePokemonBundle } from '../src/core/teamShare.js';

const API = 'https://pokeapi.co/api/v2/';
const fixture = (name, id, formKey, selectedType, { game = 'scarlet-violet' } = {}) => {
    const choice = getPokemonRecordForms({ name, id }).find(form => form.formKey === formKey);
    const entry = { name, speciesId: id, pokemonId: id, pokemonName: name, isPrimarySpecies: true, types: [name === 'alcremie' ? 'fairy' : 'normal'], url: `${API}pokemon-species/${id}/` };
    const pokemon = { name, id, species: { name, url: entry.url }, types: [{ slot: 1, type: { name: entry.types[0] } }], sprites: { front_default: `${name}-base.png` }, stats: STAT_KEYS.map(stat => ({ stat: { name: stat }, base_stat: 100 })), abilities: [{ slot: 1, is_hidden: false, ability: { name: 'test-ability' } }], moves: [{ move: { name: 'tackle', url: `${API}move/tackle/` }, version_group_details: [{ level_learned_at: 1, move_learn_method: { name: 'level-up' }, version_group: { name: game, url: `${API}version-group/${game === 'platinum' ? 9 : 25}/` } }] }] };
    const appearance = { id: choice.formId, pokemon: { name }, types: [{ slot: 1, type: { name: selectedType } }], sprites: { front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/forms/${choice.formId}.png`, front_shiny: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/forms/shiny/${choice.formId}.png` } };
    const fetcher = async url => {
        if (url === entry.url) return { id, name, gender_rate: -1, base_happiness: 50, varieties: [{ is_default: true, pokemon: { name, url: `${API}pokemon/${id}/` } }] };
        if (url === `${API}pokemon/${id}/`) return pokemon;
        if (url === choice.url) return appearance;
        if (url === `${API}move/tackle/`) return { name: 'tackle', pp: 35 };
        if (url === `${API}version-group/${game}/`) return { id: game === 'platinum' ? 9 : 25, generation: { url: `${API}generation/${game === 'platinum' ? 4 : 9}/` } };
        throw new Error(`Unexpected fixture request: ${url}`);
    };
    return { entry, choice, appearance, fetcher };
};

test('exact Alcremie appearance is preserved for a single Pokémon or full team and in portable codes', async () => {
    const { entry, choice, appearance, fetcher } = fixture('alcremie', 869, 'alcremie-rainbow-swirl-star-sweet', 'fairy');
    for (const count of [1, 6]) {
        const generated = await generatePokemon([entry], { speciesId: 869, appearanceFormId: choice.formId, count, shiny: true, versionGroup: 'scarlet-violet' }, { fetcher, random: () => 0 });
        assert.equal(generated.length, count);
        assert.equal(new Set(generated.map(result => result.pokemon.id)).size, count);
        for (const result of generated) {
            assert.equal(result.pokemon.formId, choice.formId);
            assert.equal(result.pokemon.formKey, choice.formKey);
            assert.equal(result.pokemon.species.sprites.front_default, appearance.sprites.front_default);
            assert.equal(result.pokemon.species.sprites.front_shiny, appearance.sprites.front_shiny);
            assert.equal(result.pokemon.shiny, true);
        }
        const restored = await decodeShare(await encodePokemonBundle(generated.map(result => result.pokemon), { versionGroup: 'scarlet-violet' }));
        assert.ok(restored.pokemon.every(pokemon => pokemon.formId === choice.formId && pokemon.formKey === choice.formKey));
    }
});

test('explicit Arceus/Silvally appearances set the actual type and Tera default', async () => {
    for (const [name, id, formKey, selectedType] of [['arceus', 493, 'arceus-fire', 'fire'], ['silvally', 773, 'silvally-water', 'water']]) {
        const { entry, choice, fetcher } = fixture(name, id, formKey, selectedType);
        const generated = await generatePokemon([entry], { speciesId: id, appearanceFormId: choice.formId, versionGroup: 'scarlet-violet' }, { fetcher, random: () => 0 });
        assert.equal(generated[0].pokemon.species.types[0].type.name, selectedType);
        assert.equal(generated[0].pokemon.teraType, selectedType);
    }
});

test('an appearance cannot be assigned to another species or introduced before its game', async () => {
    const alcremie = fixture('alcremie', 869, 'alcremie-rainbow-swirl-star-sweet', 'fairy');
    await assert.rejects(generatePokemon([alcremie.entry], { speciesId: 869, appearanceFormId: 10001 }, { fetcher: alcremie.fetcher }), /aparência disponível/);
    const arceus = fixture('arceus', 493, 'arceus-fairy', 'fairy', { game: 'platinum' });
    await assert.rejects(generatePokemon([arceus.entry], { speciesId: 493, appearanceFormId: arceus.choice.formId, versionGroup: 'platinum', experienceMode: 'game' }, { fetcher: arceus.fetcher }), /ainda não existia/);
});

test('appearance choices never add random tickets or leak into a later random encounter', () => {
    const { entry, choice } = fixture('alcremie', 869, 'alcremie-rainbow-swirl-star-sweet', 'fairy');
    assert.deepEqual(getGeneratorSpeciesPool([entry], { speciesId: 869, appearanceFormId: choice.formId }), getGeneratorSpeciesPool([entry], { speciesId: 869 }));
    assert.equal(normalizeGeneratorOptions({ speciesId: 0, appearanceFormId: choice.formId }).appearanceFormId, 0);
    assert.equal(normalizeGeneratorOptions({ speciesId: 869, appearanceFormId: '../10001' }).appearanceFormId, 0);
});

test('explicit Arceus/Silvally appearances are filtered by their actual types after loading', async () => {
    for (const [name, id, formKey, selectedType] of [['arceus', 493, 'arceus-fire', 'fire'], ['silvally', 773, 'silvally-water', 'water']]) {
        const { entry, choice, fetcher } = fixture(name, id, formKey, selectedType);
        const options = { speciesId: id, appearanceFormId: choice.formId, type: selectedType, versionGroup: 'scarlet-violet' };
        assert.equal(getGeneratorSpeciesPool([entry], options, new Set()).length, 1, 'base Normal typing and a stale type index cannot discard a chosen form');
        const generated = await generatePokemon([entry], options, { fetcher, random: () => 0 });
        assert.equal(generated[0].pokemon.species.types[0].type.name, selectedType);
        await assert.rejects(generatePokemon([entry], { ...options, type: selectedType === 'fire' ? 'water' : 'fire' }, { fetcher, random: () => 0 }), /aparência não tem o tipo escolhido/);
        assert.deepEqual(getGeneratorSpeciesPool([entry], { type: selectedType }), [], 'the existing random pool still applies pinned types');
    }
});

test('explicit Fire Arceus keeps Fire when the selected reference is a historical game', async () => {
    const { entry, choice, fetcher } = fixture('arceus', 493, 'arceus-fire', 'fire', { game: 'platinum' });
    const generated = await generatePokemon([entry], { speciesId: 493, appearanceFormId: choice.formId, type: 'fire', versionGroup: 'platinum', experienceMode: 'game' }, { fetcher, random: () => 0 });
    assert.equal(generated[0].pokemon.species.types[0].type.name, 'fire');
    assert.equal(generated[0].pokemon.formKey, 'arceus-fire');
    assert.equal(generated[0].versionGroup, 'platinum');
});

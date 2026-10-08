import assert from 'node:assert/strict';
import test from 'node:test';
import forms from '../src/data/forms.json' with { type: 'json' };
import { applyRecordAppearance, getPokemonRecordForms, getRecordFormLabel } from '../src/core/pokemonRecordForms.js';
import { compactPokemon, hydratePokemon, mergeHydratedTeams, normalizePokemon, normalizeTeam } from '../src/core/team.js';
import { clearApiCache } from '../src/core/mechanics.js';

const catalogue = [...forms.defaults, ...forms.entries];
const resource = name => ({ id: catalogue.find(form => form.pokemonName === name)?.pokemonId, name, forms: [] });
const type = name => ({ slot: 1, type: { name, url: `https://pokeapi.co/api/v2/type/${name}/` } });

test('all pinned forms can be consulted inside their exact Pokémon resource', () => {
    for (const name of new Set(catalogue.map(form => form.pokemonName))) {
        const expected = catalogue.filter(form => form.pokemonName === name);
        const actual = getPokemonRecordForms(resource(name));
        assert.equal(actual.length, expected.length, name);
        for (const form of expected) {
            const choice = actual.find(item => item.formId === form.formId);
            assert.equal(choice?.formKey, form.name);
            assert.equal(choice?.spriteKey, form.spriteKey);
            assert.equal(choice?.pokemonName, name);
            assert.ok(choice?.label && !choice.label.includes('undefined'), form.name);
        }
    }
});

test('cosmetic collections remain complete without extra Dex rows', () => {
    for (const [name, count] of [['unown', 28], ['burmy', 3], ['vivillon', 20], ['alcremie', 63], ['deerling', 4], ['flabebe', 5]]) {
        const choices = getPokemonRecordForms(resource(name));
        assert.equal(choices.length, count, name);
        assert.equal(new Set(choices.map(choice => choice.formId)).size, count);
        assert.equal(new Set(choices.map(choice => choice.label)).size, count);
    }
});

test('the API adds uncatalogued reversible appearances and duplicate endpoints only appear once', () => {
    const pokemon = { id: 1, name: 'future-pokemon', forms: [
        { name: 'future-pokemon', url: 'https://pokeapi.co/api/v2/pokemon-form/1/' },
        { name: 'future-pokemon-summer', url: 'https://pokeapi.co/api/v2/pokemon-form/11001/' },
        { name: 'duplicate', url: 'https://pokeapi.co/api/v2/pokemon-form/11001' },
        { name: 'invalid', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
    ] };
    const choices = getPokemonRecordForms(pokemon);
    assert.equal(choices.length, 2);
    assert.equal(choices[0].label, 'Forma base');
    assert.equal(choices[1].formKey, 'future-pokemon-summer');
    assert.equal(choices[1].spriteKey, ''); // Never guess another form's sprite.
});

test('older API caches recover named cosmetics from the pinned catalogue', () => {
    const pokemon = { ...resource('unown'), forms: [{ name: 'unown', url: 'https://pokeapi.co/api/v2/pokemon-form/201/' }] };
    const choices = getPokemonRecordForms(pokemon);
    assert.equal(choices.length, 28);
    assert.equal(choices[0].formKey, 'unown-a');
    assert.equal(choices[0].label, 'Letra A');
    assert.equal(choices.find(form => form.formKey === 'unown-question').label, '?');
    assert.equal(getRecordFormLabel('alcremie-rainbow-swirl-star-sweet', 'alcremie'), 'Espiral arco-íris · Estrela');
});

test('Arceus and Silvally apply the exact appearance type without changing moves or stats', () => {
    for (const [name, id, selectedType] of [['arceus', 493, 'fire'], ['silvally', 773, 'water']]) {
        const pokemon = { name, id, types: [type('normal')], moves: [{ move: { name: 'tackle' } }], stats: [{ base_stat: 120 }], sprites: { front_default: `${id}.png`, back_default: 'back.png' } };
        const appearance = { pokemon: { name }, types: [type(selectedType)], sprites: { front_default: `forms/${id}-${selectedType}.png`, back_default: null } };
        const displayed = applyRecordAppearance(pokemon, appearance);
        assert.equal(displayed.types[0].type.name, selectedType);
        assert.equal(displayed.sprites.front_default, appearance.sprites.front_default);
        assert.equal(displayed.sprites.back_default, 'back.png');
        assert.equal(displayed.moves, pokemon.moves);
        assert.equal(displayed.stats, pokemon.stats);
        assert.equal(pokemon.types[0].type.name, 'normal');
    }
});

test('a late response for a different Pokémon cannot alter the current record', () => {
    const pokemon = { name: 'vivillon', types: [type('bug')], sprites: { front_default: 'vivillon.png' } };
    assert.equal(applyRecordAppearance(pokemon, { pokemon: { name: 'arceus' }, types: [type('fire')] }), pokemon);
    assert.equal(applyRecordAppearance(pokemon, null), pokemon);
    assert.deepEqual(getPokemonRecordForms(null), []);
});

test('adding a consulted cosmetic keeps the form ID, name and exact portrait in its new individual', () => {
    const choice = getPokemonRecordForms(resource('alcremie')).find(form => form.formKey === 'alcremie-rainbow-swirl-star-sweet');
    const appearance = { id: choice.formId, pokemon: { name: 'alcremie' }, types: [type('fairy')], sprites: { front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/forms/${choice.formId}.png` } };
    const data = applyRecordAppearance({ id: 869, name: 'alcremie', sprites: {}, stats: [], moves: [] }, appearance);
    const pokemon = normalizePokemon({ species: data, formId: choice.formId, formKey: choice.formKey });
    assert.equal(pokemon.formId, choice.formId);
    assert.equal(pokemon.formKey, choice.formKey);
    assert.equal(pokemon.species.sprites.front_default, appearance.sprites.front_default);
    assert.equal(pokemon.species.types[0].type.name, 'fairy');
});

test('compacting and rehydrating saved forms preserves Arceus/Silvally types and cosmetic identity', async t => {
    const previousFetch = globalThis.fetch;
    await clearApiCache();
    const fixture = new Map();
    const partners = [['arceus', 'arceus-fire', 'fire'], ['silvally', 'silvally-water', 'water'], ['alcremie', 'alcremie-rainbow-swirl-star-sweet', 'fairy']].map(([name, formKey, selectedType]) => {
        const choice = getPokemonRecordForms(resource(name)).find(form => form.formKey === formKey);
        const current = { id: choice.pokemonId, name, species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${choice.pokemonId}/` }, stats: [{ stat: { name: 'hp' }, base_stat: 100 }], types: [type(name === 'alcremie' ? 'fairy' : 'normal')], moves: [], sprites: { front_default: `${name}-base.png` } };
        const appearance = { id: choice.formId, pokemon: { name }, types: [type(selectedType)], sprites: { front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/forms/${choice.formId}.png` } };
        fixture.set(`https://pokeapi.co/api/v2/pokemon/${name}`, current);
        fixture.set(current.species.url, { gender_rate: -1 });
        fixture.set(choice.url, appearance);
        return compactPokemon({ id: formKey, species: applyRecordAppearance(current, appearance), formId: choice.formId, formKey, nickname: 'Minha escolha', level: 20, rpg: { scaleVersion: 2, currentHp: 3, xp: 4, pp: [2] } });
    });
    globalThis.fetch = async url => fixture.has(String(url)) ? Response.json(fixture.get(String(url))) : new Response('Not found', { status: 404 });
    t.after(async () => { await clearApiCache(); globalThis.fetch = previousFetch; });
    for (const partner of JSON.parse(JSON.stringify(partners))) {
        const hydrated = await hydratePokemon(partner);
        assert.equal(hydrated.formId, partner.formId);
        assert.equal(hydrated.formKey, partner.formKey);
        assert.equal(hydrated.species.types[0].type.name, partner.species.types[0].type.name);
        assert.equal(hydrated.species.sprites.front_default, partner.species.sprites.front_default);
        assert.equal(hydrated.rpg.currentHp, 3);
        assert.equal(hydrated.rpg.xp, 4);
        assert.equal(hydrated.rpg.pp[0], 2);
        assert.equal(hydrated.nickname, 'Minha escolha');
    }
    // The current resource still loads when its optional form endpoint fails.
    await clearApiCache();
    for (const partner of partners) fixture.delete(`https://pokeapi.co/api/v2/pokemon-form/${partner.formId}/`);
    for (const partner of partners) {
        const hydrated = await hydratePokemon(partner);
        assert.equal(hydrated.species.types[0].type.name, partner.species.types[0].type.name);
        assert.equal(hydrated.species.sprites.front_default, partner.species.sprites.front_default);
    }
});

test('a pending appearance refresh cannot overwrite a different cosmetic choice made on the same resource', () => {
    const current = normalizeTeam({ id: 'box', pokemon: [{ id: 'individual', species: { id: 201, name: 'unown', sprites: { front_default: 'c.png' } }, formId: 10002, formKey: 'unown-c' }] });
    const previous = { ...current, pokemon: current.pokemon.map(partner => ({ ...partner, formId: 10001, formKey: 'unown-b', species: { ...partner.species, sprites: { front_default: 'b.png' } } })) };
    const merged = mergeHydratedTeams([current], [previous]);
    assert.equal(merged[0].pokemon[0], current.pokemon[0]);
    assert.equal(merged[0].pokemon[0].species.sprites.front_default, 'c.png');
});

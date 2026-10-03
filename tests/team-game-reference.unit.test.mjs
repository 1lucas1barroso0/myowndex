import assert from 'node:assert/strict';
import test from 'node:test';
import { apiCache, clearApiCache, STAT_MAP } from '../src/core/mechanics.js';
import { compactPokemon, hydratePokemon, hydrateTeam, mergeHydratedTeams, normalizeTeam } from '../src/core/team.js';
import { getPokemonAtGeneration, getPokemonReferenceForMode } from '../src/core/referenceGames.js';
import { createTokenFromPokemon } from '../src/core/room.js';

const API = 'https://pokeapi.co/api/v2/';
const generation = number => ({ url: `${API}generation/${number}/` });
const baseStats = values => Object.keys(STAT_MAP).map((name, index) => ({ stat: { name }, base_stat: values[index] }));
const fixtures = {
    clefairy: {
        id: 35, name: 'clefairy', species: { name: 'clefairy', url: `${API}pokemon-species/35/` },
        stats: baseStats([70, 45, 48, 60, 65, 35]), types: [{ slot: 1, type: { name: 'fairy' } }],
        abilities: [{ slot: 1, ability: { name: 'cute-charm' }, is_hidden: false }],
        past_types: [{ generation: generation(5), types: [{ slot: 1, type: { name: 'normal' } }] }],
    },
    pikachu: {
        id: 25, name: 'pikachu', species: { name: 'pikachu', url: `${API}pokemon-species/25/` },
        stats: baseStats([35, 55, 40, 50, 50, 90]), types: [{ slot: 1, type: { name: 'electric' } }],
        abilities: [{ slot: 1, ability: { name: 'static' }, is_hidden: false }],
        past_stats: [{ generation: generation(5), stats: [
            { stat: { name: 'defense' }, base_stat: 30 },
            { stat: { name: 'special-defense' }, base_stat: 40 },
        ] }],
    },
};
const stat = (pokemon, name) => pokemon.species.stats.find(entry => entry.stat.name === name).base_stat;

test('a compact historical partner restores canonical RPG types, abilities and base stats offline without changing saved progress', () => {
    const untouched = structuredClone(fixtures);
    const partners = Object.values(fixtures).map(species => compactPokemon({
        id: species.name, species: getPokemonAtGeneration(species, 1), level: 20,
        nickname: 'Parceiro preservado', rpg: { scaleVersion: 2, currentHp: 2, xp: 9, pp: [3], notes: 'Minha jornada' },
    }));
    assert.equal(partners[0].species.types[0].type.name, 'normal');
    assert.deepEqual(partners[0].species.abilities, []);
    assert.equal(stat(partners[1], 'defense'), 30);
    assert.equal(stat(partners[1], 'special-defense'), 40);
    for (const experienceMode of ['rpg', 'free']) {
        const restored = partners.map(partner => ({ ...partner, species: getPokemonReferenceForMode(partner.species, 'red-blue', { experienceMode }) }));
        assert.equal(restored[0].species.types[0].type.name, 'fairy');
        assert.equal(restored[0].species.abilities[0].ability.name, 'cute-charm');
        assert.equal(stat(restored[1], 'defense'), 40);
        assert.equal(stat(restored[1], 'special-defense'), 50);
        assert.equal(restored[0].rpg.currentHp, 2);
        assert.equal(restored[0].rpg.xp, 9);
        assert.equal(restored[0].rpg.pp[0], 3);
        assert.equal(restored[0].rpg.notes, 'Minha jornada');
    }
    // A second historical projection starts from canonical values, rather than
    // stacking an older partial stat delta on a previously historical view.
    const first = getPokemonAtGeneration(fixtures.pikachu, 1);
    const latest = getPokemonAtGeneration(first, 9);
    assert.equal(latest.stats.find(entry => entry.stat.name === 'defense').base_stat, 40);
    assert.equal(latest.stats.find(entry => entry.stat.name === 'special-defense').base_stat, 50);
    assert.deepEqual(fixtures, untouched);
    assert.equal(partners[0].species.reference_current.stats.length, 6);
    assert.ok(JSON.stringify(partners[0].species.reference_current).length < 1000);
    const token = createTokenFromPokemon(partners[0], { id: 'historical-box', versionGroup: 'red-blue' });
    assert.deepEqual(token.types, ['fairy'], 'An adventure always uses current types even when its source Box was viewed in an older game');
    assert.equal(partners[0].species.types[0].type.name, 'normal', 'Entering the adventure does not replace the historical Box view');
});

test('a historical Box hydrates historical types and stat deltas only in Jogos; RPG and Livre retain current canonical data', async t => {
    const previousFetch = globalThis.fetch;
    await clearApiCache();
    globalThis.fetch = async url => {
        const path = new URL(url).pathname.split('/').filter(Boolean);
        const kind = path.at(-2), name = path.at(-1);
        if (kind === 'pokemon' && fixtures[name]) return Response.json(fixtures[name]);
        if (kind === 'pokemon-species') return Response.json({ gender_rate: 4 });
        return new Response('Not found', { status: 404 });
    };
    t.after(async () => { await clearApiCache(); globalThis.fetch = previousFetch; });
    const untouched = structuredClone(fixtures);
    const box = normalizeTeam({ id: 'historical-box', updatedAt: 1, versionGroup: 'black-white', pokemon: [
        { id: 'clefairy', formName: 'clefairy', nickname: 'Minha parceira', level: 20, rpg: { xp: 9, notes: 'Ainda aqui' } },
        { id: 'pikachu', formName: 'pikachu', level: 20 },
    ] });

    const historical = await hydrateTeam(box, { experienceMode: 'game' });
    assert.equal(historical.pokemon[0].species.types[0].type.name, 'normal');
    assert.equal(stat(historical.pokemon[1], 'defense'), 30);
    assert.equal(stat(historical.pokemon[1], 'special-defense'), 40);
    assert.equal(stat(historical.pokemon[1], 'attack'), 55);
    const firstGeneration = await hydratePokemon(box.pokemon[0], { experienceMode: 'game', versionGroup: 'red-blue' });
    assert.equal(firstGeneration.species.types[0].type.name, 'normal');
    assert.deepEqual(firstGeneration.species.abilities, []);

    const defaultRpg = await hydrateTeam(historical);
    const explicitRpg = await hydrateTeam(historical, { experienceMode: 'rpg' });
    const free = await hydrateTeam(historical, { experienceMode: 'free' });
    for (const current of [defaultRpg, explicitRpg, free]) {
        assert.equal(current.versionGroup, 'black-white');
        assert.equal(current.pokemon[0].species.types[0].type.name, 'fairy');
        assert.equal(stat(current.pokemon[1], 'defense'), 40);
        assert.equal(stat(current.pokemon[1], 'special-defense'), 50);
        assert.equal(current.pokemon[0].rpg.xp, 9);
        assert.equal(current.pokemon[0].rpg.notes, 'Ainda aqui');
    }
    const live = { ...box, pokemon: box.pokemon.map(pokemon => ({ ...pokemon, nickname: 'Editado agora', rpg: { ...pokemon.rpg, xp: 12 } })) };
    const merged = mergeHydratedTeams([live], [historical])[0];
    assert.equal(merged.pokemon[0].species.types[0].type.name, 'normal');
    assert.equal(merged.pokemon[0].nickname, 'Editado agora');
    assert.equal(merged.pokemon[0].rpg.xp, 12);
    assert.deepEqual(fixtures, untouched);
    assert.equal(apiCache.get(`${API}pokemon/clefairy`)?.data?.types[0]?.type?.name, 'fairy', 'Historical views must never overwrite the current shared API catalogue');
});

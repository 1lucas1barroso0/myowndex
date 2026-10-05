import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGeneratedPokemon, fetchGeneratorData, generatePokemon, GENERATOR_REQUEST_CONCURRENCY, getGeneratedHp, getGeneratorGameReference, getGeneratorGender, getGeneratorLearnset, getGeneratorRandomCandidates, getGeneratorSpeciesPool, getGeneratorSpeciesTypes, normalizeGeneratorOptions } from '../src/core/pokemonGenerator.js';
import { clearCatalogTextCache } from '../src/core/catalogText.js';
import { STAT_KEYS } from '../src/core/team.js';
import { decodeShare, encodePokemonBundle } from '../src/core/teamShare.js';
import { resolveStorageKey } from '../src/core/storage.js';

const API = 'https://pokeapi.co/api/v2/';
const species = { id: 1, name: 'bulbasaur', gender_rate: 1, base_happiness: 50, is_legendary: false, is_mythical: false, varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: `${API}pokemon/1/` } }] };
const detail = (game, level, method = 'level-up', id = game === 'red-blue' ? 1 : 25) => ({ level_learned_at: level, move_learn_method: { name: method }, version_group: { name: game, url: `${API}version-group/${id}/` } });
const move = (name, details) => ({ move: { name, url: `${API}move/${name}/` }, version_group_details: details });
const pokemon = { id: 1, name: 'bulbasaur', species: { name: 'bulbasaur', url: `${API}pokemon-species/1/` }, types: [{ slot: 1, type: { name: 'grass' } }], stats: STAT_KEYS.map(stat => ({ stat: { name: stat }, base_stat: 45 })), abilities: [{ is_hidden: false, slot: 1, ability: { name: 'overgrow' } }, { is_hidden: true, slot: 3, ability: { name: 'chlorophyll' } }], moves: [move('tackle', [detail('red-blue', 1), detail('scarlet-violet', 1)]), move('growl', [detail('scarlet-violet', 1)]), move('vine-whip', [detail('scarlet-violet', 3)]), move('growth', [detail('scarlet-violet', 6)]), move('razor-leaf', [detail('scarlet-violet', 12)]), move('solar-beam', [detail('scarlet-violet', 0, 'machine')])], sprites: { front_default: '/sprites/1.png' } };
const catalogue = [1, 25, 151, 152, 251, 252, 386, 387, 493, 494, 649, 650, 721, 722, 809, 810, 905, 906, 1025].map(id => ({ name: `species-${id}`, url: `${API}pokemon-species/${id}/` }));

test('generator filters canonical species, types and real generation boundaries without changing catalogue', () => {
    const original = JSON.stringify(catalogue);
    assert.deepEqual(getGeneratorSpeciesPool(catalogue, { generation: 8 }).map(entry => entry.id), [810, 905]);
    assert.deepEqual(getGeneratorSpeciesPool(catalogue, {}, new Set([25, 151, 2000])).map(entry => entry.id), [25, 151]);
    assert.deepEqual(getGeneratorSpeciesPool(catalogue, { speciesId: 906, generation: 8 }), []);
    assert.equal(JSON.stringify(catalogue), original);
    const normalized = normalizeGeneratorOptions({ count: 200, level: 201.8, nature: 'invented', type: 'imaginary', experienceMode: 'game' });
    assert.equal(normalized.count, 6);
    assert.equal(normalized.level, 100);
    assert.equal(normalized.nature, 'random');
    assert.equal(normalized.type, '');
});

test('random generator gives each species one candidate regardless of how many persistent forms it owns', () => {
    const pool = [
        { id: 25, name: 'pikachu' },
        { id: 869, name: 'alcremie' },
        { id: 869, name: 'alcremie-ruby-cream', formKey: 'alcremie-ruby-cream' },
        { id: 869, name: 'alcremie-rainbow-swirl', formKey: 'alcremie-rainbow-swirl' },
    ];
    const candidates = getGeneratorRandomCandidates(pool, () => 0);
    assert.equal(candidates.length, 2);
    assert.equal(new Set(candidates.map(entry => entry.id)).size, 2);
});

test('historical game generation excludes forms introduced after the selected game', () => {
    const entries = [
        { name: 'rattata', speciesId: 19, url: `${API}pokemon-species/19/` },
        { name: 'rattata-alola', speciesId: 19, formKey: 'rattata-alola', generation: 7, types: ['dark', 'normal'], url: `${API}pokemon-species/19/` },
    ];
    assert.deepEqual(getGeneratorSpeciesPool(entries, { experienceMode: 'game', versionGroup: 'red-blue' }).map(entry => entry.name), ['rattata']);
    assert.deepEqual(getGeneratorSpeciesPool(entries, { experienceMode: 'game', versionGroup: 'sun-moon' }).map(entry => entry.name), ['rattata', 'rattata-alola']);
});

test('form type filters use the selected historical game instead of current typing', () => {
    const rotomWash = {
        name: 'rotom-wash', speciesId: 479, formKey: 'rotom-wash', generation: 4,
        types: ['electric', 'water'], pastTypes: [{ generation: 4, types: ['electric', 'ghost'] }],
        url: `${API}pokemon-species/479/`,
    };
    assert.deepEqual(getGeneratorSpeciesPool([rotomWash], { type: 'ghost', experienceMode: 'game', versionGroup: 'platinum' }).map(entry => entry.name), ['rotom-wash']);
    assert.deepEqual(getGeneratorSpeciesPool([rotomWash], { type: 'water', experienceMode: 'game', versionGroup: 'platinum' }), []);
    assert.deepEqual(getGeneratorSpeciesPool([rotomWash], { type: 'water', experienceMode: 'game', versionGroup: 'black-white' }).map(entry => entry.name), ['rotom-wash']);
});

test('choosing a species keeps interchangeable forms grouped while an explicit fixed variant remains selectable', () => {
    const entries = [
        { id: 201, speciesId: 201, name: 'unown', formKey: '', isPrimarySpecies: true, generation: 2, types: ['psychic'], url: `${API}pokemon-species/201/` },
        { id: 201, speciesId: 201, name: 'unown-b', formKey: 'unown-b', isPrimarySpecies: false, generation: 2, types: ['psychic'], url: `${API}pokemon-species/201/` },
    ];
    assert.deepEqual(getGeneratorSpeciesPool(entries, { speciesId: 201 }).map(entry => entry.formKey), ['']);
    assert.deepEqual(getGeneratorSpeciesPool(entries, { speciesId: 201, formKey: 'unown-b' }).map(entry => entry.formKey), ['unown-b']);
});

test('generator learnset uses the latest actual game and only moves learned by the selected level', () => {
    const latest = getGeneratorLearnset(pokemon, 'auto', 5);
    assert.equal(latest.versionGroup, 'scarlet-violet');
    assert.deepEqual(latest.moves.map(entry => entry.name), ['vine-whip', 'growl', 'tackle']);
    assert.deepEqual(getGeneratorLearnset(pokemon, 'red-blue', 5).moves.map(entry => entry.name), ['tackle']);
    assert.deepEqual(getGeneratorLearnset(pokemon, 'sword-shield', 50), { versionGroup: null, moves: [] });
    assert.equal(getGeneratorLearnset(pokemon, 'auto', 100).moves.length, 4);
});

test('generator gender respects genderless, fixed and official female eighths', () => {
    assert.equal(getGeneratorGender(-1), 'N');
    assert.equal(getGeneratorGender(0), 'M');
    assert.equal(getGeneratorGender(8), 'F');
    assert.equal(getGeneratorGender(1, () => 0), 'F');
    assert.equal(getGeneratorGender(1, () => 0.125), 'M');
});

test('generated partner has valid IVs, zero EVs/XP, official ability and nature, full HP and compact storage', () => {
    const partner = buildGeneratedPokemon({ pokemon, species, learnset: getGeneratorLearnset(pokemon, 'auto', 5), moveData: [{ name: 'tackle', pp: 35 }, { name: 'growl', pp: 40 }, { name: 'vine-whip', pp: 25 }], options: { level: 5, nature: 'modest' }, random: () => 0.999999 });
    assert.equal(partner.nature, 'modest');
    assert.equal(partner.ability, 'overgrow');
    assert.deepEqual(Object.values(partner.ivs), [31, 31, 31, 31, 31, 31]);
    assert.deepEqual(Object.values(partner.evs), [0, 0, 0, 0, 0, 0]);
    assert.equal(partner.rpg.xp, 0);
    assert.equal(partner.rpg.currentHp, getGeneratedHp(partner));
    assert.equal(partner.rpg.currentHp, 2, '21 game HP uses the current RPG division by 10');
    assert.equal(getGeneratedHp(partner, 'game'), 21);
    assert.deepEqual(partner.rpg.pp, [25, 40, 35, null]);
    assert.equal(partner.species.moves, undefined);
    assert.equal(partner.friendship, 50);
    assert.ok(partner.id);
    assert.equal(getGeneratedHp({ ...partner, species: { ...partner.species, name: 'shedinja' } }, 'game'), 1);
});

test('generator filters historical types from pinned data instead of the current type index', () => {
    const metadata = JSON.parse(readFileSync(new URL('../src/data/generator-species.json', import.meta.url), 'utf8'));
    const changed = [35, 81, 122, 183].map(id => ({ name: `species-${id}`, url: `${API}pokemon-species/${id}/` }));
    assert.deepEqual(getGeneratorSpeciesPool(changed, { type: 'normal', versionGroup: 'red-blue', experienceMode: 'game' }, null, metadata).map(entry => entry.id), [35]);
    assert.deepEqual(getGeneratorSpeciesPool(changed, { type: 'fairy', versionGroup: 'scarlet-violet' }, null, metadata).map(entry => entry.id), [35, 122, 183]);
    assert.deepEqual(getGeneratorSpeciesPool(changed, { type: 'steel', versionGroup: 'red-blue', experienceMode: 'game' }, null, metadata), []);
    assert.deepEqual(getGeneratorSpeciesPool(changed, { type: 'steel', versionGroup: 'gold-silver', experienceMode: 'game' }, null, metadata).map(entry => entry.id), [81]);
    assert.deepEqual(getGeneratorSpeciesPool(changed, { type: 'fairy', versionGroup: 'red-blue', experienceMode: 'rpg' }, null, metadata).map(entry => entry.id), [35, 122, 183], 'RPG repertoire selection never changes current types');
    assert.deepEqual(getGeneratorSpeciesTypes(metadata['183'], 5), ['water']);
    assert.ok(Object.values(metadata).every(entry => entry.types.length > 0));
});

test('historical null ability slots never become invented abilities or abort a valid partner', () => {
    const previous = { ...pokemon, abilities: [{ slot: 1, is_hidden: false, ability: { name: 'overgrow' } }, { slot: 3, is_hidden: true, ability: null }] };
    const partner = buildGeneratedPokemon({ pokemon: previous, species, learnset: getGeneratorLearnset(pokemon, 'auto', 5), options: { hiddenAbility: true }, random: () => 0.99999 });
    assert.equal(partner.ability, 'overgrow');
});

test('generator applies game-era abilities, types and first-generation Special stat', () => {
    const data = { ...pokemon, abilities: [{ ability: { name: 'cursed-body' } }], past_abilities: [{ generation: { url: `${API}generation/6/` }, abilities: [{ ability: { name: 'levitate' } }] }], past_types: [{ generation: { url: `${API}generation/5/` }, types: [{ type: { name: 'normal' } }] }], past_stats: [{ generation: { url: `${API}generation/1/` }, stats: [{ stat: { name: 'special' }, base_stat: 130 }] }] };
    assert.equal(getGeneratorGameReference(data, 6).abilities[0].ability.name, 'levitate');
    assert.equal(getGeneratorGameReference(data, 7).abilities[0].ability.name, 'cursed-body');
    assert.deepEqual(getGeneratorGameReference(data, 1).abilities, []);
    assert.equal(getGeneratorGameReference(data, 5).types[0].type.name, 'normal');
    assert.equal(getGeneratorGameReference(data, 6).types[0].type.name, 'grass');
    assert.equal(getGeneratorGameReference(data, 1).stats.find(entry => entry.stat.name === 'special-defense').base_stat, 130);
    assert.equal(data.stats.find(entry => entry.stat.name === 'special-defense').base_stat, 45);
});

test('partial official stat/ability histories retain unchanged slots and combine successive changes', () => {
    const pikachu = {
        ...pokemon,
        abilities: [{ slot: 1, is_hidden: false, ability: { name: 'static' } }, { slot: 3, is_hidden: true, ability: { name: 'lightning-rod' } }],
        past_abilities: [{ generation: { url: `${API}generation/4/` }, abilities: [{ slot: 3, is_hidden: true, ability: null }] }],
        past_stats: [
            { generation: { url: `${API}generation/1/` }, stats: [{ stat: { name: 'special' }, base_stat: 50 }] },
            { generation: { url: `${API}generation/5/` }, stats: [{ stat: { name: 'defense' }, base_stat: 30 }, { stat: { name: 'special-defense' }, base_stat: 40 }] },
        ],
    };
    const ruby = getGeneratorGameReference(pikachu, 3);
    assert.deepEqual(ruby.abilities.map(entry => entry.ability.name), ['static']);
    assert.equal(ruby.stats.find(entry => entry.stat.name === 'defense').base_stat, 30);
    assert.equal(ruby.stats.find(entry => entry.stat.name === 'special-defense').base_stat, 40);
    const red = getGeneratorGameReference(pikachu, 1);
    assert.deepEqual(red.abilities, []);
    assert.equal(red.stats.find(entry => entry.stat.name === 'defense').base_stat, 30);
    assert.equal(red.stats.find(entry => entry.stat.name === 'special-attack').base_stat, 50);
    assert.equal(red.stats.find(entry => entry.stat.name === 'special-defense').base_stat, 50);
    assert.deepEqual(getGeneratorGameReference(pikachu, 6).abilities.map(entry => entry.ability.name), ['static', 'lightning-rod']);
    assert.equal(pikachu.stats.find(entry => entry.stat.name === 'defense').base_stat, 45, 'source stays immutable');
});

test('generator uses official pinned Legendary/Mythical flags before catalogue requests', () => {
    const metadata = JSON.parse(readFileSync(new URL('../src/data/generator-species.json', import.meta.url), 'utf8'));
    assert.equal(Object.keys(metadata).length, 1025);
    assert.equal(metadata['1'].legendary, false);
    assert.equal(metadata['150'].legendary, true);
    assert.equal(metadata['151'].mythical, true);
    assert.deepEqual(getGeneratorSpeciesPool(catalogue, { legendary: 'only' }, null, metadata).map(entry => entry.id), [151, 251, 386, 493, 494, 649, 721, 809, 905, 1025]);
    assert.ok(getGeneratorSpeciesPool(catalogue, { legendary: 'exclude' }, null, metadata).every(entry => !metadata[entry.id].legendary && !metadata[entry.id].mythical));
});

const fixtureFetcher = async url => {
    if (url === species.varieties[0].pokemon.url) return pokemon;
    if (url === `${API}pokemon-species/1/`) return species;
    if (url === `${API}version-group/scarlet-violet/`) return { id: 25, generation: { url: `${API}generation/9/` } };
    if (url === `${API}version-group/red-blue/`) return { id: 1, generation: { url: `${API}generation/1/` } };
    if (url.includes('/move/')) return { name: url.split('/').filter(Boolean).pop(), pp: 35, past_values: [{ version_group: { url: `${API}version-group/2/` }, pp: 40 }] };
    throw new Error(`Unexpected request: ${url}`);
};

test('generator end-to-end preserves actual forms, correct game PP, progress and individual share compatibility', async () => {
    const progress = [];
    const generated = await generatePokemon([{ name: 'bulbasaur', url: `${API}pokemon-species/1/` }], { speciesId: 1, count: 2, versionGroup: 'red-blue', level: 5, experienceMode: 'game' }, { fetcher: fixtureFetcher, random: () => 0, onProgress: value => progress.push(value) });
    assert.equal(generated.length, 2);
    assert.notEqual(generated[0].pokemon.id, generated[1].pokemon.id);
    assert.equal(generated[0].pokemon.ability, '');
    assert.equal(generated[0].pokemon.rpg.pp[0], 40);
    assert.equal(progress.at(-1).completed, 2);
    const code = await encodePokemonBundle([generated[0].pokemon], { versionGroup: generated[0].versionGroup });
    const decoded = await decodeShare(code);
    assert.equal(decoded.pokemon[0].speciesName, 'bulbasaur');
    assert.equal(decoded.pokemon[0].moves[0], 'tackle');
    assert.equal(decoded.pokemon[0].rpg.xp, 0);
});

test('generator can pin a persistent form and keeps its identity in the generated partner', async () => {
    const entry = {
        name: 'bulbasaur-spring-style',
        speciesId: 1,
        pokemonId: 1,
        pokemonName: 'bulbasaur',
        formKey: 'bulbasaur-spring-style',
        formId: 12000,
        generation: 1,
        types: ['grass'],
        url: `${API}pokemon-species/1/`,
    };
    const generated = await generatePokemon([entry], {
        speciesId: 1,
        formKey: entry.formKey,
        count: 1,
        versionGroup: 'scarlet-violet',
        level: 5,
    }, {
        fetcher: async url => url === `${API}pokemon-form/${entry.formId}/`
            ? { sprites: { front_default: '/sprites/spring.png' } }
            : fixtureFetcher(url),
        random: () => 0,
    });
    assert.equal(generated.length, 1);
    assert.equal(generated[0].pokemon.species.name, 'bulbasaur');
    assert.equal(generated[0].pokemon.formKey, entry.formKey);
    assert.equal(generated[0].pokemon.formId, entry.formId);
    assert.equal(generated[0].pokemon.species.sprites.front_default, '/sprites/spring.png');
    assert.deepEqual(getGeneratorSpeciesPool([entry], { speciesId: 1, formKey: entry.formKey }).map(value => value.formKey), [entry.formKey]);
    assert.deepEqual(getGeneratorSpeciesPool([entry], { speciesId: 1 }), [], 'selecting the base form never silently picks a styled form');
});

test('generator rejects incomplete API data instead of inventing a partner and aborts before any request', async () => {
    assert.throws(() => buildGeneratedPokemon({ pokemon: { ...pokemon, stats: [] }, species, learnset: getGeneratorLearnset(pokemon, 'auto', 5) }), /ficha completa/);
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(generatePokemon(catalogue, {}, { signal: controller.signal, fetcher: async () => { calls += 1; return null; } }), { name: 'AbortError' });
    assert.equal(calls, 0);
    await assert.rejects(generatePokemon([{ name: 'bulbasaur', url: `${API}pokemon-species/1/` }], {}, { fetcher: async () => null }), /indisponível/);
});

test('generator loads bundled historical move metadata before the first generation, without opening the Pokédex', async () => {
    const previousFetch = globalThis.fetch;
    const moveCatalog = JSON.parse(readFileSync(new URL('../public/catalog/v1/move.json', import.meta.url), 'utf8'));
    clearCatalogTextCache();
    let catalogRequests = 0;
    globalThis.fetch = async url => {
        assert.equal(url, '/catalog/v1/move.json');
        catalogRequests += 1;
        return { ok: true, text: async () => JSON.stringify(moveCatalog) };
    };
    try {
        const generated = await generatePokemon([{ name: 'bulbasaur', url: `${API}pokemon-species/1/` }], { speciesId: 1, versionGroup: 'red-blue', level: 5, experienceMode: 'game' }, {
            random: () => 0,
            fetcher: async url => url.includes('/move/') ? { name: 'tackle', pp: 999 } : fixtureFetcher(url),
        });
        assert.equal(generated[0].pokemon.rpg.pp[0], 35, 'pinned Red/Blue PP supersedes later or malformed current metadata');
        assert.equal(catalogRequests, 1);
    } finally {
        globalThis.fetch = previousFetch;
        clearCatalogTextCache();
    }
});

test('PR23: old-game repertoire keeps current canonical abilities, types and PP in RPG/Livre', async () => {
    const previousFetch = globalThis.fetch;
    const metadata = JSON.parse(readFileSync(new URL('../src/data/generator-species.json', import.meta.url), 'utf8'));
    const catalog = readFileSync(new URL('../public/catalog/v1/move.json', import.meta.url), 'utf8');
    clearCatalogTextCache();
    globalThis.fetch = async () => ({ ok: true, text: async () => catalog });
    const fixture = {
        ...pokemon, name: 'clefairy', id: 35,
        species: { name: 'clefairy', url: `${API}pokemon-species/35/` },
        types: [{ slot: 1, type: { name: 'fairy' } }],
        past_types: [{ generation: { url: `${API}generation/5/` }, types: [{ slot: 1, type: { name: 'normal' } }] }],
        abilities: [{ slot: 1, is_hidden: false, ability: { name: 'cute-charm' } }],
        moves: [move('absorb', [detail('red-blue', 1)])],
    };
    const speciesFixture = { ...species, id: 35, name: 'clefairy', varieties: [{ is_default: true, pokemon: { name: 'clefairy', url: `${API}pokemon/35/` } }] };
    const fetcher = async url => {
        if (url === `${API}pokemon/35/`) return fixture;
        if (url === `${API}pokemon-species/35/`) return speciesFixture;
        if (url === `${API}move/absorb/`) return { name: 'absorb', pp: 25 };
        return fixtureFetcher(url);
    };
    const entries = [{ name: 'clefairy', url: `${API}pokemon-species/35/` }];
    try {
        for (const experienceMode of ['rpg', 'free']) {
            const [generated] = await generatePokemon(entries, { speciesId: 35, type: 'fairy', versionGroup: 'red-blue', experienceMode }, { fetcher, random: () => 0, metadata });
            assert.equal(generated.pokemon.species.types[0].type.name, 'fairy');
            assert.equal(generated.pokemon.ability, 'cute-charm');
            assert.equal(generated.pokemon.moves[0], 'absorb');
            assert.equal(generated.pokemon.rpg.pp[0], 25);
        }
        const [historic] = await generatePokemon(entries, { speciesId: 35, type: 'normal', versionGroup: 'red-blue', experienceMode: 'game' }, { fetcher, random: () => 0, metadata });
        assert.equal(historic.pokemon.species.types[0].type.name, 'normal');
        assert.equal(historic.pokemon.ability, '');
        assert.equal(historic.pokemon.rpg.pp[0], 20);
    } finally {
        globalThis.fetch = previousFetch;
        clearCatalogTextCache();
    }
});

test('generator API limit is shared across runs and cancelled queued tasks never fetch', async () => {
    let active = 0;
    let maximum = 0;
    const releases = [];
    const fetcher = async () => { active += 1; maximum = Math.max(maximum, active); await new Promise(resolve => releases.push(resolve)); active -= 1; return { ok: true }; };
    const controller = new AbortController();
    const requests = Array.from({ length: 8 }, (_, index) => fetchGeneratorData(`https://example.test/${index}`, { fetcher, ...(index === 7 ? { signal: controller.signal } : {}) }));
    const completed = Promise.allSettled(requests);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(active, GENERATOR_REQUEST_CONCURRENCY);
    controller.abort();
    while (releases.length || active) { releases.splice(0).forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); }
    const settled = await completed;
    assert.equal(maximum, GENERATOR_REQUEST_CONCURRENCY);
    assert.equal(settled[7].status, 'rejected');
    assert.equal(settled[7].reason.name, 'AbortError');
});

test('generator draft is isolated for each account and from guest storage', () => {
    assert.equal(resolveStorageKey('myowndex_generator_v1', { scope: null }), 'myowndex_generator_v1');
    assert.notEqual(resolveStorageKey('myowndex_generator_v1', { scope: 'one' }), resolveStorageKey('myowndex_generator_v1', { scope: 'two' }));
});

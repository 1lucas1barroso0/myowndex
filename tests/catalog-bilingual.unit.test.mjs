import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
    CATALOG_CACHE_BYTES, CATALOG_CACHE_LIMIT, clearCatalogTextCache,
    getCatalogCacheStats, getCatalogMoveMetadata, getCatalogText,
    getSpeciesRecordHistory, loadCatalogText,
} from '../src/core/catalogText.js';
import { cleanDescription, describeMove, describeTrait } from '../src/core/descriptions.js';
import { getMoveAtVersion } from '../src/core/referenceGames.js';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const proof = await read('docs/catalog-text-provenance.json');
const files = await Promise.all(proof.outputs.map(async output => {
    const bytes = await fs.readFile(new URL(`public/${output.file}`, root));
    return { output, bytes, data: JSON.parse(bytes) };
}));
const byName = name => files.find(({ output }) => output.file.endsWith(`/${name}.json`))?.data;

test('local bilingual catalogue has reproducible hashes, real source versions and complete pairs', () => {
    assert.equal(proof.sourceCommit, 'bc92d3b6029ef1abe9e7ad424c400b338f3c11fe');
    assert.equal(files.length, 14);
    const unique = new Map();
    for (const { output, bytes, data } of files) {
        assert.equal(bytes.length, output.bytes, output.file);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), output.sha256, output.file);
        assert.equal(data.schemaVersion, 1);
        assert.equal(Object.keys(data.entries).length, output.entries);
        assert.equal(Object.keys(data.texts).length, output.texts);
        for (const [hash, pair] of Object.entries(data.texts)) {
            assert.equal(pair.length, 2);
            for (const value of pair) {
                assert.equal(typeof value, 'string');
                assert.ok(value.trim().length > 0);
                assert.doesNotMatch(value, /[NZ]XQ\s*\d+\s*QX[NZ]|\bundefined\b|\[object Object\]/i);
                assert.doesNotMatch(value, /\bTODO\b/);
            }
            assert.equal(createHash('sha256').update(pair[0]).digest('hex').slice(0, 20), hash);
            if (unique.has(hash)) assert.deepEqual(pair, unique.get(hash), 'same source always owns the same translation');
            unique.set(hash, pair);
        }
    }
    assert.equal(unique.size, proof.englishTexts);
    assert.equal(unique.size, 20738);
    for (const [table, source] of Object.entries(proof.sources)) {
        assert.equal(source.url, `https://raw.githubusercontent.com/PokeAPI/pokeapi/${proof.sourceCommit}/data/v2/csv/${table}.csv`);
        assert.match(source.sha256, /^[a-f0-9]{64}$/);
        assert.ok(source.bytes > 0);
    }
    for (const source of [...Object.values(proof.mechanicsSources), ...Object.values(proof.moveMetadataSources)]) {
        assert.equal(source.commit, '68e5f9bc901b88477c8e9aff79b5a654fc3438a7');
        assert.ok(source.url.includes(`/${source.commit}/data/`));
        assert.match(source.sha256, /^[a-f0-9]{64}$/);
        assert.ok(source.bytes > 0);
    }
});

test('every species and every referenced description resolves to its actual paired game text', () => {
    const species = new Set();
    for (const { data } of files) {
        if (data.kind === 'species') {
            for (const [id, history] of Object.entries(data.entries)) {
                species.add(Number(id));
                assert.ok(history.length > 0);
                const versions = new Set();
                for (const [game, hash, order, form] of history) {
                    assert.ok(data.labels[game], `${id}: ${game}`);
                    assert.ok(data.texts[hash], `${id}: ${hash}`);
                    assert.ok(Number.isInteger(order) && order >= 0);
                    const key = `${game}:${form || ''}`;
                    assert.ok(!versions.has(key), `${id}: duplicate ${key}`);
                    versions.add(key);
                }
            }
        } else {
            for (const [name, entry] of Object.entries(data.entries)) {
                for (const hash of [entry.effect, entry.short].filter(Boolean)) assert.ok(data.texts[hash], name);
                for (const [game, hash, order] of entry.flavors) {
                    assert.ok(data.versionGenerations[game], `${name}: ${game}`);
                    assert.equal(order, data.versionOrders[game], `${name}: ${game}`);
                    assert.ok(data.texts[hash], name);
                }
                for (const context of Object.values(entry.mechanics || {})) {
                    assert.ok(data.texts[context.effect], name);
                    assert.ok(data.texts[context.short], name);
                }
            }
        }
    }
    assert.deepEqual([...species].sort((a, b) => a - b), Array.from({ length: 1025 }, (_, index) => index + 1));
    const coverage = kind => {
        const entries = Object.values(byName(kind).entries);
        return [entries.length, entries.filter(entry => entry.mechanics).length,
            entries.filter(entry => !entry.mechanics && !entry.effect && !entry.short && !entry.flavors.length).length];
    };
    assert.deepEqual(coverage('ability'), [374, 314, 59]);
    assert.deepEqual(coverage('move'), [937, 881, 0]);
    assert.deepEqual(coverage('item'), [2222, 530, 542]);
});

const fetchFromFiles = async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    const bytes = await fs.readFile(new URL(`public${url}`, root), 'utf8');
    return { ok: true, text: async () => bytes };
};

test('EN/PT effects respect modern and historical mechanics and preserve named exceptions', async () => {
    const priorFetch = globalThis.fetch;
    globalThis.fetch = fetchFromFiles;
    clearCatalogTextCache();
    try {
        await loadCatalogText('ability');
        const healer = describeTrait('ability', 'healer');
        assert.match(healer.reference.portuguese, /50%/);
        assert.match(healer.summary, /50%/);
        assert.doesNotMatch(healer.reference.portuguese, /30%/);
        assert.match(describeTrait('ability', 'healer', null, { versionGroup: 'scarlet-violet' }).reference.portuguese, /30%/);
        assert.match(describeTrait('ability', 'unseen-fist').reference.portuguese, /25%/);
        const protean = getCatalogText('ability', 'protean');
        assert.match(protean.original, /once per switch-in/);
        assert.match(protean.portuguese, /uma vez por entrada em campo/);
        assert.doesNotMatch(getCatalogText('ability', 'protean', {}, { versionGroup: 'sword-shield' }).original, /once/);
        assert.match(getCatalogText('ability', 'battle-bond').portuguese, /1 estágio/);
        assert.match(getCatalogText('ability', 'battle-bond', {}, { versionGroup: 'sun-moon' }).portuguese, /Ash-Greninja/);
        await loadCatalogText('item');
        assert.match(describeTrait('item', 'slowbronite').reference.portuguese, /Galarian Slowbro/);
        assert.match(getCatalogText('item', 'leftovers').portuguese, /6,25%/);
        assert.match(getCatalogText('item', 'focus-sash').portuguese, /1 HP/);
        await loadCatalogText('move');
        assert.match(getCatalogText('move', 'metronome', {}, { versionGroup: 'ruby-sapphire' }).portuguese, /Thief/);
        assert.match(getCatalogText('move', 'assist', {}, { versionGroup: 'x-y' }).portuguese, /Trick/);
        assert.match(getCatalogText('move', 'toxic-spikes').portuguese, /Safeguard/);
        assert.match(getCatalogText('move', 'salt-cure').portuguese, /12,5%/);
        assert.match(getCatalogText('move', 'salt-cure', {}, { versionGroup: 'champions' }).portuguese, /6,25%/);
        for (const name of ['recover', 'roost', 'soft-boiled', 'slack-off', 'milk-drink', 'heal-order']) {
            const healing = getCatalogText('move', name, {}, { versionGroup: 'champions' });
            assert.match(healing.original, /50%/);
            assert.match(healing.portuguese, /50%/);
            assert.match(healing.portuguese, /inteiro mais próximo, com empate para cima/);
            assert.doesNotMatch(healing.portuguese, /\d\s*\/\s*\d/);
        }
        assert.match(getCatalogText('move', 'synthesis').portuguese, /inteiro mais próximo, com empate para baixo/);
        assert.match(getCatalogText('move', 'synthesis').portuguese, /Sun ou Intense Sun/);
        assert.match(getCatalogText('move', 'jungle-healing').portuguese, /25%.*inteiro mais próximo, com empate para cima/);
        const legends = getCatalogText('move', 'growl', {}, { versionGroup: 'legends-arceus' });
        assert.equal(legends.source, 'pokeapi');
        assert.equal(legends.version, 'legends-arceus');
        assert.ok(legends.original && legends.portuguese);
    } finally {
        globalThis.fetch = priorFetch;
        clearCatalogTextCache();
    }
});

test('historical move facts use verified targeting/category, never current secondary metadata', async () => {
    const priorFetch = globalThis.fetch;
    globalThis.fetch = fetchFromFiles;
    clearCatalogTextCache();
    try {
        await loadCatalogText('move');
        const growl = { name: 'growl', target: { name: 'all-opponents' }, damage_class: { name: 'status' }, type: { name: 'normal' }, accuracy: 100, pp: 40 };
        const oldGrowl = getMoveAtVersion(growl, { id: 1, value: 'red-blue' });
        assert.equal(oldGrowl.target.name, 'selected-pokemon');
        assert.match(describeMove(oldGrowl, { historical: true }).facts.join(' '), /escolher um Pokémon/);
        assert.doesNotMatch(describeMove(oldGrowl, { historical: true }).facts.join(' '), /todos os oponentes/);
        assert.equal(getMoveAtVersion(growl, { id: 15, value: 'x-y' }).target.name, 'all-opponents');
        const bite = { name: 'bite', type: { name: 'dark' }, damage_class: { name: 'physical' }, meta: { flinch_chance: 30 } };
        const snapshot = structuredClone(bite);
        const oldBite = getMoveAtVersion(bite, { id: 1, value: 'red-blue' });
        assert.equal(oldBite.type.name, 'normal');
        assert.equal(oldBite.damage_class.name, 'physical');
        assert.match(getCatalogText('move', 'bite', oldBite, { versionGroup: 'red-blue' }).portuguese, /10%/);
        assert.doesNotMatch(describeMove(oldBite, { historical: true }).facts.join(' '), /30%/);
        assert.equal(getMoveAtVersion(bite, { id: 5, value: 'ruby-sapphire' }).damage_class.name, 'special');
        assert.equal(getMoveAtVersion(bite, { id: 8, value: 'diamond-pearl' }).damage_class.name, 'physical');
        assert.deepEqual(bite, snapshot);
        const tackle = { name: 'tackle', power: 40, accuracy: 100, past_values: [{ power: 35, accuracy: 95, version_group: { name: 'black-white', url: 'https://pokeapi.co/api/v2/version-group/11/' } }] };
        const japan = getMoveAtVersion(tackle, { id: 28, value: 'red-green-japan' });
        assert.equal(japan.power, 35);
        assert.equal(japan.accuracy, 95);
        assert.equal(japan.reference_generation, 1);
        assert.equal(getCatalogMoveMetadata('solar-beam', 'lets-go-pikachu-lets-go-eevee').basePower, 200);
        assert.equal(getCatalogMoveMetadata('solar-beam', 'sun-moon').basePower, 120);
        assert.equal(getCatalogMoveMetadata('growl', 'legends-arceus'), null);
        assert.deepEqual(describeMove(getMoveAtVersion(growl, { id: 24, value: 'legends-arceus' }), { historical: true }).facts, []);
    } finally {
        globalThis.fetch = priorFetch;
        clearCatalogTextCache();
    }
});

test('official GO pairs and form-specific entries survive catalogue expansion', async () => {
    const priorFetch = globalThis.fetch;
    globalThis.fetch = fetchFromFiles;
    clearCatalogTextCache();
    try {
        await loadCatalogText('species', 999);
        const base = getSpeciesRecordHistory(999, 'gimmighoul');
        assert.ok(base.some(entry => entry.original.includes('treasure chest')));
        const roaming = getSpeciesRecordHistory(999, 'gimmighoul-roaming');
        const go = roaming.find(entry => entry.source === 'pokemon-go');
        assert.ok(go.original && go.portuguese);
        assert.equal(go.sourceKind, 'official-localization');
        assert.doesNotMatch(go.original, /born inside a treasure chest/);
        assert.ok(!base.some(entry => entry.id.includes('roaming')));
        await loadCatalogText('species', 1);
        const history = getSpeciesRecordHistory(1);
        assert.ok(history[0].version !== 'pokemon-go');
        assert.ok(history.some(entry => entry.version === 'red'));
        assert.ok(history.every(entry => entry.original && entry.portuguese));
        assert.equal(cleanDescription(history.find(entry => entry.version === 'red').original), history.find(entry => entry.version === 'red').original);
    } finally {
        globalThis.fetch = priorFetch;
        clearCatalogTextCache();
    }
});

test('public reference cache deduplicates requests and remains bounded independently of saved Boxes', async () => {
    const priorFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (...args) => { calls++; return fetchFromFiles(...args); };
    clearCatalogTextCache();
    try {
        const [one, two] = await Promise.all([loadCatalogText('move'), loadCatalogText('move')]);
        assert.equal(one, two);
        assert.equal(calls, 1);
        const before = calls;
        assert.ok(getCatalogText('move', 'tackle').original);
        assert.ok(getCatalogText('move', 'tackle').portuguese);
        assert.equal(calls, before, 'language switching makes no request');
        await Promise.all([loadCatalogText('ability'), loadCatalogText('item'),
            ...Array.from({ length: 11 }, (_, index) => loadCatalogText('species', 1 + index * 100))]);
        const stats = getCatalogCacheStats();
        assert.ok(stats.entries <= CATALOG_CACHE_LIMIT);
        assert.ok(stats.bytes <= CATALOG_CACHE_BYTES);
        assert.equal(stats.requests, 0);
        const invalidBefore = calls;
        assert.equal(await loadCatalogText('species', -1), null);
        assert.equal(await loadCatalogText('species', 1026), null);
        assert.equal(await loadCatalogText('account'), null);
        assert.equal(calls, invalidBefore);
        clearCatalogTextCache();
        globalThis.fetch = async () => ({ ok: true, text: async () => ' '.repeat(CATALOG_CACHE_BYTES) });
        assert.equal(await loadCatalogText('item'), null);
        assert.deepEqual(getCatalogCacheStats(), { entries: 0, bytes: 0, requests: 0 });
    } finally {
        globalThis.fetch = priorFetch;
        clearCatalogTextCache();
    }
});

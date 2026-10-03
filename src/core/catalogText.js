import { cleanDescription } from './descriptions.js';

// Public reference text is disposable cache data. It never shares storage with
// Boxes, room credentials or an account, and does not use a translation service.
export const CATALOG_CACHE_LIMIT = 8;
export const CATALOG_CACHE_BYTES = 8 * 1024 * 1024;
const cache = new Map();
const requests = new Map();
const kinds = new Set(['species', 'ability', 'move', 'item']);
let retainedBytes = 0;

const speciesBucket = id => Math.floor((Math.max(1, Number(id) || 1) - 1) / 100);
const keyFor = (kind, id) => kind === 'species' ? `species-${speciesBucket(id)}` : kind;

const keep = (key, data, bytes) => {
    const previous = cache.get(key);
    if (previous) retainedBytes -= previous.bytes;
    cache.delete(key);
    cache.set(key, { data, bytes });
    retainedBytes += bytes;
    while (cache.size > CATALOG_CACHE_LIMIT || retainedBytes > CATALOG_CACHE_BYTES) {
        const oldest = cache.keys().next().value;
        const entry = cache.get(oldest);
        retainedBytes -= entry.bytes;
        cache.delete(oldest);
    }
};

const read = key => {
    const entry = cache.get(key);
    if (!entry) return null;
    cache.delete(key);
    cache.set(key, entry);
    return entry.data;
};

export const clearCatalogTextCache = () => {
    cache.clear();
    retainedBytes = 0;
};

export const getCatalogCacheStats = () => ({ entries: cache.size, bytes: retainedBytes, requests: requests.size });

export const loadCatalogText = async (kind, id) => {
    if (!kinds.has(kind)) return null;
    if (kind === 'species' && (!Number.isInteger(Number(id)) || Number(id) < 1 || Number(id) > 1025)) return null;
    const key = keyFor(kind, id);
    const ready = read(key);
    if (ready) return ready;
    if (requests.has(key)) return requests.get(key);
    const task = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`/catalog/v1/${key}.json`, { signal: controller.signal });
            if (!response.ok) return null;
            const text = await response.text();
            // A malformed or oversized reference response cannot occupy the cache.
            const bytes = text.length * 2;
            if (bytes > CATALOG_CACHE_BYTES) return null;
            const data = JSON.parse(text);
            if (data?.schemaVersion !== 1 || data.kind !== kind || !data.entries || !data.texts) return null;
            keep(key, data, bytes);
            return data;
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    })();
    requests.set(key, task);
    try { return await task; }
    finally { requests.delete(key); }
};

const pairAt = (data, key, effectChance) => {
    const pair = data?.texts?.[key];
    if (!Array.isArray(pair) || !pair[0] || !pair[1]) return null;
    return {
        original: cleanDescription(pair[0], effectChance),
        portuguese: cleanDescription(pair[1], effectChance)
            .replace(/\bPoké\s?bolas\b/gi, 'Poké Balls')
            .replace(/\bPoké\s?bola\b/gi, 'Poké Ball')
            .replace(/\bRei Alado\b/g, 'Winged King')
            .replace(/\bSerpente Férrea\b/g, 'Iron Serpent'),
        originalLanguage: 'en',
    };
};

const byId = (data, id) => {
    const direct = data?.entries?.[String(id || '').toLowerCase()];
    if (direct) return direct;
    const numeric = Number(id);
    if (!Number.isInteger(numeric)) return null;
    return Object.values(data?.entries || {}).find(entry => entry.id === numeric) || null;
};

const emptyPair = () => ({ original: '', portuguese: '', originalLanguage: 'en', source: null, version: null, sourceKind: null });

const legendsGames = new Set(['legends-arceus', 'legends-za', 'mega-dimension']);

/** Literal, pinned metadata for the selected ruleset, separate from prose. */
export const getCatalogMoveMetadata = (id, versionGroup = 'scarlet-violet') => {
    const data = read('move');
    const entry = byId(data, id);
    const generation = data?.versionGenerations?.[versionGroup];
    if (!entry?.battleData?.base || !generation || legendsGames.has(versionGroup)) return null;
    let result = { ...entry.battleData.base };
    for (let current = 8; current >= generation; current--) {
        if (entry.battleData[`gen${current}`]) result = { ...result, ...entry.battleData[`gen${current}`] };
    }
    const special = versionGroup === 'champions' ? 'champions'
        : versionGroup === 'lets-go-pikachu-lets-go-eevee' ? 'letsgo'
            : versionGroup === 'brilliant-diamond-shining-pearl' ? 'bdsp' : null;
    if (special && entry.battleData[special]) result = { ...result, ...entry.battleData[special] };
    // Before the Gen4 split the damaging category came from the move's type.
    if (generation <= 3 && result.category !== 'Status') {
        result.category = data.legacySpecialTypes?.includes(result.type?.toLowerCase()) ? 'Special' : 'Physical';
    }
    // Official Gen1/2 battles have one opponent, even when a later simulator
    // inherits the modern spread-target identifier for the same move.
    if (generation <= 2 && ['allAdjacent', 'allAdjacentFoes'].includes(result.target)) result.target = 'normal';
    return { ...result, generation };
};

export const getCatalogText = (kind, id, detail = {}, { versionGroup, short = false, flavorOnly = false } = {}) => {
    const data = read(keyFor(kind, id));
    const entry = byId(data, id || detail?.name || detail?.id);
    if (!entry) return emptyPair();
    if (entry.mechanics?.base && !flavorOnly && !legendsGames.has(versionGroup)) {
        let revised = { ...entry.mechanics.base };
        const generation = data.versionGenerations?.[versionGroup] || 9;
        // Overrides inherit downward: a Gen8 change also applies in Gen7 until
        // a more specific Gen7/Gen6/etc. override replaces it.
        for (let current = 8; current >= generation; current--) {
            if (entry.mechanics[`gen${current}`]) revised = { ...revised, ...entry.mechanics[`gen${current}`] };
        }
        if (versionGroup === 'champions' && entry.mechanics.champions) revised = { ...revised, ...entry.mechanics.champions };
        if (versionGroup === 'lets-go-pikachu-lets-go-eevee' && entry.mechanics.letsgo) revised = { ...revised, ...entry.mechanics.letsgo };
        const pair = pairAt(data, short ? revised.short || revised.effect : revised.effect || revised.short, detail?.effect_chance);
        if (pair) return { ...pair, source: 'pokemon-showdown', version: versionGroup || 'scarlet-violet', sourceKind: 'editorial' };
    }
    // A selected historical game uses that game's real flavour, rather than
    // presenting a current-generation effect as if it belonged to an old game.
    const flavor = versionGroup && versionGroup !== 'auto'
        ? entry.flavors?.find(value => value[0] === versionGroup)
        : null;
    // Legends has its own combat rules. Its official in-game text must not be
    // replaced by a main-series generation explanation from Showdown.
    const key = legendsGames.has(versionGroup) ? flavor?.[1]
        : flavor?.[1] || (short ? entry.short || entry.effect : entry.effect || entry.short) || entry.flavors?.[0]?.[1];
    const pair = pairAt(data, key, detail?.effect_chance);
    if (!pair) return emptyPair();
    const latest = !entry.effect && !entry.short ? entry.flavors?.[0]?.[0] : null;
    return {
        ...pair,
        source: 'pokeapi',
        version: flavor?.[0] || latest,
        sourceKind: 'editorial',
    };
};

export const getSpeciesRecordHistory = (speciesId, formName) => {
    const data = read(keyFor('species', speciesId));
    const entries = data?.entries?.[String(speciesId)] || [];
    const formSpecific = entries.filter(value => value[3] === formName);
    return entries.filter(value => !value[3] && !(value[0] === 'pokemon-go' && formSpecific.length))
        .concat(formSpecific)
        .sort((left, right) => right[2] - left[2])
        .flatMap(entry => {
            const pair = pairAt(data, entry[1]);
            if (!pair) return [];
            const go = entry[0] === 'pokemon-go';
            return [{
                ...pair,
                id: `${entry[0]}${entry[3] ? `:${entry[3]}` : ''}`,
                version: entry[0],
                label: data.labels?.[entry[0]] || entry[0],
                source: go ? 'pokemon-go' : 'pokeapi',
                sourceKind: go ? 'official-localization' : 'editorial',
            }];
        });
};

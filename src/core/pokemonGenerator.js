import { calculateStat, convertToTTRPG, extractId, fetchCached, getLatestVersionGroup, NATURES, TYPES } from './mechanics.js';
import { integerInRange } from './math.js';
import { randomInt } from './random.js';
import { compactPokemon, normalizePokemon, STAT_KEYS } from './team.js';
import { getMoveReferenceForMode, getPokemonAtGeneration, getPokemonReferenceForMode, getReferenceGameGeneration } from './referenceGames.js';
import { loadCatalogText } from './catalogText.js';
import { dexEntryRegion } from './dexCollection.js';

export const GENERATOR_REQUEST_CONCURRENCY = 3;
export const GENERATOR_DRAFT_KEY = 'myowndex_generator_v1';
export const GENERATION_RANGES = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];
const API = 'https://pokeapi.co/api/v2/';
const requestQueue = [];
let activeRequests = 0;
const abortError = () => Object.assign(new Error('Geração interrompida.'), { name: 'AbortError' });
const checkSignal = signal => { if (signal?.aborted) throw abortError(); };

// The shared limit also covers a cancelled run whose cached request is still
// finishing. Starting a replacement can never multiply network concurrency.
const drainRequests = () => {
    while (activeRequests < GENERATOR_REQUEST_CONCURRENCY && requestQueue.length) {
        const task = requestQueue.shift();
        task.signal?.removeEventListener('abort', task.abort);
        if (task.signal?.aborted) { task.reject(abortError()); continue; }
        activeRequests += 1;
        Promise.resolve().then(task.run).then(task.resolve, task.reject).finally(() => {
            activeRequests -= 1;
            drainRequests();
        });
    }
};

export const fetchGeneratorData = (url, { signal, fetcher = fetchCached } = {}) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const task = { signal, resolve, reject, run: async () => {
        checkSignal(signal);
        const value = await fetcher(url, { timeoutMs: 10000 });
        checkSignal(signal);
        if (!value) throw new Error('A Pokédex está indisponível agora. Tente novamente quando a conexão voltar.');
        return value;
    } };
    task.abort = () => {
        const index = requestQueue.indexOf(task);
        if (index >= 0) { requestQueue.splice(index, 1); reject(abortError()); }
    };
    signal?.addEventListener('abort', task.abort, { once: true });
    requestQueue.push(task);
    drainRequests();
});

export const normalizeGeneratorOptions = (options = {}) => ({
    count: integerInRange(options.count, 1, 6, 1),
    level: integerInRange(options.level, 1, options.experienceMode === 'game' ? 100 : 200, 5),
    speciesId: integerInRange(options.speciesId, 0, 1025, 0),
    formKey: typeof options.formKey === 'string' && /^[a-z0-9-]{1,120}$/.test(options.formKey) ? options.formKey : '',
    generation: integerInRange(options.generation, 0, 9, 0),
    type: TYPES.includes(options.type) && options.type !== 'stellar' ? options.type : '',
    region: ['alola', 'galar', 'hisui', 'paldea'].includes(options.region) ? options.region : '',
    versionGroup: typeof options.versionGroup === 'string' ? options.versionGroup : 'auto',
    experienceMode: ['game', 'rpg', 'free'].includes(options.experienceMode) ? options.experienceMode : 'rpg',
    shiny: Boolean(options.shiny),
    hiddenAbility: Boolean(options.hiddenAbility),
    legendary: ['exclude', 'only'].includes(options.legendary) ? options.legendary : 'all',
    nature: Object.prototype.hasOwnProperty.call(NATURES, options.nature) ? options.nature : 'random',
});

export const getGeneratorSpeciesPool = (catalogue, options = {}, typeIds = null, metadata = {}) => {
    const normalized = normalizeGeneratorOptions(options);
    const range = GENERATION_RANGES[normalized.generation - 1];
    const gameGeneration = normalized.experienceMode === 'game' ? getReferenceGameGeneration(normalized.versionGroup) || 9 : 9;
    return (Array.isArray(catalogue) ? catalogue : []).map(entry => ({
        ...entry,
        id: Number(entry.speciesId || extractId(entry.url)),
    })).filter(entry => {
        if (!Number.isInteger(entry.id) || entry.id < 1 || entry.id > 1025) return false;
        if (normalized.speciesId && entry.id !== normalized.speciesId) return false;
        if (normalized.speciesId && normalized.formKey && entry.formKey !== normalized.formKey) return false;
        if (normalized.speciesId && !normalized.formKey && entry.formKey && !entry.isPrimarySpecies) return false;
        const meta = metadata[entry.id];
        const entryGeneration = Number(entry.generation || meta?.generation);
        if (normalized.experienceMode === 'game' && normalized.versionGroup !== 'auto'
            && Number.isInteger(entryGeneration) && entryGeneration > gameGeneration) return false;
        if (normalized.generation && Number.isInteger(entryGeneration) && entryGeneration !== normalized.generation) return false;
        if (normalized.generation && !Number.isInteger(entryGeneration) && range && (entry.id < range[0] || entry.id > range[1])) return false;
        if (normalized.region && dexEntryRegion(entry) !== normalized.region) return false;
        if (normalized.legendary !== 'all' && meta) {
            const special = Boolean(meta.legendary || meta.mythical);
            if (normalized.legendary === 'only' ? !special : special) return false;
        }
        const pinnedTypes = Array.isArray(entry.types) && entry.types.length
            ? getGeneratorSpeciesTypes(entry, gameGeneration)
            : getGeneratorSpeciesTypes(meta, gameGeneration);
        if (normalized.type && pinnedTypes?.length && !pinnedTypes.includes(normalized.type)) return false;
        if (typeIds && !entry.formKey && !typeIds.has(entry.id)) return false;
        return true;
    });
};

export const getGeneratorSpeciesTypes = (entry, generation = 9) => {
    const past = (entry?.pastTypes || []).filter(value => value.generation >= generation)
        .sort((a, b) => a.generation - b.generation)[0];
    return past?.types || entry?.types || [];
};

export const getGeneratorLearnset = (pokemon, versionGroup, level) => {
    const resolved = getLatestVersionGroup(pokemon?.moves, versionGroup);
    if (!resolved) return { versionGroup: null, moves: [] };
    const legal = new Map();
    for (const entry of pokemon.moves || []) {
        const levels = (entry.version_group_details || []).filter(detail => detail.version_group?.name === resolved
            && detail.move_learn_method?.name === 'level-up' && Number(detail.level_learned_at) <= level);
        if (entry.move?.name && levels.length) legal.set(entry.move.name, {
            ...entry.move,
            level: Math.max(...levels.map(detail => Number(detail.level_learned_at) || 0)),
        });
    }
    // A natural encounter knows its four most recently learned moves. Machine,
    // tutor and egg moves stay available through the ordinary PC editor.
    return { versionGroup: resolved, moves: [...legal.values()].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)).slice(0, 4) };
};

export const getGeneratorGender = (rate, random) => {
    if (rate === -1) return 'N';
    if (rate === 0) return 'M';
    if (rate === 8) return 'F';
    return randomInt(8, random) < integerInRange(rate, 0, 8, 0) ? 'F' : 'M';
};

export const getGeneratedHp = (partner, experienceMode = 'rpg') => {
    const base = partner.species?.stats?.find(entry => entry.stat?.name === 'hp')?.base_stat;
    const hp = calculateStat(base, partner.evs?.hp, partner.ivs?.hp, partner.level, 1, true, partner.species?.name);
    return experienceMode === 'game' ? hp : convertToTTRPG(hp, true);
};

export const getGeneratorGameReference = getPokemonAtGeneration;

export const buildGeneratedPokemon = ({ pokemon, species, learnset, moveData = [], options = {}, formIdentity = null, random }) => {
    const normalized = normalizeGeneratorOptions(options);
    if (!pokemon?.name || !STAT_KEYS.every(stat => pokemon.stats?.some(entry => entry.stat?.name === stat && Number.isInteger(entry.base_stat) && entry.base_stat > 0)) || !species?.name || !learnset?.versionGroup) throw new Error('Este Pokémon não trouxe uma ficha completa para o jogo escolhido.');
    const validAbilities = (pokemon.abilities || []).filter(entry => entry.ability?.name);
    const abilities = validAbilities.filter(entry => normalized.hiddenAbility || !entry.is_hidden);
    const selectedAbilities = abilities.length ? abilities : validAbilities;
    const nature = normalized.nature === 'random' ? Object.keys(NATURES)[randomInt(Object.keys(NATURES).length, random)] : normalized.nature;
    const partner = normalizePokemon({
        species: { ...pokemon, gender_rate: species.gender_rate },
        genderRate: species.gender_rate,
        gender: getGeneratorGender(species.gender_rate, random),
        level: normalized.level,
        nature,
        ability: selectedAbilities.length ? selectedAbilities[randomInt(selectedAbilities.length, random)].ability.name : '',
        ivs: Object.fromEntries(STAT_KEYS.map(stat => [stat, randomInt(32, random)])),
        evs: Object.fromEntries(STAT_KEYS.map(stat => [stat, 0])),
        shiny: normalized.shiny,
        friendship: species.base_happiness,
        teraType: pokemon.types?.[0]?.type?.name || '',
        moves: learnset.moves.map(move => move.name),
        formKey: formIdentity?.formKey || '',
        formId: formIdentity?.formId || null,
        rpg: { xp: 0, pp: learnset.moves.map(move => moveData.find(data => data?.name === move.name)?.pp ?? null) },
    });
    partner.rpg.currentHp = getGeneratedHp(partner, normalized.experienceMode);
    return compactPokemon(partner);
};

const shuffled = (values, random) => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const other = randomInt(index + 1, random);
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
};

export const getGeneratorDexEntryGroups = values => {
    const byDexEntry = new Map();
    for (const entry of Array.isArray(values) ? values : []) {
        const id = Number(entry?.id || entry?.speciesId || extractId(entry?.url));
        if (!Number.isInteger(id) || id < 1 || id > 1025) continue;
        if (!byDexEntry.has(id)) byDexEntry.set(id, []);
        byDexEntry.get(id).push(entry);
    }
    return [...byDexEntry.values()];
};

export const getGeneratorRandomCandidates = (values, random) => {
    // Fairness happens in two separate draws:
    // 1) shuffle National Dex entries, so every entry has the same weight;
    // 2) only after an entry is chosen, draw one eligible mutually-exclusive
    //    form inside that entry. Extra forms can never buy extra lottery tickets.
    const dexEntries = shuffled(getGeneratorDexEntryGroups(values), random);
    return dexEntries.map(forms => forms[randomInt(forms.length, random)]);
};

export const generatePokemon = async (catalogue, options = {}, { signal, fetcher = fetchCached, random, onProgress, metadata = {} } = {}) => {
    const normalized = normalizeGeneratorOptions(options);
    const request = url => fetchGeneratorData(url, { signal, fetcher });
    checkSignal(signal);
    let typeIds = null;
    const hasPinnedTypes = Array.isArray(catalogue) && catalogue.every(entry =>
        Array.isArray(entry.types) || Array.isArray(metadata[Number(entry.speciesId || extractId(entry.url))]?.types));
    // A current type index cannot exclude old Normal Clefairy or pure Electric
    // Magnemite. Without the pinned index, inspect candidates in the real game.
    const historicalTypes = normalized.experienceMode === 'game' && getReferenceGameGeneration(normalized.versionGroup) < 6 && normalized.versionGroup !== 'auto';
    if (normalized.type && !hasPinnedTypes && !historicalTypes) {
        const type = await request(`${API}type/${normalized.type}/`);
        typeIds = new Set((type.pokemon || []).map(entry => Number(extractId(entry.pokemon?.url))).filter(id => id <= 1025));
    }
    const pool = getGeneratorSpeciesPool(catalogue, normalized, typeIds, metadata);
    if (!pool.length) throw new Error('Nenhum Pokémon combina com essas escolhas. Mude os filtros e tente de novo.');
    const pinned = normalized.speciesId ? pool[0] : null;
    const candidates = pinned
        ? Array.from({ length: normalized.count }, () => pinned)
        : getGeneratorRandomCandidates(pool, random);
    const result = [];
    let checked = 0;
    // Load the bundled rules once; historical PP must not depend on whether
    // the user happened to open a move's Pokédex reference before generating.
    await loadCatalogText('move');
    checkSignal(signal);
    // Bounded work: rare filters never fetch the entire national Pokédex.
    for (const entry of candidates.slice(0, Math.max(36, normalized.count * 10))) {
        checkSignal(signal);
        const species = await request(entry.url);
        const legendary = species.is_legendary || species.is_mythical;
        if ((normalized.legendary === 'only' && !legendary) || (normalized.legendary === 'exclude' && legendary)) continue;
        const requestedPokemonName = entry.pokemonName || null;
        const selectedForm = requestedPokemonName
            ? species.varieties?.find(variety => variety.pokemon?.name === requestedPokemonName)?.pokemon
            : null;
        const defaultForm = selectedForm || species.varieties?.find(variety => variety.is_default)?.pokemon;
        if (!defaultForm?.url) throw new Error('A Pokédex não trouxe a forma escolhida deste Pokémon.');
        const currentPokemon = await request(defaultForm.url);
        const formAppearance = entry.formId ? await request(`${API}pokemon-form/${entry.formId}/`) : null;
        const formSprites = formAppearance?.sprites
            ? Object.fromEntries(Object.entries(formAppearance.sprites).filter(([, value]) => Boolean(value)))
            : null;
        const pokemonWithAppearance = formSprites && Object.keys(formSprites).length
            ? { ...currentPokemon, sprites: { ...(currentPokemon.sprites || {}), ...formSprites } }
            : currentPokemon;
        const learnset = getGeneratorLearnset(currentPokemon, normalized.versionGroup, normalized.level);
        checked += 1;
        onProgress?.({ completed: result.length, total: normalized.count, checked });
        if (!learnset.versionGroup) continue;
        const game = normalized.experienceMode === 'game' ? await request(`${API}version-group/${learnset.versionGroup}/`) : null;
        if (game && !Number(extractId(game.generation?.url))) throw new Error('A Pokédex não trouxe a geração do jogo escolhido.');
        const pokemon = getPokemonReferenceForMode(pokemonWithAppearance, game || learnset.versionGroup, { experienceMode: normalized.experienceMode });
        if (normalized.type && !pokemon.types?.some(value => value.type?.name === normalized.type)) continue;
        const moveData = [];
        for (const move of learnset.moves) {
            const data = await request(move.url || `${API}move/${move.name}/`);
            // Only Jogos uses old-game PP. RPG/Livre retain current rules even
            // when the chosen game supplies an older Pokémon repertoire.
            moveData.push(getMoveReferenceForMode(data, { value: learnset.versionGroup, url: game?.url || `${API}version-group/${game?.id}/` }, normalized.experienceMode));
        }
        const partner = buildGeneratedPokemon({
            pokemon,
            species,
            learnset,
            moveData,
            options: normalized,
            formIdentity: entry.formKey ? { formKey: entry.formKey, formId: entry.formId } : null,
            random,
        });
        result.push({ pokemon: partner, versionGroup: learnset.versionGroup });
        onProgress?.({ completed: result.length, total: normalized.count, checked });
        if (result.length === normalized.count) break;
    }
    checkSignal(signal);
    if (!result.length) throw new Error('Nenhum Pokémon está disponível com essas escolhas. Mude o jogo ou amplie os filtros.');
    return result;
};

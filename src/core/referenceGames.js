import { extractId, getLatestVersionGroup, VERSION_LABELS, VERSION_PRIORITY } from './mechanics.js';
import { getCatalogMoveMetadata } from './catalogText.js';
import { getCurrentMoveReference } from './championsMoves.js';

const versionId = version => Number(version?.id || extractId(version?.url)) || 0;

// Pinned PokeAPI version_groups.csv chronology. IDs are not chronology:
// Red/Green Japan was added as ID28, after Scarlet/Violet's ID25.
const versionRows = [
    [1, 'red-blue', 1, 3], [2, 'yellow', 1, 4], [3, 'gold-silver', 2, 5], [4, 'crystal', 2, 6],
    [5, 'ruby-sapphire', 3, 7], [6, 'emerald', 3, 8], [7, 'firered-leafgreen', 3, 11],
    [8, 'diamond-pearl', 4, 12], [9, 'platinum', 4, 13], [10, 'heartgold-soulsilver', 4, 14],
    [11, 'black-white', 5, 15], [12, 'colosseum', 3, 9], [13, 'xd', 3, 10], [14, 'black-2-white-2', 5, 16],
    [15, 'x-y', 6, 17], [16, 'omega-ruby-alpha-sapphire', 6, 18], [17, 'sun-moon', 7, 19],
    [18, 'ultra-sun-ultra-moon', 7, 20], [19, 'lets-go-pikachu-lets-go-eevee', 7, 21],
    [20, 'sword-shield', 8, 22], [21, 'the-isle-of-armor', 8, 23], [22, 'the-crown-tundra', 8, 24],
    [23, 'brilliant-diamond-shining-pearl', 8, 25], [24, 'legends-arceus', 8, 26], [25, 'scarlet-violet', 9, 27],
    [26, 'the-teal-mask', 9, 28], [27, 'the-indigo-disk', 9, 29], [28, 'red-green-japan', 1, 1],
    [29, 'blue-japan', 1, 2], [30, 'legends-za', 9, 30], [31, 'mega-dimension', 9, 31], [32, 'champions', 9, 32],
];
const versionRow = value => versionRows.find(([id, name]) => id === versionId(value) || name === value?.value || name === value?.name);
const versionOrder = value => versionRow(value)?.[3] || versionId(value);
export const getReferenceGameGeneration = value => versionRow(typeof value === 'string' ? { value } : value)?.[2] || null;
const targetNames = {
    normal: 'selected-pokemon', adjacentFoe: 'selected-pokemon', any: 'selected-pokemon',
    self: 'user', all: 'entire-field', allySide: 'users-field', foeSide: 'opponents-field',
    allyTeam: 'user-and-allies', adjacentAlly: 'ally', adjacentAllyOrSelf: 'user-or-ally',
    allAdjacent: 'all-other-pokemon', allAdjacentFoes: 'all-opponents', randomNormal: 'random-opponent',
    scripted: 'specific-move',
};

/** Only show games that actually supplied this Pokémon's learnset. */
export const getLearnsetGames = moves => {
    const observed = new Map();
    for (const move of Array.isArray(moves) ? moves : []) {
        for (const detail of move?.version_group_details || []) {
            const version = detail.version_group;
            if (version?.name) observed.set(version.name, Math.max(versionId(version), observed.get(version.name) || 0));
        }
    }
    const priority = value => {
        const index = VERSION_PRIORITY.indexOf(value);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...observed].sort(([a, aId], [b, bId]) => priority(a) - priority(b) || bId - aId)
        .map(([value, id]) => ({ value, id, label: VERSION_LABELS[value] || value.replace(/-/g, ' ') }));
};

export const resolveLearnsetGame = (moves, selected = 'auto') => getLatestVersionGroup(moves, selected);

/** PokéAPI marks past values with the first version group AFTER the change. */
export const getMoveAtVersion = (move, selectedVersion) => {
    const selected = typeof selectedVersion === 'number' ? { id: selectedVersion }
        : typeof selectedVersion === 'string' ? { value: selectedVersion } : selectedVersion;
    const row = versionRow(selected);
    const selectedId = versionId(selected) || row?.[0];
    if (!move || !selectedId) return move;
    const selectedOrder = versionOrder(selected);
    const result = { ...move };
    const changes = (Array.isArray(move.past_values) ? move.past_values : [])
        .filter(change => versionOrder(change.version_group) > selectedOrder)
        .sort((a, b) => versionOrder(b.version_group) - versionOrder(a.version_group));
    for (const change of changes) {
        for (const field of ['accuracy', 'power', 'pp', 'effect_chance', 'type']) {
            if (change[field] != null) result[field] = change[field];
        }
        if (change.effect_entries?.length) result.effect_entries = change.effect_entries;
    }
    // Game-specific prose must never quietly come from a later game.
    const flavors = (move.flavor_text_entries || []).filter(entry => versionOrder(entry.version_group) <= selectedOrder);
    const newest = Math.max(0, ...flavors.map(entry => versionOrder(entry.version_group)));
    result.flavor_text_entries = flavors.filter(entry => versionOrder(entry.version_group) === newest);
    const metadata = getCatalogMoveMetadata(move.name || move.id, row?.[1] || selected?.value || selected?.name);
    result.reference_generation = row?.[2] || null;
    result.reference_metadata_verified = Boolean(metadata);
    if (metadata) {
        if (metadata.category) result.damage_class = { name: metadata.category.toLowerCase() };
        if (metadata.type) result.type = { name: metadata.type.toLowerCase() };
        if (targetNames[metadata.target]) result.target = { name: targetNames[metadata.target] };
        if (metadata.basePower != null) result.power = metadata.basePower || null;
        if (metadata.accuracy != null) result.accuracy = metadata.accuracy === true ? null : metadata.accuracy;
        if (metadata.pp != null) result.pp = metadata.pp;
        if (metadata.priority != null) result.priority = metadata.priority;
    }
    return result;
};

/** In RPG/Livre a game selects the repertoire, while current rules still apply. */
export const getMoveReferenceForMode = (move, selectedVersion, experienceMode = 'rpg') => {
    const selected = experienceMode === 'game' ? selectedVersion : { id: versionRow({ value: 'champions' })?.[0], value: 'champions' };
    const reference = getMoveAtVersion(move, selected);
    return experienceMode === 'game' ? reference : getCurrentMoveReference(reference);
};

const canonicalStats = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
const referenceName = value => typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value) ? value : null;
const compactCanonicalMetadata = source => {
    if (!source || !Array.isArray(source.stats) || source.stats.length !== 6
        || !Array.isArray(source.types) || source.types.length < 1 || source.types.length > 2
        || !Array.isArray(source.abilities) || source.abilities.length > 3) return null;
    const stats = canonicalStats.map(name => {
        const entry = source.stats.find(value => value.stat?.name === name);
        if (!Number.isInteger(entry?.base_stat) || entry.base_stat < 1 || entry.base_stat > 255) return null;
        return { base_stat: entry.base_stat, stat: { name },
            ...(Number.isInteger(entry.effort) && entry.effort >= 0 && entry.effort <= 3 ? { effort: entry.effort } : {}) };
    });
    const types = source.types.map((entry, index) => {
        const name = referenceName(entry?.type?.name);
        return name ? { slot: index + 1, type: { name } } : null;
    });
    const abilities = source.abilities.map((entry, index) => {
        const name = referenceName(entry?.ability?.name);
        return name ? { slot: Number.isInteger(entry.slot) && entry.slot >= 1 && entry.slot <= 3 ? entry.slot : index + 1,
            is_hidden: Boolean(entry.is_hidden), ability: { name } } : null;
    });
    return stats.every(Boolean) && types.every(Boolean) && abilities.every(Boolean)
        ? { stats, types, abilities } : null;
};

/** Bounded canonical fields survive an old-game Box without a catalogue fetch. */
export const getStoredCurrentPokemonReference = pokemon => compactCanonicalMetadata(pokemon?.reference_current);

/** Real historical slots/stat deltas, without replacing unchanged data. */
export const getPokemonAtGeneration = (pokemon, generation) => {
    const current = getStoredCurrentPokemonReference(pokemon) || compactCanonicalMetadata(pokemon);
    const baseline = current ? { ...pokemon, ...current } : pokemon;
    const result = { ...baseline };
    if (current) result.reference_current = compactCanonicalMetadata(current);
    const history = key => (pokemon[key] || []).filter(entry => Number(extractId(entry.generation?.url)) >= generation)
        .sort((a, b) => Number(extractId(b.generation?.url)) - Number(extractId(a.generation?.url)));
    // Ability and stat history contains changed slots, not complete snapshots.
    // Apply every newer change backward; null removes only that ability slot.
    const abilities = new Map((baseline.abilities || []).map((entry, index) => [entry.slot || index + 1, { ...entry, ability: { ...entry.ability } }]));
    for (const previous of history('past_abilities')) {
        (previous.abilities || []).forEach((entry, index) => {
            const slot = entry.slot || index + 1;
            if (entry.ability?.name) abilities.set(slot, { ...entry, ability: { ...entry.ability } }); else abilities.delete(slot);
        });
    }
    result.abilities = [...abilities].sort(([left], [right]) => left - right).map(([, entry]) => entry);
    if (generation < 3) result.abilities = [];
    const previousTypes = history('past_types').at(-1);
    if (previousTypes?.types) result.types = previousTypes.types.map(entry => ({ ...entry, type: { ...entry.type } }));
    result.stats = (baseline.stats || []).map(entry => ({ ...entry, stat: { ...entry.stat } }));
    for (const previous of history('past_stats')) {
        result.stats = result.stats.map(entry => {
            const prior = (previous.stats || []).find(value => value.stat?.name === entry.stat?.name)
                || (generation === 1 && ['special-attack', 'special-defense'].includes(entry.stat?.name)
                    ? (previous.stats || []).find(value => value.stat?.name === 'special') : null);
            return prior ? { ...entry, base_stat: prior.base_stat } : entry;
        });
    }
    return result;
};

export const getPokemonReferenceForMode = (pokemon, selectedGame, { experienceMode = 'rpg' } = {}) => {
    if (experienceMode !== 'game') {
        const current = getStoredCurrentPokemonReference(pokemon);
        return current ? { ...pokemon, ...current } : pokemon;
    }
    const generation = Number(extractId(selectedGame?.generation?.url)) || getReferenceGameGeneration(selectedGame);
    return generation ? getPokemonAtGeneration(pokemon, generation) : pokemon;
};

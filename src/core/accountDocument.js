import { compactPokemon, compactTeam, dedupeTeams } from "./team.js";
import { normalizeAccountXpDocument } from "./accountXp.js";
import { normalizeLocalDiceRoom } from "./localPokemonRolls.js";
import { localRollSpec, normalizeLocalRollHistory } from "./localRolls.js";
import { mergePokemonExperienceAwards } from "./experience.js";

export const ACCOUNT_SCHEMA = 1;
export const ACCOUNT_DOCUMENT_LIMIT = 4 * 1024 * 1024;
export const ACCOUNT_SYNC_KEY = "myowndex_account_sync_v1";
export const ACCOUNT_RESOURCE_KEYS = Object.freeze({
    boxes: "myowndex_rotom_v4", dex: "myowndex_dex_favorites_v1",
    preferences: "myowndex_preferences_v1", appearance: "myowndex_appearance_v1",
    localAdventure: "myowndex_local_room_v1",
    dicePreferences: "myowndex_local_dice_preferences_v1",
    diceRoom: "myowndex_local_dice_room_v1",
    generatorDraft: "myowndex_generator_v1",
    rollHistory: "myowndex_local_roll_history_v3",
});
const TOOL_RESOURCES = ["dicePreferences", "diceRoom", "generatorDraft"];

const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clock = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const clockMap = value => Object.fromEntries(Object.entries(object(value)).filter(([key]) => key !== "__proto__" && key !== "constructor" && key !== "prototype").map(([key, time]) => [key, clock(time)]));
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
export const accountValuesEqual = (first, second) => JSON.stringify(sorted(first)) === JSON.stringify(sorted(second));
// Merge clocks and tombstones must be stored, but they never require replacing
// an open editor or reapplying the same game data to its controls.
export const accountContentEqual = (first, second) => accountValuesEqual(
    Object.fromEntries(["boxes", "dex", "preferences", "localAdventure", "localTools"].map(key => [key, first?.[key]])),
    Object.fromEntries(["boxes", "dex", "preferences", "localAdventure", "localTools"].map(key => [key, second?.[key]])),
);
const favoriteIds = value => [...new Set((Array.isArray(value) ? value : []).map(String).filter(id => /^\d+$/.test(id)))].sort((a, b) => Number(a) - Number(b));
const boundedRollClocks = value => Object.fromEntries(Object.entries(clockMap(value))
    .sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId)).slice(0, 300));
const normalizeTools = value => {
    const source = object(value);
    let dicePreferences = null;
    try { if (source.dicePreferences) dicePreferences = localRollSpec(source.dicePreferences); } catch { /* Invalid settings never hide saved results. */ }
    const diceRoom = source.diceRoom && typeof source.diceRoom === "object" && !Array.isArray(source.diceRoom)
        ? normalizeLocalDiceRoom(source.diceRoom) : null;
    const results = (Array.isArray(source.generatorDraft?.results) ? source.generatorDraft.results : []).slice(0, 6)
        .filter(entry => entry?.pokemon?.species?.name && typeof entry.versionGroup === "string")
        .map(entry => ({ pokemon: compactPokemon(entry.pokemon), versionGroup: entry.versionGroup.slice(0, 80),
            saved: Boolean(entry.saved), exported: Boolean(entry.exported) }));
    return { dicePreferences, diceRoom, generatorDraft: results.length ? { schema: 1, results } : null,
        rollHistory: normalizeLocalRollHistory(source.rollHistory) };
};

export function normalizeAccountDocument(value = {}) {
    const source = normalizeAccountXpDocument(object(value));
    const preferences = object(source.preferences);
    return {
        schema: ACCOUNT_SCHEMA,
        boxes: dedupeTeams(source.boxes || []).map(compactTeam),
        dex: { favorites: favoriteIds(source.dex?.favorites) },
        preferences: {
            experienceMode: ["rpg", "game", "free"].includes(preferences.experienceMode) ? preferences.experienceMode : "rpg",
            view: ["room", "pokedex", "teambuilder", "guide"].includes(preferences.view) ? preferences.view : "pokedex",
            appearance: ["normal", "night"].includes(preferences.appearance) ? preferences.appearance : "normal",
        },
        localAdventure: source.localAdventure && typeof source.localAdventure === "object" ? source.localAdventure : null,
        localTools: normalizeTools(source.localTools),
        // Room credentials remain on their own device, including when signed in.
        roomSession: null,
        clocks: { preferences: clock(source.clocks?.preferences),
            ...Object.fromEntries(["experienceMode", "appearance", "view"].map(key => [`preferences.${key}`, clock(source.clocks?.[`preferences.${key}`] ?? source.clocks?.preferences)])),
            localAdventure: clock(source.clocks?.localAdventure), roomSession: 0,
            ...Object.fromEntries(TOOL_RESOURCES.map(key => [`localTools.${key}`, clock(source.clocks?.[`localTools.${key}`])])) },
        tombstones: { boxes: clockMap(source.tombstones?.boxes), favorites: clockMap(source.tombstones?.favorites),
            localRolls: boundedRollClocks(source.tombstones?.localRolls) },
        favoriteClocks: clockMap(source.favoriteClocks),
        rollClocks: boundedRollClocks(source.rollClocks),
    };
}

export function recordAccountChanges(previous, snapshot, timestamp = Date.now()) {
    const before = normalizeAccountDocument(previous);
    const next = normalizeAccountDocument({ ...before, ...snapshot,
        localTools: { ...before.localTools, ...object(snapshot?.localTools) } });
    const priorClock = [...Object.values(before.clocks), ...Object.values(before.favoriteClocks), ...Object.values(before.rollClocks),
        ...Object.values(before.tombstones.boxes), ...Object.values(before.tombstones.favorites), ...Object.values(before.tombstones.localRolls)].reduce((highest, value) => Math.max(highest, clock(value)), 0);
    const now = Math.max(clock(timestamp), priorClock) + 1;
    const nextIds = new Set(next.boxes.map(team => team.id));
    before.boxes.forEach(team => { if (!nextIds.has(team.id)) next.tombstones.boxes[team.id] = now; });
    next.boxes.forEach(team => {
        if (team.updatedAt > (next.tombstones.boxes[team.id] || 0)) delete next.tombstones.boxes[team.id];
    });
    const nextFavorites = new Set(next.dex.favorites);
    const oldFavorites = new Set(before.dex.favorites);
    before.dex.favorites.forEach(id => { if (!nextFavorites.has(id)) next.tombstones.favorites[id] = now; });
    next.dex.favorites.forEach(id => {
        if (!oldFavorites.has(id)) next.favoriteClocks[id] = now;
        if ((next.favoriteClocks[id] || 0) > (next.tombstones.favorites[id] || 0)) delete next.tombstones.favorites[id];
    });
    ["preferences", "localAdventure"].forEach(resource => {
        if (!accountValuesEqual(before[resource], next[resource])) next.clocks[resource] = now;
    });
    ["experienceMode", "appearance", "view"].forEach(key => {
        if (before.preferences[key] !== next.preferences[key]) next.clocks[`preferences.${key}`] = now;
    });
    TOOL_RESOURCES.forEach(key => {
        if (!accountValuesEqual(before.localTools[key], next.localTools[key])) next.clocks[`localTools.${key}`] = now;
    });
    const oldRolls = new Set(before.localTools.rollHistory.map(entry => entry.id));
    const nextRolls = new Set(next.localTools.rollHistory.map(entry => entry.id));
    before.localTools.rollHistory.forEach(entry => { if (!nextRolls.has(entry.id)) next.tombstones.localRolls[entry.id] = now; });
    next.localTools.rollHistory.forEach(entry => {
        if (!oldRolls.has(entry.id)) next.rollClocks[entry.id] = now;
        if ((next.rollClocks[entry.id] || 0) > (next.tombstones.localRolls[entry.id] || 0)) delete next.tombstones.localRolls[entry.id];
    });
    next.tombstones.localRolls = boundedRollClocks(next.tombstones.localRolls);
    next.rollClocks = boundedRollClocks(next.rollClocks);
    return next;
}

const semanticBox = box => box ? { ...box, updatedAt: 0, pokemon: box.pokemon.map(partner => ({ ...partner, species: { name: partner.species?.name } })) } : null;
const boxEqual = (first, second) => accountValuesEqual(semanticBox(first), semanticBox(second));
const fingerprint = value => {
    const text = JSON.stringify(sorted(value));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    return (hash >>> 0).toString(36);
};
const recoveryBox = box => {
    const id = `${box.id}-recovered-${fingerprint(semanticBox(box))}`;
    return { ...box, id, shareId: id, name: `${box.name.slice(0, 58)} · cópia recuperada` };
};
const mergeClockMaps = (first, second) => Object.fromEntries([...new Set([...Object.keys(first), ...Object.keys(second)])].map(key => [key, Math.max(clock(first[key]), clock(second[key]))]));

const mergeBoxExperienceAwards = (left, right, baseline) => {
    if (!left || !right || !baseline || left.pokemon.length !== baseline.pokemon.length || right.pokemon.length !== baseline.pokemon.length) return null;
    const metadata = box => ({ ...box, updatedAt: 0, pokemon: [] });
    if (!accountValuesEqual(metadata(left), metadata(baseline)) || !accountValuesEqual(metadata(right), metadata(baseline))) return null;
    const pokemon = baseline.pokemon.map((partner, index) => {
        const first = left.pokemon[index], second = right.pokemon[index];
        if (first?.id !== partner.id || second?.id !== partner.id) return null;
        return mergePokemonExperienceAwards(first, second, partner);
    });
    if (pokemon.some(partner => !partner)) return null;
    return { ...baseline, updatedAt: Math.max(left.updatedAt, right.updatedAt), pokemon };
};

/** Three-way merge preserves independent Boxes and recovers competing edits. */
export function mergeAccountDocuments(localValue, remoteValue, baseValue = null) {
    const local = normalizeAccountDocument(localValue);
    const remote = normalizeAccountDocument(remoteValue);
    const base = baseValue ? normalizeAccountDocument(baseValue) : null;
    const result = normalizeAccountDocument(remote);
    const recoveries = [];
    result.tombstones.boxes = mergeClockMaps(local.tombstones.boxes, remote.tombstones.boxes);
    result.tombstones.favorites = mergeClockMaps(local.tombstones.favorites, remote.tombstones.favorites);
    result.favoriteClocks = mergeClockMaps(local.favoriteClocks, remote.favoriteClocks);
    result.tombstones.localRolls = boundedRollClocks(mergeClockMaps(local.tombstones.localRolls, remote.tombstones.localRolls));
    result.rollClocks = boundedRollClocks(mergeClockMaps(local.rollClocks, remote.rollClocks));
    const localBoxes = new Map(local.boxes.map(box => [box.id, box]));
    const remoteBoxes = new Map(remote.boxes.map(box => [box.id, box]));
    const baseBoxes = new Map((base?.boxes || []).map(box => [box.id, box]));
    const boxes = new Map();
    [...new Set([...localBoxes.keys(), ...remoteBoxes.keys()])].forEach(id => {
        const left = localBoxes.get(id);
        const right = remoteBoxes.get(id);
        const previous = baseBoxes.get(id);
        let chosen = !left ? right : !right ? left : left.updatedAt > right.updatedAt ? left : right;
        if (left && right && previous) {
            const leftChanged = !boxEqual(left, previous);
            const rightChanged = !boxEqual(right, previous);
            if (leftChanged && !rightChanged) chosen = left;
            else if (rightChanged && !leftChanged) chosen = right;
        }
        const competingEdits = left && right && !boxEqual(left, right)
            && (!previous || (!boxEqual(left, previous) && !boxEqual(right, previous)));
        const mergedRewards = competingEdits && previous ? mergeBoxExperienceAwards(left, right, previous) : null;
        if (mergedRewards) chosen = mergedRewards;
        if (!mergedRewards && competingEdits) {
            const recovered = recoveryBox(chosen === left ? right : left);
            boxes.set(recovered.id, recovered);
        }
        if ((result.tombstones.boxes[id] || 0) >= chosen.updatedAt) {
            if (previous && !boxEqual(chosen, previous)) {
                const recovered = recoveryBox(chosen);
                boxes.set(recovered.id, recovered);
            }
            return;
        }
        boxes.set(id, chosen);
    });
    result.boxes = [...boxes.values()];
    result.dex.favorites = favoriteIds([...local.dex.favorites, ...remote.dex.favorites]).filter(id =>
        (result.favoriteClocks[id] || 0) > (result.tombstones.favorites[id] || -1));
    ["experienceMode", "appearance", "view"].forEach(key => {
        const path = `preferences.${key}`;
        const leftChanged = base && local.preferences[key] !== base.preferences[key];
        const rightChanged = base && remote.preferences[key] !== base.preferences[key];
        const takeLocal = leftChanged && !rightChanged ? true : rightChanged && !leftChanged ? false
            : local.clocks[path] > remote.clocks[path];
        result.preferences[key] = takeLocal ? local.preferences[key] : remote.preferences[key];
        result.clocks[path] = Math.max(local.clocks[path], remote.clocks[path]);
    });
    result.clocks.preferences = Math.max(local.clocks.preferences, remote.clocks.preferences);
    ["localAdventure"].forEach(resource => {
        const leftChanged = base && !accountValuesEqual(local[resource], base[resource]);
        const rightChanged = base && !accountValuesEqual(remote[resource], base[resource]);
        const takeLocal = leftChanged && !rightChanged ? true : rightChanged && !leftChanged ? false
            : local.clocks[resource] > remote.clocks[resource];
        result[resource] = takeLocal ? local[resource] : remote[resource];
        result.clocks[resource] = Math.max(local.clocks[resource], remote.clocks[resource]);
        if (resource === "localAdventure" && leftChanged && rightChanged && !accountValuesEqual(local[resource], remote[resource])) {
            const value = takeLocal ? remote[resource] : local[resource];
            if (value) recoveries.push({ resource, value, recoveredAt: Date.now() });
        }
    });
    TOOL_RESOURCES.forEach(key => {
        const path = `localTools.${key}`;
        const leftChanged = base && !accountValuesEqual(local.localTools[key], base.localTools[key]);
        const rightChanged = base && !accountValuesEqual(remote.localTools[key], base.localTools[key]);
        const takeLocal = leftChanged && !rightChanged ? true : rightChanged && !leftChanged ? false
            : local.clocks[path] > remote.clocks[path];
        result.localTools[key] = takeLocal ? local.localTools[key] : remote.localTools[key];
        result.clocks[path] = Math.max(local.clocks[path], remote.clocks[path]);
        if (key !== "dicePreferences" && leftChanged && rightChanged
            && !accountValuesEqual(local.localTools[key], remote.localTools[key])) {
            const value = takeLocal ? remote.localTools[key] : local.localTools[key];
            if (value) recoveries.push({ resource: path, value, recoveredAt: Date.now() });
        }
    });
    const leftRolls = new Map(local.localTools.rollHistory.map(entry => [entry.id, entry]));
    const rightRolls = new Map(remote.localTools.rollHistory.map(entry => [entry.id, entry]));
    const baseRolls = new Set((base?.localTools.rollHistory || []).map(entry => entry.id));
    const survivingRolls = [...rightRolls.values(), ...leftRolls.values()].filter(entry => {
        // Removing a known baseline receipt wins over its unchanged stale copy,
        // even after old tombstones leave the bounded metadata window.
        if (baseRolls.has(entry.id) && (!leftRolls.has(entry.id) || !rightRolls.has(entry.id))) return false;
        return (result.rollClocks[entry.id] || 0) > (result.tombstones.localRolls[entry.id] || -1);
    });
    result.localTools.rollHistory = normalizeLocalRollHistory(survivingRolls);
    return { document: normalizeAccountDocument(result), recoveries };
}

/** Reapply a complete cloud merge to one live editor resource. Edits made while
 * its durable write was pending stay in the three-way merge instead of being
 * replaced by the captured snapshot. Partial preference fields stay partial. */
export function rebaseLiveAccountDocument(snapshot, incomingDocument, previousDocument) {
    const incoming = normalizeAccountDocument(incomingDocument);
    if (!previousDocument) return incoming;
    const previous = normalizeAccountDocument(previousDocument);
    const live = recordAccountChanges(previous, {
        ...object(snapshot),
        preferences: { ...previous.preferences, ...object(snapshot?.preferences) },
        dex: { ...previous.dex, ...object(snapshot?.dex) },
    });
    return mergeAccountDocuments(live, incoming, previous).document;
}

export function importGuestDocument(accountValue, guestValue, timestamp = Date.now()) {
    const account = normalizeAccountDocument(accountValue);
    const guest = normalizeAccountDocument(guestValue);
    const byId = new Map(account.boxes.map(box => [box.id, box]));
    guest.boxes.forEach(box => {
        const existing = byId.get(box.id);
        if (!existing) byId.set(box.id, { ...box, updatedAt: timestamp });
        else if (!boxEqual(existing, box)) {
            const recovered = recoveryBox(box);
            if (!byId.has(recovered.id)) byId.set(recovered.id, { ...recovered, updatedAt: timestamp });
        }
    });
    return recordAccountChanges(account, {
        boxes: [...byId.values()],
        dex: { favorites: favoriteIds([...account.dex.favorites, ...guest.dex.favorites]) },
        localAdventure: account.localAdventure || guest.localAdventure,
        localTools: {
            ...Object.fromEntries(TOOL_RESOURCES.map(key => [key, account.localTools[key] || guest.localTools[key]])),
            rollHistory: normalizeLocalRollHistory([...account.localTools.rollHistory, ...guest.localTools.rollHistory]),
        },
    }, timestamp);
}

export function accountDocumentBytes(document) {
    return new TextEncoder().encode(JSON.stringify(document)).byteLength;
}

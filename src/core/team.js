import { fetchCached } from "./mechanics.js";
import { secureRandomId } from "./random.js";
import { readStorage, removeStorage, writeStorage } from "./storage.js";

export const TEAM_STORAGE_KEY = "myowndex_rotom_v4";
export const LEGACY_TEAM_STORAGE_KEY = "myowndex_rotom_v3";
export const TEAM_SCHEMA_VERSION = 4;
export const STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
export const RPG_STATUSES = ["", "burn", "freeze", "paralysis", "poison", "bad-poison", "sleep"];

const now = () => Date.now();
const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === "string" ? value : "";

export const createId = (prefix = "box") => {
    return secureRandomId(prefix);
};

export const clampInteger = (value, minimum, maximum, fallback = minimum) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};

export const normalizeStats = (stats, fallback, maximum) => Object.fromEntries(
    STAT_KEYS.map(stat => [stat, clampInteger(stats?.[stat], 0, maximum, fallback)])
);

const normalizeMoves = moves => {
    const normalized = asArray(moves).slice(0, 4).map(asText);
    while (normalized.length < 4) normalized.push("");
    return normalized;
};

const normalizeOptionalNumber = (value, minimum, maximum) => {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(maximum, Math.max(minimum, parsed));
};

export const normalizeRpgData = (value = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const status = asText(source.status);
    const pp = asArray(source.pp).slice(0, 4).map(entry => normalizeOptionalNumber(entry, 0, 99));
    while (pp.length < 4) pp.push(null);
    return {
        xp: normalizeOptionalNumber(source.xp, 0, 999999) ?? 0,
        currentHp: normalizeOptionalNumber(source.currentHp, 0, 99999),
        status: RPG_STATUSES.includes(status) ? status : "",
        caughtWith: asText(source.caughtWith).slice(0, 80),
        originalTrainer: asText(source.originalTrainer).slice(0, 120),
        notes: asText(source.notes).slice(0, 2000),
        animeNotes: asText(source.animeNotes).slice(0, 1000),
        pp
    };
};

const normalizeGender = (gender, rate) => {
    if (rate === -1) return "N";
    if (rate === 0) return "M";
    if (rate === 8) return "F";
    return ["M", "F"].includes(gender) ? gender : "M";
};

const speciesShell = input => {
    const source = input?.species && typeof input.species === "object" ? input.species : {};
    const name = asText(input?.formName || input?.speciesName || source.name || input?.species).toLowerCase();
    return {
        ...source,
        name,
        species: source.species || (name ? {
            name: asText(input?.speciesName || name).toLowerCase(),
            url: ""
        } : undefined)
    };
};

export const normalizePokemon = input => {
    const source = input && typeof input === "object" ? input : {};
    const species = speciesShell(source);
    const rawRate = Number(source.genderRate ?? species.gender_rate ?? -1);
    const genderRate = Number.isFinite(rawRate) ? Math.min(8, Math.max(-1, rawRate)) : -1;
    const customStatEntries = source.customStats && typeof source.customStats === "object"
        ? STAT_KEYS
            .filter(stat => Object.prototype.hasOwnProperty.call(source.customStats, stat))
            .map(stat => [stat, clampInteger(source.customStats[stat], 1, 255, 1)])
        : [];
    const customStats = customStatEntries.length ? Object.fromEntries(customStatEntries) : null;

    return {
        id: asText(source.id) || createId("partner"),
        species,
        nickname: asText(source.nickname),
        level: clampInteger(source.level, 1, 200, 5),
        item: asText(source.item).toLowerCase(),
        ability: asText(source.ability).toLowerCase(),
        nature: asText(source.nature).toLowerCase() || "hardy",
        moves: normalizeMoves(source.moves),
        ivs: normalizeStats(source.ivs, 31, 31),
        evs: normalizeStats(source.evs, 0, 252),
        canGMax: Boolean(source.canGMax),
        shiny: Boolean(source.shiny),
        dynamaxLevel: clampInteger(source.dynamaxLevel, 0, 10, 0),
        teraType: asText(source.teraType).toLowerCase(),
        friendship: clampInteger(source.friendship, 0, 255, 70),
        gender: normalizeGender(source.gender, genderRate),
        genderRate,
        genderLocked: Boolean(source.genderLocked),
        customStats,
        customTypes: asArray(source.customTypes).filter(Boolean).slice(0, 2).map(value => asText(value).toLowerCase()),
        rpg: normalizeRpgData(source.rpg)
    };
};

const compactSpecies = species => {
    if (!species || typeof species !== "object") return {};
    return {
        id: species.id,
        name: species.name,
        species: species.species ? {
            name: species.species.name,
            url: species.species.url
        } : undefined,
        abilities: species.abilities,
        sprites: species.sprites,
        stats: species.stats,
        types: species.types,
        height: species.height,
        weight: species.weight,
        gender_rate: species.gender_rate
    };
};

export const compactPokemon = pokemon => {
    const normalized = normalizePokemon(pokemon);
    return { ...normalized, species: compactSpecies(normalized.species) };
};

export const normalizeTeam = input => {
    const source = input && typeof input === "object" ? input : {};
    const id = asText(source.id) || createId("box");
    const rawUpdatedAt = Number(source.updatedAt);
    return {
        id,
        shareId: asText(source.shareId) || id,
        name: asText(source.name || source.boxName).trim().slice(0, 80) || "Box",
        versionGroup: asText(source.versionGroup || source.ruleset) || "auto",
        updatedAt: Number.isFinite(rawUpdatedAt) ? Math.max(0, rawUpdatedAt) : now(),
        pokemon: asArray(source.pokemon || source.partners).slice(0, 6).map(normalizePokemon)
    };
};

export const compactTeam = team => ({
    ...normalizeTeam(team),
    pokemon: asArray(team?.pokemon).slice(0, 6).map(compactPokemon)
});

export const dedupeTeams = teams => {
    const byShareId = new Map();
    asArray(teams).forEach(rawTeam => {
        const team = normalizeTeam(rawTeam);
        const current = byShareId.get(team.shareId);
        if (!current || team.updatedAt >= current.updatedAt) byShareId.set(team.shareId, team);
    });
    return [...byShareId.values()];
};

export const createTeam = (name = "Nova Box") => {
    const id = createId("box");
    return normalizeTeam({ id, shareId: id, name, updatedAt: now(), pokemon: [] });
};

export const removeTeamById = (teams, teamId) => {
    const source = asArray(teams);
    const index = source.findIndex(team => team.id === teamId);
    if (index < 0) return { teams: source, removed: null, index: -1 };
    return {
        teams: source.filter((_, teamIndex) => teamIndex !== index),
        removed: source[index],
        index
    };
};

export const restoreTeamAt = (teams, team, index = 0) => {
    if (!team) return asArray(teams);
    const withoutDuplicate = asArray(teams).filter(candidate => candidate.id !== team.id && candidate.shareId !== team.shareId);
    const targetIndex = Math.min(withoutDuplicate.length, Math.max(0, Number(index) || 0));
    return [
        ...withoutDuplicate.slice(0, targetIndex),
        team,
        ...withoutDuplicate.slice(targetIndex)
    ];
};

export const touchTeam = team => ({
    ...team,
    id: asText(team?.id) || createId("box"),
    shareId: asText(team?.shareId || team?.id) || createId("share"),
    updatedAt: now()
});

export const loadTeams = () => {
    const current = readStorage(TEAM_STORAGE_KEY, null);
    if (current?.schema === TEAM_SCHEMA_VERSION && Array.isArray(current.teams)) {
        return dedupeTeams(current.teams);
    }
    const legacy = readStorage(LEGACY_TEAM_STORAGE_KEY, []);
    return dedupeTeams(Array.isArray(legacy) ? legacy : []);
};

export const saveTeams = teams => {
    const compact = dedupeTeams(teams).map(compactTeam);
    const saved = writeStorage(TEAM_STORAGE_KEY, {
        schema: TEAM_SCHEMA_VERSION,
        savedAt: now(),
        teams: compact
    });
    if (saved) removeStorage(LEGACY_TEAM_STORAGE_KEY);
    return saved;
};

export const hydratePokemon = async pokemon => {
    const stored = normalizePokemon(pokemon);
    const formName = stored.species?.name;
    if (!formName) return stored;

    const data = await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(formName)}`);
    if (!data) return stored;
    const speciesData = data.species?.url ? await fetchCached(data.species.url) : null;
    const genderRate = Number(speciesData?.gender_rate);
    const enriched = {
        ...data,
        gender_rate: Number.isFinite(genderRate) ? genderRate : stored.genderRate
    };
    return normalizePokemon({
        ...stored,
        species: enriched,
        genderRate: Number.isFinite(genderRate) ? genderRate : stored.genderRate
    });
};

export const hydrateTeam = async team => {
    const normalized = normalizeTeam(team);
    const pokemon = await Promise.all(normalized.pokemon.map(hydratePokemon));
    return { ...normalized, pokemon };
};

export const hydrateTeams = async teams => Promise.all(asArray(teams).map(hydrateTeam));

export const mergeHydratedTeams = (currentTeams, hydratedTeams) => {
    const hydratedByIdentity = new Map();
    asArray(hydratedTeams).forEach(team => {
        hydratedByIdentity.set(team.id, team);
        hydratedByIdentity.set(team.shareId, team);
    });
    return asArray(currentTeams).map(currentTeam => {
        const hydrated = hydratedByIdentity.get(currentTeam.id) || hydratedByIdentity.get(currentTeam.shareId);
        if (!hydrated) return currentTeam;
        return {
            ...currentTeam,
            pokemon: asArray(currentTeam.pokemon).map((partner, index) => {
                const hydratedPartner = hydrated.pokemon?.find(candidate => candidate.id === partner.id)
                    || hydrated.pokemon?.[index];
                if (!hydratedPartner?.species?.name) return partner;
                return {
                    ...partner,
                    species: hydratedPartner.species,
                    genderRate: hydratedPartner.genderRate
                };
            })
        };
    });
};

export const mergeImportedTeam = (existingTeams, incomingTeam) => {
    const incoming = normalizeTeam(incomingTeam);
    const existing = dedupeTeams(existingTeams);
    const index = existing.findIndex(team => team.shareId === incoming.shareId);
    if (index === -1) {
        return { teams: [...existing, incoming], team: incoming, status: "added" };
    }
    const current = existing[index];
    if (incoming.updatedAt <= current.updatedAt) {
        return { teams: existing, team: current, status: "ignored" };
    }
    const replacement = { ...incoming, id: current.id };
    const merged = [...existing];
    merged[index] = replacement;
    return { teams: merged, team: replacement, status: "replaced" };
};

export const insertImportedPokemon = (existingTeams, targetTeamId, incomingPokemon) => {
    const existing = dedupeTeams(existingTeams);
    const targetIndex = existing.findIndex(team => team.id === targetTeamId);
    if (targetIndex < 0) {
        return {
            teams: existing,
            team: null,
            added: [],
            rejected: asArray(incomingPokemon).map(normalizePokemon),
            status: "missing-target",
        };
    }

    const target = existing[targetIndex];
    const freeSlots = Math.max(0, 6 - target.pokemon.length);
    const candidates = asArray(incomingPokemon).map(partner => normalizePokemon({
        ...partner,
        id: createId("partner"),
    }));
    const added = candidates.slice(0, freeSlots);
    const rejected = candidates.slice(freeSlots);
    if (!added.length) {
        return { teams: existing, team: target, added, rejected, status: "full" };
    }

    const updated = touchTeam({
        ...target,
        pokemon: [...target.pokemon, ...added],
    });
    const teams = [...existing];
    teams[targetIndex] = updated;
    return {
        teams,
        team: updated,
        added,
        rejected,
        status: rejected.length ? "partial" : "added",
    };
};

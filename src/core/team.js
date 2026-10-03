import { calculateStat, convertToTTRPG, fetchCached } from "./mechanics.js";
import { clampFinite, finiteNumberOrNull, integerInRange, quantizeStepDown } from "./math.js";
import { secureRandomId } from "./random.js";
import { readStorage, removeStorage, writeStorage } from "./storage.js";

export const TEAM_STORAGE_KEY = "myowndex_rotom_v4";
export const LEGACY_TEAM_STORAGE_KEY = "myowndex_rotom_v3";
export const TEAM_SCHEMA_VERSION = 5;
export const RPG_SCALE_VERSION = 2;
export const STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
export const RPG_STATUSES = ["", "burn", "freeze", "paralysis", "poison", "bad-poison", "sleep"];

const now = () => Date.now();
const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === "string" ? value : "";

export const createId = (prefix = "box") => {
    return secureRandomId(prefix);
};

export const clampInteger = (value, minimum, maximum, fallback = minimum) => {
    return integerInRange(value, minimum, maximum, fallback);
};

export const normalizeStats = (stats, fallback, maximum) => Object.fromEntries(
    STAT_KEYS.map(stat => [stat, clampInteger(stats?.[stat], 0, maximum, fallback)])
);

const normalizeMoves = moves => {
    const normalized = asArray(moves).slice(0, 4).map(asText);
    while (normalized.length < 4) normalized.push("");
    return normalized;
};

const normalizeOptionalNumber = (value, minimum, maximum, step = null) => {
    if (value === "" || value == null) return null;
    const parsed = finiteNumberOrNull(value);
    if (parsed == null) return null;
    if (!step) return clampFinite(parsed, minimum, maximum, minimum);
    return quantizeStepDown(parsed, step, { minimum, maximum, fallback: minimum });
};

const legacyScale20 = (value, isHp = false) => {
    const numeric = finiteNumberOrNull(value);
    if (numeric == null || numeric <= 0) return isHp ? 1 : 0;
    const scaled = numeric / 20;
    const whole = Math.floor(scaled);
    const fraction = scaled - whole;
    const rounded = fraction + Number.EPSILON * 16 >= 0.56 ? Math.ceil(scaled) : whole;
    return isHp ? Math.max(1, rounded) : rounded;
};

export const normalizeRpgData = (value = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const status = asText(source.status);
    const pp = asArray(source.pp).slice(0, 4).map(entry => normalizeOptionalNumber(entry, 0, 99, 1));
    while (pp.length < 4) pp.push(null);
    return {
        scaleVersion: clampInteger(source.scaleVersion, 1, RPG_SCALE_VERSION, source.currentHp == null ? RPG_SCALE_VERSION : 1),
        xp: normalizeOptionalNumber(source.xp, 0, 999999, 0.5) ?? 0,
        currentHp: normalizeOptionalNumber(source.currentHp, 0, 99999, 1),
        status: RPG_STATUSES.includes(status) ? status : "",
        sleepTurns: status === "sleep" && source.sleepTurns != null ? clampInteger(source.sleepTurns, 0, 2, 0) : null,
        freezeTurns: status === "freeze" && source.freezeTurns != null ? clampInteger(source.freezeTurns, 0, 2, 0) : null,
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
    const rawRate = finiteNumberOrNull(source.genderRate ?? species.gender_rate);
    const genderRate = rawRate == null ? -1 : integerInRange(rawRate, -1, 8, -1);
    const customStatEntries = source.customStats && typeof source.customStats === "object"
        ? STAT_KEYS
            .filter(stat => Object.prototype.hasOwnProperty.call(source.customStats, stat))
            .map(stat => [stat, clampInteger(source.customStats[stat], 1, 255, 1)])
        : [];
    const customStats = customStatEntries.length ? Object.fromEntries(customStatEntries) : null;

    const normalizedRpg = normalizeRpgData(source.rpg);
    const speciesHpBase = finiteNumberOrNull(species?.stats?.find(entry => entry?.stat?.name === "hp")?.base_stat);
    const knownHpBase = customStats?.hp ?? speciesHpBase;
    let rpg = normalizedRpg.currentHp == null || normalizedRpg.scaleVersion >= RPG_SCALE_VERSION
        ? { ...normalizedRpg, scaleVersion: RPG_SCALE_VERSION }
        : { ...normalizedRpg };
    if (normalizedRpg.currentHp != null
        && normalizedRpg.scaleVersion < RPG_SCALE_VERSION
        && knownHpBase != null) {
        const hpBase = integerInRange(knownHpBase, 1, 255, 1);
        const speciesName = species?.species?.name || species?.name || "";
        const rawMaxHp = calculateStat(
            hpBase,
            source.evs?.hp,
            source.ivs?.hp,
            source.level,
            1,
            true,
            speciesName,
        );
        const oldMaxHp = legacyScale20(rawMaxHp, true);
        const newMaxHp = convertToTTRPG(rawMaxHp, true);
        const oldCurrentHp = clampInteger(normalizedRpg.currentHp, 0, oldMaxHp, oldMaxHp);
        const currentHp = oldCurrentHp <= 0
            ? 0
            : oldCurrentHp >= oldMaxHp
                ? newMaxHp
                : Math.max(1, Math.min(newMaxHp, Math.round((oldCurrentHp / oldMaxHp) * newMaxHp)));
        rpg = { ...normalizedRpg, currentHp, scaleVersion: RPG_SCALE_VERSION };
    }

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
        rpg
    };
};

const compactSpecies = species => {
    if (!species || typeof species !== "object") return {};
    // Keep the catalogue fields used offline; other generations can be fetched again.
    // In particular, the full sprites catalogue can exceed localStorage quota for large PCs.
    const spriteKeys = [
        "front_default", "front_shiny", "front_female", "front_shiny_female",
        "back_default", "back_shiny", "back_female", "back_shiny_female"
    ];
    const pickSprites = (source, keys) => Object.fromEntries(keys
        .filter(key => Object.prototype.hasOwnProperty.call(source, key))
        .map(key => [key, source[key]]));
    let sprites = species.sprites;
    if (sprites && typeof sprites === "object") {
        const artwork = sprites.other?.["official-artwork"];
        const animated = sprites.versions?.["generation-v"]?.["black-white"]?.animated;
        sprites = pickSprites(sprites, spriteKeys);
        if (artwork && typeof artwork === "object") {
            sprites.other = { "official-artwork": pickSprites(artwork, ["front_default", "front_shiny"]) };
        }
        if (animated && typeof animated === "object") {
            sprites.versions = { "generation-v": { "black-white": { animated: pickSprites(animated, spriteKeys) } } };
        }
    }
    return {
        id: species.id,
        name: species.name,
        species: species.species ? {
            name: species.species.name,
            url: species.species.url
        } : undefined,
        abilities: species.abilities,
        sprites,
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
    const rawUpdatedAt = finiteNumberOrNull(source.updatedAt);
    return {
        id,
        shareId: asText(source.shareId) || id,
        name: asText(source.name || source.boxName).trim().slice(0, 80) || "Box",
        versionGroup: asText(source.versionGroup || source.ruleset) || "auto",
        updatedAt: rawUpdatedAt == null ? now() : integerInRange(rawUpdatedAt, 0, Number.MAX_SAFE_INTEGER, now()),
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
    const targetIndex = integerInRange(index, 0, withoutDuplicate.length, 0);
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
    if ([4, TEAM_SCHEMA_VERSION].includes(current?.schema) && Array.isArray(current.teams)) {
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

export const TEAM_HYDRATION_CONCURRENCY = 4;
const hydrationQueue = [];
let activeHydrations = 0;

const drainHydrations = () => {
    while (activeHydrations < TEAM_HYDRATION_CONCURRENCY && hydrationQueue.length) {
        const task = hydrationQueue.shift();
        activeHydrations += 1;
        Promise.resolve().then(task.run).then(task.resolve, task.reject).finally(() => {
            activeHydrations -= 1;
            drainHydrations();
        });
    }
};

const hydratePokemonData = async pokemon => {
    const stored = normalizePokemon(pokemon);
    const formName = stored.species?.name;
    if (!formName) return stored;

    const data = await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(formName)}`);
    if (!data) return stored;
    const speciesData = data.species?.url ? await fetchCached(data.species.url) : null;
    const genderRate = finiteNumberOrNull(speciesData?.gender_rate);
    const enriched = {
        ...data,
        gender_rate: genderRate == null ? stored.genderRate : integerInRange(genderRate, -1, 8, stored.genderRate)
    };
    return normalizePokemon({
        ...stored,
        species: enriched,
        genderRate: genderRate == null ? stored.genderRate : integerInRange(genderRate, -1, 8, stored.genderRate)
    });
};

// Every Box shares this queue, including simultaneous hydrateTeam calls. The
// stored partner stays usable while its optional catalogue details refresh.
export const hydratePokemon = pokemon => new Promise((resolve, reject) => {
    hydrationQueue.push({ run: () => hydratePokemonData(pokemon), resolve, reject });
    drainHydrations();
});

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
            pokemon: asArray(currentTeam.pokemon).map(partner => {
                const hydratedPartner = hydrated.pokemon?.find(candidate => candidate.id === partner.id);
                // A pending catalogue request belongs to this partner and this form only.
                // Deleting, replacing or transforming a partner must not revive stale data.
                if (!hydratedPartner?.species?.name || hydratedPartner.species.name !== partner.species?.name) return partner;
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

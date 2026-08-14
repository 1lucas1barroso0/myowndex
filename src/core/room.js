import {
    calculateDefenses,
    calculateStat,
    convertToTTRPG,
    formatName,
    NATURES,
    STAT_MAP,
} from "./mechanics.js";
import { RPG_STATUS_LABELS } from "./copy.js";
import {
    adjustMoveAccuracy,
    calculateStagedStats,
    getDefensiveTypes,
    getMoveResolutionProfile,
    getMoveStab,
    isDirectKnockoutMove,
    normalizePpSlots,
    normalizeSlug,
    normalizeStageMap,
    normalizeVolatileEffects,
    stageMultiplier,
} from "./automation.js";
import { getDamageCeiling, rollAttributeTest, rollPercentTest } from "./rpgRules.js";
import { compactTeam, createId, normalizeTeam, touchTeam } from "./team.js";
import {
    applyBattleIllusion,
    calculateDynamicMovePower,
    getAbilityMoveBlock,
    getMoveStatProfile,
    getSpecialMoveBlockReason,
    ignoresGhostTypeImmunity,
    normalizeSpecialState,
    transformBattleToken,
} from "./specialMechanics.js";

export const ROOM_SCHEMA_VERSION = 3;
export const ROOM_SESSION_STORAGE_KEY = "myowndex_live_room_v1";
export const LOCAL_ROOM_STORAGE_KEY = "myowndex_local_room_v1";

export const ROOM_PHASES = [
    { id: "exploracao", label: "Exploração" },
    { id: "interpretacao", label: "Interpretação" },
    { id: "batalha", label: "Batalha" },
    { id: "intervalo", label: "Intervalo" },
];

export const ROOM_WEATHERS = [
    { id: "limpo", label: "Céu limpo" },
    { id: "sol", label: "Sol forte" },
    { id: "chuva", label: "Chuva" },
    { id: "neve", label: "Neve" },
    { id: "areia", label: "Tempestade de areia" },
    { id: "nevoa", label: "Névoa" },
];

export const ROOM_TERRAINS = [
    { id: "nenhum", label: "Sem terreno" },
    { id: "eletrico", label: "Terreno Elétrico" },
    { id: "gramado", label: "Terreno de Grama" },
    { id: "nevoa", label: "Terreno de Névoa" },
    { id: "psiquico", label: "Terreno Psíquico" },
];

export const ROOM_SCENARIOS = [
    { id: "rota", label: "Rota campestre", icon: "🌿", tone: "#65a30d" },
    { id: "floresta", label: "Floresta", icon: "🌲", tone: "#166534" },
    { id: "cidade", label: "Cidade", icon: "🏙️", tone: "#64748b" },
    { id: "praia", label: "Praia", icon: "🌊", tone: "#0ea5e9" },
    { id: "caverna", label: "Caverna", icon: "🪨", tone: "#57534e" },
    { id: "neve", label: "Campo nevado", icon: "❄️", tone: "#bae6fd" },
    { id: "arena", label: "Estádio", icon: "🏟️", tone: "#dc2626" },
    { id: "laboratorio", label: "Laboratório", icon: "🧪", tone: "#06b6d4" },
    { id: "distorcao", label: "Mundo Distorcido", icon: "🌀", tone: "#7c3aed" },
];

export const STATUS_LABELS = RPG_STATUS_LABELS;

const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === "string" ? value : "";
const numberInRange = (value, minimum, maximum, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
};

export const createRoomSnapshot = (title = "Nova aventura") => ({
    schema: ROOM_SCHEMA_VERSION,
    title: asText(title).trim().slice(0, 80) || "Nova aventura",
    phase: "exploracao",
    round: 1,
    turnIndex: 0,
    scenario: "rota",
    weather: "limpo",
    terrain: "nenhum",
    sceneNotes: "",
    gmNotes: "",
    tokens: [],
    initiative: [],
    audio: {
        trackId: null,
        title: "",
        playing: false,
        volume: 0.55,
        startedAt: 0,
        offset: 0,
    },
    settings: {
        showHp: true,
        allowPlayerMovement: false,
        mirrorSprites: true,
    },
});

export const normalizeRoomToken = value => {
    const source = value && typeof value === "object" ? value : {};
    const maxHp = Math.max(1, Math.round(numberInRange(source.maxHp, 1, 99999, 1)));
    const moves = asArray(source.moves).slice(0, 4).map(move => normalizeSlug(move));
    while (moves.length < 4) moves.push("");
    // Forest's Curse e Trick-or-Treat podem acrescentar um terceiro tipo durante a cena.
    const types = asArray(source.types).filter(Boolean).slice(0, 3).map(type => normalizeSlug(type));
    const originalTypes = asArray(source.originalTypes).length
        ? asArray(source.originalTypes).filter(Boolean).slice(0, 2).map(type => normalizeSlug(type))
        : types;
    const stats = Object.fromEntries(Object.keys(STAT_MAP).map(stat => [
        stat,
        numberInRange(source.stats?.[stat], 0, 99999, 0),
    ]));
    const originalStats = Object.fromEntries(Object.keys(STAT_MAP).map(stat => [
        stat,
        numberInRange(source.originalStats?.[stat], 0, 99999, stats[stat] * 20),
    ]));
    const stages = normalizeStageMap(source.stages);
    const token = {
        id: asText(source.id) || createId("token"),
        pokemonId: asText(source.pokemonId),
        teamId: asText(source.teamId),
        teamShareId: asText(source.teamShareId),
        ownerPlayerId: asText(source.ownerPlayerId),
        name: asText(source.name).slice(0, 80) || "Pokémon",
        speciesName: asText(source.speciesName).toLowerCase(),
        speciesId: Math.max(0, Math.round(numberInRange(source.speciesId, 0, 99999, 0))),
        sprite: asText(source.sprite).slice(0, 500),
        weight: numberInRange(source.weight, 0, 999999, 0),
        side: ["ally", "opponent", "neutral"].includes(source.side) ? source.side : "ally",
        x: numberInRange(source.x, 4, 96, 50),
        y: numberInRange(source.y, 8, 92, 55),
        maxHp,
        currentHp: numberInRange(source.currentHp, 0, maxHp, maxHp),
        status: Object.prototype.hasOwnProperty.call(STATUS_LABELS, source.status) ? source.status : "",
        level: Math.round(numberInRange(source.level, 1, 200, 5)),
        enteredRound: Math.max(1, Math.round(numberInRange(source.enteredRound, 1, 9999, 1))),
        xp: numberInRange(source.xp, 0, 999999, 0),
        priority: Math.round(numberInRange(source.priority, -7, 7, 0)),
        declaredMove: normalizeSlug(source.declaredMove),
        types,
        originalTypes,
        teraType: normalizeSlug(source.teraType),
        teraActive: Boolean(source.teraActive && source.teraType),
        ability: normalizeSlug(source.ability),
        item: normalizeSlug(source.item),
        nature: normalizeSlug(source.nature),
        gender: asText(source.gender).slice(0, 20),
        toxicCounter: source.status === "bad-poison"
            ? Math.round(numberInRange(source.toxicCounter, 1, 15, 1))
            : 0,
        stats,
        originalStats,
        stages,
        moves,
        pp: normalizePpSlots(source.pp),
        volatileEffects: normalizeVolatileEffects(source.volatileEffects),
        specialState: normalizeSpecialState(source.specialState),
        hidden: Boolean(source.hidden),
    };
    return { ...token, stats: calculateStagedStats(token) };
};

export const normalizeRoomSnapshot = value => {
    const source = value && typeof value === "object" ? value : {};
    const fallback = createRoomSnapshot(source.title);
    const tokens = asArray(source.tokens).slice(0, 40).map(normalizeRoomToken);
    const tokenIds = new Set(tokens.map(token => token.id));
    const initiative = asArray(source.initiative).filter(id => tokenIds.has(id)).slice(0, 40);
    return {
        ...fallback,
        ...source,
        schema: ROOM_SCHEMA_VERSION,
        title: asText(source.title).trim().slice(0, 80) || fallback.title,
        phase: ROOM_PHASES.some(phase => phase.id === source.phase) ? source.phase : fallback.phase,
        round: Math.max(1, Math.round(numberInRange(source.round, 1, 9999, 1))),
        turnIndex: initiative.length
            ? Math.round(numberInRange(source.turnIndex, 0, initiative.length - 1, 0))
            : 0,
        scenario: ROOM_SCENARIOS.some(scene => scene.id === source.scenario) ? source.scenario : fallback.scenario,
        weather: ROOM_WEATHERS.some(weather => weather.id === source.weather) ? source.weather : fallback.weather,
        terrain: ROOM_TERRAINS.some(terrain => terrain.id === source.terrain) ? source.terrain : fallback.terrain,
        sceneNotes: asText(source.sceneNotes).slice(0, 4000),
        gmNotes: asText(source.gmNotes).slice(0, 6000),
        tokens,
        initiative,
        audio: {
            ...fallback.audio,
            ...(source.audio && typeof source.audio === "object" ? source.audio : {}),
            trackId: asText(source.audio?.trackId) || null,
            title: asText(source.audio?.title).slice(0, 120),
            playing: Boolean(source.audio?.playing),
            volume: numberInRange(source.audio?.volume, 0, 1, 0.55),
            startedAt: Math.max(0, Number(source.audio?.startedAt) || 0),
            offset: numberInRange(source.audio?.offset, 0, 604800, 0),
        },
        settings: {
            ...fallback.settings,
            ...(source.settings && typeof source.settings === "object" ? source.settings : {}),
            showHp: source.settings?.showHp !== false,
            allowPlayerMovement: Boolean(source.settings?.allowPlayerMovement),
            mirrorSprites: source.settings?.mirrorSprites !== false,
        },
    };
};

const sameValue = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeChangedValue = (base, desired, latest, path = "") => {
    if (sameValue(base, desired)) return latest;
    if (path === "tokens" && Array.isArray(base) && Array.isArray(desired) && Array.isArray(latest)) {
        const baseById = new Map(base.map(token => [token?.id, token]));
        const desiredById = new Map(desired.map(token => [token?.id, token]));
        const latestById = new Map(latest.map(token => [token?.id, token]));
        const merged = desired.map(token => {
            const id = token?.id;
            const baseToken = baseById.get(id);
            const latestToken = latestById.get(id);
            if (!baseToken || !latestToken) return token;
            return mergeChangedValue(baseToken, token, latestToken, `tokens.${id}`);
        });
        latest.forEach(token => {
            const id = token?.id;
            if (!baseById.has(id) && !desiredById.has(id)) merged.push(token);
        });
        return merged;
    }
    if (Array.isArray(desired)) return desired;
    if (isRecord(base) && isRecord(desired) && isRecord(latest)) {
        const result = { ...latest };
        const keys = new Set([...Object.keys(base), ...Object.keys(desired)]);
        keys.forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(desired, key)) {
                delete result[key];
                return;
            }
            result[key] = mergeChangedValue(base[key], desired[key], latest[key], path ? `${path}.${key}` : key);
        });
        return result;
    }
    return desired;
};

export const mergeRoomConflictSnapshot = (base, desired, latest) => normalizeRoomSnapshot(
    mergeChangedValue(
        normalizeRoomSnapshot(base),
        normalizeRoomSnapshot(desired),
        normalizeRoomSnapshot(latest),
    )
);

const baseStatValue = (pokemon, statName) => {
    const custom = pokemon?.customStats?.[statName];
    if (Number.isFinite(Number(custom))) return Number(custom);
    return Number(pokemon?.species?.stats?.find(entry => entry?.stat?.name === statName)?.base_stat) || 1;
};

export const calculatePokemonStats = pokemon => {
    const nature = NATURES[pokemon?.nature] || NATURES.hardy;
    const speciesName = pokemon?.species?.species?.name || pokemon?.species?.name || "";
    return Object.fromEntries(Object.keys(STAT_MAP).map(statName => {
        const isHp = statName === "hp";
        const multiplier = nature.up === statName ? 1.1 : nature.down === statName ? 0.9 : 1;
        const original = calculateStat(
            baseStatValue(pokemon, statName),
            pokemon?.evs?.[statName],
            pokemon?.ivs?.[statName],
            pokemon?.level,
            multiplier,
            isHp,
            speciesName,
        );
        return [statName, {
            original,
            rpg: convertToTTRPG(original, isHp),
        }];
    }));
};

export const getPokemonSprite = pokemon => {
    const sprites = pokemon?.species?.sprites;
    const animated = sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;
    const pixel = sprites?.front_default;
    const id = Number(pokemon?.species?.id) || 0;
    return animated || pixel || (id
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
        : "");
};

export const createTokenFromPokemon = (pokemon, team, index = 0, side = "ally") => {
    const computed = calculatePokemonStats(pokemon);
    const maxHp = computed.hp.rpg;
    const currentHp = pokemon?.rpg?.currentHp == null
        ? maxHp
        : numberInRange(pokemon.rpg.currentHp, 0, maxHp, maxHp);
    const ally = side === "ally";
    const row = Math.floor(index / 3);
    const column = index % 3;
    return normalizeRoomToken({
        id: createId("token"),
        pokemonId: pokemon?.id,
        teamId: team?.id,
        teamShareId: team?.shareId,
        name: pokemon?.nickname || formatName(pokemon?.species?.species?.name || pokemon?.species?.name) || "Pokémon",
        speciesName: pokemon?.species?.species?.name || pokemon?.species?.name || "",
        speciesId: pokemon?.species?.id,
        sprite: getPokemonSprite(pokemon),
        weight: pokemon?.species?.weight || 0,
        side,
        x: ally ? 20 + column * 11 : 80 - column * 11,
        y: ally ? 67 + row * 10 : 33 - row * 10,
        maxHp,
        currentHp,
        status: pokemon?.rpg?.status || "",
        level: pokemon?.level,
        xp: pokemon?.rpg?.xp || 0,
        types: pokemon?.customTypes?.length
            ? pokemon.customTypes
            : pokemon?.species?.types?.map(entry => entry?.type?.name),
        originalTypes: pokemon?.customTypes?.length
            ? pokemon.customTypes
            : pokemon?.species?.types?.map(entry => entry?.type?.name),
        teraType: pokemon?.teraType || "",
        teraActive: false,
        ability: pokemon?.ability || "",
        item: pokemon?.item || "",
        nature: pokemon?.nature || "",
        gender: pokemon?.gender || "",
        stats: Object.fromEntries(Object.entries(computed).map(([key, values]) => [key, values.rpg])),
        originalStats: Object.fromEntries(Object.entries(computed).map(([key, values]) => [key, values.original])),
        moves: pokemon?.moves,
        pp: pokemon?.rpg?.pp,
    });
};

export const addTeamToSnapshot = (snapshot, teamInput, side = "ally", ownerPlayerId = "") => {
    const room = normalizeRoomSnapshot(snapshot);
    const team = normalizeTeam(teamInput);
    const existingPokemon = new Set(room.tokens.map(token => token.pokemonId).filter(Boolean));
    const available = team.pokemon.filter(pokemon => !existingPokemon.has(pokemon.id));
    const capacity = Math.max(0, 40 - room.tokens.length);
    const tokens = available.slice(0, capacity).map((pokemon, index) => ({
        ...createTokenFromPokemon(pokemon, team, room.tokens.length + index, side),
        ownerPlayerId: asText(ownerPlayerId),
        enteredRound: room.round,
    }));
    let combined = [...room.tokens, ...tokens];
    const enteredIds = new Set(tokens.map(token => token.id));
    combined = combined.map(token => {
        if (!enteredIds.has(token.id) || token.currentHp <= 0) return token;
        if (token.ability === "imposter") {
            const target = combined.find(candidate => candidate.currentHp > 0 && candidate.side !== token.side && candidate.side !== "neutral");
            const transformed = transformBattleToken(token, target, { via: "imposter", round: room.round });
            if (transformed.applied) return transformed.token;
        }
        if (token.ability === "illusion") {
            const sameTeam = combined.filter(candidate => candidate.id !== token.id && candidate.currentHp > 0 && candidate.teamId === token.teamId);
            const candidates = sameTeam.length
                ? sameTeam
                : combined.filter(candidate => candidate.id !== token.id && candidate.currentHp > 0 && candidate.side === token.side);
            const disguise = candidates[candidates.length - 1];
            const disguised = applyBattleIllusion(token, disguise);
            if (disguised.applied) return disguised.token;
        }
        return token;
    });
    const normalizedRoom = normalizeRoomSnapshot({ ...room, tokens: combined });
    return { room: normalizedRoom, tokens: normalizedRoom.tokens.filter(token => enteredIds.has(token.id)) };
};

export const compactTeamOffer = team => compactTeam(team);

export const syncTeamsWithRoomProgress = (teams, snapshot, playerId = null) => {
    const room = normalizeRoomSnapshot(snapshot);
    const eligibleTokens = room.tokens.filter(token =>
        token.pokemonId
        && token.teamId
        && (!playerId || token.ownerPlayerId === playerId)
    );
    if (!eligibleTokens.length) return teams;
    let changed = false;
    const synchronized = asArray(teams).map(team => {
        const related = eligibleTokens.filter(token =>
            token.teamId === team.id
            || (token.teamShareId && token.teamShareId === team.shareId)
        );
        if (!related.length) return team;
        let teamChanged = false;
        const pokemon = asArray(team.pokemon).map(partner => {
            const token = related.find(candidate => candidate.pokemonId === partner.id);
            if (!token) return partner;
            const specialState = normalizeSpecialState(token.specialState);
            const hasTemporaryMoveCopy = specialState.moveOverrides.some(override => !override.permanent);
            const synchronizedPp = specialState.transform?.base?.pp
                || (hasTemporaryMoveCopy ? partner.rpg?.pp : token.pp);
            const rpg = {
                ...partner.rpg,
                currentHp: token.currentHp,
                status: token.status,
                xp: token.xp,
                pp: synchronizedPp,
            };
            const permanentMoveChange = specialState.moveOverrides.some(override => override.permanent);
            const moves = permanentMoveChange ? token.moves : partner.moves;
            if (
                Number(partner.level) === token.level
                && partner.rpg?.currentHp === token.currentHp
                && (partner.rpg?.status || "") === token.status
                && Number(partner.rpg?.xp || 0) === token.xp
                && JSON.stringify(partner.rpg?.pp || []) === JSON.stringify(synchronizedPp || [])
                && JSON.stringify(partner.moves || []) === JSON.stringify(moves || [])
            ) return partner;
            teamChanged = true;
            return { ...partner, level: token.level, moves, rpg };
        });
        if (!teamChanged) return team;
        changed = true;
        return touchTeam({ ...team, pokemon });
    });
    return changed ? synchronized : teams;
};

export const advanceInitiative = snapshot => {
    const room = normalizeRoomSnapshot(snapshot);
    if (!room.initiative.length) return room;
    const nextIndex = (room.turnIndex + 1) % room.initiative.length;
    return {
        ...room,
        turnIndex: nextIndex,
        round: nextIndex === 0 ? room.round + 1 : room.round,
    };
};

const residualAmount = (maximumHp, fraction) => Math.max(1, Math.floor(Math.max(1, Number(maximumHp) || 1) * fraction));
const uniqueSources = values => [...new Set(values.filter(Boolean))];
const SAND_IMMUNE_ABILITIES = new Set(["magic-guard", "overcoat", "sand-force", "sand-rush", "sand-veil"]);

export const applyEndOfRoundEffects = snapshot => {
    const room = normalizeRoomSnapshot(snapshot);
    const effects = [];
    const leechHealing = [];
    let tokens = room.tokens.map(token => {
        if (token.currentHp <= 0) return token;
        let currentHp = token.currentHp;
        let status = token.status;
        let forcedFaint = false;
        let delayedDamage = 0;
        let persistentHealing = 0;
        const residualSources = [];
        const volatileEffects = [];

        normalizeVolatileEffects(token.volatileEffects).forEach(effect => {
            if (effect.id === "yawn") {
                const turns = Math.max(0, Number(effect.turns) || 0) - 1;
                if (turns > 0) {
                    volatileEffects.push({ ...effect, turns });
                } else if (!status) {
                    status = "sleep";
                    effects.push({
                        kind: "status",
                        tokenId: token.id,
                        tokenName: token.name,
                        status,
                        damage: 0,
                        remainingHp: currentHp,
                        fainted: false,
                        sources: ["bocejo"],
                    });
                }
                return;
            }

            if (["future-sight", "doom-desire"].includes(effect.id)) {
                const turns = Math.max(0, Number(effect.turns) || 0) - 1;
                if (turns > 0) volatileEffects.push({ ...effect, turns });
                else {
                    const amount = Math.min(currentHp, Math.max(0, Number(effect.amount) || 0));
                    delayedDamage += amount;
                    residualSources.push(formatName(effect.sourceMove));
                }
                return;
            }

            if (effect.id === "wish") {
                const turns = Math.max(0, Number(effect.turns) || 0) - 1;
                if (turns > 0) volatileEffects.push({ ...effect, turns });
                else persistentHealing += Math.max(1, Number(effect.amount) || residualAmount(token.maxHp, 1 / 2));
                return;
            }

            if (effect.id === "perish-song") {
                const turns = Math.max(0, Number(effect.turns) || 0) - 1;
                if (turns > 0) volatileEffects.push({ ...effect, turns });
                else forcedFaint = true;
                return;
            }

            if (effect.id === "leech-seed") {
                const amount = Math.min(currentHp, residualAmount(token.maxHp, 1 / 8));
                if (amount > 0 && token.ability !== "magic-guard") {
                    delayedDamage += amount;
                    residualSources.push("Leech Seed");
                    leechHealing.push({ sourceTokenId: effect.sourceTokenId, sourceName: effect.sourceName, amount });
                }
                volatileEffects.push(effect);
                return;
            }

            if (["aqua-ring", "ingrain"].includes(effect.id)) {
                persistentHealing += residualAmount(token.maxHp, 1 / 16);
                volatileEffects.push(effect);
                return;
            }

            if (effect.turns == null) {
                volatileEffects.push(effect);
                return;
            }
            const turns = Math.max(0, Number(effect.turns) || 0) - 1;
            if (turns > 0) volatileEffects.push({ ...effect, turns });
        });

        let specialState = normalizeSpecialState(token.specialState);
        if (room.weather === "neve" && token.ability === "ice-face" && specialState.markers.includes("ice-face-broken")) {
            specialState = {
                ...specialState,
                markers: specialState.markers.filter(marker => marker !== "ice-face-broken"),
            };
            effects.push({
                kind: "state",
                tokenId: token.id,
                tokenName: token.name,
                damage: 0,
                remainingHp: currentHp,
                fainted: false,
                sources: ["neve restaurou Ice Face"],
            });
        }

        if (persistentHealing > 0 && !forcedFaint) {
            const before = currentHp;
            currentHp = Math.min(token.maxHp, currentHp + persistentHealing);
            const healed = currentHp - before;
            if (healed > 0) {
                effects.push({
                    kind: "heal",
                    tokenId: token.id,
                    tokenName: token.name,
                    healed,
                    damage: 0,
                    remainingHp: currentHp,
                    fainted: false,
                    sources: ["recuperação persistente"],
                });
            }
        }

        let residualDamage = delayedDamage;
        let toxicCounter = status === "bad-poison" ? Math.max(1, token.toxicCounter || 1) : 0;
        const indirectBlocked = token.ability === "magic-guard";
        if (!indirectBlocked && status === "burn") {
            residualDamage += residualAmount(token.maxHp, 1 / 16);
            residualSources.push("queimadura");
        }
        if (!indirectBlocked && status === "poison") {
            residualDamage += residualAmount(token.maxHp, 1 / 8);
            residualSources.push("envenenamento");
        }
        if (!indirectBlocked && status === "bad-poison") {
            residualDamage += residualAmount(token.maxHp, toxicCounter / 16);
            residualSources.push("envenenamento grave");
            toxicCounter = Math.min(15, toxicCounter + 1);
        }
        const sandImmuneType = token.types.some(type => ["ground", "rock", "steel"].includes(type));
        if (room.weather === "areia" && !sandImmuneType && !SAND_IMMUNE_ABILITIES.has(token.ability)) {
            residualDamage += residualAmount(token.maxHp, 1 / 16);
            residualSources.push("tempestade de areia");
        }

        if (forcedFaint) {
            currentHp = 0;
            effects.push({
                kind: "perish",
                tokenId: token.id,
                tokenName: token.name,
                damage: token.currentHp,
                remainingHp: 0,
                fainted: true,
                sources: ["Perish Song"],
            });
        } else if (residualDamage > 0) {
            const applied = Math.min(currentHp, residualDamage);
            currentHp = Math.max(0, currentHp - applied);
            effects.push({
                kind: "damage",
                tokenId: token.id,
                tokenName: token.name,
                damage: applied,
                remainingHp: currentHp,
                fainted: currentHp <= 0,
                sources: uniqueSources(residualSources),
            });
        }
        return { ...token, status, currentHp, toxicCounter, volatileEffects, specialState };
    });

    leechHealing.forEach(drain => {
        const index = tokens.findIndex(token => token.id === drain.sourceTokenId && token.currentHp > 0);
        if (index < 0) return;
        const source = tokens[index];
        const currentHp = Math.min(source.maxHp, source.currentHp + drain.amount);
        const healed = currentHp - source.currentHp;
        if (healed <= 0) return;
        tokens[index] = { ...source, currentHp };
        effects.push({
            kind: "heal",
            tokenId: source.id,
            tokenName: source.name,
            healed,
            damage: 0,
            remainingHp: currentHp,
            fainted: false,
            sources: ["Leech Seed"],
        });
    });

    return { room: { ...room, tokens }, effects };
};

export const buildInitiative = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    const results = room.tokens.filter(token => !token.hidden && token.currentHp > 0).map(token => {
        const test = rollAttributeTest({
            mode: "normal",
            attribute: token.stats?.speed || 0,
            random,
        });
        const tieBreak = Math.floor((typeof random === "function" ? random() : Math.random()) * 6) + 1;
        return {
            tokenId: token.id,
            priority: token.priority || 0,
            total: test.total,
            dice: test.kept,
            tieBreak,
        };
    }).sort((first, second) =>
        second.priority - first.priority
        || second.total - first.total
        || second.tieBreak - first.tieBreak
        || first.tokenId.localeCompare(second.tokenId)
    );
    return {
        room: {
            ...room,
            initiative: results.map(result => result.tokenId),
            turnIndex: 0,
            round: room.round,
        },
        results,
    };
};

export const calculateMoveResolution = ({
    attacker,
    defender,
    move,
    mode = "normal",
    random,
    round = 0,
}) => {
    const profile = getMoveResolutionProfile(move);
    const statProfile = getMoveStatProfile({ move, attacker, defender });
    const attackKey = statProfile.attackKey;
    const defenseKey = statProfile.defenseKey;
    const attackerStagesIgnored = profile.requiresDamageContest && normalizeSlug(defender?.ability) === "unaware";
    const defenderStagesIgnored = profile.requiresDamageContest && normalizeSlug(attacker?.ability) === "unaware";
    const contestAttribute = (token, key, ignoreStages) => {
        const current = Number(token?.stats?.[key]) || 0;
        if (!ignoreStages) return current;
        const original = Number(token?.originalStats?.[key]);
        if (Number.isFinite(original)) return convertToTTRPG(original);
        return current / stageMultiplier(normalizeStageMap(token?.stages)[key]);
    };
    const offensiveToken = statProfile.attackSource === "defender" ? defender : attacker;
    const attackTest = profile.requiresDamageContest
        ? rollAttributeTest({
            mode,
            attribute: contestAttribute(offensiveToken, attackKey, attackerStagesIgnored),
            random,
        })
        : null;
    const defenseTest = profile.requiresDamageContest
        ? rollAttributeTest({
            mode: "normal",
            attribute: contestAttribute(defender, defenseKey, defenderStagesIgnored),
            random,
        })
        : null;
    const contestSuccess = profile.requiresDamageContest
        ? attackTest.total > defenseTest.total
        : true;
    const accuracyState = adjustMoveAccuracy({ move, attacker, defender });
    const accuracyTest = accuracyState.automatic
        ? { automatic: true, rolls: [], result: null, chance: accuracyState.adjustedAccuracy, success: true }
        : {
            automatic: false,
            ...rollPercentTest({
                chance: accuracyState.adjustedAccuracy,
                advantage: profile.requiresDamageContest && contestSuccess && attackTest.total - defenseTest.total > 1,
                random,
            }),
        };
    const dynamicPower = calculateDynamicMovePower({ move, attacker, defender, random });
    const listedPower = Number(move?.power);
    const power = dynamicPower?.power ?? (Number.isFinite(listedPower) ? listedPower : 0);
    const baseDamage = convertToTTRPG(power);
    const moveType = move?.type?.name || "";
    const stab = getMoveStab(attacker, moveType);
    const defensiveTypes = getDefensiveTypes(defender);
    const effectiveDefensiveTypes = ignoresGhostTypeImmunity(attacker, moveType, defensiveTypes)
        ? defensiveTypes.filter(type => type !== "ghost")
        : defensiveTypes;
    const effectiveness = defender && moveType
        ? calculateDefenses(
            effectiveDefensiveTypes.map(type => ({ type: { name: type } }))
        )[moveType] ?? 1
        : 1;
    const typeSensitiveStatusMoves = new Set(["thunder-wave"]);
    const typeBlocked = effectiveness === 0
        && (profile.requiresDamageContest || typeSensitiveStatusMoves.has(normalizeSlug(move?.name)));
    const specialBlockReason = getSpecialMoveBlockReason({ move, attacker, defender, round });
    const abilityBlock = getAbilityMoveBlock({ move, attacker, defender, effectiveness });
    const moveConnected = accuracyTest.success && !typeBlocked && !specialBlockReason && !abilityBlock;
    const damageHit = profile.requiresDamageContest && contestSuccess && moveConnected;
    const hit = moveConnected;
    const criticalMultiplier = attackTest?.critical ? 1.5 : 1;
    const flashFireMultiplier = moveType === "fire" && normalizeSpecialState(attacker?.specialState).markers.includes("flash-fire-boost") ? 1.5 : 1;
    const directKnockout = isDirectKnockoutMove(move);
    const minimumHits = Math.max(1, Number(move?.meta?.min_hits) || 1);
    const maximumHits = Math.max(minimumHits, Number(move?.meta?.max_hits) || minimumHits);
    const hitCount = damageHit && maximumHits > 1
        ? minimumHits + Math.floor((typeof random === "function" ? random() : Math.random()) * (maximumHits - minimumHits + 1))
        : 1;
    const moveName = normalizeSlug(move?.name);
    const fixedDamage = (() => {
        if (!damageHit || !defender) return null;
        if (moveName === "dragon-rage") return convertToTTRPG(40);
        if (moveName === "sonic-boom") return convertToTTRPG(20);
        if (["night-shade", "seismic-toss"].includes(moveName)) return convertToTTRPG(attacker?.level || 1);
        if (moveName === "final-gambit") return Math.max(1, Number(attacker?.currentHp) || 1);
        if (moveName === "psywave") {
            const multiplier = 0.5 + (typeof random === "function" ? random() : Math.random());
            return convertToTTRPG(Math.max(1, Math.floor((attacker?.level || 1) * multiplier)));
        }
        if (["super-fang", "natures-madness", "ruination"].includes(moveName)) {
            return Math.max(1, Math.ceil((Number(defender.currentHp) || 1) / 2));
        }
        if (moveName === "endeavor") {
            return Math.max(0, (Number(defender.currentHp) || 0) - (Number(attacker?.currentHp) || 0));
        }
        return null;
    })();
    const manualDamage = profile.requiresDamageContest
        && fixedDamage == null
        && !directKnockout
        && (power <= 0 || ["bide", "comeuppance", "counter", "metal-burst", "mirror-coat"].includes(moveName));
    const rawDamagePerHit = damageHit && effectiveness > 0
        ? directKnockout
            ? Math.max(1, Number(defender?.currentHp) || 1)
            : fixedDamage != null
                ? fixedDamage
                : manualDamage
                    ? 0
                    : Math.max(1, Math.round(baseDamage * stab * effectiveness * criticalMultiplier * flashFireMultiplier))
        : 0;
    const offensiveStage = attackerStagesIgnored ? 0 : normalizeStageMap(offensiveToken?.stages)[attackKey];
    const ceilingMultiplier = Math.max(1, stageMultiplier(offensiveStage));
    const ceiling = getDamageCeiling(attacker?.level || 1) * ceilingMultiplier;
    const damagePerHit = attackTest?.critical || directKnockout || fixedDamage != null || manualDamage
        ? rawDamagePerHit
        : Math.min(rawDamagePerHit, ceiling);
    const damage = damagePerHit * hitCount;
    return {
        profile,
        resolutionKind: profile.resolutionKind,
        resolutionLabel: profile.resolutionLabel,
        attackKey,
        defenseKey,
        attackTest,
        defenseTest,
        attackerStagesIgnored,
        defenderStagesIgnored,
        statProfile,
        contestSuccess,
        accuracy: accuracyState.baseAccuracy,
        adjustedAccuracy: accuracyState.adjustedAccuracy,
        accuracyState,
        accuracyTest,
        power,
        dynamicPower,
        baseDamage,
        stab,
        criticalMultiplier,
        flashFireMultiplier,
        effectiveness,
        typeBlocked,
        specialBlockReason,
        abilityBlock,
        moveConnected,
        damageHit,
        hit,
        ceiling,
        ceilingMultiplier,
        rawDamagePerHit,
        damagePerHit,
        hitCount,
        directKnockout,
        fixedDamage,
        manualDamage,
        damage,
    };
};

export const eventSummary = event => {
    const payload = event?.payload || {};
    if (event?.type === "roll") {
        const protection = payload.hitKillProtected
            ? ` A prévia calculou ${Number(payload.calculatedDamage) || 0} de dano, e a proteção contra hit kill manteria o alvo com 1 HP.`
            : "";
        return `${event.author} rolou ${payload.label || "um teste"}: ${payload.result ?? "—"}.${protection}`;
    }
    if (event?.type === "move-declared") {
        return `${event.author} escolheu ${payload.moveName ? formatName(payload.moveName) : "um movimento"}${payload.tokenName ? ` para ${payload.tokenName}` : ""}.`;
    }
    if (event?.type === "move") {
        const damage = Number(payload.damage) || 0;
        const connected = Boolean(payload.moveConnected ?? payload.hit);
        const moveDescription = payload.calledMoveName
            ? `usou ${payload.selectedMoveName || "um movimento"}, que chamou ${payload.calledMoveName}`
            : `usou ${payload.moveName || "um movimento"}`;
        const result = damage > 0
            ? `causou ${damage} de dano`
            : connected && payload.effectOnly
                ? "teve seu efeito resolvido"
                : connected
                    ? "alcançou o alvo, mas não causou dano"
                    : "não alcançou o alvo";
        const protection = payload.hitKillProtected
            ? ` O golpe causaria ${Number(payload.calculatedDamage) || damage}, mas a proteção contra hit kill manteve o alvo com 1 HP.`
            : "";
        const fainted = payload.fainted ? " O alvo não pode mais batalhar." : "";
        const fumble = payload.fumble ? " O erro crítico pede uma consequência escolhida para esta cena." : "";
        const special = payload.specialNarrative ? ` ${payload.specialNarrative}` : "";
        return `${event.author}: ${payload.attackerName || "Pokémon"} ${moveDescription} e ${result}.${protection}${fainted}${fumble}${special}`;
    }
    if (event?.type === "message") return `${event.author}: ${asText(payload.text)}`;
    if (event?.type === "ready") return payload.ready
        ? `${event.author} confirmou presença.`
        : `${event.author} voltou a se preparar.`;
    if (event?.type === "team-offer") return `${event.author} enviou a equipe “${payload.team?.name || "sem nome"}”.`;
    if (event?.type === "sfx") return `Som da cena: ${payload.label || "efeito"}.`;
    return asText(payload.text) || `${event?.author || "MyOwnDex"} registrou uma ação.`;
};

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
    applyDirectionalIntegerModifier,
    clampFinite,
    finiteNumberOrNull,
    finiteProduct,
    integerInRange,
    MAX_SAFE_GAME_INTEGER,
    quantizePositiveHpChange,
    quantizeStepDown,
    roundRpgScaledValue,
    safeDivide,
} from "./math.js";
import {
    adjustMoveAccuracy,
    applyStageChange,
    calculateStagedStats,
    clearHitKillSurvivalGrace,
    disableHitKillProtection,
    getDefensiveTypes,
    getHitKillProtectionKey,
    getHitKillSurvivalGraceKeys,
    getMoveResolutionProfile,
    getMoveStab,
    getStatusBlockReason,
    isDirectKnockoutMove,
    normalizeHitKillProtectionUsage,
    normalizePpSlots,
    normalizeSlug,
    normalizeStageMap,
    normalizeVolatileEffects,
    resolveDamageSequence,
    stageMultiplier,
} from "./automation.js";
import { getDamageCeiling, rollAttributeTest, rollPercentTest } from "./rpgRules.js";
import { randomChance, randomChoice, randomInt, randomUnit, rollD6 } from "./random.js";
import { compactTeam, createId, normalizeTeam, touchTeam } from "./team.js";
import {
    applyBattleIllusion,
    calculateDynamicMovePower,
    getAbilityMoveBlock,
    getMoveStatProfile,
    getSpecialMoveBlockReason,
    ignoresGhostTypeImmunity,
    normalizeSpecialState,
    revealBattleIllusion,
    revertBattleTransform,
    revertTemporaryMoveCopies,
    transformBattleToken,
} from "./specialMechanics.js";
import {
    consumeHeldItem,
    getDamageTraitModifiers,
    getInitiativeTraitState,
    getMultiHitTraitState,
    getTraitMoveBlock,
    isAbilityActive,
    isHeldItemActive,
    isWeatherSuppressed,
    normalizeTraitState,
    recordTraitEvent,
    restoreHeldItem,
    setAbilitySuppressed,
    traitSlug,
} from "./traitMechanics.js";

export const ROOM_SCHEMA_VERSION = 7;
export const ROOM_SESSION_STORAGE_KEY = "myowndex_live_room_v1";
export const LOCAL_ROOM_STORAGE_KEY = "myowndex_local_room_v1";

export const ROOM_PHASES = [
    {
        id: "exploracao",
        label: "Exploração",
        description: "Percorra rotas, investigue lugares, procure pistas e encontre Pokémon.",
    },
    {
        id: "interpretacao",
        label: "Interpretação",
        description: "Converse, tome decisões e dê espaço para cada personagem agir na história.",
    },
    {
        id: "batalha",
        label: "Batalha",
        description: "Organize o campo, declare movimentos e acompanhe cada turno do confronto.",
    },
    {
        id: "intervalo",
        label: "Intervalo",
        description: "Recupere o fôlego, cuide da equipe e prepare o próximo trecho da aventura.",
    },
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
    { id: "rota", label: "Rota campestre", icon: "🌿", tone: "#4ADE80" },
    { id: "floresta", label: "Floresta", icon: "🌲", tone: "#0E7490" },
    { id: "cidade", label: "Cidade", icon: "🏙️", tone: "#CBD5E1" },
    { id: "praia", label: "Praia", icon: "🌊", tone: "#0EA5E9" },
    { id: "caverna", label: "Caverna", icon: "🪨", tone: "#7F1D1D" },
    { id: "neve", label: "Campo nevado", icon: "❄️", tone: "#BAE6FD" },
    { id: "arena", label: "Estádio", icon: "🏟️", tone: "#B91C1C" },
    { id: "laboratorio", label: "Laboratório", icon: "🧪", tone: "#67E8F9" },
    { id: "distorcao", label: "Mundo Distorcido", icon: "🌀", tone: "#075985" },
];

export const STATUS_LABELS = RPG_STATUS_LABELS;

const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === "string" ? value : "";
const numberInRange = (value, minimum, maximum, fallback) => clampFinite(value, minimum, maximum, fallback);

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
    benchTokens: [],
    initiative: [],
    hitKillProtectionUsed: [],
    hitKillProtectionDisabled: [],
    hitKillSurvivalGrace: [],
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
    const maxHp = integerInRange(source.maxHp, 1, 99999, 1);
    const moves = asArray(source.moves).slice(0, 4).map(move => normalizeSlug(move));
    while (moves.length < 4) moves.push("");
    // Forest's Curse e Trick-or-Treat podem acrescentar um terceiro tipo durante a cena.
    const types = asArray(source.types).filter(Boolean).slice(0, 3).map(type => normalizeSlug(type));
    const originalTypes = asArray(source.originalTypes).length
        ? asArray(source.originalTypes).filter(Boolean).slice(0, 2).map(type => normalizeSlug(type))
        : types;
    const stats = Object.fromEntries(Object.keys(STAT_MAP).map(stat => [
        stat,
        integerInRange(source.stats?.[stat], 0, 99999, 0),
    ]));
    const originalStats = Object.fromEntries(Object.keys(STAT_MAP).map(stat => [
        stat,
        integerInRange(source.originalStats?.[stat], 0, 99999, stats[stat] * 20),
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
        speciesId: integerInRange(source.speciesId, 0, 99999, 0),
        sprite: asText(source.sprite).slice(0, 500),
        weight: integerInRange(source.weight, 0, 999999, 0),
        side: ["ally", "opponent", "neutral"].includes(source.side) ? source.side : "ally",
        x: numberInRange(source.x, 4, 96, 50),
        y: numberInRange(source.y, 8, 92, 55),
        maxHp,
        currentHp: integerInRange(source.currentHp, 0, maxHp, maxHp),
        status: Object.prototype.hasOwnProperty.call(STATUS_LABELS, source.status) ? source.status : "",
        level: integerInRange(source.level, 1, 200, 5),
        enteredRound: integerInRange(source.enteredRound, 1, 9999, 1),
        xp: quantizeStepDown(source.xp, 0.5, { minimum: 0, maximum: 999999, fallback: 0 }),
        priority: integerInRange(source.priority, -7, 7, 0),
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
            ? integerInRange(source.toxicCounter, 1, 15, 1)
            : 0,
        stats,
        originalStats,
        stages,
        moves,
        pp: normalizePpSlots(source.pp),
        volatileEffects: normalizeVolatileEffects(source.volatileEffects),
        specialState: normalizeSpecialState(source.specialState),
        traitState: normalizeTraitState(source.traitState, source.item, source.ability),
        hidden: Boolean(source.hidden),
    };
    return { ...token, stats: calculateStagedStats(token) };
};

export const normalizeRoomSnapshot = value => {
    const source = value && typeof value === "object" ? value : {};
    const fallback = createRoomSnapshot(source.title);
    const tokens = asArray(source.tokens).slice(0, 40).map(normalizeRoomToken);
    const benchTokens = asArray(source.benchTokens).slice(0, 40).map(normalizeRoomToken);
    const neutralizingGasActive = tokens.some(token => token.currentHp > 0
        && traitSlug(token.ability) === "neutralizing-gas"
        && !normalizeTraitState(token.traitState, token.item, token.ability).ability.suppressed);
    const resolvedTokens = tokens.map(token => {
        const state = normalizeTraitState(token.traitState, token.item, token.ability);
        const gasSuppressed = state.ability.suppressed && state.ability.suppressionReason === "Neutralizing Gas ativo na cena";
        const protectedByShield = isHeldItemActive(token) && traitSlug(token.item) === "ability-shield";
        const shouldSuppress = neutralizingGasActive
            && traitSlug(token.ability) !== "neutralizing-gas"
            && !protectedByShield;
        if (shouldSuppress && !state.ability.suppressed) return setAbilitySuppressed(token, true, "Neutralizing Gas ativo na cena");
        if (!shouldSuppress && gasSuppressed) return setAbilitySuppressed(token, false);
        return token;
    });
    const tokenIds = new Set(resolvedTokens.map(token => token.id));
    const initiative = asArray(source.initiative).filter(id => tokenIds.has(id)).slice(0, 40);
    return {
        ...fallback,
        ...source,
        schema: ROOM_SCHEMA_VERSION,
        title: asText(source.title).trim().slice(0, 80) || fallback.title,
        phase: ROOM_PHASES.some(phase => phase.id === source.phase) ? source.phase : fallback.phase,
        round: integerInRange(source.round, 1, 9999, 1),
        turnIndex: initiative.length
            ? integerInRange(source.turnIndex, 0, initiative.length - 1, 0)
            : 0,
        scenario: ROOM_SCENARIOS.some(scene => scene.id === source.scenario) ? source.scenario : fallback.scenario,
        weather: ROOM_WEATHERS.some(weather => weather.id === source.weather) ? source.weather : fallback.weather,
        terrain: ROOM_TERRAINS.some(terrain => terrain.id === source.terrain) ? source.terrain : fallback.terrain,
        sceneNotes: asText(source.sceneNotes).slice(0, 4000),
        gmNotes: asText(source.gmNotes).slice(0, 6000),
        tokens: resolvedTokens,
        benchTokens,
        initiative,
        hitKillProtectionUsed: normalizeHitKillProtectionUsage(source.hitKillProtectionUsed),
        hitKillProtectionDisabled: normalizeHitKillProtectionUsage(source.hitKillProtectionDisabled),
        hitKillSurvivalGrace: normalizeHitKillProtectionUsage(source.hitKillSurvivalGrace),
        audio: {
            ...fallback.audio,
            ...(source.audio && typeof source.audio === "object" ? source.audio : {}),
            trackId: asText(source.audio?.trackId) || null,
            title: asText(source.audio?.title).slice(0, 120),
            playing: Boolean(source.audio?.playing),
            volume: numberInRange(source.audio?.volume, 0, 1, 0.55),
            startedAt: integerInRange(source.audio?.startedAt, 0, MAX_SAFE_GAME_INTEGER, 0),
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

export const changeRoomPhase = (snapshot, nextPhase) => {
    const room = normalizeRoomSnapshot(snapshot);
    const phase = ROOM_PHASES.some(candidate => candidate.id === nextPhase)
        ? nextPhase
        : room.phase;
    if (phase === room.phase) return room;
    return normalizeRoomSnapshot({
        ...room,
        phase,
        hitKillProtectionUsed: phase === "batalha"
            ? []
            : room.hitKillProtectionUsed,
        hitKillProtectionDisabled: phase === "batalha"
            ? []
            : room.hitKillProtectionDisabled,
        hitKillSurvivalGrace: phase === "batalha"
            ? []
            : room.hitKillSurvivalGrace,
    });
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
    const custom = finiteNumberOrNull(pokemon?.customStats?.[statName]);
    if (custom != null) return integerInRange(custom, 1, 255, 1);
    return integerInRange(
        pokemon?.species?.stats?.find(entry => entry?.stat?.name === statName)?.base_stat,
        1,
        255,
        1,
    );
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
    const id = integerInRange(pokemon?.species?.id, 0, 99999, 0);
    return animated || pixel || (id
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
        : "");
};

const getBattlefieldPosition = (index = 0, side = "ally") => {
    const ally = side === "ally";
    const row = Math.floor(index / 3);
    const column = index % 3;
    return {
        x: ally ? 20 + column * 11 : 80 - column * 11,
        y: ally ? 67 + row * 10 : 33 - row * 10,
    };
};

export const createTokenFromPokemon = (pokemon, team, index = 0, side = "ally") => {
    const computed = calculatePokemonStats(pokemon);
    const maxHp = computed.hp.rpg;
    const currentHp = pokemon?.rpg?.currentHp == null
        ? maxHp
        : integerInRange(pokemon.rpg.currentHp, 0, maxHp, maxHp);
    const position = getBattlefieldPosition(index, side);
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
        ...position,
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

const activateEnteredTokens = (room, tokenInput, enteredIdInput) => {
    const enteredIds = new Set(enteredIdInput);
    let combined = tokenInput;
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
    let weather = room.weather;
    let terrain = room.terrain;
    const weatherAbilities = {
        drizzle: "chuva",
        "primordial-sea": "chuva",
        drought: "sol",
        "desolate-land": "sol",
        "orichalcum-pulse": "sol",
        "sand-stream": "areia",
        "snow-warning": "neve",
    };
    const terrainAbilities = {
        "electric-surge": "eletrico",
        "grassy-surge": "gramado",
        "misty-surge": "nevoa",
        "psychic-surge": "psiquico",
    };
    const intimidateImmunities = new Set(["clear-body", "full-metal-body", "hyper-cutter", "inner-focus", "oblivious", "own-tempo", "scrappy", "white-smoke"]);

    for (const enteredId of enteredIds) {
        let entered = combined.find(token => token.id === enteredId);
        if (!entered || entered.currentHp <= 0 || !isAbilityActive(entered)) continue;
        const ability = traitSlug(entered.ability);
        const gasInCombinedScene = combined.some(candidate => candidate.currentHp > 0 && traitSlug(candidate.ability) === "neutralizing-gas");
        if (gasInCombinedScene && ability !== "neutralizing-gas" && traitSlug(entered.item) !== "ability-shield") continue;
        if (weatherAbilities[ability]) {
            weather = weatherAbilities[ability];
            entered = recordTraitEvent(entered, { kind: "ability", sourceId: ability, label: "Clima criado", detail: `Clima alterado para ${weather}`, round: room.round });
        }
        if (terrainAbilities[ability]) {
            terrain = terrainAbilities[ability];
            entered = recordTraitEvent(entered, { kind: "ability", sourceId: ability, label: "Terreno criado", detail: `Terreno alterado para ${terrain}`, round: room.round });
        }
        if (ability === "intrepid-sword") {
            entered = applyStageChange(entered, "attack", 1);
            entered = recordTraitEvent(entered, { kind: "ability", sourceId: ability, label: "Ataque aumentou", detail: "Entrada em campo", round: room.round });
        }
        if (ability === "dauntless-shield") {
            entered = applyStageChange(entered, "defense", 1);
            entered = recordTraitEvent(entered, { kind: "ability", sourceId: ability, label: "Defesa aumentou", detail: "Entrada em campo", round: room.round });
        }
        if (ability === "download") {
            const opponents = combined.filter(candidate => candidate.currentHp > 0 && candidate.side !== entered.side && candidate.side !== "neutral");
            const defense = opponents.reduce((sum, candidate) => sum + integerInRange(candidate.stats?.defense, 0, 99999, 0), 0);
            const specialDefense = opponents.reduce((sum, candidate) => sum + integerInRange(candidate.stats?.["special-defense"], 0, 99999, 0), 0);
            const stat = defense < specialDefense ? "attack" : "special-attack";
            entered = applyStageChange(entered, stat, 1);
            entered = recordTraitEvent(entered, { kind: "ability", sourceId: ability, label: `${stat} aumentou`, detail: "Download comparou as defesas em cena", round: room.round });
        }
        combined = combined.map(candidate => candidate.id === enteredId ? entered : candidate);

        if (ability === "intimidate") {
            combined = combined.map(candidate => {
                if (candidate.id === enteredId || candidate.currentHp <= 0 || candidate.side === entered.side || candidate.side === "neutral") return candidate;
                const targetAbility = isAbilityActive(candidate) ? traitSlug(candidate.ability) : "";
                if (intimidateImmunities.has(targetAbility)) {
                    return recordTraitEvent(candidate, { kind: "ability", sourceId: targetAbility, label: "Intimidate impedido", detail: `${candidate.name} preservou o Ataque`, round: room.round });
                }
                const direction = targetAbility === "contrary" ? 1 : -1;
                let changed = applyStageChange(candidate, "attack", direction);
                if (targetAbility === "defiant") changed = applyStageChange(changed, "attack", 2);
                if (targetAbility === "competitive") changed = applyStageChange(changed, "special-attack", 2);
                return recordTraitEvent(changed, {
                    kind: "ability",
                    sourceId: ability,
                    label: "Intimidate ativado",
                    detail: targetAbility === "contrary" ? "Contrary inverteu a redução" : "Ataque reduzido na entrada",
                    round: room.round,
                });
            });
        }
    }

    const terrainSeed = {
        "electric-seed": ["eletrico", "defense"],
        "grassy-seed": ["gramado", "defense"],
        "misty-seed": ["nevoa", "special-defense"],
        "psychic-seed": ["psiquico", "special-defense"],
    };
    combined = combined.map(token => {
        const seed = terrainSeed[traitSlug(token.item)];
        if (!seed || seed[0] !== terrain || token.currentHp <= 0) return token;
        const itemId = traitSlug(token.item);
        const consumed = consumeHeldItem(token, { reason: `${itemId} reagiu ao terreno`, round: room.round });
        const changed = applyStageChange(consumed.token, seed[1], 1);
        return recordTraitEvent(changed, { kind: "item", sourceId: itemId, label: "Semente ativada", detail: `Terreno ${terrain}`, round: room.round });
    });
    return { tokens: combined, weather, terrain };
};

export const addTeamToSnapshot = (snapshot, teamInput, side = "ally", ownerPlayerId = "", options = {}) => {
    const room = normalizeRoomSnapshot(snapshot);
    const team = normalizeTeam(teamInput);
    const belongsToTeam = token => token.teamId === team.id
        || Boolean(token.teamShareId && token.teamShareId === team.shareId);
    const relatedTokens = room.tokens.filter(belongsToTeam);
    const relatedBenchTokens = room.benchTokens.filter(belongsToTeam);
    const fieldPokemonIds = new Set(relatedTokens.map(token => token.pokemonId).filter(Boolean));
    const existingPokemon = new Set(
        [...relatedTokens, ...relatedBenchTokens]
            .map(token => token.pokemonId)
            .filter(Boolean)
    );
    const requestedActiveIds = new Set(asArray(options.activePokemonIds).map(asText).filter(Boolean));
    const activeCapacity = Math.max(0, 40 - room.tokens.length);
    const requestedBenchTokens = requestedActiveIds.size
        ? relatedBenchTokens.filter(token => requestedActiveIds.has(token.pokemonId)
            && !fieldPokemonIds.has(token.pokemonId)
            && token.currentHp > 0)
        : [];
    const promotedTokens = requestedBenchTokens.slice(0, activeCapacity).map((token, index) => ({
        ...token,
        ...getBattlefieldPosition(room.tokens.length + index, side),
        side,
        ownerPlayerId: token.ownerPlayerId || asText(ownerPlayerId),
        enteredRound: room.round,
    }));
    const promotedIds = new Set(promotedTokens.map(token => token.id));
    const available = team.pokemon.filter(pokemon => !existingPokemon.has(pokemon.id));
    const activeCandidates = requestedActiveIds.size
        ? available.filter(pokemon => requestedActiveIds.has(pokemon.id))
        : available;
    const createdTokens = activeCandidates.slice(0, Math.max(0, activeCapacity - promotedTokens.length)).map((pokemon, index) => ({
        ...createTokenFromPokemon(pokemon, team, room.tokens.length + promotedTokens.length + index, side),
        ownerPlayerId: asText(ownerPlayerId),
        enteredRound: room.round,
    }));
    const enteredPokemonIds = new Set(createdTokens.map(token => token.pokemonId));
    const benchCandidates = options.benchRemaining
        ? available.filter(pokemon => !enteredPokemonIds.has(pokemon.id))
        : [];
    const remainingBenchTokens = room.benchTokens.filter(token => !promotedIds.has(token.id));
    const benchCapacity = Math.max(0, 40 - remainingBenchTokens.length);
    const benchTokens = benchCandidates.slice(0, benchCapacity).map((pokemon, index) => ({
        ...createTokenFromPokemon(pokemon, team, remainingBenchTokens.length + index, side),
        ownerPlayerId: asText(ownerPlayerId),
        enteredRound: room.round,
    }));
    const tokens = [...promotedTokens, ...createdTokens];
    let combined = [...room.tokens, ...tokens];
    const enteredIds = new Set(tokens.map(token => token.id));
    const activated = activateEnteredTokens(room, combined, enteredIds);
    combined = activated.tokens;

    const normalizedRoom = normalizeRoomSnapshot({
        ...room,
        weather: activated.weather,
        terrain: activated.terrain,
        tokens: combined,
        benchTokens: [...remainingBenchTokens, ...benchTokens],
    });
    return {
        room: normalizedRoom,
        tokens: normalizedRoom.tokens.filter(token => enteredIds.has(token.id)),
        benchTokens: normalizedRoom.benchTokens.filter(token => benchTokens.some(candidate => candidate.id === token.id)),
    };
};

const prepareTokenForSwitch = tokenInput => {
    let token = tokenInput;
    const revertedTransform = revertBattleTransform(token);
    if (revertedTransform.applied) token = revertedTransform.token;
    const revertedCopy = revertTemporaryMoveCopies(token);
    if (revertedCopy.applied) token = revertedCopy.token;
    const revealed = revealBattleIllusion(token);
    if (revealed.applied) token = revealed.token;
    const stages = normalizeStageMap({});
    const traitState = normalizeTraitState(token.traitState, token.item, token.ability);
    const changed = {
        ...token,
        declaredMove: "",
        priority: 0,
        volatileEffects: [],
        stages,
        traitState: {
            ...traitState,
            ability: { ...traitState.ability, suppressed: false, suppressionReason: "" },
            markers: traitState.markers.filter(marker => !marker.startsWith("choice-lock:")),
        },
        specialState: {
            ...normalizeSpecialState(token.specialState),
            illusion: null,
            markers: normalizeSpecialState(token.specialState).markers.filter(marker => marker !== "flash-fire-boost"),
        },
    };
    return { ...changed, stats: calculateStagedStats(changed) };
};

export const swapTeamPokemonInSnapshot = (snapshot, outgoingTokenId, incomingTokenId) => {
    const room = normalizeRoomSnapshot(snapshot);
    const outgoingIndex = room.tokens.findIndex(token => token.id === outgoingTokenId);
    const incomingIndex = room.benchTokens.findIndex(token => token.id === incomingTokenId || token.pokemonId === incomingTokenId);
    if (outgoingIndex < 0) return { room, swapped: false, reason: "Escolha o Pokémon que está em campo." };
    if (incomingIndex < 0) return { room, swapped: false, reason: "Escolha um Pokémon disponível no banco." };
    const outgoing = room.tokens[outgoingIndex];
    const incoming = room.benchTokens[incomingIndex];
    const sameTeam = Boolean(
        outgoing.teamId
        && incoming.teamId
        && (
            outgoing.teamId === incoming.teamId
            || (outgoing.teamShareId && outgoing.teamShareId === incoming.teamShareId)
        )
    );
    if (!sameTeam) return { room, swapped: false, reason: "A troca só pode usar o banco da mesma equipe." };
    if (incoming.currentHp <= 0) return { room, swapped: false, reason: `${incoming.name} não pode mais batalhar.` };

    const benched = prepareTokenForSwitch(outgoing);
    const entered = {
        ...prepareTokenForSwitch(incoming),
        side: outgoing.side,
        x: outgoing.x,
        y: outgoing.y,
        ownerPlayerId: outgoing.ownerPlayerId,
        enteredRound: room.round,
    };
    const tokens = room.tokens.map((token, index) => index === outgoingIndex ? entered : token);
    const benchTokens = room.benchTokens.map((token, index) => index === incomingIndex ? benched : token);
    const initiative = room.initiative.map(tokenId => tokenId === outgoing.id ? entered.id : tokenId);
    const activated = activateEnteredTokens({ ...room, tokens }, tokens, [entered.id]);
    const normalizedRoom = normalizeRoomSnapshot({
        ...room,
        tokens: activated.tokens,
        benchTokens,
        initiative,
        weather: activated.weather,
        terrain: activated.terrain,
    });
    return {
        room: normalizedRoom,
        swapped: true,
        outgoing: benched,
        incoming: normalizedRoom.tokens.find(token => token.id === entered.id) || entered,
    };
};

export const compactTeamOffer = team => compactTeam(team);

export const syncTeamsWithRoomProgress = (teams, snapshot, playerId = null) => {
    const room = normalizeRoomSnapshot(snapshot);
    const eligibleTokens = [...room.tokens, ...room.benchTokens].filter(token =>
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
                integerInRange(partner.level, 1, 200, 1) === token.level
                && partner.rpg?.currentHp === token.currentHp
                && (partner.rpg?.status || "") === token.status
                && clampFinite(partner.rpg?.xp, 0, 999999, 0) === token.xp
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

const residualAmount = (maximumHp, fraction) => {
    const hp = integerInRange(maximumHp, 1, 99999, 1);
    const ratio = clampFinite(fraction, 0, 1, 0);
    return quantizePositiveHpChange(finiteProduct([hp, ratio], { minimum: 0, maximum: hp, fallback: 0 }), hp);
};
const uniqueSources = values => [...new Set(values.filter(Boolean))];
const SAND_IMMUNE_ABILITIES = new Set(["magic-guard", "overcoat", "sand-force", "sand-rush", "sand-veil"]);
const END_ROUND_STATUS_BERRIES = Object.freeze({
    "aspear-berry": "freeze",
    "cheri-berry": "paralysis",
    "chesto-berry": "sleep",
    "pecha-berry": "poison",
    "rawst-berry": "burn",
});

export const applyEndOfRoundEffects = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    const effectiveWeather = isWeatherSuppressed(room.tokens) ? "limpo" : room.weather;
    const effects = [];
    const leechHealing = [];
    let hitKillProtectionUsed = room.hitKillProtectionUsed;
    let hitKillProtectionDisabled = room.hitKillProtectionDisabled;
    let hitKillSurvivalGrace = room.hitKillSurvivalGrace;
    const resolveRoundDamage = (token, damage, options = {}) => {
        const requestedDamage = integerInRange(damage, 0, MAX_SAFE_GAME_INTEGER, 0);
        if (!token || token.currentHp <= 0 || requestedDamage <= 0) {
            return { token, appliedDamage: 0, protectedFromKnockout: false, traitProtected: false };
        }
        if (options.selfInflicted) {
            hitKillProtectionDisabled = disableHitKillProtection(hitKillProtectionDisabled, token);
        }
        const key = getHitKillProtectionKey(token);
        const resolved = resolveDamageSequence({
            token,
            hitDamages: [{ damage: requestedDamage, hitNumber: integerInRange(options.hitNumber, 1, 20, 1) }],
            round: room.round,
            protectionUsed: Boolean(key && hitKillProtectionUsed.includes(key)),
            protectionDisabled: Boolean(key && hitKillProtectionDisabled.includes(key)),
            survivalGrace: getHitKillSurvivalGraceKeys(token).some(graceKey => hitKillSurvivalGrace.includes(graceKey)),
            allowSurvivalTrait: Boolean(options.allowSurvivalTrait),
            critical: Boolean(options.critical),
            defenderFumble: Boolean(options.defenderFumble),
            directKnockout: Boolean(options.directKnockout),
        });
        if (resolved.protectionConsumed && key) {
            hitKillProtectionUsed = normalizeHitKillProtectionUsage([...hitKillProtectionUsed, key]);
        }
        if (resolved.survivalGraceRemaining) {
            hitKillSurvivalGrace = normalizeHitKillProtectionUsage([
                ...clearHitKillSurvivalGrace(hitKillSurvivalGrace, token),
                ...getHitKillSurvivalGraceKeys(resolved.token || token),
            ]);
        } else if (requestedDamage > 0) {
            hitKillSurvivalGrace = clearHitKillSurvivalGrace(hitKillSurvivalGrace, token);
        }
        return resolved;
    };
    let tokens = room.tokens.map(token => {
        if (token.currentHp <= 0) return token;
        let currentHp = token.currentHp;
        let status = token.status;
        let forcedFaint = false;
        const damageEvents = [];
        let persistentHealing = 0;
        let workingToken = { ...token, traitState: normalizeTraitState(token.traitState, token.item, token.ability) };
        const activeAbility = isAbilityActive(workingToken) ? traitSlug(workingToken.ability) : "";
        const activeItem = isHeldItemActive(workingToken) ? traitSlug(workingToken.item) : "";
        const healingSources = [];
        const volatileEffects = [];

        normalizeVolatileEffects(token.volatileEffects).forEach(effect => {
            if (effect.id === "yawn") {
                const turns = integerInRange(effect.turns, 0, 99, 0) - 1;
                if (turns > 0) {
                    volatileEffects.push({ ...effect, turns });
                } else if (!status) {
                    const blocked = getStatusBlockReason("sleep", { ...workingToken, status }, null, { terrain: room.terrain });
                    if (blocked) {
                        effects.push({
                            kind: "state",
                            tokenId: token.id,
                            tokenName: token.name,
                            damage: 0,
                            remainingHp: currentHp,
                            fainted: false,
                            sources: [`Bocejo não causou sono: ${blocked}`],
                        });
                        return;
                    }
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
                const turns = integerInRange(effect.turns, 0, 99, 0) - 1;
                if (turns > 0) volatileEffects.push({ ...effect, turns });
                else {
                    const amount = integerInRange(effect.amount, 0, 99999, 0);
                    damageEvents.push({
                        amount,
                        source: formatName(effect.sourceMove),
                        allowSurvivalTrait: true,
                        critical: effect.critical,
                        defenderFumble: effect.defenderFumble,
                        directKnockout: effect.directKnockout,
                    });
                }
                return;
            }

            if (effect.id === "wish") {
                const turns = integerInRange(effect.turns, 0, 99, 0) - 1;
                if (turns > 0) volatileEffects.push({ ...effect, turns });
                else {
                    const storedAmount = finiteNumberOrNull(effect.amount);
                    persistentHealing += storedAmount != null && storedAmount > 0
                        ? integerInRange(storedAmount, 1, 99999, 1)
                        : residualAmount(token.maxHp, 1 / 2);
                }
                return;
            }

            if (effect.id === "perish-song") {
                const turns = integerInRange(effect.turns, 0, 99, 0) - 1;
                if (turns > 0) volatileEffects.push({ ...effect, turns });
                else forcedFaint = true;
                return;
            }

            if (effect.id === "leech-seed") {
                const amount = Math.min(currentHp, residualAmount(token.maxHp, 1 / 8));
                if (amount > 0 && activeAbility !== "magic-guard") {
                    damageEvents.push({
                        amount,
                        source: "Leech Seed",
                        leechSourceTokenId: effect.sourceTokenId,
                        leechSourceName: effect.sourceName,
                    });
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
            const turns = integerInRange(effect.turns, 0, 99, 0) - 1;
            if (turns > 0) volatileEffects.push({ ...effect, turns });
        });

        let specialState = normalizeSpecialState(token.specialState);
        if (effectiveWeather === "neve" && token.ability === "ice-face" && specialState.markers.includes("ice-face-broken")) {
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

        workingToken = { ...workingToken, currentHp, status, specialState };
        if (activeAbility === "speed-boost") {
            workingToken = applyStageChange(workingToken, "speed", 1);
            workingToken = recordTraitEvent(workingToken, {
                kind: "ability",
                sourceId: activeAbility,
                label: "Velocidade aumentou",
                detail: "Fim da rodada",
                round: room.round,
            });
            effects.push({
                kind: "stage",
                tokenId: token.id,
                tokenName: token.name,
                stat: "speed",
                change: 1,
                damage: 0,
                remainingHp: currentHp,
                fainted: false,
                sources: ["Speed Boost"],
            });
        }
        if (activeAbility === "moody") {
            const stats = ["attack", "defense", "special-attack", "special-defense", "speed", "accuracy", "evasion"];
            const raisedStat = randomChoice(stats, random) || "attack";
            const loweredOptions = stats.filter(stat => stat !== raisedStat);
            const loweredStat = randomChoice(loweredOptions, random) || "defense";
            workingToken = applyStageChange(workingToken, raisedStat, 2);
            workingToken = applyStageChange(workingToken, loweredStat, -1);
            workingToken = recordTraitEvent(workingToken, {
                kind: "ability",
                sourceId: activeAbility,
                label: "Moody oscilou",
                detail: `${raisedStat} +2; ${loweredStat} -1`,
                round: room.round,
            });
            effects.push({
                kind: "stage",
                tokenId: token.id,
                tokenName: token.name,
                damage: 0,
                remainingHp: currentHp,
                fainted: false,
                sources: [`Moody: ${formatName(raisedStat)} +2, ${formatName(loweredStat)} -1`],
            });
        }

        if (activeItem === "leftovers") {
            persistentHealing += residualAmount(token.maxHp, 1 / 16);
            healingSources.push("Leftovers");
        }
        if (activeItem === "black-sludge") {
            if (token.types.includes("poison")) {
                persistentHealing += residualAmount(token.maxHp, 1 / 16);
                healingSources.push("Black Sludge");
            } else if (activeAbility !== "magic-guard") {
                damageEvents.push({ amount: residualAmount(token.maxHp, 1 / 8), source: "Black Sludge", selfInflicted: true });
            }
        }
        if (activeItem === "sticky-barb" && activeAbility !== "magic-guard") {
            damageEvents.push({ amount: residualAmount(token.maxHp, 1 / 8), source: "Sticky Barb", selfInflicted: true });
        }
        if (activeAbility === "rain-dish" && effectiveWeather === "chuva") {
            persistentHealing += residualAmount(token.maxHp, 1 / 16);
            healingSources.push("Rain Dish");
        }
        if (activeAbility === "ice-body" && effectiveWeather === "neve") {
            persistentHealing += residualAmount(token.maxHp, 1 / 16);
            healingSources.push("Ice Body");
        }
        if (activeAbility === "dry-skin" && effectiveWeather === "chuva") {
            persistentHealing += residualAmount(token.maxHp, 1 / 8);
            healingSources.push("Dry Skin");
        }
        if (activeAbility === "poison-heal" && ["poison", "bad-poison"].includes(status)) {
            persistentHealing += residualAmount(token.maxHp, 1 / 8);
            healingSources.push("Poison Heal");
        }
        const grounded = !token.types.includes("flying") && activeAbility !== "levitate" && activeItem !== "air-balloon";
        if (room.terrain === "gramado" && grounded) {
            persistentHealing += residualAmount(token.maxHp, 1 / 16);
            healingSources.push("Terreno de Grama");
        }
        if (activeAbility !== "magic-guard" && activeAbility === "dry-skin" && effectiveWeather === "sol") {
            damageEvents.push({ amount: residualAmount(token.maxHp, 1 / 8), source: "Dry Skin sob sol", selfInflicted: true });
        }
        if (activeAbility !== "magic-guard" && activeAbility === "solar-power" && effectiveWeather === "sol") {
            damageEvents.push({ amount: residualAmount(token.maxHp, 1 / 8), source: "Solar Power", selfInflicted: true });
        }

        if (status && activeAbility === "hydration" && effectiveWeather === "chuva") {
            const previousStatus = status;
            status = "";
            workingToken = recordTraitEvent({ ...workingToken, status, toxicCounter: 0 }, {
                kind: "ability",
                sourceId: activeAbility,
                label: "Condição curada",
                detail: `${previousStatus} removido pela chuva`,
                round: room.round,
            });
            effects.push({ kind: "status", tokenId: token.id, tokenName: token.name, status: "", damage: 0, remainingHp: currentHp, fainted: false, sources: ["Hydration curou a condição"] });
        } else if (status && activeAbility === "shed-skin" && randomChance(1, 3, random)) {
            const previousStatus = status;
            status = "";
            workingToken = recordTraitEvent({ ...workingToken, status, toxicCounter: 0 }, {
                kind: "ability",
                sourceId: activeAbility,
                label: "Condição curada",
                detail: `${previousStatus} removido no fim da rodada`,
                round: room.round,
            });
            effects.push({ kind: "status", tokenId: token.id, tokenName: token.name, status: "", damage: 0, remainingHp: currentHp, fainted: false, sources: ["Shed Skin curou a condição"] });
        }

        if (!status && ["flame-orb", "toxic-orb"].includes(activeItem)) {
            const nextStatus = activeItem === "flame-orb" ? "burn" : "bad-poison";
            const blocked = getStatusBlockReason(nextStatus, { ...workingToken, status }, null, { terrain: room.terrain });
            if (!blocked) {
                status = nextStatus;
                workingToken = recordTraitEvent({ ...workingToken, status, toxicCounter: nextStatus === "bad-poison" ? 1 : 0 }, {
                    kind: "item",
                    sourceId: activeItem,
                    label: "Condição aplicada",
                    detail: `${activeItem} ativou no fim da rodada`,
                    round: room.round,
                });
                effects.push({ kind: "status", tokenId: token.id, tokenName: token.name, status, damage: 0, remainingHp: currentHp, fainted: false, sources: [formatName(activeItem)] });
            }
        }

        const currentItem = traitSlug(workingToken.item);
        const cureStatus = END_ROUND_STATUS_BERRIES[currentItem];
        const berryMatches = cureStatus && (cureStatus === status || (cureStatus === "poison" && status === "bad-poison"));
        if (status && (currentItem === "lum-berry" || berryMatches)) {
            const previousStatus = status;
            const consumed = consumeHeldItem(workingToken, { reason: `${currentItem} curou ${previousStatus}`, round: room.round });
            workingToken = recordTraitEvent({ ...consumed.token, status: "", toxicCounter: 0 }, {
                kind: "item",
                sourceId: currentItem,
                label: "Condição curada",
                detail: `${previousStatus} removido no fim da rodada`,
                round: room.round,
            });
            status = "";
            effects.push({ kind: "status", tokenId: token.id, tokenName: token.name, status: "", damage: 0, remainingHp: currentHp, fainted: false, sources: [`${formatName(currentItem)} foi consumida`] });
        }

        const traitState = normalizeTraitState(workingToken.traitState, workingToken.item, workingToken.ability);
        if (activeAbility === "harvest" && traitState.item.consumed && traitState.item.originalId.endsWith("-berry")) {
            const harvests = effectiveWeather === "sol" || randomChance(1, 2, random);
            if (harvests) {
                const restored = restoreHeldItem(workingToken, { reason: "Harvest recuperou a Fruta", round: room.round });
                if (restored.applied) {
                    workingToken = restored.token;
                    effects.push({ kind: "state", tokenId: token.id, tokenName: token.name, damage: 0, remainingHp: currentHp, fainted: false, sources: [`Harvest restaurou ${formatName(restored.itemId)}`] });
                }
            }
        }

        if (persistentHealing > 0 && !forcedFaint) {
            const before = currentHp;
            currentHp = Math.min(token.maxHp, currentHp + persistentHealing);
            const healed = currentHp - before;
            if (healed > 0) {
                workingToken = { ...workingToken, currentHp };
                uniqueSources(healingSources.length ? healingSources : ["recuperação-persistente"]).forEach(source => {
                    workingToken = recordTraitEvent(workingToken, {
                        kind: "state",
                        sourceId: traitSlug(source),
                        label: "HP recuperado",
                        detail: `${healed} HP no fim da rodada`,
                        round: room.round,
                    });
                });
                effects.push({
                    kind: "heal",
                    tokenId: token.id,
                    tokenName: token.name,
                    healed,
                    damage: 0,
                    remainingHp: currentHp,
                    fainted: false,
                    sources: uniqueSources(healingSources.length ? healingSources : ["recuperação persistente"]),
                });
            }
        }

        let toxicCounter = status === "bad-poison" ? integerInRange(token.toxicCounter, 1, 15, 1) : 0;
        const indirectBlocked = activeAbility === "magic-guard";
        if (!indirectBlocked && status === "burn") {
            damageEvents.push({
                amount: residualAmount(token.maxHp, 1 / 16),
                source: "queimadura",
                selfInflicted: activeItem === "flame-orb",
            });
        }
        if (!indirectBlocked && activeAbility !== "poison-heal" && status === "poison") {
            damageEvents.push({
                amount: residualAmount(token.maxHp, 1 / 8),
                source: "envenenamento",
                selfInflicted: activeItem === "toxic-orb",
            });
        }
        if (!indirectBlocked && activeAbility !== "poison-heal" && status === "bad-poison") {
            damageEvents.push({
                amount: residualAmount(token.maxHp, toxicCounter / 16),
                source: "envenenamento grave",
                selfInflicted: activeItem === "toxic-orb",
            });
            toxicCounter = integerInRange(toxicCounter + 1, 1, 15, 1);
        }
        const sandImmuneType = token.types.some(type => ["ground", "rock", "steel"].includes(type));
        if (effectiveWeather === "areia" && !sandImmuneType && !SAND_IMMUNE_ABILITIES.has(activeAbility) && activeItem !== "safety-goggles") {
            damageEvents.push({ amount: residualAmount(token.maxHp, 1 / 16), source: "tempestade de areia" });
        }

        if (forcedFaint) {
            const resolved = resolveRoundDamage({ ...workingToken, currentHp }, currentHp, { directKnockout: true });
            currentHp = resolved.remainingHp;
            workingToken = resolved.token || workingToken;
            effects.push({
                kind: "perish",
                tokenId: token.id,
                tokenName: token.name,
                damage: resolved.appliedDamage,
                remainingHp: currentHp,
                fainted: currentHp <= 0,
                sources: ["Perish Song"],
            });
        } else {
            damageEvents.forEach((damageEvent, index) => {
                if (currentHp <= 0 || damageEvent.amount <= 0) return;
                const resolved = resolveRoundDamage(
                    { ...workingToken, currentHp },
                    damageEvent.amount,
                    { ...damageEvent, hitNumber: index + 1 },
                );
                currentHp = resolved.remainingHp;
                workingToken = resolved.token || workingToken;
                workingToken = recordTraitEvent(workingToken, {
                    kind: "state",
                    sourceId: traitSlug(damageEvent.source),
                    label: "Dano residual",
                    detail: `${resolved.appliedDamage} de dano no fim da rodada`,
                    round: room.round,
                });
                effects.push({
                    kind: "damage",
                    tokenId: token.id,
                    tokenName: token.name,
                    damage: resolved.appliedDamage,
                    remainingHp: currentHp,
                    fainted: currentHp <= 0,
                    protectedFromKnockout: resolved.protectedFromKnockout,
                    traitProtected: resolved.traitProtected,
                    sources: [damageEvent.source],
                });
                if (damageEvent.leechSourceTokenId && resolved.appliedDamage > 0) {
                    leechHealing.push({
                        sourceTokenId: damageEvent.leechSourceTokenId,
                        sourceName: damageEvent.leechSourceName,
                        amount: resolved.appliedDamage,
                    });
                }
            });
        }
        const changed = {
            ...workingToken,
            status,
            currentHp,
            toxicCounter,
            volatileEffects,
            specialState,
        };
        return { ...changed, stats: calculateStagedStats(changed) };
    });

    leechHealing.forEach(drain => {
        const index = tokens.findIndex(token => token.id === drain.sourceTokenId && token.currentHp > 0);
        if (index < 0) return;
        const source = tokens[index];
        const currentHp = integerInRange(source.currentHp + drain.amount, 0, source.maxHp, source.currentHp);
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

    const badDreamSources = tokens.filter(token => token.currentHp > 0 && isAbilityActive(token) && traitSlug(token.ability) === "bad-dreams");
    badDreamSources.forEach(source => {
        tokens = tokens.map(target => {
            if (target.id === source.id || target.side === source.side || target.side === "neutral" || target.status !== "sleep" || target.currentHp <= 0) return target;
            if (isAbilityActive(target) && traitSlug(target.ability) === "magic-guard") return target;
            const resolved = resolveRoundDamage(target, residualAmount(target.maxHp, 1 / 8));
            const damage = resolved.appliedDamage;
            const changed = recordTraitEvent(resolved.token || target, {
                kind: "ability",
                sourceId: "bad-dreams",
                label: "Pesadelo causou dano",
                detail: `${source.name} manteve Bad Dreams em cena`,
                round: room.round,
            });
            effects.push({
                kind: "damage",
                tokenId: target.id,
                tokenName: target.name,
                damage,
                remainingHp: changed.currentHp,
                fainted: changed.currentHp <= 0,
                protectedFromKnockout: resolved.protectedFromKnockout,
                traitProtected: resolved.traitProtected,
                sources: [`Bad Dreams de ${source.name}`],
            });
            return changed;
        });
    });

    const healers = tokens.filter(token => token.currentHp > 0 && isAbilityActive(token) && traitSlug(token.ability) === "healer");
    healers.forEach(healer => {
        tokens = tokens.map(target => {
            if (target.id === healer.id || target.side !== healer.side || !target.status || target.currentHp <= 0 || !randomChance(3, 10, random)) return target;
            const previousStatus = target.status;
            const changed = recordTraitEvent({ ...target, status: "", toxicCounter: 0 }, {
                kind: "ability",
                sourceId: "healer",
                label: "Condição curada",
                detail: `${healer.name} curou ${previousStatus}`,
                round: room.round,
            });
            effects.push({ kind: "status", tokenId: target.id, tokenName: target.name, status: "", damage: 0, remainingHp: target.currentHp, fainted: false, sources: [`Healer de ${healer.name}`] });
            return changed;
        });
    });

    return {
        room: {
            ...room,
            tokens,
            hitKillProtectionUsed,
            hitKillProtectionDisabled,
            hitKillSurvivalGrace,
        },
        effects,
    };
};

export const buildInitiative = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    const results = room.tokens.filter(token => !token.hidden && token.currentHp > 0).map(token => {
        const traitState = getInitiativeTraitState(token, { weather: isWeatherSuppressed(room.tokens) ? "limpo" : room.weather, round: room.round });
        const test = rollAttributeTest({
            mode: "normal",
            attribute: applyDirectionalIntegerModifier(token.stats?.speed, traitState.multiplier, { minimum: 0, maximum: 99999 }),
            random,
        });
        return {
            tokenId: token.id,
            priority: token.priority || 0,
            total: test.total,
            dice: test.kept,
            tieBreak: null,
            traitState,
        };
    });
    const tiedResults = new Map();
    results.forEach(result => {
        const key = `${result.priority}:${result.total}`;
        const group = tiedResults.get(key) || [];
        group.push(result);
        tiedResults.set(key, group);
    });
    tiedResults.forEach(group => {
        if (group.length > 1) group.forEach(result => { result.tieBreak = rollD6(random); });
    });
    results.sort((first, second) =>
        second.priority - first.priority
        || second.total - first.total
        || (second.tieBreak || 0) - (first.tieBreak || 0)
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
    weather = "limpo",
    terrain = "nenhum",
    weatherSuppressed = false,
}) => {
    const effectiveWeather = weatherSuppressed ? "limpo" : weather;
    const profile = getMoveResolutionProfile(move);
    const statProfile = getMoveStatProfile({ move, attacker, defender });
    const attackKey = statProfile.attackKey;
    const defenseKey = statProfile.defenseKey;
    const attackerStagesIgnored = profile.requiresDamageContest && isAbilityActive(defender) && normalizeSlug(defender?.ability) === "unaware";
    const defenderStagesIgnored = profile.requiresDamageContest && isAbilityActive(attacker) && normalizeSlug(attacker?.ability) === "unaware";
    const contestAttribute = (token, key, ignoreStages) => {
        const current = integerInRange(token?.stats?.[key], 0, 99999, 0);
        if (!ignoreStages) return current;
        const original = finiteNumberOrNull(token?.originalStats?.[key]);
        if (original != null) return convertToTTRPG(original);
        return safeDivide(current, stageMultiplier(normalizeStageMap(token?.stages)[key]), current);
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
    const accuracyState = adjustMoveAccuracy({ move, attacker, defender, weather: effectiveWeather });
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
    const listedPower = finiteNumberOrNull(move?.power);
    const power = clampFinite(dynamicPower?.power ?? listedPower ?? 0, 0, MAX_SAFE_GAME_INTEGER, 0);
    const baseDamage = convertToTTRPG(power);
    const moveType = move?.type?.name || "";
    const baseStab = getMoveStab(attacker, moveType);
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
    const traitBlock = getTraitMoveBlock({ move, attacker, defender });
    const moveConnected = accuracyTest.success && !typeBlocked && !specialBlockReason && !abilityBlock && !traitBlock;
    const damageHit = profile.requiresDamageContest && contestSuccess && moveConnected;
    const hit = moveConnected;
    const criticalMultiplier = attackTest?.critical ? 1.5 : 1;
    const traitModifiers = getDamageTraitModifiers({
        attacker,
        defender,
        move,
        effectiveness,
        stab: baseStab,
        weather: effectiveWeather,
        terrain,
        critical: Boolean(attackTest?.critical),
    });
    const stab = traitModifiers.stab;
    const flashFireMultiplier = moveType === "fire" && normalizeSpecialState(attacker?.specialState).markers.includes("flash-fire-boost") ? 1.5 : 1;
    const directKnockout = isDirectKnockoutMove(move);
    const listedMinimumHits = integerInRange(move?.meta?.min_hits, 1, 20, 1);
    const listedMaximumHits = integerInRange(move?.meta?.max_hits, listedMinimumHits, 20, listedMinimumHits);
    const multiHitTraits = getMultiHitTraitState({ attacker, move, minimumHits: listedMinimumHits, maximumHits: listedMaximumHits });
    const minimumHits = multiHitTraits.minimumHits;
    const maximumHits = multiHitTraits.maximumHits;
    const hitCount = damageHit && maximumHits > 1
        ? minimumHits + randomInt(maximumHits - minimumHits + 1, random)
        : 1;
    const moveName = normalizeSlug(move?.name);
    const fixedDamage = (() => {
        if (!damageHit || !defender) return null;
        if (moveName === "dragon-rage") return Math.max(1, convertToTTRPG(40));
        if (moveName === "sonic-boom") return Math.max(1, convertToTTRPG(20));
        if (["night-shade", "seismic-toss"].includes(moveName)) return Math.max(1, convertToTTRPG(integerInRange(attacker?.level, 1, 200, 1)));
        if (moveName === "final-gambit") return integerInRange(attacker?.currentHp, 1, 99999, 1);
        if (moveName === "psywave") {
            const multiplier = 0.5 + randomUnit(random);
            return Math.max(1, convertToTTRPG(Math.max(1, Math.floor(integerInRange(attacker?.level, 1, 200, 1) * multiplier))));
        }
        if (["super-fang", "natures-madness", "ruination"].includes(moveName)) {
            return Math.max(1, Math.ceil(integerInRange(defender.currentHp, 1, 99999, 1) / 2));
        }
        if (moveName === "endeavor") {
            return Math.max(0, integerInRange(defender.currentHp, 0, 99999, 0) - integerInRange(attacker?.currentHp, 0, 99999, 0));
        }
        return null;
    })();
    const manualDamage = profile.requiresDamageContest
        && fixedDamage == null
        && !directKnockout
        && (power <= 0 || ["bide", "comeuppance", "counter", "metal-burst", "mirror-coat"].includes(moveName));
    const multipliedPower = finiteProduct([
        power,
        stab,
        effectiveness,
        criticalMultiplier,
        flashFireMultiplier,
        traitModifiers.multiplier,
    ], { minimum: 0, maximum: MAX_SAFE_GAME_INTEGER, fallback: 0 });
    const calculatedDamagePerHit = roundRpgScaledValue(safeDivide(multipliedPower, 20, 0), {
        minimumWhenPositive: multipliedPower > 0 ? 1 : 0,
        maximum: MAX_SAFE_GAME_INTEGER,
    });
    const rawDamagePerHit = damageHit && effectiveness > 0
        ? directKnockout
            ? integerInRange(defender?.currentHp, 1, 99999, 1)
            : fixedDamage != null
                ? fixedDamage
                : manualDamage
                    ? 0
                    : calculatedDamagePerHit
        : 0;
    const offensiveStage = attackerStagesIgnored ? 0 : normalizeStageMap(offensiveToken?.stages)[attackKey];
    const ceilingMultiplier = Math.max(1, stageMultiplier(offensiveStage));
    const baseCeiling = getDamageCeiling(attacker?.level);
    const ceiling = applyDirectionalIntegerModifier(baseCeiling, ceilingMultiplier, { minimum: baseCeiling, maximum: 99999 });
    const damagePerHit = attackTest?.critical || directKnockout || fixedDamage != null || manualDamage
        ? rawDamagePerHit
        : Math.min(rawDamagePerHit, ceiling);
    const damage = integerInRange(finiteProduct(
        [damagePerHit, hitCount],
        { minimum: 0, maximum: MAX_SAFE_GAME_INTEGER, fallback: 0 },
    ), 0, MAX_SAFE_GAME_INTEGER, 0);
    return {
        profile,
        weather: effectiveWeather,
        weatherSuppressed,
        terrain,
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
        baseStab,
        stab,
        criticalMultiplier,
        flashFireMultiplier,
        traitModifiers,
        multiHitTraits,
        effectiveness,
        typeBlocked,
        specialBlockReason,
        abilityBlock,
        traitBlock,
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
            ? payload.faintedOnHit
                ? ` A proteção contra hit kill agiria, mas outro hit derrotaria o alvo no ${integerInRange(payload.faintedOnHit, 1, 20, 1)}º impacto.`
                : ` A prévia calculou ${integerInRange(payload.calculatedDamage, 0, MAX_SAFE_GAME_INTEGER, 0)} de dano, e a proteção contra hit kill manteria o alvo em combate.`
            : "";
        return `${event.author} rolou ${payload.label || "um teste"}: ${payload.result ?? "—"}.${protection}`;
    }
    if (event?.type === "move-declared") {
        return `${event.author} escolheu ${payload.moveName ? formatName(payload.moveName) : "um movimento"}${payload.tokenName ? ` para ${payload.tokenName}` : ""}.`;
    }
    if (event?.type === "move") {
        const damage = integerInRange(payload.damage, 0, MAX_SAFE_GAME_INTEGER, 0);
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
            ? payload.faintedOnHit
                ? ` A proteção contra hit kill agiu no ${integerInRange(payload.hitKillProtectedHits?.[0], 1, 20, 1)}º hit, mas o alvo foi derrotado no ${integerInRange(payload.faintedOnHit, 1, 20, 1)}º.`
                : ` A proteção contra hit kill agiu no ${integerInRange(payload.hitKillProtectedHits?.[0], 1, 20, 1)}º hit e foi consumida nesta batalha.`
            : "";
        const fainted = payload.fainted ? " O alvo não pode mais batalhar." : "";
        const fumble = payload.fumble ? " O erro crítico pede uma consequência escolhida para esta cena." : "";
        const defenderFumble = payload.defenderFumble
            ? " O erro crítico do defensor permitiu que um dano fatal ignorasse a proteção contra Hit Kill."
            : "";
        const special = payload.specialNarrative ? ` ${payload.specialNarrative}` : "";
        return `${event.author}: ${payload.attackerName || "Pokémon"} ${moveDescription} e ${result}.${protection}${fainted}${fumble}${defenderFumble}${special}`;
    }
    if (event?.type === "message") return `${event.author}: ${asText(payload.text)}`;
    if (event?.type === "ready") return payload.ready
        ? `${event.author} confirmou presença.`
        : `${event.author} voltou a se preparar.`;
    if (event?.type === "team-offer") return `${event.author} enviou a equipe “${payload.team?.name || "sem nome"}”.`;
    if (event?.type === "sfx") return `Som da cena: ${payload.label || "efeito"}.`;
    return asText(payload.text) || `${event?.author || "MyOwnDex"} registrou uma ação.`;
};

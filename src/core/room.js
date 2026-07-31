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
    calculateStagedStats,
    getDefensiveTypes,
    getMoveStab,
    isDirectKnockoutMove,
    normalizePpSlots,
    normalizeSlug,
    normalizeStageMap,
} from "./automation.js";
import { getDamageCeiling, rollAttributeTest, rollPercentTest } from "./rpgRules.js";
import { compactTeam, createId, normalizeTeam, touchTeam } from "./team.js";

export const ROOM_SCHEMA_VERSION = 1;
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
    const types = asArray(source.types).filter(Boolean).slice(0, 2).map(type => normalizeSlug(type));
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
        side: ["ally", "opponent", "neutral"].includes(source.side) ? source.side : "ally",
        x: numberInRange(source.x, 4, 96, 50),
        y: numberInRange(source.y, 8, 92, 55),
        maxHp,
        currentHp: numberInRange(source.currentHp, 0, maxHp, maxHp),
        status: Object.prototype.hasOwnProperty.call(STATUS_LABELS, source.status) ? source.status : "",
        level: Math.round(numberInRange(source.level, 1, 200, 5)),
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
    }));
    return { room: normalizeRoomSnapshot({ ...room, tokens: [...room.tokens, ...tokens] }), tokens };
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
            const rpg = {
                ...partner.rpg,
                currentHp: token.currentHp,
                status: token.status,
                xp: token.xp,
                pp: token.pp,
            };
            if (
                Number(partner.level) === token.level
                && partner.rpg?.currentHp === token.currentHp
                && (partner.rpg?.status || "") === token.status
                && Number(partner.rpg?.xp || 0) === token.xp
                && JSON.stringify(partner.rpg?.pp || []) === JSON.stringify(token.pp || [])
            ) return partner;
            teamChanged = true;
            return { ...partner, level: token.level, rpg };
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
const SAND_IMMUNE_ABILITIES = new Set(["magic-guard", "overcoat", "sand-force", "sand-rush", "sand-veil"]);

export const applyEndOfRoundEffects = snapshot => {
    const room = normalizeRoomSnapshot(snapshot);
    const effects = [];
    const tokens = room.tokens.map(token => {
        if (token.currentHp <= 0) return token;
        let damage = 0;
        let toxicCounter = token.status === "bad-poison" ? Math.max(1, token.toxicCounter || 1) : 0;
        if (token.status === "burn") damage += residualAmount(token.maxHp, 1 / 16);
        if (token.status === "poison") damage += residualAmount(token.maxHp, 1 / 8);
        if (token.status === "bad-poison") {
            damage += residualAmount(token.maxHp, toxicCounter / 16);
            toxicCounter = Math.min(15, toxicCounter + 1);
        }
        const sandImmuneType = token.types.some(type => ["ground", "rock", "steel"].includes(type));
        if (room.weather === "areia" && !sandImmuneType && !SAND_IMMUNE_ABILITIES.has(token.ability)) {
            damage += residualAmount(token.maxHp, 1 / 16);
        }
        if (!damage) return { ...token, toxicCounter };
        const applied = Math.min(token.currentHp, damage);
        const currentHp = Math.max(0, token.currentHp - applied);
        effects.push({
            tokenId: token.id,
            tokenName: token.name,
            damage: applied,
            remainingHp: currentHp,
            fainted: currentHp <= 0,
            sources: [
                token.status === "burn" ? "queimadura" : "",
                token.status === "poison" ? "envenenamento" : "",
                token.status === "bad-poison" ? "envenenamento grave" : "",
                room.weather === "areia" && !sandImmuneType && !SAND_IMMUNE_ABILITIES.has(token.ability) ? "tempestade de areia" : "",
            ].filter(Boolean),
        });
        return { ...token, currentHp, toxicCounter };
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
}) => {
    const moveCategory = move?.damage_class?.name;
    const attackKey = moveCategory === "special" ? "special-attack" : "attack";
    const defenseKey = moveCategory === "special" ? "special-defense" : "defense";
    const attackTest = rollAttributeTest({
        mode,
        attribute: attacker?.stats?.[attackKey] || 0,
        random,
    });
    const defenseTest = rollAttributeTest({
        mode: "normal",
        attribute: defender?.stats?.[defenseKey] || 0,
        random,
    });
    const accuracy = move?.accuracy == null ? 100 : Number(move.accuracy);
    const power = Number(move?.power) || 0;
    const baseDamage = convertToTTRPG(power);
    const moveType = move?.type?.name || "";
    const stab = getMoveStab(attacker, moveType);
    const effectiveness = calculateDefenses(
        getDefensiveTypes(defender).map(type => ({ type: { name: type } }))
    )[moveType] ?? 1;
    const contestSuccess = attackTest.total > defenseTest.total;
    const accuracyTest = accuracy >= 100
        ? { automatic: true, rolls: [], result: null, chance: 100, success: true }
        : {
            automatic: false,
            ...rollPercentTest({
                chance: accuracy,
                advantage: contestSuccess && attackTest.total - defenseTest.total > 1,
                random,
            }),
        };
    const hit = contestSuccess && accuracyTest.success;
    const criticalMultiplier = attackTest.critical ? 1.5 : 1;
    const directKnockout = isDirectKnockoutMove(move);
    const minimumHits = Math.max(1, Number(move?.meta?.min_hits) || 1);
    const maximumHits = Math.max(minimumHits, Number(move?.meta?.max_hits) || minimumHits);
    const hitCount = hit && maximumHits > 1
        ? minimumHits + Math.floor((typeof random === "function" ? random() : Math.random()) * (maximumHits - minimumHits + 1))
        : 1;
    const rawDamagePerHit = hit && effectiveness > 0
        ? directKnockout
            ? Math.max(1, Number(defender?.currentHp) || 1)
            : Math.max(1, Math.round(baseDamage * stab * effectiveness * criticalMultiplier))
        : 0;
    const ceiling = getDamageCeiling(attacker?.level || 1);
    const damagePerHit = attackTest.critical || directKnockout
        ? rawDamagePerHit
        : Math.min(rawDamagePerHit, ceiling);
    const damage = damagePerHit * hitCount;
    return {
        attackKey,
        defenseKey,
        attackTest,
        defenseTest,
        accuracy,
        accuracyTest,
        power,
        baseDamage,
        stab,
        criticalMultiplier,
        effectiveness,
        hit,
        ceiling,
        rawDamagePerHit,
        damagePerHit,
        hitCount,
        directKnockout,
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
        const result = payload.hit ? `causou ${damage} de dano` : "não causou dano";
        const protection = payload.hitKillProtected
            ? ` O golpe causaria ${Number(payload.calculatedDamage) || damage}, mas a proteção contra hit kill manteve o alvo com 1 HP.`
            : "";
        const fainted = payload.fainted ? " O alvo não pode mais batalhar." : "";
        const fumble = payload.fumble ? " O erro crítico pede uma consequência escolhida para esta cena." : "";
        return `${event.author}: ${payload.attackerName || "Pokémon"} usou ${payload.moveName || "um movimento"} e ${result}.${protection}${fainted}${fumble}`;
    }
    if (event?.type === "message") return `${event.author}: ${asText(payload.text)}`;
    if (event?.type === "ready") return payload.ready
        ? `${event.author} confirmou presença.`
        : `${event.author} voltou a se preparar.`;
    if (event?.type === "team-offer") return `${event.author} enviou a equipe “${payload.team?.name || "sem nome"}”.`;
    if (event?.type === "sfx") return `Som da cena: ${payload.label || "efeito"}.`;
    return asText(payload.text) || `${event?.author || "MyOwnDex"} registrou uma ação.`;
};

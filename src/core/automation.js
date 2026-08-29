import { convertToTTRPG, formatName } from "./mechanics.js";
import {
    applyDirectionalIntegerModifier,
    clampFinite as clamp,
    finiteNumber as asNumber,
    finiteProduct,
    integerInRange,
    MAX_SAFE_GAME_INTEGER,
    quantizePositiveHpChange,
    roundRpgScaledValue,
    safeDivide,
} from "./math.js";
import { RPG_STATUS_LABELS } from "./copy.js";
import { rollPercentTest } from "./rpgRules.js";
import {
    copyObservedMove,
    getMoveSpecialProfile,
    normalizeSpecialState,
    recordBattleMove,
    revealBattleIllusion,
    transformBattleToken,
} from "./specialMechanics.js";
import {
    assignHeldItem,
    consumeHeldItem,
    getAccuracyTraitModifiers,
    getSurvivalTrait,
    getSurvivalTraitSources,
    isAbilityActive,
    isHeldItemActive,
    moveHasTrait,
    normalizeTraitState,
    recordTraitEvent,
    restoreHeldItem,
    setChoiceLock,
    traitSlug,
} from "./traitMechanics.js";

export const COMBAT_STAT_STAGE_KEYS = ["attack", "defense", "special-attack", "special-defense", "speed"];
export const ACCURACY_STAGE_KEYS = ["accuracy", "evasion"];
export const STAGE_STAT_KEYS = [...COMBAT_STAT_STAGE_KEYS, ...ACCURACY_STAGE_KEYS];
export const STAGE_LABELS = Object.freeze({
    attack: "Ataque",
    defense: "Defesa",
    "special-attack": "Atq. Esp.",
    "special-defense": "Def. Esp.",
    speed: "Velocidade",
    accuracy: "Precisão",
    evasion: "Evasão",
});

export const MOVE_STATUS_MAP = {
    burn: "burn",
    freeze: "freeze",
    paralysis: "paralysis",
    poison: "poison",
    sleep: "sleep",
};

const asArray = value => Array.isArray(value) ? value : [];
export const normalizeSlug = value => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

export const getHitKillProtectionKey = token => {
    const pokemonId = String(token?.pokemonId || "").trim();
    const teamId = String(token?.teamShareId || token?.teamId || "").trim();
    if (pokemonId && teamId) return `pokemon:${teamId}:${pokemonId}`.slice(0, 240);
    const tokenId = String(token?.id || "").trim();
    return tokenId ? `token:${tokenId}`.slice(0, 240) : "";
};

export const normalizeHitKillProtectionUsage = value => [...new Set(
    asArray(value)
        .map(entry => String(entry || "").trim().slice(0, 240))
        .filter(Boolean)
)].slice(0, 80);

const HIT_KILL_SURVIVAL_GRACE_SEPARATOR = "::survival-trait:";

const getHitKillSurvivalGracePrefix = token => {
    const protectionKey = getHitKillProtectionKey(token).slice(0, 180);
    return protectionKey ? `${protectionKey}${HIT_KILL_SURVIVAL_GRACE_SEPARATOR}` : "";
};

export const getHitKillSurvivalGraceKeys = token => {
    const prefix = getHitKillSurvivalGracePrefix(token);
    if (!prefix) return [];
    return getSurvivalTraitSources(token)
        .map(source => `${prefix}${source.kind}:${source.id}`.slice(0, 240));
};

export const hasHitKillSurvivalGrace = (value, token) => {
    const usage = new Set(normalizeHitKillProtectionUsage(value));
    return getHitKillSurvivalGraceKeys(token).some(key => usage.has(key));
};

export const clearHitKillSurvivalGrace = (value, token) => {
    const prefix = getHitKillSurvivalGracePrefix(token);
    const usage = normalizeHitKillProtectionUsage(value);
    return prefix ? usage.filter(entry => !entry.startsWith(prefix)) : usage;
};

export const hasHitKillProtectionDisabled = (value, token) => {
    const key = getHitKillProtectionKey(token);
    return Boolean(key && normalizeHitKillProtectionUsage(value).includes(key));
};

export const disableHitKillProtection = (value, token) => {
    const key = getHitKillProtectionKey(token);
    return key
        ? normalizeHitKillProtectionUsage([...normalizeHitKillProtectionUsage(value), key])
        : normalizeHitKillProtectionUsage(value);
};

export const normalizePpSlots = value => {
    const pp = asArray(value).slice(0, 4).map(entry => {
        if (entry === "" || entry == null) return null;
        return integerInRange(entry, 0, 99, 0);
    });
    while (pp.length < 4) pp.push(null);
    return pp;
};

export const normalizeStageMap = value => Object.fromEntries(
    STAGE_STAT_KEYS.map(stat => [stat, integerInRange(value?.[stat], -6, 6, 0)])
);

export const normalizeVolatileEffects = value => {
    const unique = new Map();
    asArray(value).forEach(entry => {
        const id = normalizeSlug(entry?.id || entry);
        if (!id) return;
        unique.set(id, {
            id,
            sourceMove: normalizeSlug(entry?.sourceMove),
            sourceTokenId: String(entry?.sourceTokenId || "").slice(0, 120),
            sourceName: String(entry?.sourceName || "").slice(0, 80),
            turns: entry?.turns == null ? null : integerInRange(entry.turns, 0, 99, 0),
            amount: entry?.amount == null ? null : integerInRange(entry.amount, 0, 99999, 0),
            critical: Boolean(entry?.critical),
            defenderFumble: Boolean(entry?.defenderFumble),
            directKnockout: Boolean(entry?.directKnockout),
        });
    });
    return [...unique.values()].slice(0, 16);
};

export const stageMultiplier = stage => {
    const normalized = integerInRange(stage, -6, 6, 0);
    return normalized >= 0 ? (2 + normalized) / 2 : 2 / (2 - normalized);
};

export const accuracyStageMultiplier = stage => {
    const normalized = integerInRange(stage, -6, 6, 0);
    return normalized >= 0 ? (3 + normalized) / 3 : 3 / (3 - normalized);
};

export const calculateStagedStats = token => {
    const stages = normalizeStageMap(token?.stages);
    const current = token?.stats && typeof token.stats === "object" ? token.stats : {};
    const original = token?.originalStats && typeof token.originalStats === "object"
        ? token.originalStats
        : {};
    const result = { ...current };
    COMBAT_STAT_STAGE_KEYS.forEach(stat => {
        const originalValue = asNumber(original[stat], Math.max(0, asNumber(current[stat])) * 20);
        const baseline = convertToTTRPG(originalValue);
        const stage = stages[stat];
        const rawScaled = safeDivide(finiteProduct(
            [Math.max(0, originalValue), stageMultiplier(stage)],
            { minimum: 0, maximum: 99999 * 20, fallback: 0 },
        ), 20, 0);
        let staged = roundRpgScaledValue(rawScaled, { maximum: 99999 });
        if (stage > 0 && staged <= baseline && baseline < 99999) staged = baseline + 1;
        if (stage < 0 && staged >= baseline && baseline > 0) staged = baseline - 1;
        result[stat] = integerInRange(staged, 0, 99999, baseline);
    });
    return result;
};

export const applyStageChange = (token, stat, change) => {
    if (!STAGE_STAT_KEYS.includes(stat) || !change) return token;
    const stages = normalizeStageMap(token?.stages);
    stages[stat] = integerInRange(stages[stat] + integerInRange(change, -12, 12, 0), -6, 6, stages[stat]);
    const next = { ...token, stages };
    return { ...next, stats: calculateStagedStats(next) };
};

export const getDefensiveTypes = token => {
    const teraType = normalizeSlug(token?.teraType);
    if (token?.teraActive && teraType) return [teraType];
    return asArray(token?.types).map(normalizeSlug).filter(Boolean);
};

export const getMoveStab = (token, moveType) => {
    const type = normalizeSlug(moveType);
    if (!type) return 1;
    const originalTypes = asArray(token?.originalTypes).length
        ? asArray(token.originalTypes).map(normalizeSlug)
        : asArray(token?.types).map(normalizeSlug);
    const teraType = normalizeSlug(token?.teraType);
    const originalMatch = originalTypes.includes(type);
    const teraMatch = Boolean(token?.teraActive && teraType === type);
    if (originalMatch && teraMatch) return 2;
    if (originalMatch || teraMatch) return 1.5;
    return 1;
};

export const getMovePpState = (token, move, moveName = move?.name) => {
    const normalizedName = normalizeSlug(moveName);
    const moves = asArray(token?.moves).map(normalizeSlug);
    const index = moves.indexOf(normalizedName);
    const pp = normalizePpSlots(token?.pp);
    const specialState = normalizeSpecialState(token?.specialState);
    const copiedWithFivePp = Boolean(
        specialState.transform
        || specialState.moveOverrides.some(override => override.slot === index && override.kind === "mimic")
    );
    const maximum = copiedWithFivePp
        ? 5
        : move?.pp == null
            ? null
            : clamp(asNumber(move.pp), 0, 99);
    const remaining = index < 0 ? null : (pp[index] ?? maximum);
    return { index, pp, maximum, remaining };
};

const TARGET_PROFILES = Object.freeze({
    user: { scope: "self", recipient: "user", label: "Usuário", requiresSelection: false, opponentDirected: false, affectsPokemon: true },
    "users-field": { scope: "field", recipient: "field", label: "Campo do usuário", requiresSelection: false, opponentDirected: false, affectsPokemon: false },
    "user-and-allies": { scope: "allies", recipient: "group", label: "Usuário e aliados", requiresSelection: false, opponentDirected: false, affectsPokemon: true },
    "all-allies": { scope: "allies", recipient: "group", label: "Todos os aliados", requiresSelection: false, opponentDirected: false, affectsPokemon: true },
    ally: { scope: "ally", recipient: "target", label: "Aliado escolhido", requiresSelection: true, opponentDirected: false, affectsPokemon: true },
    "user-or-ally": { scope: "ally-or-self", recipient: "target", label: "Usuário ou aliado", requiresSelection: true, opponentDirected: false, affectsPokemon: true },
    "all-opponents": { scope: "opponents", recipient: "group", label: "Todos os oponentes", requiresSelection: false, opponentDirected: true, affectsPokemon: true },
    "opponents-field": { scope: "field", recipient: "field", label: "Campo oponente", requiresSelection: false, opponentDirected: true, affectsPokemon: false },
    "random-opponent": { scope: "opponent", recipient: "target", label: "Oponente sorteado", requiresSelection: true, opponentDirected: true, affectsPokemon: true },
    "all-other-pokemon": { scope: "all-other", recipient: "group", label: "Todos, exceto o usuário", requiresSelection: false, opponentDirected: true, affectsPokemon: true },
    "all-pokemon": { scope: "all", recipient: "group", label: "Todos em cena", requiresSelection: false, opponentDirected: false, affectsPokemon: true },
    "entire-field": { scope: "field", recipient: "field", label: "Campo inteiro", requiresSelection: false, opponentDirected: false, affectsPokemon: false },
    "specific-move": { scope: "opponent", recipient: "target", label: "Alvo do movimento", requiresSelection: true, opponentDirected: true, affectsPokemon: true },
    "selected-pokemon-me-first": { scope: "opponent", recipient: "target", label: "Oponente escolhido", requiresSelection: true, opponentDirected: true, affectsPokemon: true },
    "selected-pokemon": { scope: "opponent", recipient: "target", label: "Pokémon escolhido", requiresSelection: true, opponentDirected: true, affectsPokemon: true },
});

const DEFAULT_TARGET_PROFILE = TARGET_PROFILES["selected-pokemon"];

export const getMoveTargetProfile = move => {
    const name = normalizeSlug(move?.target?.name);
    return { name: name || "selected-pokemon", ...(TARGET_PROFILES[name] || DEFAULT_TARGET_PROFILE) };
};

const sameSide = (first, second) => Boolean(first && second && first.side === second.side);
const opposingSide = (first, second) => Boolean(
    first
    && second
    && first.id !== second.id
    && first.side !== "neutral"
    && second.side !== "neutral"
    && first.side !== second.side
);

export const getSelectableMoveTargets = (tokens, attacker, move) => {
    const source = asArray(tokens).filter(token => token?.currentHp > 0);
    const profile = getMoveTargetProfile(move);
    if (!attacker || !profile.requiresSelection) return [];
    if (profile.scope === "ally") return source.filter(token => token.id !== attacker.id && sameSide(token, attacker));
    if (profile.scope === "ally-or-self") return source.filter(token => sameSide(token, attacker));
    const opponents = source.filter(token => opposingSide(token, attacker));
    return opponents.length ? opponents : source.filter(token => token.id !== attacker.id);
};

export const getAffectedMoveTargets = (tokens, attacker, selectedTarget, move) => {
    const source = asArray(tokens).filter(token => token?.currentHp > 0);
    const profile = getMoveTargetProfile(move);
    if (!attacker) return [];
    if (profile.scope === "self") return [attacker];
    if (profile.scope === "ally" || profile.scope === "ally-or-self" || profile.scope === "opponent") {
        return selectedTarget ? [selectedTarget] : [];
    }
    if (profile.scope === "allies") return source.filter(token => sameSide(token, attacker));
    if (profile.scope === "opponents") {
        const opponents = source.filter(token => opposingSide(token, attacker));
        return opponents.length ? opponents : source.filter(token => token.id !== attacker.id);
    }
    if (profile.scope === "all-other") return source.filter(token => token.id !== attacker.id);
    if (profile.scope === "all") return source;
    return [];
};

export const getMoveResolutionProfile = move => {
    const target = getMoveTargetProfile(move);
    const damageClass = normalizeSlug(move?.damage_class?.name);
    const damaging = damageClass === "physical" || damageClass === "special";
    const accuracy = move?.accuracy;
    const requiresDamageContest = damaging && target.affectsPokemon;
    const requiresAccuracyCheck = Boolean(target.opponentDirected && accuracy !== null && accuracy !== undefined && accuracy !== true);
    const resolutionKind = requiresDamageContest
        ? "attack"
        : requiresAccuracyCheck
            ? "target-effect"
            : "declaration";
    return {
        target,
        damageClass,
        damaging,
        effectOnly: !damaging,
        requiresDamageContest,
        requiresAccuracyCheck,
        resolutionKind,
        resolutionLabel: resolutionKind === "attack"
            ? "Ataque contra defesa"
            : resolutionKind === "target-effect"
                ? "Efeito por precisão"
                : "Efeito por declaração",
    };
};

export const adjustMoveAccuracy = ({ move, attacker, defender, weather = "limpo" } = {}) => {
    const profile = getMoveResolutionProfile(move);
    const baseAccuracy = move?.accuracy === true || move?.accuracy == null
        ? null
        : clamp(asNumber(move.accuracy, 100), 0, 100);
    const noGuard = [attacker?.ability, defender?.ability].map(normalizeSlug).includes("no-guard");
    if (!profile.requiresAccuracyCheck || baseAccuracy == null || noGuard) {
        return {
            automatic: true,
            baseAccuracy,
            adjustedAccuracy: 100,
            accuracyStage: 0,
            evasionStage: 0,
            combinedStage: 0,
            multiplier: 1,
            traitModifiers: { multiplier: 1, entries: [] },
            noGuard,
        };
    }
    const attackerStages = normalizeStageMap(attacker?.stages);
    const defenderStages = normalizeStageMap(defender?.stages);
    const accuracyStage = attackerStages.accuracy;
    const evasionStage = defenderStages.evasion;
    const combinedStage = clamp(accuracyStage - evasionStage, -6, 6);
    const traitModifiers = getAccuracyTraitModifiers({ attacker, defender, move, weather });
    const multiplier = accuracyStageMultiplier(combinedStage) * traitModifiers.multiplier;
    return {
        automatic: false,
        baseAccuracy,
        adjustedAccuracy: applyDirectionalIntegerModifier(baseAccuracy, multiplier, { minimum: 0, maximum: 100 }),
        accuracyStage,
        evasionStage,
        combinedStage,
        multiplier,
        traitModifiers,
        noGuard: false,
    };
};

const statusForMove = move => {
    if (normalizeSlug(move?.name) === "yawn") return "";
    const ailment = normalizeSlug(move?.meta?.ailment?.name);
    if (!ailment || ailment === "none") return "";
    if (normalizeSlug(move?.name) === "toxic") return "bad-poison";
    return MOVE_STATUS_MAP[ailment] || "";
};

const chanceResult = (chance, random, advantage = false) => {
    const normalized = clamp(asNumber(chance), 0, 100);
    if (normalized >= 100) {
        return { automatic: true, rolls: [], result: null, chance: 100, success: true };
    }
    if (normalized <= 0) {
        return { automatic: true, rolls: [], result: null, chance: 0, success: false };
    }
    return { automatic: false, ...rollPercentTest({ chance: normalized, advantage, random }) };
};

const moveEffectChance = (move, field, statusMoveDefault = false) => {
    const direct = asNumber(move?.meta?.[field]);
    if (direct > 0) return clamp(direct, 0, 100);
    const effect = asNumber(move?.effect_chance);
    if (effect > 0) return clamp(effect, 0, 100);
    return statusMoveDefault ? 100 : 0;
};

const hpAmount = value => quantizePositiveHpChange(value, 99999);

const DIRECT_KNOCKOUT_MOVES = new Set(["fissure", "guillotine", "horn-drill", "sheer-cold"]);

export const isDirectKnockoutMove = move => {
    const name = normalizeSlug(move?.name);
    const category = normalizeSlug(move?.meta?.category?.name);
    return DIRECT_KNOCKOUT_MOVES.has(name) || category === "ohko" || category === "one-hit-ko";
};

const SELF_STAGE_CHANGE_MOVES = new Set([
    "armor-cannon", "clangorous-soul", "close-combat", "draco-meteor", "fleur-cannon",
    "hammer-arm", "headlong-rush", "ice-hammer", "leaf-storm", "make-it-rain", "no-retreat",
    "overheat", "psycho-boost", "shell-smash", "spin-out", "superpower", "v-create",
]);

const PROTECTING_MOVES = new Set([
    "baneful-bunker", "burning-bulwark", "detect", "endure", "kings-shield",
    "max-guard", "obstruct", "protect", "silk-trap", "spiky-shield",
]);

const SELF_SACRIFICE_MOVES = new Set([
    "explosion", "final-gambit", "healing-wish", "lunar-dance", "memento",
    "misty-explosion", "self-destruct",
]);

const SELF_HP_COST_MOVES = Object.freeze({
    "belly-drum": 1 / 2,
    "clangorous-soul": 1 / 3,
    "fillet-away": 1 / 2,
    "shed-tail": 1 / 2,
});

const MISS_CRASH_MOVES = new Set(["high-jump-kick", "jump-kick"]);

const stageChangesTargetUser = move => {
    const profile = getMoveTargetProfile(move);
    const category = normalizeSlug(move?.meta?.category?.name);
    const name = normalizeSlug(move?.name);
    return profile.recipient === "user"
        || category === "damage+raise"
        || SELF_STAGE_CHANGE_MOVES.has(name);
};

const WEATHER_MOVES = Object.freeze({
    "rain-dance": "chuva",
    "sunny-day": "sol",
    sandstorm: "areia",
    hail: "neve",
    snowscape: "neve",
    "chilly-reception": "neve",
});

const TERRAIN_MOVES = Object.freeze({
    "electric-terrain": "eletrico",
    "grassy-terrain": "gramado",
    "misty-terrain": "nevoa",
    "psychic-terrain": "psiquico",
});

export const getMoveFieldChange = move => {
    const name = normalizeSlug(move?.name);
    const weather = WEATHER_MOVES[name] || "";
    const terrain = TERRAIN_MOVES[name] || "";
    return weather || terrain ? { weather, terrain } : null;
};

const STATUS_IMMUNE_ABILITIES = Object.freeze({
    burn: new Set(["water-veil", "water-bubble"]),
    freeze: new Set(["magma-armor"]),
    paralysis: new Set(["limber"]),
    poison: new Set(["immunity"]),
    "bad-poison": new Set(["immunity"]),
    sleep: new Set(["insomnia", "vital-spirit", "sweet-veil"]),
});

const STATUS_CURE_BERRIES = Object.freeze({
    "aspear-berry": "freeze",
    "cheri-berry": "paralysis",
    "chesto-berry": "sleep",
    "pecha-berry": "poison",
    "rawst-berry": "burn",
});

const PINCH_HEAL_BERRIES = new Set(["aguav-berry", "figy-berry", "iapapa-berry", "mago-berry", "wiki-berry"]);
const PINCH_STAGE_BERRIES = Object.freeze({
    "apicot-berry": "special-defense",
    "ganlon-berry": "defense",
    "liechi-berry": "attack",
    "petaya-berry": "special-attack",
    "salac-berry": "speed",
});

export const getStatusBlockReason = (status, target, attacker, { terrain = "nenhum" } = {}) => {
    if (!status || !target) return "";
    const types = getDefensiveTypes(target);
    const ability = isAbilityActive(target) ? normalizeSlug(target.ability) : "";
    const sourceAbility = isAbilityActive(attacker) ? normalizeSlug(attacker?.ability) : "";
    const grounded = !types.includes("flying")
        && !(isAbilityActive(target) && ability === "levitate")
        && !(isHeldItemActive(target) && normalizeSlug(target.item) === "air-balloon");
    if (grounded && terrain === "eletrico" && status === "sleep") return "o Terreno Elétrico impede o sono";
    if (grounded && terrain === "nevoa" && status) return "o Terreno de Névoa impede condições principais";
    if (ability === "comatose" || ability === "purifying-salt") return `a habilidade ${formatName(ability)} impede a condição`;
    if (STATUS_IMMUNE_ABILITIES[status]?.has(ability)) return `a habilidade ${formatName(ability)} impede a condição`;
    if (status === "burn" && types.includes("fire")) return "Pokémon de Fogo não podem ser queimados";
    if (status === "freeze" && types.includes("ice")) return "Pokémon de Gelo não podem ser congelados";
    if (status === "paralysis" && types.includes("electric")) return "Pokémon Elétricos não podem ser paralisados";
    if (["poison", "bad-poison"].includes(status)
        && sourceAbility !== "corrosion"
        && types.some(type => type === "poison" || type === "steel")) {
        return "a tipagem impede o envenenamento";
    }
    return "";
};

export const applyHitKillProtection = ({
    damage,
    currentHp,
    maxHp = currentHp,
    protectionUsed = false,
    critical = false,
    defenderFumble = false,
    directKnockout = false,
} = {}) => {
    const fallbackHp = integerInRange(currentHp, 0, 99999, 0);
    const maximumHp = integerInRange(maxHp, 1, 99999, Math.max(1, fallbackHp));
    const hpBefore = integerInRange(currentHp, 0, maximumHp, Math.min(fallbackHp, maximumHp));
    const calculatedDamage = integerInRange(damage, 0, MAX_SAFE_GAME_INTEGER, 0);
    const threshold = maximumHp * 3;
    const wouldKnockOut = hpBefore > 0 && calculatedDamage >= hpBefore;
    const atMaximumHp = hpBefore === maximumHp;
    const bypassed = Boolean(critical || defenderFumble || directKnockout);
    const protectedFromKnockout = wouldKnockOut
        && atMaximumHp
        && !protectionUsed
        && !bypassed
        && calculatedDamage < threshold;
    const appliedDamage = protectedFromKnockout
        ? Math.max(0, hpBefore - 1)
        : Math.min(calculatedDamage, hpBefore);
    return {
        hpBefore,
        maximumHp,
        calculatedDamage,
        appliedDamage,
        threshold,
        wouldKnockOut,
        atMaximumHp,
        protectionUsed: Boolean(protectionUsed),
        protectionConsumed: protectedFromKnockout,
        protectedFromKnockout,
        bypassed,
        attackerCritical: Boolean(critical),
        defenderFumble: Boolean(defenderFumble),
        directKnockout: Boolean(directKnockout),
        remainingHp: Math.max(0, hpBefore - appliedDamage),
    };
};

export const resolveKnockoutProtection = ({
    token,
    damage,
    hitCount = 1,
    round = 0,
    protectionUsed = false,
    survivalGrace = false,
    allowSurvivalTrait = true,
    critical = false,
    defenderFumble = false,
    directKnockout = false,
} = {}) => {
    const base = applyHitKillProtection({
        damage,
        currentHp: token?.currentHp,
        maxHp: token?.maxHp,
        protectionUsed,
        critical,
        defenderFumble,
        directKnockout,
    });
    const survivalSources = getSurvivalTraitSources(token);
    if (base.protectedFromKnockout) {
        return {
            ...base,
            token,
            traitProtected: false,
            traitSourceId: "",
            survivalGraceGranted: survivalSources.length > 0,
            survivalGraceUsed: false,
        };
    }
    const survival = token && base.calculatedDamage > 0 && allowSurvivalTrait
        ? getSurvivalTrait(token, {
            damage: base.calculatedDamage,
            hitCount,
            round,
            fullHpEligibilityPreserved: survivalGrace,
        })
        : { applied: false, token };
    if (!survival.applied) {
        return {
            ...base,
            token,
            traitProtected: false,
            traitSourceId: "",
            survivalGraceGranted: false,
            survivalGraceUsed: false,
        };
    }
    return {
        ...base,
        token: survival.token,
        appliedDamage: survival.appliedDamage,
        remainingHp: Math.max(0, base.hpBefore - survival.appliedDamage),
        protectedFromKnockout: false,
        protectionConsumed: false,
        traitProtected: true,
        traitSourceId: survival.sourceId,
        traitSourceKind: survival.sourceKind,
        traitNarrative: survival.narrative,
        itemConsumed: survival.itemConsumed || "",
        survivalGraceGranted: false,
        survivalGraceUsed: Boolean(survivalGrace),
    };
};

export const buildHitDamageSequence = ({ damage, damagePerHit, hitCount = 1 } = {}) => {
    const count = integerInRange(hitCount, 1, 20, 1);
    const total = integerInRange(damage, 0, MAX_SAFE_GAME_INTEGER, 0);
    const explicitPerHit = damagePerHit == null
        ? null
        : integerInRange(damagePerHit, 0, MAX_SAFE_GAME_INTEGER, 0);
    if (count === 1) return [total];
    if (explicitPerHit != null) {
        return Array.from({ length: count }, () => explicitPerHit);
    }
    const base = Math.floor(total / count);
    let remainder = Math.max(0, total - base * count);
    return Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0));
};

export const resolveDamageSequence = ({
    token,
    damage,
    damagePerHit,
    hitCount = 1,
    hitDamages,
    round = 0,
    protectionUsed = false,
    protectionDisabled = false,
    survivalGrace = false,
    allowHitKillProtection = true,
    allowSurvivalTrait = true,
    critical = false,
    defenderFumble = false,
    directKnockout = false,
} = {}) => {
    const sequence = Array.isArray(hitDamages)
        ? hitDamages.slice(0, 20).map((entry, index) => ({
            damage: integerInRange(entry?.damage ?? entry, 0, MAX_SAFE_GAME_INTEGER, 0),
            hitNumber: integerInRange(entry?.hitNumber, 1, 20, index + 1),
        }))
        : buildHitDamageSequence({ damage, damagePerHit, hitCount })
            .map((hitDamage, index) => ({ damage: hitDamage, hitNumber: index + 1 }));
    const rolledDamage = sequence.reduce((sum, entry) => sum + entry.damage, 0);
    const hpBefore = Math.max(0, asNumber(token?.currentHp));
    let workingToken = token;
    let workingProtectionUsed = Boolean(protectionUsed);
    let workingSurvivalGrace = Boolean(survivalGrace);
    const hits = [];

    for (const entry of sequence) {
        if (!workingToken || asNumber(workingToken.currentHp) <= 0) break;
        const graceBeforeHit = workingSurvivalGrace;
        const result = resolveKnockoutProtection({
            token: workingToken,
            damage: entry.damage,
            hitCount: 1,
            round,
            protectionUsed: workingProtectionUsed || protectionDisabled || !allowHitKillProtection,
            survivalGrace: workingSurvivalGrace,
            allowSurvivalTrait,
            critical,
            defenderFumble,
            directKnockout,
        });
        workingToken = {
            ...(result.token || workingToken),
            currentHp: integerInRange(result.remainingHp, 0, integerInRange(workingToken.maxHp, 1, 99999, 1), 0),
        };
        if (result.protectionConsumed) workingProtectionUsed = true;
        if (entry.damage > 0) {
            workingSurvivalGrace = result.protectedFromKnockout
                ? Boolean(result.survivalGraceGranted)
                : false;
        }
        hits.push({
            ...result,
            hitNumber: entry.hitNumber,
            token: workingToken,
            survivalGraceExpired: Boolean(
                entry.damage > 0
                && graceBeforeHit
                && !result.protectedFromKnockout
            ),
        });
    }

    const last = hits[hits.length - 1] || resolveKnockoutProtection({ token, damage: 0 });
    const calculatedDamage = hits.reduce((sum, entry) => sum + entry.calculatedDamage, 0);
    const appliedDamage = hits.reduce((sum, entry) => sum + entry.appliedDamage, 0);
    const protectedHits = hits.filter(entry => entry.protectedFromKnockout).map(entry => entry.hitNumber);
    const traitProtectedHits = hits.filter(entry => entry.traitProtected).map(entry => entry.hitNumber);
    const lastTraitHit = [...hits].reverse().find(entry => entry.traitProtected);
    const faintedHit = hits.find(entry => entry.remainingHp <= 0)?.hitNumber || null;
    return {
        ...last,
        token: workingToken,
        hpBefore,
        calculatedDamage,
        rolledDamage,
        appliedDamage,
        remainingHp: integerInRange(workingToken?.currentHp, 0, 99999, 0),
        protectedFromKnockout: protectedHits.length > 0,
        protectionConsumed: protectedHits.length > 0,
        protectionUsed: workingProtectionUsed,
        protectionDisabled: Boolean(protectionDisabled),
        traitProtected: traitProtectedHits.length > 0,
        traitSourceId: lastTraitHit?.traitSourceId || "",
        traitSourceKind: lastTraitHit?.traitSourceKind || "",
        traitNarrative: lastTraitHit?.traitNarrative || "",
        itemConsumed: lastTraitHit?.itemConsumed || "",
        survivalGraceGranted: hits.some(entry => entry.survivalGraceGranted),
        survivalGraceUsed: hits.some(entry => entry.survivalGraceUsed || entry.survivalGraceExpired),
        survivalGraceRemaining: workingSurvivalGrace,
        bypassed: hits.some(entry => entry.bypassed && entry.wouldKnockOut),
        wouldKnockOut: hits.some(entry => entry.wouldKnockOut),
        attackerCritical: Boolean(critical),
        defenderFumble: Boolean(defenderFumble),
        directKnockout: Boolean(directKnockout),
        hits,
        protectedHits,
        traitProtectedHits,
        faintedOnHit: faintedHit,
        resolvedHitCount: hits.length,
        plannedHitCount: sequence.length,
    };
};

export const getMoveAutomationTags = move => {
    if (!move) return [];
    const profile = getMoveResolutionProfile(move);
    const tags = ["PP", profile.resolutionLabel, profile.target.label];
    if (profile.requiresDamageContest) tags.push("Dano");
    if (!profile.requiresAccuracyCheck) tags.push("Sem teste de precisão");
    if (move.priority) tags.push(`Prioridade ${move.priority > 0 ? "+" : ""}${move.priority}`);
    const status = statusForMove(move);
    if (status) tags.push(RPG_STATUS_LABELS[status] || formatName(status));
    if (normalizeSlug(move.name) === "yawn") tags.push("Sono no turno seguinte");
    if (asNumber(move?.meta?.drain) > 0) tags.push("Drenagem");
    if (asNumber(move?.meta?.drain) < 0) tags.push("Recuo");
    if (asNumber(move?.meta?.healing) > 0) tags.push("Cura");
    if (asArray(move?.stat_changes).some(entry => STAGE_STAT_KEYS.includes(entry?.stat?.name))) {
        tags.push("Modificadores");
    }
    const special = getMoveSpecialProfile(move);
    if (special) tags.push(special.automation === "automatic" ? "O MyOwnDex resolve a regra especial" : "A regra especial pede uma escolha");
    return [...new Set(tags)];
};

export const applyMoveConsequences = ({
    tokens,
    attackerId,
    defenderId,
    targetId = defenderId,
    move,
    ppMove = move,
    resolution,
    random,
    consumePp = true,
    applySelfChanges = true,
    clearDeclaration = true,
    round = 0,
    hitKillProtectionUsed = [],
    hitKillProtectionDisabled = [],
    hitKillSurvivalGrace = [],
}) => {
    const source = asArray(tokens);
    const protectionUsage = normalizeHitKillProtectionUsage(hitKillProtectionUsed);
    let nextHitKillProtectionDisabled = normalizeHitKillProtectionUsage(hitKillProtectionDisabled);
    let nextHitKillSurvivalGrace = normalizeHitKillProtectionUsage(hitKillSurvivalGrace);
    const protectionDisabledThisAction = [];
    const originalAttacker = source.find(token => token.id === attackerId);
    const originalTarget = targetId ? source.find(token => token.id === targetId) : null;
    if (!originalAttacker || !move || !resolution) {
        return {
            tokens: source,
            hitKillProtectionUsed: protectionUsage,
            hitKillProtectionDisabled: nextHitKillProtectionDisabled,
            hitKillSurvivalGrace: nextHitKillSurvivalGrace,
            consequences: { applied: false },
        };
    }

    let attacker = {
        ...originalAttacker,
        pp: normalizePpSlots(originalAttacker.pp),
        stages: normalizeStageMap(originalAttacker.stages),
        volatileEffects: normalizeVolatileEffects(originalAttacker.volatileEffects),
        traitState: normalizeTraitState(originalAttacker.traitState, originalAttacker.item, originalAttacker.ability),
    };
    let target = originalTarget?.id === attacker.id
        ? attacker
        : originalTarget
            ? {
                ...originalTarget,
                stages: normalizeStageMap(originalTarget.stages),
                volatileEffects: normalizeVolatileEffects(originalTarget.volatileEffects),
                traitState: normalizeTraitState(originalTarget.traitState, originalTarget.item, originalTarget.ability),
            }
            : null;

    const replaceEntity = (id, value) => {
        if (!id || !value) return;
        if (id === attacker.id) {
            attacker = value;
            if (target?.id === id) target = value;
        } else if (target?.id === id) {
            target = value;
        }
    };

    const clearSurvivalGraceAfterDamage = (entity, amount) => {
        if (!entity || asNumber(amount) <= 0) return;
        nextHitKillSurvivalGrace = clearHitKillSurvivalGrace(nextHitKillSurvivalGrace, entity);
    };

    const disableProtectionAfterSelfDamage = (entity, amount) => {
        if (!entity || asNumber(amount) <= 0) return;
        const key = getHitKillProtectionKey(entity);
        if (key && !nextHitKillProtectionDisabled.includes(key)) {
            protectionDisabledThisAction.push({ tokenId: entity.id, tokenName: entity.name, key });
        }
        nextHitKillProtectionDisabled = disableHitKillProtection(nextHitKillProtectionDisabled, entity);
        clearSurvivalGraceAfterDamage(entity, amount);
    };

    const ppState = getMovePpState(attacker, ppMove, ppMove?.name);
    let ppBefore = ppState.remaining;
    let ppAfter = ppState.remaining;
    if (consumePp && !resolution.traitBlock?.attackerBlocked && ppState.index >= 0 && ppState.remaining != null) {
        ppAfter = Math.max(0, ppState.remaining - 1);
        attacker.pp[ppState.index] = ppAfter;
    }

    const moveName = normalizeSlug(move?.name);
    const moveConnected = Boolean(resolution.moveConnected ?? resolution.hit);
    const delayedDamage = ["future-sight", "doom-desire"].includes(moveName) && moveConnected;
    const damageHit = Boolean(resolution.damageHit ?? resolution.hit) && !delayedDamage;
    const targetSecondariesBlocked = Boolean(
        resolution.profile?.damaging
        && (resolution.traitModifiers?.suppressTargetSecondaries || resolution.traitModifiers?.blockTargetSecondaries)
    );
    const effectAdvantage = Boolean(
        resolution.attackTest
        && resolution.defenseTest
        && resolution.attackTest.total - resolution.defenseTest.total > 1
    );
    const resolvedDamage = damageHit
        ? integerInRange(resolution.damage, 0, MAX_SAFE_GAME_INTEGER, 0)
        : 0;
    const plannedHitDamages = damageHit
        ? buildHitDamageSequence({
            damage: resolvedDamage,
            damagePerHit: resolution.damagePerHit,
            hitCount: resolution.hitCount,
        })
        : [];
    const substitute = target
        ? normalizeVolatileEffects(target.volatileEffects).find(effect => effect.id === "substitute")
        : null;
    let substituteRemaining = integerInRange(substitute?.amount, 0, 99999, 0);
    let substituteDamage = 0;
    let substituteBroken = false;
    const targetHitDamages = [];
    plannedHitDamages.forEach((hitDamage, index) => {
        if (substituteRemaining > 0 && hitDamage > 0) {
            const applied = Math.min(substituteRemaining, hitDamage);
            substituteDamage += applied;
            substituteRemaining = Math.max(0, substituteRemaining - hitDamage);
            if (substituteRemaining <= 0) substituteBroken = true;
            return;
        }
        if (hitDamage > 0) targetHitDamages.push({ damage: hitDamage, hitNumber: index + 1 });
    });
    const substituteAbsorbed = substituteDamage > 0;
    const substituteBlockedTarget = substituteAbsorbed && targetHitDamages.length === 0;
    if (target && substituteAbsorbed) {
        const effects = normalizeVolatileEffects(target.volatileEffects)
            .flatMap(effect => effect.id !== "substitute"
                ? [effect]
                : substituteRemaining > 0
                    ? [{ ...effect, amount: substituteRemaining }]
                    : []);
        replaceEntity(target.id, { ...target, volatileEffects: effects });
    }
    const traitNarratives = [];
    const traitActivations = [];
    const consumedItems = [];
    const traitStatuses = [];
    const hitKillProtectionKey = getHitKillProtectionKey(target);
    const survivalGraceAvailable = target
        ? hasHitKillSurvivalGrace(nextHitKillSurvivalGrace, target)
        : false;
    const hitKill = target
        ? resolveDamageSequence({
            token: target,
            hitDamages: targetHitDamages,
            round,
            protectionUsed: hitKillProtectionKey
                ? protectionUsage.includes(hitKillProtectionKey)
                : false,
            protectionDisabled: hitKillProtectionKey
                ? nextHitKillProtectionDisabled.includes(hitKillProtectionKey)
                : false,
            survivalGrace: survivalGraceAvailable,
            critical: Boolean(resolution.attackTest?.critical),
            defenderFumble: Boolean(resolution.defenseTest?.fumble),
            directKnockout: Boolean(resolution.directKnockout || isDirectKnockoutMove(move)),
        })
        : resolveDamageSequence({ hitDamages: [] });
    if (target) {
        hitKill.hits.filter(entry => entry.traitProtected).forEach(entry => {
            if (entry.traitNarrative) traitNarratives.push(entry.traitNarrative);
            traitActivations.push({ kind: entry.traitSourceKind, sourceId: entry.traitSourceId, effect: "survival", hitNumber: entry.hitNumber });
            if (entry.itemConsumed) consumedItems.push(entry.itemConsumed);
        });
        target = hitKill.token || target;
        replaceEntity(target.id, target);
    }
    const damage = damageHit ? hitKill.appliedDamage : 0;
    let nextHitKillProtectionUsed = hitKill.protectedFromKnockout && hitKillProtectionKey
        ? normalizeHitKillProtectionUsage([...protectionUsage, hitKillProtectionKey])
        : protectionUsage;
    if (target && hitKill.survivalGraceRemaining) {
        nextHitKillSurvivalGrace = normalizeHitKillProtectionUsage([
            ...clearHitKillSurvivalGrace(nextHitKillSurvivalGrace, target),
            ...getHitKillSurvivalGraceKeys(target),
        ]);
    } else if (target && hitKill.calculatedDamage > 0) {
        nextHitKillSurvivalGrace = clearHitKillSurvivalGrace(nextHitKillSurvivalGrace, target);
    }

    let healed = 0;
    let recoil = 0;
    const drain = asNumber(move?.meta?.drain);
    if (damageHit && damage > 0 && drain > 0) {
        const before = asNumber(attacker.currentHp);
        const requested = hpAmount(damage * drain / 100);
        attacker.currentHp = clamp(before + requested, 0, Math.max(1, asNumber(attacker.maxHp, 1)));
        healed = Math.max(0, attacker.currentHp - before);
    } else if (damageHit && damage > 0 && drain < 0) {
        const before = asNumber(attacker.currentHp);
        const requested = hpAmount(damage * Math.abs(drain) / 100);
        attacker.currentHp = clamp(before - requested, 0, Math.max(1, asNumber(attacker.maxHp, 1)));
        recoil = Math.max(0, before - attacker.currentHp);
        disableProtectionAfterSelfDamage(attacker, recoil);
    }

    const healing = asNumber(move?.meta?.healing);
    if (moveConnected && healing > 0 && moveName !== "wish") {
        const healingTarget = target || attacker;
        const before = asNumber(healingTarget.currentHp);
        const directHealing = hpAmount(asNumber(healingTarget.maxHp, 1) * healing / 100);
        const nextHealingTarget = {
            ...healingTarget,
            currentHp: clamp(before + directHealing, 0, Math.max(1, asNumber(healingTarget.maxHp, 1))),
        };
        healed += Math.max(0, nextHealingTarget.currentHp - before);
        replaceEntity(healingTarget.id, nextHealingTarget);
    }

    let appliedStatus = "";
    let blockedStatus = "";
    let statusTargetId = "";
    let statusRoll = null;
    const status = statusForMove(move);
    const statusTarget = target || attacker;
    if (moveConnected && status && statusTarget && (!substituteBlockedTarget || statusTarget.id === attacker.id) && (!targetSecondariesBlocked || statusTarget.id === attacker.id)) {
        blockedStatus = statusTarget.status
            ? `${statusTarget.name} já possui uma condição principal`
            : getStatusBlockReason(status, statusTarget, attacker, { terrain: resolution.terrain });
        if (!blockedStatus) {
            const statusMove = move?.damage_class?.name === "status";
            const chance = moveEffectChance(move, "ailment_chance", statusMove);
            statusRoll = chanceResult(chance, random, effectAdvantage);
            if (statusRoll.success) {
                appliedStatus = status;
                statusTargetId = statusTarget.id;
                replaceEntity(statusTarget.id, {
                    ...statusTarget,
                    status,
                    toxicCounter: status === "bad-poison" ? 1 : statusTarget.toxicCounter,
                });
            }
        }
    }

    let trackedEffect = "";
    if (moveConnected && moveName === "yawn" && statusTarget) {
        blockedStatus = statusTarget.status
            ? `${statusTarget.name} já possui uma condição principal`
            : getStatusBlockReason("sleep", statusTarget, attacker, { terrain: resolution.terrain });
        if (!blockedStatus) {
            const effects = normalizeVolatileEffects(statusTarget.volatileEffects)
                .filter(effect => effect.id !== "yawn");
            effects.push({ id: "yawn", sourceMove: "yawn", turns: 2 });
            replaceEntity(statusTarget.id, { ...statusTarget, volatileEffects: effects });
            trackedEffect = "yawn";
        }
    }

    if (moveConnected && PROTECTING_MOVES.has(moveName)) {
        const effects = normalizeVolatileEffects(attacker.volatileEffects)
            .filter(effect => effect.id !== "protection");
        effects.push({ id: "protection", sourceMove: moveName, turns: 1 });
        replaceEntity(attacker.id, { ...attacker, volatileEffects: effects });
        trackedEffect = moveName;
    }

    const supportedChanges = asArray(move?.stat_changes).filter(entry =>
        STAGE_STAT_KEYS.includes(entry?.stat?.name) && asNumber(entry?.change) !== 0
    );
    let stageRoll = null;
    const stageChanges = [];
    const changesAffectUser = stageChangesTargetUser(move);
    if (moveConnected && supportedChanges.length && (applySelfChanges || !changesAffectUser) && (!substituteBlockedTarget || changesAffectUser) && (!targetSecondariesBlocked || changesAffectUser)) {
        const statusMove = move?.damage_class?.name === "status";
        const chance = moveEffectChance(move, "stat_chance", statusMove);
        stageRoll = chanceResult(chance || 100, random, effectAdvantage);
        if (stageRoll.success) {
            const stageTarget = changesAffectUser ? attacker : (target || attacker);
            let changedTarget = stageTarget;
            supportedChanges.forEach(entry => {
                const stat = entry.stat.name;
                const before = normalizeStageMap(changedTarget.stages)[stat];
                changedTarget = applyStageChange(changedTarget, stat, entry.change);
                const after = normalizeStageMap(changedTarget.stages)[stat];
                stageChanges.push({
                    tokenId: changedTarget.id,
                    stat,
                    change: after - before,
                    requestedChange: integerInRange(entry.change, -12, 12, 0),
                    before,
                    after,
                });
            });
            replaceEntity(changedTarget.id, changedTarget);
        }
    }

    const specialNarratives = [...traitNarratives];
    let specialChange = null;
    let resetAllStages = false;
    let perishSong = false;
    let abilityDamage = 0;
    let itemDamage = 0;
    let traitHealing = 0;
    const indirectHitKillProtections = [];

    const applyTraitStage = (entity, stat, change, sourceKind, sourceId, detail) => {
        if (!entity || !STAGE_STAT_KEYS.includes(stat) || !change) return entity;
        const before = normalizeStageMap(entity.stages)[stat];
        let changed = applyStageChange(entity, stat, change);
        const after = normalizeStageMap(changed.stages)[stat];
        if (after === before) return entity;
        changed = recordTraitEvent(changed, {
            kind: sourceKind,
            sourceId,
            label: `${STAGE_LABELS[stat]} ${after > before ? "aumentou" : "diminuiu"}`,
            detail,
            round,
        });
        replaceEntity(changed.id, changed);
        stageChanges.push({
            tokenId: changed.id,
            stat,
            change: after - before,
            requestedChange: change,
            before,
            after,
            sourceKind,
            sourceId,
        });
        traitActivations.push({ kind: sourceKind, sourceId, effect: "stage" });
        return changed;
    };

    const applyTraitHealing = (entity, amount, sourceKind, sourceId, detail) => {
        if (!entity || amount <= 0 || entity.currentHp <= 0) return entity;
        const before = asNumber(entity.currentHp);
        const currentHp = clamp(before + hpAmount(amount), 0, Math.max(1, asNumber(entity.maxHp, 1)));
        const applied = Math.max(0, currentHp - before);
        if (!applied) return entity;
        let changed = { ...entity, currentHp };
        changed = recordTraitEvent(changed, { kind: sourceKind, sourceId, label: "HP recuperado", detail, round });
        replaceEntity(changed.id, changed);
        healed += applied;
        traitHealing += applied;
        traitActivations.push({ kind: sourceKind, sourceId, effect: "heal", amount: applied });
        specialNarratives.push(`${formatName(sourceId)} recuperou ${applied} HP de ${changed.name}.`);
        return changed;
    };

    const applyTraitDamage = (entity, amount, sourceKind, sourceId, detail) => {
        if (!entity || amount <= 0 || entity.currentHp <= 0 || (isAbilityActive(entity) && normalizeSlug(entity.ability) === "magic-guard")) return entity;
        const requested = hpAmount(amount);
        const protectionKey = getHitKillProtectionKey(entity);
        const resolved = resolveDamageSequence({
            token: entity,
            damage: requested,
            round,
            protectionUsed: Boolean(protectionKey && nextHitKillProtectionUsed.includes(protectionKey)),
            protectionDisabled: hasHitKillProtectionDisabled(nextHitKillProtectionDisabled, entity),
            survivalGrace: hasHitKillSurvivalGrace(nextHitKillSurvivalGrace, entity),
            allowSurvivalTrait: false,
        });
        const applied = resolved.appliedDamage;
        let changed = resolved.token || entity;
        if (resolved.protectedFromKnockout && protectionKey) {
            nextHitKillProtectionUsed = normalizeHitKillProtectionUsage([...nextHitKillProtectionUsed, protectionKey]);
            indirectHitKillProtections.push({
                tokenId: entity.id,
                tokenName: entity.name,
                sourceKind,
                sourceId,
                threshold: resolved.threshold,
            });
            specialNarratives.push(`A Proteção contra Hit Kill manteve ${entity.name} com 1 HP diante do dano de ${formatName(sourceId)}.`);
        }
        if (resolved.survivalGraceRemaining) {
            nextHitKillSurvivalGrace = normalizeHitKillProtectionUsage([
                ...clearHitKillSurvivalGrace(nextHitKillSurvivalGrace, entity),
                ...getHitKillSurvivalGraceKeys(changed),
            ]);
        } else if (resolved.calculatedDamage > 0) {
            clearSurvivalGraceAfterDamage(entity, resolved.calculatedDamage);
        }
        changed = recordTraitEvent(changed, { kind: sourceKind, sourceId, label: "Dano reativo", detail, round });
        replaceEntity(changed.id, changed);
        if (sourceKind === "ability") abilityDamage += applied;
        else itemDamage += applied;
        traitActivations.push({ kind: sourceKind, sourceId, effect: "damage", amount: applied });
        specialNarratives.push(`${formatName(sourceId)} causou ${applied} de dano a ${changed.name}.`);
        return changed;
    };

    const consumeTraitItem = (entity, reason) => {
        if (!entity?.item) return entity;
        const consumed = consumeHeldItem(entity, { reason, round });
        if (!consumed.applied) return entity;
        replaceEntity(entity.id, consumed.token);
        consumedItems.push(consumed.itemId);
        traitActivations.push({ kind: "item", sourceId: consumed.itemId, effect: "consumed" });
        return consumed.token;
    };

    if (substituteAbsorbed) {
        specialNarratives.push(`Substitute absorveu ${substituteDamage} de dano${substituteBroken ? " e se desfez" : ""}.`);
    }
    if (targetSecondariesBlocked) {
        specialNarratives.push(resolution.traitModifiers?.suppressTargetSecondaries
            ? "Sheer Force converteu os efeitos secundários contra o alvo em força direta."
            : "Shield Dust ou Covert Cloak impediu os efeitos secundários contra o alvo.");
    }

    if (moveConnected && moveName === "transform" && target) {
        const transformed = transformBattleToken(attacker, target, { via: "transform", round });
        if (transformed.applied) {
            replaceEntity(attacker.id, transformed.token);
            specialNarratives.push(transformed.narrative);
            specialChange = { kind: "transform", sourceTokenId: target.id, sourceName: target.name };
        } else if (transformed.reason) {
            specialNarratives.push(`Transform não foi aplicado: ${transformed.reason}.`);
        }
    }

    if (moveConnected && ["sketch", "mimic"].includes(moveName) && target) {
        const copied = copyObservedMove(attacker, target, moveName);
        if (copied.applied) {
            replaceEntity(attacker.id, copied.token);
            specialNarratives.push(copied.narrative);
            specialChange = { kind: moveName, ...copied.override };
        } else if (copied.reason) {
            specialNarratives.push(`${formatName(moveName)} não foi aplicado: ${copied.reason}.`);
        }
    }

    if (moveConnected && moveName === "pain-split" && target) {
        const average = Math.floor((asNumber(attacker.currentHp) + asNumber(target.currentHp)) / 2);
        const attackerBefore = asNumber(attacker.currentHp);
        const targetBefore = asNumber(target.currentHp);
        const nextAttacker = { ...attacker, currentHp: clamp(average, 0, Math.max(1, asNumber(attacker.maxHp, 1))) };
        const nextTarget = { ...target, currentHp: clamp(average, 0, Math.max(1, asNumber(target.maxHp, 1))) };
        const attackerLoss = Math.max(0, attackerBefore - nextAttacker.currentHp);
        const targetLoss = Math.max(0, targetBefore - nextTarget.currentHp);
        disableProtectionAfterSelfDamage(attacker, attackerLoss);
        clearSurvivalGraceAfterDamage(target, targetLoss);
        replaceEntity(attacker.id, nextAttacker);
        replaceEntity(target.id, nextTarget);
        healed += Math.max(0, nextAttacker.currentHp - attackerBefore) + Math.max(0, nextTarget.currentHp - targetBefore);
        specialNarratives.push(`Pain Split aproximou os dois HP da média ${average}, respeitando o máximo de cada Pokémon.`);
        specialChange = { kind: "pain-split", average };
    }

    if (moveConnected && moveName === "haze") {
        resetAllStages = true;
        specialNarratives.push("Haze neutralizou os sete modificadores de todos os Pokémon em cena.");
        specialChange = { kind: "reset-all-stages" };
    }

    if (moveConnected && moveName === "clear-smog" && target) {
        const stages = normalizeStageMap({});
        const changed = { ...target, stages };
        replaceEntity(target.id, { ...changed, stats: calculateStagedStats(changed) });
        specialNarratives.push(`Clear Smog neutralizou todos os modificadores de ${target.name}.`);
        specialChange = { kind: "reset-stages", targetId: target.id };
    }

    if (moveConnected && moveName === "psych-up" && target) {
        const stages = normalizeStageMap(target.stages);
        const changed = { ...attacker, stages };
        replaceEntity(attacker.id, { ...changed, stats: calculateStagedStats(changed) });
        specialNarratives.push(`${attacker.name} copiou os sete modificadores de ${target.name}.`);
        specialChange = { kind: "copy-stages", targetId: target.id };
    }

    if (moveConnected && ["heart-swap", "power-swap", "guard-swap", "speed-swap"].includes(moveName) && target) {
        const attackerStages = normalizeStageMap(attacker.stages);
        const targetStages = normalizeStageMap(target.stages);
        const keys = moveName === "heart-swap"
            ? STAGE_STAT_KEYS
            : moveName === "power-swap"
                ? ["attack", "special-attack"]
                : moveName === "guard-swap"
                    ? ["defense", "special-defense"]
                    : ["speed"];
        const nextAttackerStages = { ...attackerStages };
        const nextTargetStages = { ...targetStages };
        keys.forEach(key => {
            nextAttackerStages[key] = targetStages[key];
            nextTargetStages[key] = attackerStages[key];
        });
        const changedAttacker = { ...attacker, stages: nextAttackerStages };
        const changedTarget = { ...target, stages: nextTargetStages };
        replaceEntity(attacker.id, { ...changedAttacker, stats: calculateStagedStats(changedAttacker) });
        replaceEntity(target.id, { ...changedTarget, stats: calculateStagedStats(changedTarget) });
        specialNarratives.push(`${formatName(moveName)} trocou ${keys.map(key => STAGE_LABELS[key]).join(" e ")} entre ${attacker.name} e ${target.name}.`);
        specialChange = { kind: "swap-stages", stats: keys, targetId: target.id };
    }

    if (moveConnected && moveName === "topsy-turvy" && target) {
        const stages = Object.fromEntries(Object.entries(normalizeStageMap(target.stages)).map(([key, value]) => [key, -value]));
        const changed = { ...target, stages };
        replaceEntity(target.id, { ...changed, stats: calculateStagedStats(changed) });
        specialNarratives.push(`Topsy-Turvy inverteu todos os modificadores de ${target.name}.`);
        specialChange = { kind: "invert-stages", targetId: target.id };
    }

    if (moveConnected && moveName === "power-trick") {
        const stats = { ...attacker.stats, attack: attacker.stats?.defense, defense: attacker.stats?.attack };
        const originalStats = {
            ...attacker.originalStats,
            attack: attacker.originalStats?.defense,
            defense: attacker.originalStats?.attack,
        };
        const state = normalizeSpecialState(attacker.specialState);
        const active = !state.markers.includes("power-trick");
        const markers = active
            ? [...state.markers, "power-trick"]
            : state.markers.filter(marker => marker !== "power-trick");
        replaceEntity(attacker.id, { ...attacker, stats, originalStats, specialState: { ...state, markers } });
        specialNarratives.push(`Power Trick ${active ? "trocou" : "restaurou"} Ataque e Defesa de ${attacker.name}.`);
        specialChange = { kind: "power-trick", active };
    }

    if (moveConnected && target && moveName === "knock-off" && target.item && normalizeSlug(target.ability) !== "sticky-hold") {
        const removed = consumeHeldItem(target, { reason: `${formatName(moveName)} removeu o item`, round });
        if (removed.applied) {
            replaceEntity(target.id, removed.token);
            consumedItems.push(removed.itemId);
            traitActivations.push({ kind: "item", sourceId: removed.itemId, effect: "removed" });
            specialNarratives.push(`${formatName(removed.itemId)} foi removido de ${target.name} por Knock Off.`);
            specialChange = { kind: "remove-item", targetId: target.id, item: removed.itemId };
        }
    }

    if (moveConnected && moveName === "fling" && attacker.item) {
        const thrown = consumeHeldItem(attacker, { reason: "Fling arremessou o item", round });
        if (thrown.applied) {
            replaceEntity(attacker.id, thrown.token);
            consumedItems.push(thrown.itemId);
            traitActivations.push({ kind: "item", sourceId: thrown.itemId, effect: "flung" });
            specialNarratives.push(`${attacker.name} arremessou ${formatName(thrown.itemId)} com Fling.`);
            specialChange = { kind: "fling-item", item: thrown.itemId };
        }
    }

    if (moveConnected && target && ["thief", "covet"].includes(moveName) && !attacker.item && target.item && normalizeSlug(target.ability) !== "sticky-hold") {
        const stolenItem = target.item;
        replaceEntity(attacker.id, assignHeldItem(attacker, stolenItem, { reason: `${formatName(moveName)} tomou o item`, round }));
        replaceEntity(target.id, assignHeldItem(target, "", { reason: `${formatName(moveName)} levou o item`, round }));
        specialNarratives.push(`${attacker.name} tomou ${formatName(stolenItem)} de ${target.name}.`);
        specialChange = { kind: "steal-item", targetId: target.id, item: stolenItem };
    }

    if (moveConnected && target && ["bug-bite", "pluck", "incinerate"].includes(moveName) && /-berry$/.test(target.item || "")) {
        const eaten = consumeHeldItem(target, { reason: `${formatName(moveName)} consumiu a Fruta`, round });
        if (eaten.applied) {
            replaceEntity(target.id, eaten.token);
            consumedItems.push(eaten.itemId);
            specialNarratives.push(`${formatName(eaten.itemId)} de ${target.name} foi consumida por ${formatName(moveName)}.`);
            specialChange = { kind: "consume-target-item", targetId: target.id, item: eaten.itemId };
        }
    }

    if (moveConnected && moveName === "recycle") {
        const restored = restoreHeldItem(attacker, { reason: "Recycle recuperou o item consumido", round });
        if (restored.applied) {
            replaceEntity(attacker.id, restored.token);
            traitActivations.push({ kind: "item", sourceId: restored.itemId, effect: "restored" });
            specialNarratives.push(`Recycle restaurou ${formatName(restored.itemId)} para ${attacker.name}.`);
            specialChange = { kind: "restore-item", item: restored.itemId };
        }
    }

    if (moveConnected && ["trick", "switcheroo"].includes(moveName) && target) {
        const attackerItem = attacker.item || "";
        const targetItem = target.item || "";
        replaceEntity(attacker.id, assignHeldItem(attacker, targetItem, { reason: `${formatName(moveName)} trocou os itens`, round }));
        replaceEntity(target.id, assignHeldItem(target, attackerItem, { reason: `${formatName(moveName)} trocou os itens`, round }));
        specialNarratives.push(`${attacker.name} e ${target.name} trocaram seus itens.`);
        specialChange = { kind: "swap-items", targetId: target.id };
    }

    if (moveConnected && moveName === "skill-swap" && target) {
        const attackerAbility = attacker.ability || "";
        const targetAbility = target.ability || "";
        replaceEntity(attacker.id, { ...attacker, ability: targetAbility, traitState: normalizeTraitState({}, attacker.item, targetAbility) });
        replaceEntity(target.id, { ...target, ability: attackerAbility, traitState: normalizeTraitState({}, target.item, attackerAbility) });
        specialNarratives.push(`${attacker.name} e ${target.name} trocaram suas habilidades.`);
        specialChange = { kind: "swap-abilities", targetId: target.id };
    }

    if (moveConnected && target && ["soak", "magic-powder", "trick-or-treat", "forests-curse"].includes(moveName)) {
        const nextTypes = moveName === "soak"
            ? ["water"]
            : moveName === "magic-powder"
                ? ["psychic"]
                : [...new Set([...asArray(target.types), moveName === "trick-or-treat" ? "ghost" : "grass"])];
        replaceEntity(target.id, { ...target, types: nextTypes });
        specialNarratives.push(`${formatName(moveName)} alterou os tipos atuais de ${target.name} para ${nextTypes.map(formatName).join(" / ")}.`);
        specialChange = { kind: "type-change", targetId: target.id, types: nextTypes };
    }

    if (moveConnected && delayedDamage && target) {
        const effects = normalizeVolatileEffects(target.volatileEffects).filter(effect => effect.id !== moveName);
        effects.push({
            id: moveName,
            sourceMove: moveName,
            sourceTokenId: attacker.id,
            sourceName: attacker.name,
            turns: 2,
            amount: Math.max(0, asNumber(resolution.damage)),
            critical: Boolean(resolution.attackTest?.critical),
            defenderFumble: Boolean(resolution.defenseTest?.fumble),
            directKnockout: Boolean(resolution.directKnockout),
        });
        replaceEntity(target.id, { ...target, volatileEffects: effects });
        trackedEffect = moveName;
        specialNarratives.push(`${formatName(moveName)} foi preparado para atingir ${target.name} em 2 rodadas.`);
        specialChange = { kind: "delayed-damage", targetId: target.id, turns: 2, amount: Math.max(0, asNumber(resolution.damage)) };
    }

    if (moveConnected && moveName === "wish") {
        const effects = normalizeVolatileEffects(attacker.volatileEffects).filter(effect => effect.id !== "wish");
        const amount = Math.max(1, Math.floor(asNumber(attacker.maxHp, 1) / 2));
        effects.push({ id: "wish", sourceMove: "wish", sourceTokenId: attacker.id, sourceName: attacker.name, turns: 2, amount });
        replaceEntity(attacker.id, { ...attacker, volatileEffects: effects });
        trackedEffect = "wish";
        specialNarratives.push(`Wish foi preparado e recuperará até ${amount} HP em 2 rodadas.`);
        specialChange = { kind: "delayed-heal", targetId: attacker.id, turns: 2, amount };
    }

    const selfHpCostFraction = SELF_HP_COST_MOVES[moveName]
        || (moveName === "curse" && getDefensiveTypes(attacker).includes("ghost") ? 1 / 2 : 0);
    if (moveConnected && selfHpCostFraction > 0) {
        const amount = Math.max(1, Math.floor(asNumber(attacker.maxHp, 1) * selfHpCostFraction));
        const canPay = moveName === "curse" || asNumber(attacker.currentHp) > amount;
        if (canPay) {
            const applied = Math.min(asNumber(attacker.currentHp), amount);
            replaceEntity(attacker.id, { ...attacker, currentHp: Math.max(0, asNumber(attacker.currentHp) - applied) });
            disableProtectionAfterSelfDamage(attacker, applied);
            recoil += applied;
            specialNarratives.push(`${attacker.name} pagou ${applied} HP para usar ${formatName(moveName)}.`);
        } else {
            specialNarratives.push(`${formatName(moveName)} não cobrou HP porque ${attacker.name} não podia pagar o custo.`);
        }
    }

    if (!moveConnected && MISS_CRASH_MOVES.has(moveName) && !resolution.traitBlock?.attackerBlocked) {
        const amount = Math.min(asNumber(attacker.currentHp), Math.max(1, Math.floor(asNumber(attacker.maxHp, 1) / 2)));
        replaceEntity(attacker.id, { ...attacker, currentHp: Math.max(0, asNumber(attacker.currentHp) - amount) });
        disableProtectionAfterSelfDamage(attacker, amount);
        recoil += amount;
        specialNarratives.push(`${attacker.name} perdeu ${amount} HP com a queda de ${formatName(moveName)}.`);
    }

    if (moveConnected && moveName === "substitute") {
        const amount = Math.max(1, Math.floor(asNumber(attacker.maxHp, 1) / 4));
        if (asNumber(attacker.currentHp) > amount) {
            const effects = normalizeVolatileEffects(attacker.volatileEffects).filter(effect => effect.id !== "substitute");
            effects.push({ id: "substitute", sourceMove: "substitute", sourceTokenId: attacker.id, sourceName: attacker.name, turns: null, amount });
            replaceEntity(attacker.id, { ...attacker, currentHp: asNumber(attacker.currentHp) - amount, volatileEffects: effects });
            disableProtectionAfterSelfDamage(attacker, amount);
            recoil += amount;
            trackedEffect = "substitute";
            specialNarratives.push(`${attacker.name} investiu ${amount} HP para criar um Substitute.`);
            specialChange = { kind: "substitute", amount };
        } else {
            specialNarratives.push("Substitute não foi criado porque o usuário não possui HP suficiente.");
        }
    }

    if (moveConnected && moveName === "leech-seed" && target) {
        if (getDefensiveTypes(target).includes("grass")) {
            specialNarratives.push("Leech Seed não afetou um Pokémon do tipo Grama.");
        } else {
            const effects = normalizeVolatileEffects(target.volatileEffects).filter(effect => effect.id !== "leech-seed");
            effects.push({ id: "leech-seed", sourceMove: "leech-seed", sourceTokenId: attacker.id, sourceName: attacker.name, turns: null });
            replaceEntity(target.id, { ...target, volatileEffects: effects });
            trackedEffect = "leech-seed";
            specialNarratives.push(`${target.name} foi semeado; o dreno será resolvido no fim das rodadas.`);
            specialChange = { kind: "leech-seed", targetId: target.id, sourceTokenId: attacker.id };
        }
    }

    if (moveConnected && ["aqua-ring", "ingrain"].includes(moveName)) {
        const effects = normalizeVolatileEffects(attacker.volatileEffects).filter(effect => effect.id !== moveName);
        effects.push({ id: moveName, sourceMove: moveName, sourceTokenId: attacker.id, sourceName: attacker.name, turns: null });
        replaceEntity(attacker.id, { ...attacker, volatileEffects: effects });
        trackedEffect = moveName;
        specialNarratives.push(`${formatName(moveName)} foi registrado como recuperação persistente.`);
        specialChange = { kind: "persistent-heal", targetId: attacker.id };
    }

    if (moveConnected && moveName === "perish-song") {
        perishSong = true;
        trackedEffect = "perish-song";
        specialNarratives.push("Perish Song marcou todos em cena com uma contagem de 3 rodadas.");
        specialChange = { kind: "perish-song", turns: 3 };
    }

    if (moveConnected && SELF_SACRIFICE_MOVES.has(moveName)) {
        const hpLost = Math.max(0, asNumber(attacker.currentHp));
        replaceEntity(attacker.id, { ...attacker, currentHp: 0 });
        disableProtectionAfterSelfDamage(attacker, hpLost);
        recoil += hpLost;
        specialNarratives.push(`${attacker.name} concluiu ${formatName(moveName)} e não pode mais batalhar.`);
        specialChange = { kind: "self-sacrifice", hpLost };
    }

    if (resolution.abilityBlock && target) {
        const { ability, marker, absorbed } = resolution.abilityBlock;
        if (marker) {
            const state = normalizeSpecialState(target.specialState);
            const markers = [...new Set([...state.markers, marker])];
            let changedTarget = { ...target, specialState: { ...state, markers } };
            if (marker === "disguise-broken") {
                abilityDamage = Math.min(changedTarget.currentHp, hpAmount(asNumber(changedTarget.maxHp, 1) / 8));
                changedTarget = { ...changedTarget, currentHp: Math.max(0, changedTarget.currentHp - abilityDamage) };
                disableProtectionAfterSelfDamage(target, abilityDamage);
                specialNarratives.push(`Disguise absorveu o golpe, rompeu o disfarce e custou ${abilityDamage} HP.`);
            } else {
                specialNarratives.push(`${formatName(ability)} mudou de estado após bloquear o golpe.`);
            }
            replaceEntity(target.id, changedTarget);
        } else if (absorbed && ["water-absorb", "volt-absorb", "dry-skin"].includes(ability)) {
            const before = asNumber(target.currentHp);
            const amount = hpAmount(asNumber(target.maxHp, 1) / 4);
            const currentHp = clamp(before + amount, 0, Math.max(1, asNumber(target.maxHp, 1)));
            healed += Math.max(0, currentHp - before);
            replaceEntity(target.id, { ...target, currentHp });
            specialNarratives.push(`${formatName(ability)} absorveu o golpe e recuperou ${Math.max(0, currentHp - before)} HP.`);
        } else if (absorbed && ["motor-drive", "lightning-rod", "storm-drain", "sap-sipper", "well-baked-body"].includes(ability)) {
            const stat = ability === "motor-drive"
                ? "speed"
                : ["lightning-rod", "storm-drain"].includes(ability)
                    ? "special-attack"
                    : ability === "sap-sipper"
                        ? "attack"
                        : "defense";
            const change = ability === "well-baked-body" ? 2 : 1;
            const changed = applyStageChange(target, stat, change);
            replaceEntity(target.id, changed);
            specialNarratives.push(`${formatName(ability)} absorveu o golpe e alterou ${STAGE_LABELS[stat]} em +${change}.`);
        } else if (absorbed && ability === "flash-fire") {
            const state = normalizeSpecialState(target.specialState);
            const markers = [...new Set([...state.markers, "flash-fire-boost"])];
            replaceEntity(target.id, { ...target, specialState: { ...state, markers } });
            specialNarratives.push("Flash Fire absorveu o golpe e fortaleceu os próximos movimentos de Fogo.");
        } else {
            specialNarratives.push(`${resolution.abilityBlock.reason}.`);
        }
    }

    if (resolution.traitBlock) {
        const block = resolution.traitBlock;
        specialNarratives.push(`${block.reason}.`);
        traitActivations.push({ kind: block.kind, sourceId: block.sourceId, effect: block.attackerBlocked ? "restricted" : "blocked" });
        if (block.attackerBlocked) {
            attacker = recordTraitEvent(attacker, { kind: block.kind, sourceId: block.sourceId, label: "Ação restringida", detail: block.reason, round });
        } else if (target) {
            replaceEntity(target.id, recordTraitEvent(target, { kind: block.kind, sourceId: block.sourceId, label: "Movimento bloqueado", detail: block.reason, round }));
        }
    }

    if (target && damage > 0) {
        const targetItemAtImpact = isHeldItemActive(target) ? traitSlug(target.item) : "";
        const targetAbilityAtImpact = isAbilityActive(target) ? traitSlug(target.ability) : "";
        if (targetItemAtImpact === "air-balloon") {
            target = consumeTraitItem(target, "O dano estourou Air Balloon");
            specialNarratives.push(`Air Balloon de ${target.name} estourou após o impacto.`);
        }
        if (target.currentHp > 0 && targetItemAtImpact === "weakness-policy" && asNumber(resolution.effectiveness) > 1) {
            target = consumeTraitItem(target, "Weakness Policy foi ativado por dano super efetivo");
            target = applyTraitStage(target, "attack", 2, "item", "weakness-policy", "Dano super efetivo ativou o Seguro Fraqueza");
            target = applyTraitStage(target, "special-attack", 2, "item", "weakness-policy", "Dano super efetivo ativou o Seguro Fraqueza");
        }
        if (target.currentHp > 0 && targetItemAtImpact === "kee-berry" && move?.damage_class?.name === "physical") {
            target = consumeTraitItem(target, "Kee Berry reagiu ao golpe físico");
            target = applyTraitStage(target, "defense", 1, "item", "kee-berry", "Golpe físico ativou a Fruta");
        }
        if (target.currentHp > 0 && targetItemAtImpact === "maranga-berry" && move?.damage_class?.name === "special") {
            target = consumeTraitItem(target, "Maranga Berry reagiu ao golpe especial");
            target = applyTraitStage(target, "special-defense", 1, "item", "maranga-berry", "Golpe especial ativou a Fruta");
        }
        if (target.currentHp > 0 && targetItemAtImpact === "enigma-berry" && asNumber(resolution.effectiveness) > 1) {
            target = consumeTraitItem(target, "Enigma Berry reagiu ao golpe super efetivo");
            target = applyTraitHealing(target, asNumber(target.maxHp, 1) / 4, "item", "enigma-berry", "Golpe super efetivo ativou a Fruta");
        }

        const contactPrevented = isHeldItemActive(attacker) && traitSlug(attacker.item) === "punching-glove" && moveHasTrait(move, "punch");
        const contact = moveHasTrait(move, "contact") && !contactPrevented;
        if (contact && ["rough-skin", "iron-barbs"].includes(targetAbilityAtImpact)) {
            attacker = applyTraitDamage(attacker, asNumber(attacker.maxHp, 1) / 8, "ability", targetAbilityAtImpact, "Contato com a defesa do alvo");
        }
        if (contact && targetItemAtImpact === "rocky-helmet") {
            attacker = applyTraitDamage(attacker, asNumber(attacker.maxHp, 1) / 6, "item", targetItemAtImpact, "Contato com Rocky Helmet");
        }
        if (contact && target.currentHp <= 0 && targetAbilityAtImpact === "aftermath") {
            attacker = applyTraitDamage(attacker, asNumber(attacker.maxHp, 1) / 4, "ability", targetAbilityAtImpact, "Aftermath reagiu ao nocaute por contato");
        }
        if (contact && !attacker.status && ["static", "flame-body", "poison-point"].includes(targetAbilityAtImpact)) {
            const reactiveStatus = targetAbilityAtImpact === "static"
                ? "paralysis"
                : targetAbilityAtImpact === "flame-body"
                    ? "burn"
                    : "poison";
            const blocked = getStatusBlockReason(reactiveStatus, attacker, target, { terrain: resolution.terrain });
            const roll = chanceResult(30, random);
            if (!blocked && roll.success) {
                attacker = recordTraitEvent({ ...attacker, status: reactiveStatus }, {
                    kind: "ability",
                    sourceId: targetAbilityAtImpact,
                    label: "Condição aplicada",
                    detail: `${targetAbilityAtImpact} reagiu ao contato`,
                    round,
                });
                replaceEntity(attacker.id, attacker);
                traitStatuses.push({ tokenId: attacker.id, status: reactiveStatus, sourceId: targetAbilityAtImpact });
                traitActivations.push({ kind: "ability", sourceId: targetAbilityAtImpact, effect: "status" });
                specialNarratives.push(`${formatName(targetAbilityAtImpact)} aplicou ${RPG_STATUS_LABELS[reactiveStatus] || formatName(reactiveStatus)} a ${attacker.name}.`);
            }
        }
    }

    if (damage > 0 && attacker.currentHp > 0) {
        const attackerItemAfterHit = isHeldItemActive(attacker) ? traitSlug(attacker.item) : "";
        if (attackerItemAfterHit === "life-orb") {
            if (!(isAbilityActive(attacker) && traitSlug(attacker.ability) === "magic-guard")) {
                const before = asNumber(attacker.currentHp);
                const applied = Math.min(before, hpAmount(asNumber(attacker.maxHp, 1) / 10));
                attacker = recordTraitEvent({ ...attacker, currentHp: Math.max(0, before - applied) }, {
                    kind: "item",
                    sourceId: attackerItemAfterHit,
                    label: "Custo de HP",
                    detail: "Life Orb cobrou o custo do golpe",
                    round,
                });
                disableProtectionAfterSelfDamage(attacker, applied);
                replaceEntity(attacker.id, attacker);
                recoil += applied;
                traitActivations.push({ kind: "item", sourceId: attackerItemAfterHit, effect: "recoil", amount: applied });
                specialNarratives.push(`Life Orb cobrou ${applied} HP de ${attacker.name}.`);
            }
        }
        if (attackerItemAfterHit === "shell-bell") {
            attacker = applyTraitHealing(attacker, damage / 8, "item", attackerItemAfterHit, "Shell Bell converteu dano em cura");
        }
    }

    if (target && target.currentHp <= 0 && damage > 0 && attacker.currentHp > 0 && isAbilityActive(attacker)) {
        const attackerAbility = traitSlug(attacker.ability);
        if (["moxie", "chilling-neigh"].includes(attackerAbility)) {
            attacker = applyTraitStage(attacker, "attack", 1, "ability", attackerAbility, "O nocaute ativou a habilidade");
        } else if (attackerAbility === "grim-neigh") {
            attacker = applyTraitStage(attacker, "special-attack", 1, "ability", attackerAbility, "O nocaute ativou a habilidade");
        } else if (attackerAbility === "beast-boost") {
            const candidates = COMBAT_STAT_STAGE_KEYS.map(stat => [stat, asNumber(attacker.stats?.[stat])]);
            candidates.sort((first, second) => second[1] - first[1]);
            attacker = applyTraitStage(attacker, candidates[0]?.[0] || "attack", 1, "ability", attackerAbility, "Beast Boost elevou o maior atributo atual");
        }
    }

    if (moveConnected && moveHasTrait(move, "sound") && isHeldItemActive(attacker) && traitSlug(attacker.item) === "throat-spray") {
        attacker = consumeTraitItem(attacker, "Throat Spray reagiu ao movimento sonoro");
        attacker = applyTraitStage(attacker, "special-attack", 1, "item", "throat-spray", "Movimento sonoro ativou o item");
    }

    const resolveAutomaticItem = entity => {
        if (!entity || entity.currentHp <= 0 || !isHeldItemActive(entity)) return entity;
        const itemId = traitSlug(entity.item);
        const ratio = asNumber(entity.currentHp) / Math.max(1, asNumber(entity.maxHp, 1));
        const matchingStatus = STATUS_CURE_BERRIES[itemId];
        const berryMatchesStatus = Boolean(matchingStatus && [entity.status, entity.status === "bad-poison" ? "poison" : ""].includes(matchingStatus));
        if ((itemId === "lum-berry" && entity.status) || berryMatchesStatus) {
            const previousStatus = entity.status;
            let changed = consumeTraitItem(entity, `${formatName(itemId)} curou ${RPG_STATUS_LABELS[previousStatus] || formatName(previousStatus)}`);
            changed = recordTraitEvent({ ...changed, status: "", toxicCounter: 0 }, {
                kind: "item",
                sourceId: itemId,
                label: "Condição curada",
                detail: `Removeu ${previousStatus}`,
                round,
            });
            replaceEntity(changed.id, changed);
            specialNarratives.push(`${formatName(itemId)} foi consumida e curou ${RPG_STATUS_LABELS[previousStatus] || formatName(previousStatus)} de ${changed.name}.`);
            return changed;
        }
        if (itemId === "oran-berry" && ratio <= 1 / 2) {
            let changed = consumeTraitItem(entity, "Oran Berry foi ativada por HP baixo");
            return applyTraitHealing(changed, Math.max(1, asNumber(changed.maxHp, 1) / 4), "item", itemId, "HP baixo ativou a Fruta");
        }
        if (itemId === "sitrus-berry" && ratio <= 1 / 2) {
            let changed = consumeTraitItem(entity, "Sitrus Berry foi ativada por HP baixo");
            return applyTraitHealing(changed, asNumber(changed.maxHp, 1) / 4, "item", itemId, "HP baixo ativou a Fruta");
        }
        if (PINCH_HEAL_BERRIES.has(itemId) && ratio <= 1 / 4) {
            let changed = consumeTraitItem(entity, `${formatName(itemId)} foi ativada por HP crítico`);
            return applyTraitHealing(changed, asNumber(changed.maxHp, 1) / 3, "item", itemId, "HP crítico ativou a Fruta");
        }
        if (PINCH_STAGE_BERRIES[itemId] && ratio <= 1 / 4) {
            let changed = consumeTraitItem(entity, `${formatName(itemId)} foi ativada por HP crítico`);
            return applyTraitStage(changed, PINCH_STAGE_BERRIES[itemId], 1, "item", itemId, "HP crítico ativou a Fruta");
        }
        if (itemId === "white-herb") {
            const stages = normalizeStageMap(entity.stages);
            const negatives = Object.entries(stages).filter(([, value]) => value < 0);
            if (negatives.length) {
                let changed = consumeTraitItem(entity, "White Herb neutralizou modificadores negativos");
                const nextStages = { ...stages };
                negatives.forEach(([stat]) => { nextStages[stat] = 0; });
                changed = { ...changed, stages: nextStages };
                changed = { ...changed, stats: calculateStagedStats(changed) };
                replaceEntity(changed.id, changed);
                specialNarratives.push(`White Herb neutralizou ${negatives.map(([stat]) => STAGE_LABELS[stat]).join(", ")} de ${changed.name}.`);
                return changed;
            }
        }
        return entity;
    };

    attacker = resolveAutomaticItem(attacker);
    if (target && target.id !== attacker.id) target = resolveAutomaticItem(target);

    if (damageHit) {
        asArray(resolution.traitModifiers?.entries).forEach(entry => {
            const belongsToTarget = target && [traitSlug(target.ability), traitSlug(target.item)].includes(entry.sourceId);
            const owner = belongsToTarget ? target : attacker;
            const changed = recordTraitEvent(owner, {
                kind: entry.kind,
                sourceId: entry.sourceId,
                label: "Modificador de dano",
                detail: `${entry.detail} (${entry.multiplier}×)`,
                round,
            });
            replaceEntity(owner.id, changed);
            if (belongsToTarget) target = changed;
            else attacker = changed;
            traitActivations.push({ kind: entry.kind, sourceId: entry.sourceId, effect: "damage-modifier", multiplier: entry.multiplier });
        });
    }

    if (!resolution.traitBlock?.attackerBlocked) attacker = setChoiceLock(attacker, moveName, round);

    if (target && damage > 0 && normalizeSpecialState(target.specialState).illusion) {
        const revealed = revealBattleIllusion(target);
        if (revealed.applied) {
            replaceEntity(target.id, revealed.token);
            specialNarratives.push(`A Ilusão de ${target.name} foi revelada pelo dano.`);
        }
    }

    const fieldChange = moveConnected ? getMoveFieldChange(move) : null;
    if (clearDeclaration) {
        attacker = recordBattleMove(attacker, {
            moveName,
            targetId: target?.id || "",
            targetName: target?.name || "",
            round,
            connected: moveConnected,
            damage,
            damageClass: move?.damage_class?.name,
        });
        attacker = { ...attacker, declaredMove: "", priority: 0 };
    }
    let nextTokens = source.map(token => {
        if (token.id === attacker.id) return attacker;
        if (target && token.id === target.id) return target;
        return token;
    });
    if (resetAllStages) {
        nextTokens = nextTokens.map(token => {
            const stages = normalizeStageMap({});
            const changed = { ...token, stages };
            return { ...changed, stats: calculateStagedStats(changed) };
        });
    }
    if (perishSong) {
        const protectedNames = nextTokens
            .filter(token => normalizeSlug(token.ability) === "soundproof")
            .map(token => token.name);
        if (protectedNames.length) {
            specialNarratives.push(`Soundproof protegeu ${protectedNames.join(", ")} de Perish Song.`);
        }
        nextTokens = nextTokens.map(token => {
            if (normalizeSlug(token.ability) === "soundproof") return token;
            const effects = normalizeVolatileEffects(token.volatileEffects).filter(effect => effect.id !== "perish-song");
            effects.push({ id: "perish-song", sourceMove: "perish-song", sourceTokenId: attacker.id, sourceName: attacker.name, turns: 3 });
            return { ...token, volatileEffects: effects };
        });
    }

    return {
        tokens: nextTokens,
        hitKillProtectionUsed: nextHitKillProtectionUsed,
        hitKillProtectionDisabled: nextHitKillProtectionDisabled,
        hitKillSurvivalGrace: nextHitKillSurvivalGrace,
        consequences: {
            applied: true,
            targetId: target?.id || "",
            moveConnected,
            damageHit,
            ppBefore,
            ppAfter,
            damage,
            calculatedDamage: hitKill.calculatedDamage,
            rolledDamage: hitKill.rolledDamage,
            resolvedHitCount: hitKill.resolvedHitCount,
            plannedHitCount: hitKill.plannedHitCount,
            hitKillProtectedHits: hitKill.protectedHits,
            traitProtectedHits: hitKill.traitProtectedHits,
            faintedOnHit: hitKill.faintedOnHit,
            hitKillThreshold: hitKill.threshold,
            hitKillProtected: hitKill.protectedFromKnockout || indirectHitKillProtections.length > 0,
            hitKillBypassed: hitKill.bypassed,
            hitKillBypassedByAttackerCritical: Boolean(hitKill.attackerCritical && hitKill.wouldKnockOut),
            hitKillBypassedByDefenderFumble: Boolean(hitKill.defenderFumble && hitKill.wouldKnockOut),
            hpBefore: hitKill.hpBefore,
            healed,
            recoil,
            appliedStatus,
            blockedStatus,
            statusTargetId,
            statusRoll,
            trackedEffect,
            stageChanges,
            stageRoll,
            fieldChange,
            scheduledDamage: delayedDamage ? integerInRange(resolution.damage, 0, MAX_SAFE_GAME_INTEGER, 0) : 0,
            specialChange,
            specialNarratives,
            abilityBlock: resolution.abilityBlock || null,
            abilityDamage,
            itemDamage,
            traitHealing,
            traitProtected: Boolean(hitKill.traitProtected),
            traitSourceId: hitKill.traitSourceId || "",
            survivalGraceGranted: Boolean(hitKill.survivalGraceGranted),
            survivalGraceUsed: Boolean(hitKill.survivalGraceUsed),
            survivalGraceRemaining: Boolean(hitKill.survivalGraceRemaining),
            protectionDisabledThisAction,
            indirectHitKillProtections,
            traitActivations,
            consumedItems,
            traitStatuses,
            traitModifiers: resolution.traitModifiers || null,
            traitBlock: resolution.traitBlock || null,
            substituteDamage,
            substituteBroken,
            fainted: Boolean(target && target.currentHp <= 0),
            attackerFainted: attacker.currentHp <= 0,
        },
    };
};

import { convertToTTRPG, formatName } from "./mechanics.js";
import { RPG_STATUS_LABELS } from "./copy.js";
import { rollPercentTest } from "./rpgRules.js";

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
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const normalizeSlug = value => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

export const normalizePpSlots = value => {
    const pp = asArray(value).slice(0, 4).map(entry => {
        if (entry === "" || entry == null) return null;
        return clamp(asNumber(entry), 0, 99);
    });
    while (pp.length < 4) pp.push(null);
    return pp;
};

export const normalizeStageMap = value => Object.fromEntries(
    STAGE_STAT_KEYS.map(stat => [stat, clamp(Math.round(asNumber(value?.[stat])), -6, 6)])
);

export const normalizeVolatileEffects = value => {
    const unique = new Map();
    asArray(value).forEach(entry => {
        const id = normalizeSlug(entry?.id || entry);
        if (!id) return;
        unique.set(id, {
            id,
            sourceMove: normalizeSlug(entry?.sourceMove),
            turns: entry?.turns == null ? null : clamp(Math.round(asNumber(entry.turns)), 0, 99),
        });
    });
    return [...unique.values()].slice(0, 16);
};

export const stageMultiplier = stage => {
    const normalized = clamp(Math.round(asNumber(stage)), -6, 6);
    return normalized >= 0 ? (2 + normalized) / 2 : 2 / (2 - normalized);
};

export const accuracyStageMultiplier = stage => {
    const normalized = clamp(Math.round(asNumber(stage)), -6, 6);
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
        result[stat] = convertToTTRPG(Math.floor(originalValue * stageMultiplier(stages[stat])));
    });
    return result;
};

export const applyStageChange = (token, stat, change) => {
    if (!STAGE_STAT_KEYS.includes(stat) || !change) return token;
    const stages = normalizeStageMap(token?.stages);
    stages[stat] = clamp(stages[stat] + Math.round(asNumber(change)), -6, 6);
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
    const maximum = move?.pp == null ? null : clamp(asNumber(move.pp), 0, 99);
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

export const adjustMoveAccuracy = ({ move, attacker, defender } = {}) => {
    const profile = getMoveResolutionProfile(move);
    const baseAccuracy = move?.accuracy === true || move?.accuracy == null
        ? null
        : clamp(asNumber(move.accuracy, 100), 0, 100);
    if (!profile.requiresAccuracyCheck || baseAccuracy == null) {
        return {
            automatic: true,
            baseAccuracy,
            adjustedAccuracy: 100,
            accuracyStage: 0,
            evasionStage: 0,
            combinedStage: 0,
            multiplier: 1,
        };
    }
    const attackerStages = normalizeStageMap(attacker?.stages);
    const defenderStages = normalizeStageMap(defender?.stages);
    const accuracyStage = attackerStages.accuracy;
    const evasionStage = defenderStages.evasion;
    const combinedStage = clamp(accuracyStage - evasionStage, -6, 6);
    const multiplier = accuracyStageMultiplier(combinedStage);
    return {
        automatic: false,
        baseAccuracy,
        adjustedAccuracy: clamp(Math.floor(baseAccuracy * multiplier), 0, 100),
        accuracyStage,
        evasionStage,
        combinedStage,
        multiplier,
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

const hpAmount = value => value > 0 ? Math.max(1, Math.round(value)) : 0;

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

export const getStatusBlockReason = (status, target, attacker) => {
    if (!status || !target) return "";
    const types = getDefensiveTypes(target);
    const ability = normalizeSlug(target.ability);
    const sourceAbility = normalizeSlug(attacker?.ability);
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
    critical = false,
    directKnockout = false,
} = {}) => {
    const hpBefore = Math.max(0, asNumber(currentHp));
    const calculatedDamage = Math.max(0, asNumber(damage));
    const threshold = hpBefore * 3;
    const wouldKnockOut = hpBefore > 0 && calculatedDamage >= hpBefore;
    const bypassed = Boolean(critical || directKnockout);
    const protectedFromKnockout = wouldKnockOut && !bypassed && calculatedDamage < threshold;
    const appliedDamage = protectedFromKnockout
        ? Math.max(0, hpBefore - 1)
        : Math.min(calculatedDamage, hpBefore);
    return {
        hpBefore,
        calculatedDamage,
        appliedDamage,
        threshold,
        wouldKnockOut,
        protectedFromKnockout,
        bypassed,
        remainingHp: Math.max(0, hpBefore - appliedDamage),
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
    return [...new Set(tags)];
};

export const applyMoveConsequences = ({
    tokens,
    attackerId,
    defenderId,
    targetId = defenderId,
    move,
    resolution,
    random,
    consumePp = true,
    applySelfChanges = true,
    clearDeclaration = true,
}) => {
    const source = asArray(tokens);
    const originalAttacker = source.find(token => token.id === attackerId);
    const originalTarget = targetId ? source.find(token => token.id === targetId) : null;
    if (!originalAttacker || !move || !resolution) {
        return { tokens: source, consequences: { applied: false } };
    }

    let attacker = {
        ...originalAttacker,
        pp: normalizePpSlots(originalAttacker.pp),
        stages: normalizeStageMap(originalAttacker.stages),
        volatileEffects: normalizeVolatileEffects(originalAttacker.volatileEffects),
    };
    let target = originalTarget?.id === attacker.id
        ? attacker
        : originalTarget
            ? {
                ...originalTarget,
                stages: normalizeStageMap(originalTarget.stages),
                volatileEffects: normalizeVolatileEffects(originalTarget.volatileEffects),
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

    const ppState = getMovePpState(attacker, move);
    let ppBefore = ppState.remaining;
    let ppAfter = ppState.remaining;
    if (consumePp && ppState.index >= 0 && ppState.remaining != null) {
        ppAfter = Math.max(0, ppState.remaining - 1);
        attacker.pp[ppState.index] = ppAfter;
    }

    const moveConnected = Boolean(resolution.moveConnected ?? resolution.hit);
    const damageHit = Boolean(resolution.damageHit ?? resolution.hit);
    const effectAdvantage = Boolean(
        resolution.attackTest
        && resolution.defenseTest
        && resolution.attackTest.total - resolution.defenseTest.total > 1
    );
    const calculatedDamage = damageHit ? Math.max(0, asNumber(resolution.damage)) : 0;
    const hitKill = target
        ? applyHitKillProtection({
            damage: calculatedDamage,
            currentHp: target.currentHp,
            critical: Boolean(resolution.attackTest?.critical),
            directKnockout: Boolean(resolution.directKnockout || isDirectKnockoutMove(move)),
        })
        : applyHitKillProtection({ damage: 0, currentHp: 0 });
    const damage = damageHit ? hitKill.appliedDamage : 0;
    if (target && damage > 0) {
        replaceEntity(target.id, {
            ...target,
            currentHp: clamp(hitKill.remainingHp, 0, Math.max(1, asNumber(target.maxHp, 1))),
        });
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
    }

    const healing = asNumber(move?.meta?.healing);
    if (moveConnected && healing > 0) {
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
    if (moveConnected && status && statusTarget) {
        blockedStatus = statusTarget.status
            ? `${statusTarget.name} já possui uma condição principal`
            : getStatusBlockReason(status, statusTarget, attacker);
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
    if (moveConnected && normalizeSlug(move.name) === "yawn" && statusTarget) {
        blockedStatus = statusTarget.status
            ? `${statusTarget.name} já possui uma condição principal`
            : getStatusBlockReason("sleep", statusTarget, attacker);
        if (!blockedStatus) {
            const effects = normalizeVolatileEffects(statusTarget.volatileEffects)
                .filter(effect => effect.id !== "yawn");
            effects.push({ id: "yawn", sourceMove: "yawn", turns: 2 });
            replaceEntity(statusTarget.id, { ...statusTarget, volatileEffects: effects });
            trackedEffect = "yawn";
        }
    }

    if (moveConnected && PROTECTING_MOVES.has(normalizeSlug(move.name))) {
        const effects = normalizeVolatileEffects(attacker.volatileEffects)
            .filter(effect => effect.id !== "protection");
        effects.push({ id: "protection", sourceMove: normalizeSlug(move.name), turns: 1 });
        replaceEntity(attacker.id, { ...attacker, volatileEffects: effects });
        trackedEffect = normalizeSlug(move.name);
    }

    const supportedChanges = asArray(move?.stat_changes).filter(entry =>
        STAGE_STAT_KEYS.includes(entry?.stat?.name) && asNumber(entry?.change) !== 0
    );
    let stageRoll = null;
    const stageChanges = [];
    const changesAffectUser = stageChangesTargetUser(move);
    if (moveConnected && supportedChanges.length && (applySelfChanges || !changesAffectUser)) {
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
                    requestedChange: Math.round(asNumber(entry.change)),
                    before,
                    after,
                });
            });
            replaceEntity(changedTarget.id, changedTarget);
        }
    }

    const fieldChange = moveConnected ? getMoveFieldChange(move) : null;
    if (clearDeclaration) attacker = { ...attacker, declaredMove: "", priority: 0 };
    const nextTokens = source.map(token => {
        if (token.id === attacker.id) return attacker;
        if (target && token.id === target.id) return target;
        return token;
    });

    return {
        tokens: nextTokens,
        consequences: {
            applied: true,
            targetId: target?.id || "",
            moveConnected,
            damageHit,
            ppBefore,
            ppAfter,
            damage,
            calculatedDamage,
            hitKillThreshold: hitKill.threshold,
            hitKillProtected: hitKill.protectedFromKnockout,
            hitKillBypassed: hitKill.bypassed,
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
            fainted: Boolean(target && target.currentHp <= 0),
            attackerFainted: attacker.currentHp <= 0,
        },
    };
};

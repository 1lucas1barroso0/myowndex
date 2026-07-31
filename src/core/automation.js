import { convertToTTRPG, formatName } from "./mechanics.js";
import { RPG_STATUS_LABELS } from "./copy.js";
import { rollPercentTest } from "./rpgRules.js";

export const STAGE_STAT_KEYS = ["attack", "defense", "special-attack", "special-defense", "speed"];

export const MOVE_STATUS_MAP = {
    burn: "burn",
    freeze: "freeze",
    paralysis: "paralysis",
    poison: "poison",
    sleep: "sleep",
};

const USER_TARGETS = new Set([
    "user",
    "users-field",
    "user-and-allies",
    "user-or-ally",
    "all-allies",
]);

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

export const stageMultiplier = stage => {
    const normalized = clamp(Math.round(asNumber(stage)), -6, 6);
    return normalized >= 0 ? (2 + normalized) / 2 : 2 / (2 - normalized);
};

export const calculateStagedStats = token => {
    const stages = normalizeStageMap(token?.stages);
    const current = token?.stats && typeof token.stats === "object" ? token.stats : {};
    const original = token?.originalStats && typeof token.originalStats === "object"
        ? token.originalStats
        : {};
    const result = { ...current };
    STAGE_STAT_KEYS.forEach(stat => {
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

const statusForMove = move => {
    const ailment = normalizeSlug(move?.meta?.ailment?.name);
    if (!ailment || ailment === "none") return "";
    if (normalizeSlug(move?.name) === "toxic") return "bad-poison";
    return MOVE_STATUS_MAP[ailment] || "";
};

const chanceResult = (chance, random) => {
    const normalized = clamp(asNumber(chance), 0, 100);
    if (normalized >= 100) {
        return { automatic: true, rolls: [], result: null, chance: 100, success: true };
    }
    if (normalized <= 0) {
        return { automatic: true, rolls: [], result: null, chance: 0, success: false };
    }
    return { automatic: false, ...rollPercentTest({ chance: normalized, random }) };
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
    const tags = ["PP"];
    if (move.power) tags.push("Dano");
    if (move.priority) tags.push(`Prioridade ${move.priority > 0 ? "+" : ""}${move.priority}`);
    const status = statusForMove(move);
    if (status) tags.push(RPG_STATUS_LABELS[status] || formatName(status));
    if (asNumber(move?.meta?.drain) > 0) tags.push("Drenagem");
    if (asNumber(move?.meta?.drain) < 0) tags.push("Recuo");
    if (asNumber(move?.meta?.healing) > 0) tags.push("Cura");
    if (asArray(move?.stat_changes).some(entry => STAGE_STAT_KEYS.includes(entry?.stat?.name))) {
        tags.push("Estágios");
    }
    return tags;
};

export const applyMoveConsequences = ({
    tokens,
    attackerId,
    defenderId,
    move,
    resolution,
    random,
}) => {
    const source = asArray(tokens);
    let attacker = source.find(token => token.id === attackerId);
    let defender = source.find(token => token.id === defenderId);
    if (!attacker || !defender || !move || !resolution) {
        return { tokens: source, consequences: { applied: false } };
    }

    attacker = {
        ...attacker,
        pp: normalizePpSlots(attacker.pp),
        stages: normalizeStageMap(attacker.stages),
    };
    defender = {
        ...defender,
        stages: normalizeStageMap(defender.stages),
    };

    const ppState = getMovePpState(attacker, move);
    let ppBefore = ppState.remaining;
    let ppAfter = ppState.remaining;
    if (ppState.index >= 0 && ppState.remaining != null) {
        ppAfter = Math.max(0, ppState.remaining - 1);
        attacker.pp[ppState.index] = ppAfter;
    }

    const calculatedDamage = Math.max(0, asNumber(resolution.damage));
    const hitKill = applyHitKillProtection({
        damage: resolution.hit ? calculatedDamage : 0,
        currentHp: defender.currentHp,
        critical: Boolean(resolution.attackTest?.critical),
        directKnockout: Boolean(resolution.directKnockout || isDirectKnockoutMove(move)),
    });
    const damage = resolution.hit ? hitKill.appliedDamage : 0;
    if (damage > 0) {
        defender.currentHp = clamp(hitKill.remainingHp, 0, Math.max(1, asNumber(defender.maxHp, 1)));
    }

    let healed = 0;
    let recoil = 0;
    const drain = asNumber(move?.meta?.drain);
    if (resolution.hit && damage > 0 && drain > 0) {
        const before = asNumber(attacker.currentHp);
        const requested = hpAmount(damage * drain / 100);
        attacker.currentHp = clamp(
            before + requested,
            0,
            Math.max(1, asNumber(attacker.maxHp, 1)),
        );
        healed = Math.max(0, attacker.currentHp - before);
    } else if (resolution.hit && damage > 0 && drain < 0) {
        const before = asNumber(attacker.currentHp);
        const requested = hpAmount(damage * Math.abs(drain) / 100);
        attacker.currentHp = clamp(
            before - requested,
            0,
            Math.max(1, asNumber(attacker.maxHp, 1)),
        );
        recoil = Math.max(0, before - attacker.currentHp);
    }

    const healing = asNumber(move?.meta?.healing);
    if (resolution.hit && healing > 0) {
        const before = asNumber(attacker.currentHp);
        const directHealing = hpAmount(asNumber(attacker.maxHp, 1) * healing / 100);
        attacker.currentHp = clamp(
            before + directHealing,
            0,
            Math.max(1, asNumber(attacker.maxHp, 1)),
        );
        healed += Math.max(0, attacker.currentHp - before);
    }

    let appliedStatus = "";
    let statusTargetId = "";
    let statusRoll = null;
    const status = statusForMove(move);
    const targetName = normalizeSlug(move?.target?.name);
    const targetsUser = USER_TARGETS.has(targetName) || targetName.startsWith("user");
    const statusTarget = targetsUser ? attacker : defender;
    if (resolution.hit && status && !statusTarget.status) {
        const statusMove = move?.damage_class?.name === "status";
        const chance = moveEffectChance(move, "ailment_chance", statusMove);
        statusRoll = chanceResult(chance, random);
        if (statusRoll.success) {
            appliedStatus = status;
            statusTargetId = statusTarget.id;
            if (targetsUser) attacker.status = status;
            else defender.status = status;
        }
    }

    const supportedChanges = asArray(move?.stat_changes).filter(entry =>
        STAGE_STAT_KEYS.includes(entry?.stat?.name) && asNumber(entry?.change) !== 0
    );
    let stageRoll = null;
    const stageChanges = [];
    if (resolution.hit && supportedChanges.length) {
        const statusMove = move?.damage_class?.name === "status";
        const chance = moveEffectChance(move, "stat_chance", statusMove);
        stageRoll = chanceResult(chance || 100, random);
        if (stageRoll.success) {
            supportedChanges.forEach(entry => {
                const target = targetsUser ? attacker : defender;
                const changed = applyStageChange(target, entry.stat.name, entry.change);
                if (targetsUser) attacker = changed;
                else defender = changed;
                stageChanges.push({
                    tokenId: target.id,
                    stat: entry.stat.name,
                    change: Math.round(asNumber(entry.change)),
                });
            });
        }
    }

    attacker = { ...attacker, declaredMove: "", priority: 0 };
    const nextTokens = source.map(token => {
        if (token.id === attackerId) return attacker;
        if (token.id === defenderId) return defender;
        return token;
    });

    return {
        tokens: nextTokens,
        consequences: {
            applied: true,
            ppBefore,
            ppAfter,
            damage: resolution.hit ? damage : 0,
            calculatedDamage: resolution.hit ? calculatedDamage : 0,
            hitKillThreshold: hitKill.threshold,
            hitKillProtected: hitKill.protectedFromKnockout,
            hitKillBypassed: hitKill.bypassed,
            hpBefore: hitKill.hpBefore,
            healed,
            recoil,
            appliedStatus,
            statusTargetId,
            statusRoll,
            stageChanges,
            stageRoll,
            fainted: defender.currentHp <= 0,
            attackerFainted: attacker.currentHp <= 0,
        },
    };
};

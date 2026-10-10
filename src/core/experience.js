import { calculateStat, convertToTTRPG } from "./mechanics.js";
import { finiteNumberOrNull, integerInRange, MAX_SAFE_GAME_INTEGER } from "./math.js";
import { secureRandomId } from "./random.js";

export const EXPERIENCE_AWARD_LIMIT = 32;
export const EV_STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
const AWARD_ID = /^xp_([0-9a-z]{1,11})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const awardTime = id => {
    const match = typeof id === "string" && id.match(AWARD_ID);
    const time = match ? parseInt(match[1], 36) : NaN;
    return Number.isSafeInteger(time) && time >= 0 ? time : null;
};
const compareAwards = (first, second) => (awardTime(first.id) ?? 0) - (awardTime(second.id) ?? 0) || first.id.localeCompare(second.id);
const afterClosedAward = (id, closed) => !closed || compareAwards({ id }, { id: closed }) > 0;

/** A timestamp in the ID lets retired receipts stay retired without an endless ledger. */
export const createExperienceAwardId = (timestamp = Date.now()) => `xp_${integerInRange(timestamp, 0, MAX_SAFE_GAME_INTEGER, Date.now()).toString(36)}_${secureRandomId("")}`;

export const normalizeGrowthData = (value = {}) => {
    const closedAward = awardTime(value.closedAward) != null ? value.closedAward : "";
    const seen = new Set();
    const experienceAwards = (Array.isArray(value.experienceAwards) ? value.experienceAwards : [])
        .filter(entry => entry && awardTime(entry.id) != null && afterClosedAward(entry.id, closedAward) && !seen.has(entry.id) && seen.add(entry.id))
        .map(entry => ({ id: entry.id, xp: integerInRange(entry.xp, 1, 999999, 1),
            levelCap: integerInRange(entry.levelCap, 1, 200, 100), isTTRPG: entry.isTTRPG !== false }))
        .sort(compareAwards);
    const removed = experienceAwards.slice(0, Math.max(0, experienceAwards.length - EXPERIENCE_AWARD_LIMIT));
    return { growthVersion: 1,
        pendingEvs: integerInRange(value.pendingEvs, 0, MAX_SAFE_GAME_INTEGER, 0),
        experienceAwards: experienceAwards.slice(-EXPERIENCE_AWARD_LIMIT),
        closedAward: removed.at(-1)?.id || closedAward,
    };
};

export function getChallengeReward({ baseXp = 1, winnerMaxLevel, opponentMaxLevel, winnerCount, opponentCount, battle = true } = {}) {
    const base = integerInRange(baseXp, 1, 3, 1);
    const winnerLevel = integerInRange(winnerMaxLevel, 1, 200, 1);
    const opponentLevel = integerInRange(opponentMaxLevel, 1, 200, 1);
    const winners = integerInRange(winnerCount, 1, 40, 1);
    const opponents = integerInRange(opponentCount, 1, 40, 1);
    let multiplier = 1, penalties = 0;
    const reasons = [];
    if (battle) {
        if (opponentLevel >= 2 * winnerLevel) { multiplier *= 2; reasons.push("Adversário com pelo menos o dobro do maior nível: ×2."); }
        else if (winnerLevel >= 2 * opponentLevel) { penalties += 1; reasons.push("Vencedor com pelo menos o dobro do maior nível: −1 na base."); }
        if (opponents >= 2 * winners) { multiplier *= 2; reasons.push("Adversário com pelo menos o dobro de Pokémon em batalha: ×2."); }
        else if (winners >= 2 * opponents) { penalties += 1; reasons.push("Vencedor com pelo menos o dobro de Pokémon em batalha: −1 na base."); }
    }
    const adjustedBaseXp = base - penalties;
    const xp = Math.max(1, adjustedBaseXp * multiplier);
    return { baseXp: base, adjustedBaseXp, penalties, multiplier, xp, evs: xp * 2, reasons,
        winnerMaxLevel: winnerLevel, opponentMaxLevel: opponentLevel, winnerCount: winners, opponentCount: opponents };
}

/** An explicit narrator override changes the granted amount, not the RPG's
 * default base/penalty/multiplier arithmetic. EVs always remain 2 per XP. */
export const resolveChallengeAward = (calculated, manualXp = null) => {
    if (manualXp === null) return { ...calculated, source: "automatic" };
    const value = Number(manualXp);
    if (!Number.isSafeInteger(value) || value < 1 || value > 999999) return null;
    return { ...calculated, xp: value, evs: value * 2, source: "manual" };
};

export const getFriendshipScale = raw => Math.floor(integerInRange(raw, 0, 255, 0) / 10);
export const adjustPokemonFriendship = (pokemon, delta) => ({ ...pokemon,
    friendship: integerInRange(integerInRange(pokemon?.friendship, 0, 255, 70) + integerInRange(delta, -255, 255, 0), 0, 255, 70) });

export const getAllocatedEvTotal = pokemon => EV_STAT_KEYS.reduce((sum, key) => sum + integerInRange(pokemon?.evs?.[key], 0, 252, 0), 0);
export const getAvailableEvAmount = (pokemon, stat) => EV_STAT_KEYS.includes(stat)
    ? Math.max(0, Math.min(integerInRange(pokemon?.rpg?.pendingEvs, 0, MAX_SAFE_GAME_INTEGER, 0),
        252 - integerInRange(pokemon?.evs?.[stat], 0, 252, 0), 510 - getAllocatedEvTotal(pokemon))) : 0;

export const allocatePokemonEvs = (pokemon, { stat, amount = 1 } = {}) => {
    const allocated = Math.min(integerInRange(amount, 0, 510, 0), getAvailableEvAmount(pokemon, stat));
    if (!allocated) return pokemon;
    return { ...pokemon, evs: { ...pokemon.evs, [stat]: integerInRange(pokemon.evs?.[stat], 0, 252, 0) + allocated },
        rpg: { ...pokemon.rpg, ...normalizeGrowthData(pokemon.rpg), pendingEvs: pokemon.rpg.pendingEvs - allocated } };
};

export function applyPokemonExperienceAward(pokemon, { xp = 1, awardId, isTTRPG = true, levelCap = 100 } = {}) {
    if (!pokemon || typeof pokemon !== "object") return pokemon;
    if (awardTime(awardId) == null) throw new RangeError("Esta recompensa precisa de um identificador válido.");
    const growth = normalizeGrowthData(pokemon.rpg);
    if (!afterClosedAward(awardId, growth.closedAward) || growth.experienceAwards.some(entry => entry.id === awardId)) return pokemon;
    const acquired = finiteNumberOrNull(xp);
    if (!Number.isSafeInteger(acquired) || acquired < 1 || acquired > 999999) throw new RangeError("A recompensa de XP precisa ser um número inteiro positivo.");
    const cap = integerInRange(levelCap, 1, 200, 100);
    const currentLevel = integerInRange(pokemon.level, 1, 200, 1);
    const nextXp = integerInRange(integerInRange(pokemon.rpg?.xp, 0, 999999, 0) + acquired, 0, 999999, 0);
    const nextLevel = currentLevel < cap && nextXp >= Math.floor((currentLevel + 1) / 2) ? currentLevel + 1 : currentLevel;
    const nextGrowth = normalizeGrowthData({ ...growth,
        pendingEvs: integerInRange(growth.pendingEvs + acquired * 2, 0, MAX_SAFE_GAME_INTEGER, 0),
        experienceAwards: [...growth.experienceAwards, { id: awardId, xp: acquired, levelCap: cap, isTTRPG }],
    });
    let currentHp = pokemon.rpg?.currentHp ?? null;
    const hpBase = finiteNumberOrNull(pokemon.customStats?.hp)
        ?? finiteNumberOrNull(pokemon.species?.stats?.find(entry => entry?.stat?.name === "hp")?.base_stat);
    if (nextLevel !== currentLevel && currentHp != null && hpBase != null) {
        const maxAt = level => {
            const raw = calculateStat(hpBase, pokemon.evs?.hp ?? 0, pokemon.ivs?.hp ?? 31, level, 1, true, pokemon.species?.name);
            return isTTRPG ? convertToTTRPG(raw, true) : raw;
        };
        const before = maxAt(currentLevel), after = maxAt(nextLevel);
        const previousHp = integerInRange(currentHp, 0, before, before);
        currentHp = previousHp === 0 ? 0 : Math.min(after, previousHp + Math.max(0, after - before));
    }
    return { ...pokemon, level: nextLevel, rpg: { ...pokemon.rpg, ...nextGrowth,
        xp: nextLevel > currentLevel ? 0 : nextXp, currentHp } };
}

const growthFree = pokemon => {
    const rpg = { ...pokemon?.rpg };
    ["xp", "currentHp", "growthVersion", "pendingEvs", "experienceAwards", "closedAward"].forEach(key => delete rpg[key]);
    return { ...pokemon, level: 0, rpg };
};
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const equal = (first, second) => JSON.stringify(stable(first)) === JSON.stringify(stable(second));

/** Only concurrent reward changes are combined; unrelated edits keep the existing recovery flow. */
export function mergePokemonExperienceAwards(left, right, baseline) {
    if (!left || !right || !baseline || !equal(growthFree(left), growthFree(baseline)) || !equal(growthFree(right), growthFree(baseline))) return null;
    const baseGrowth = normalizeGrowthData(baseline.rpg);
    const known = new Set(baseGrowth.experienceAwards.map(entry => entry.id));
    const extras = partner => normalizeGrowthData(partner.rpg).experienceAwards.filter(entry => !known.has(entry.id) && afterClosedAward(entry.id, baseGrowth.closedAward));
    const replay = entries => entries.reduce((partner, entry) => applyPokemonExperienceAward(partner,
        { xp: entry.xp, awardId: entry.id, isTTRPG: entry.isTTRPG, levelCap: entry.levelCap }), baseline);
    const first = extras(left), second = extras(right);
    if (!equal(replay(first), left) || !equal(replay(second), right)) return null;
    const union = new Map([...first, ...second].map(entry => [entry.id, entry]));
    for (const entry of first) {
        if (second.some(other => other.id === entry.id && !equal(other, entry))) return null;
    }
    return replay([...union.values()].sort(compareAwards));
}

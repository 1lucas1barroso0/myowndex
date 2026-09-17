import { integerInRange } from "./math.js";
import { randomInt } from "./random.js";
import { rollPercentTest } from "./rpgRules.js";

// Modern condition timing, explicitly adapted to the RPG's damage scale.
export const SELF_THAW_MOVES = new Set(["flame-wheel", "sacred-fire", "flare-blitz", "fusion-flare", "scald", "steam-eruption", "burn-up", "pyro-ball", "scorching-sands", "matcha-gotcha"]);
export const THAW_TARGET_MOVES = new Set(["scald", "steam-eruption", "scorching-sands", "matcha-gotcha"]);
export const sleepDuration = (random, ability = "", rest = false) => {
    const turns = rest ? 2 : 1 + randomInt(3, random);
    return ability === "early-bird" ? Math.floor(turns / 2) : turns;
};

export const checkActionConditions = ({ token, move, ability = "", random } = {}) => {
    let next = { ...token, volatileEffects: [...(token.volatileEffects || [])] };
    const notes = [], rolls = [];
    const finish = (canAct, selfDamage = 0) => ({ token: next, canAct, selfDamage, notes, rolls });
    if (next.currentHp <= 0 || next.captured) { notes.push("Este Pokémon não está disponível para agir."); return finish(false); }
    const percent = (kind, chance) => {
        const test = rollPercentTest({ chance, random });
        rolls.push({ kind, ...test });
        return test.success;
    };
    // Sleep/freeze are checked before flinch and confusion, only once per action.
    if (next.status === "sleep") {
        const turns = next.sleepTurns == null ? sleepDuration(random, ability) : integerInRange(next.sleepTurns, 0, 3, 0);
        if (turns === 0) {
            next = { ...next, status: "", sleepTurns: null };
            notes.push("Acordou antes de agir.");
            if (["snore", "sleep-talk"].includes(move?.name)) { notes.push("O movimento escolhido exige sono."); return finish(false); }
        } else {
            next.sleepTurns = turns - 1;
            notes.push("Ainda está dormindo.");
            if (!["snore", "sleep-talk"].includes(move?.name)) return finish(false);
        }
    }
    if (next.status === "freeze") {
        const selfThaw = SELF_THAW_MOVES.has(move?.name) && (move?.name !== "burn-up" || next.types?.includes("fire"));
        if (selfThaw || percent("thaw", 20)) {
            next.status = "";
            notes.push("Descongelou e pode agir.");
        } else { notes.push("O congelamento impediu a ação."); return finish(false); }
    }
    if (next.volatileEffects.some(effect => effect.id === "flinch")) {
        next.volatileEffects = next.volatileEffects.filter(effect => effect.id !== "flinch");
        if (ability !== "inner-focus") { notes.push("Hesitou e perdeu a ação."); return finish(false); }
    }
    const confusion = next.volatileEffects.find(effect => effect.id === "confusion");
    if (confusion) {
        const turns = confusion.turns == null ? 1 + randomInt(4, random) : integerInRange(confusion.turns, 0, 4, 0);
        next.volatileEffects = next.volatileEffects.filter(effect => effect.id !== "confusion");
        if (turns > 0 && ability !== "own-tempo") {
            const remainingTurns = turns - 1;
            if (remainingTurns > 0) next.volatileEffects.push({ ...confusion, turns: remainingTurns });
            if (percent("confusion", 33)) {
                const damage = Math.min(next.currentHp, 2); // 40 / 20, no STAB, crit, contest or type.
                next.currentHp -= damage;
                notes.push(`A confusão impediu a ação e causou ${damage} HP de dano ao próprio Pokémon.`);
                return finish(false, damage);
            }
        } else notes.push("A confusão terminou.");
    }
    if (next.status === "paralysis" && percent("paralysis", 25)) {
        notes.push("A paralisia impediu a ação.");
        return finish(false);
    }
    return finish(true);
};

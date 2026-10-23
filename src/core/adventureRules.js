import { integerInRange } from "./math.js";

export const getRestBlockReason = (token, snapshot = null) => {
    if (!token) return "Escolha um Pokémon para descansar.";
    if (snapshot && (snapshot.phase !== "intervalo" || snapshot.initiative?.length)) return "Descanse no intervalo, depois de concluir a rodada.";
    if (snapshot?.battleStarted && !snapshot.battleEnded) return "Encerre a batalha antes de descansar.";
    if (token.gimmickState?.active || token.specialState?.transform) return "Encerre a transformação antes de descansar.";
    if (token.specialState?.moveOverrides?.some(entry => !entry.permanent)) return "Encerre a cópia temporária de movimentos antes de descansar.";
    return "";
};

/** Narrator confirms safety and elapsed time; scene callers also pass its state. */
export const restPokemon = (token, kind = "short", snapshot = null) => {
    const blocked = getRestBlockReason(token, snapshot);
    if (blocked) throw new RangeError(blocked);
    if (kind === "short") {
        if (token.currentHp <= 0 || token.shortRestUsed) return token;
        return { ...token, currentHp: Math.min(token.maxHp, token.currentHp + Math.max(1, Math.floor(token.maxHp / 4))), shortRestUsed: true };
    }
    if (kind !== "full") throw new RangeError("Escolha descanso curto ou completo.");
    return { ...token, currentHp: token.maxHp, pp: [null, null, null, null], status: "", sleepTurns: null,
        freezeTurns: null, toxicCounter: 0, volatileEffects: [], shortRestUsed: false };
};

/** Group results are resolved once; essential roles cannot be bypassed by
 * adding unrelated people. Risk advances one shared clock, never one per fail. */
export const resolveGroupOutcome = participants => {
    if (!Array.isArray(participants) || !participants.length || participants.length > 40
        || participants.some(entry => typeof entry?.success !== "boolean")) throw new RangeError("Registre os resultados dos participantes.");
    const failures = participants.filter(entry => !entry.success).length;
    return { success: participants.some(entry => entry.success) && participants.every(entry => !entry.essential || entry.success),
        failures, riskSteps: failures === 0 ? 0 : failures * 2 >= participants.length ? 2 : 1 };
};

export const advanceChase = (state, success) => {
    if (typeof success !== "boolean") throw new RangeError("Resolva a disputa antes de avançar a perseguição.");
    const escape = integerInRange(state?.escape, 0, 3, 0), danger = integerInRange(state?.danger, 0, 3, 0);
    if (escape === 3 || danger === 3) return { escape, danger };
    return { escape: Math.min(3, escape + Number(success)), danger: Math.min(3, danger + Number(!success)) };
};

import { normalizeStageMap, stageMultiplier } from "./automation.js";
import { applyDirectionalIntegerModifier, finiteNumberOrNull, integerInRange } from "./math.js";
import { rollProportionalAttributeTest } from "./rpgRules.js";
import { getInitiativeTraitState, isWeatherSuppressed } from "./traitMechanics.js";
import { normalizeRoomSnapshot } from "./room.js";
import { RPG_SCALE_DIVISOR } from "./mechanics.js";

export const LOCAL_DICE_ROOM_KEY = "myowndex_local_dice_room_v1";
export const LOCAL_DICE_TOKEN_LIMIT = 24;
const pendingFieldWriters = new Set();
export const registerLocalPokemonDiceWrites = flush => {
    if (typeof flush !== "function") throw new TypeError("Use uma função para concluir as jogadas locais.");
    pendingFieldWriters.add(flush);
    return () => pendingFieldWriters.delete(flush);
};
export const flushLocalPokemonDiceWrites = async () => {
    const results = await Promise.all([...pendingFieldWriters].map(flush => Promise.resolve().then(flush).catch(() => false)));
    return results.every(result => result !== false);
};
export const LOCAL_OPPOSED_STATS = Object.freeze({
    attack: "Ataque", defense: "Defesa", "special-attack": "Atq. Esp.",
    "special-defense": "Def. Esp.", speed: "Velocidade",
});

/** A single bounded practice field; Box partners are never overwritten by a test. */
export const normalizeLocalDiceRoom = value => {
    const snapshot = normalizeRoomSnapshot(value);
    const tokens = snapshot.tokens.slice(0, LOCAL_DICE_TOKEN_LIMIT);
    const tokenIds = new Set(tokens.map(token => token.id));
    return { ...snapshot, tokens, benchTokens: snapshot.benchTokens.slice(0, LOCAL_DICE_TOKEN_LIMIT - tokens.length),
        initiative: snapshot.initiative.filter(id => tokenIds.has(id)),
        gmNotes: "", sceneNotes: String(snapshot.sceneNotes || "").slice(0, 1200),
        audio: { ...snapshot.audio, trackId: null, title: "", playing: false },
    };
};

/** The same original stats and stage conventions used by the battle engine.
 * Multiplication remains internal; callers show the dice and the winner. */
export const localOpposedAttribute = (token, stat, snapshot) => {
    if (!Object.hasOwn(LOCAL_OPPOSED_STATS, stat)) throw new RangeError("Escolha um atributo da ficha.");
    const original = finiteNumberOrNull(token?.originalStats?.[stat]);
    const staged = original !== null
        ? Math.max(1, Math.floor(original * stageMultiplier(normalizeStageMap(token?.stages)[stat])))
        : integerInRange(token?.stats?.[stat], 1, 99999, 1) * RPG_SCALE_DIVISOR;
    if (stat !== "speed") return integerInRange(staged, 1, 99999, 1);
    const weather = isWeatherSuppressed(snapshot?.tokens) ? "limpo" : snapshot?.weather;
    return applyDirectionalIntegerModifier(staged, getInitiativeTraitState(token, { weather, round: snapshot?.round }).multiplier, { minimum: 1, maximum: 99999 });
};

export const rollLocalPokemonOpposition = ({ snapshot, attackerId, defenderId, attackerStat = "attack", defenderStat = "defense", mode = "normal", random }) => {
    const attacker = snapshot?.tokens?.find(token => token.id === attackerId);
    const defender = snapshot?.tokens?.find(token => token.id === defenderId);
    if (!attacker || !defender || attacker.id === defender.id || [attacker,defender].some(token=>token.currentHp<=0 || token.hidden || token.captured)) throw new RangeError("Escolha dois Pokémon diferentes e ativos para a disputa.");
    if (!["normal","advantage","disadvantage"].includes(mode)) throw new RangeError("Escolha uma situação válida para a disputa.");
    // All input validation precedes entropy; a failed selection creates no roll.
    const attackAttribute = localOpposedAttribute(attacker, attackerStat, snapshot);
    const defenseAttribute = localOpposedAttribute(defender, defenderStat, snapshot);
    const attack = rollProportionalAttributeTest({ attribute: attackAttribute, mode, random });
    const defense = rollProportionalAttributeTest({ attribute: defenseAttribute, mode: "normal", random });
    const success = attack.total > defense.total;
    return { attack, defense, success, winner: success ? attacker.name : defender.name, attackerName: attacker.name, defenderName: defender.name,
        detail: `${success ? attacker.name : defender.name} venceu a disputa.${attack.total === defense.total ? " Empate: a oposição prevalece." : ""}`,
    };
};

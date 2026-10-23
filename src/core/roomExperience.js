import { calculateStagedStats } from "./automation.js";
import { applyPokemonExperienceAward, normalizeGrowthData } from "./experience.js";
import { createTokenFromPokemon, getLinkedBoxPokemon, normalizeRoomSnapshot, hasNewerBoxEdit } from "./room.js";
import { activateTeraShift, restoreTeraShift } from "./battleGimmicks.js";

export const getRoomExperienceBlockReason = (snapshot, tokenId, teams = []) => {
    if (snapshot.phase === "batalha" || snapshot.initiative?.length) return "Registre a XP no intervalo depois da batalha.";
    if (snapshot.battleStarted && !snapshot.battleEnded) return "Encerre a batalha antes de registrar XP.";
    const token = snapshot.tokens.find(entry => entry.id === tokenId);
    if (!token) return "Este Pokémon não está mais na cena.";
    if (token.gimmickState?.active || token.specialState?.transform) return "Encerre a transformação antes de registrar XP.";
    if (hasNewerBoxEdit(teams, token)) return "Atualize a ficha do PC na cena antes de registrar XP.";
    return "";
};

/** Scene rewards share the Box engine; only explicit progress writes change Boxes. */
export function awardRoomPokemonExperience(snapshot, tokenId, reward, teams = []) {
    const room = normalizeRoomSnapshot(snapshot);
    const blocked = getRoomExperienceBlockReason(room, tokenId, teams);
    if (blocked) throw new RangeError(blocked);
    const token = room.tokens.find(entry => entry.id === tokenId);
    const { team, pokemon: source } = getLinkedBoxPokemon(teams, token) || {};
    const pokemon = { ...(source || {}), level: token.level, evs: token.evs, ivs: token.ivs,
        friendship: token.friendship, rpg: { ...source?.rpg, ...normalizeGrowthData(token), xp: token.xp, currentHp: token.currentHp } };
    const awarded = applyPokemonExperienceAward(pokemon, { ...reward, isTTRPG: true, levelCap: reward.levelCap ?? 100 });
    if (awarded === pokemon) return room;
    if (!source && awarded.level !== token.level) throw new RangeError("Traga a Box deste Pokémon ao PC antes de subir de nível, para atualizar os atributos corretamente.");
    let updated = { ...token, level: awarded.level, xp: awarded.rpg.xp, ...normalizeGrowthData(awarded.rpg) };
    if (source && awarded.level !== token.level) {
        const reference = createTokenFromPokemon(awarded, team, 0, token.side);
        const ownForm = restoreTeraShift(token);
        updated = { ...updated, maxHp: reference.maxHp,
            currentHp: ownForm.currentHp === 0 ? 0 : Math.min(reference.maxHp, ownForm.currentHp + Math.max(0, reference.maxHp - ownForm.maxHp)),
            originalStats: reference.originalStats, stats: reference.stats };
        if (token.teraShiftBase) {
            const identity = ["speciesId", "speciesName", "formName", "sprite", "ability", "types", "originalTypes"];
            updated = activateTeraShift({ ...updated,
                ...Object.fromEntries(identity.map(key => [key, reference[key]])), teraShiftBase: null });
        }
        updated.stats = calculateStagedStats(updated);
    }
    return normalizeRoomSnapshot({ ...room, tokens: room.tokens.map(entry => entry.id === tokenId ? updated : entry) });
}

export function getRoomBattleRewardContext(snapshot, tokenId) {
    const token = snapshot.tokens.find(entry => entry.id === tokenId);
    if (!token || token.side === "neutral") return null;
    const participants = [...snapshot.tokens.filter(entry => entry.battleParticipated || !entry.hidden), ...(snapshot.benchTokens || []).filter(entry => entry.battleParticipated || entry.activeMoveActions > 0)].filter(entry => entry.side !== "neutral");
    const winners = participants.filter(entry => entry.side === token.side);
    const opponents = participants.filter(entry => entry.side !== token.side);
    if (!winners.length || !opponents.length) return null;
    return { winnerMaxLevel: Math.max(...winners.map(entry => entry.battleEntryLevel || entry.level)), opponentMaxLevel: Math.max(...opponents.map(entry => entry.battleEntryLevel || entry.level)), winnerCount: winners.length, opponentCount: opponents.length };
}

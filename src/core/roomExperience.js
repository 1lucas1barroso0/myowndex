import { calculateStagedStats } from "./automation.js";
import { applyPokemonExperienceAward, normalizeGrowthData } from "./experience.js";
import { createTokenFromPokemon, normalizeRoomSnapshot } from "./room.js";

/** Scene rewards share the Box engine; only explicit progress writes change Boxes. */
export function awardRoomPokemonExperience(snapshot, tokenId, reward, teams = []) {
    const room = normalizeRoomSnapshot(snapshot);
    const token = room.tokens.find(entry => entry.id === tokenId);
    if (!token) throw new RangeError("Este Pokémon não está mais na cena.");
    const team = teams.find(entry => entry.id === token.teamId);
    const source = team?.pokemon.find(entry => entry.id === token.pokemonId);
    const pokemon = { ...(source || {}), level: token.level, evs: token.evs, ivs: token.ivs,
        friendship: token.friendship, rpg: { ...source?.rpg, ...normalizeGrowthData(token), xp: token.xp, currentHp: token.currentHp } };
    const awarded = applyPokemonExperienceAward(pokemon, { ...reward, isTTRPG: true, levelCap: 200 });
    if (awarded === pokemon) return room;
    let updated = { ...token, level: awarded.level, xp: awarded.rpg.xp, ...normalizeGrowthData(awarded.rpg) };
    if (source && awarded.level !== token.level) {
        const reference = createTokenFromPokemon(awarded, team, 0, token.side);
        updated = { ...updated, maxHp: reference.maxHp,
            currentHp: token.currentHp === 0 ? 0 : Math.min(reference.maxHp, token.currentHp + Math.max(0, reference.maxHp - token.maxHp)),
            originalStats: reference.originalStats, stats: reference.stats };
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

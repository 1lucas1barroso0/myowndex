import assert from "node:assert/strict";
import test from "node:test";
import { awardRoomPokemonExperience, getRoomBattleRewardContext } from "../src/core/roomExperience.js";
import { createExperienceAwardId } from "../src/core/experience.js";
import { createTokenFromPokemon, createRoomSnapshot, normalizeRoomSnapshot, syncTeamsWithRoomProgress } from "../src/core/room.js";
import { normalizeTeam } from "../src/core/team.js";

const stats = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

const partner = { id: "pokemon-a", nickname: "Buba", level: 10, nature: "hardy", friendship: 75,
    evs: Object.fromEntries(stats.map(stat => [stat, 0])), ivs: Object.fromEntries(stats.map(stat => [stat, 31])), moves: ["tackle"],
    species: { id: 1, name: "bulbasaur", stats: ["hp", "attack", "defense", "special-attack", "special-defense", "speed"].map(name => ({ stat: { name }, base_stat: 50 })), types: [{ type: { name: "grass" } }], sprites: {} },
    rpg: { xp: 4, currentHp: 0, pp: [35], status: "burn" } };
const box = normalizeTeam({ id: "box-a", name: "Equipe", pokemon: [partner] });
const token = { ...createTokenFromPokemon(box.pokemon[0], box), id: "actor", battleParticipated: true, battleEntryLevel: 10 };
const scene = () => normalizeRoomSnapshot({ ...createRoomSnapshot("Teste"), phase: "batalha", tokens: [token], initiative: ["actor"] });

test("scene rewards preserve fainting, conditions and the round while earning EVs once", () => {
    const before = scene();
    const reward = { xp: 8, awardId: createExperienceAwardId() };
    const after = awardRoomPokemonExperience(before, "actor", reward, [box]);
    assert.equal(after.tokens[0].level, 11);
    assert.equal(after.tokens[0].xp, 0);
    assert.equal(after.tokens[0].pendingEvs, 16);
    assert.equal(after.tokens[0].currentHp, 0);
    assert.equal(after.tokens[0].status, "burn");
    assert.equal(after.tokens[0].friendship, 75);
    assert.deepEqual(after.initiative, before.initiative);
    assert.deepEqual(awardRoomPokemonExperience(after, "actor", reward, [box]), after);
    assert.equal(box.pokemon[0].rpg.xp, 4, "awarding scene progress does not mutate the source Box");
    const saved = syncTeamsWithRoomProgress([box], after)[0].pokemon[0];
    assert.equal(saved.rpg.pendingEvs, 16);
    assert.equal(saved.rpg.experienceAwards.length, 1);
});

test("reward context includes participants who left and keeps their battle entry levels", () => {
    const base = scene();
    const snapshot = normalizeRoomSnapshot({ ...base, tokens: [{ ...token, level: 11 }, { ...token, id: "enemy", side: "opponent", level: 20, battleEntryLevel: 20, captured: true, hidden: true }],
        benchTokens: [{ ...token, id: "swapped", level: 8, battleEntryLevel: 8 }, { ...token, id: "unfought", level: 100, battleEntryLevel: 0, battleParticipated: false, activeMoveActions: 0 }] });
    assert.deepEqual(getRoomBattleRewardContext(snapshot, "actor"), { winnerMaxLevel: 10, opponentMaxLevel: 20, winnerCount: 2, opponentCount: 1 });
    assert.equal(getRoomBattleRewardContext({ ...snapshot, tokens: snapshot.tokens.map(entry => ({ ...entry, side: "neutral" })) }, "actor"), null);
});

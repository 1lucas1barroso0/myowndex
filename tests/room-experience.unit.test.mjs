import assert from "node:assert/strict";
import test from "node:test";
import { awardRoomPokemonExperience, getRoomBattleRewardContext, getRoomExperienceBlockReason } from "../src/core/roomExperience.js";
import { createExperienceAwardId } from "../src/core/experience.js";
import { createTokenFromPokemon, createRoomSnapshot, endRoomBattle, normalizeRoomSnapshot, syncTeamsWithRoomProgress } from "../src/core/room.js";
import { normalizeTeam } from "../src/core/team.js";
import { transformBattleToken } from "../src/core/specialMechanics.js";

const stats = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

const partner = { id: "pokemon-a", nickname: "Buba", level: 10, nature: "hardy", friendship: 75,
    evs: Object.fromEntries(stats.map(stat => [stat, 0])), ivs: Object.fromEntries(stats.map(stat => [stat, 31])), moves: ["tackle"],
    species: { id: 1, name: "bulbasaur", stats: ["hp", "attack", "defense", "special-attack", "special-defense", "speed"].map(name => ({ stat: { name }, base_stat: 50 })), types: [{ type: { name: "grass" } }], sprites: {} },
    rpg: { xp: 4, currentHp: 0, pp: [35], status: "burn" } };
const box = normalizeTeam({ id: "box-a", name: "Equipe", pokemon: [partner] });
const token = { ...createTokenFromPokemon(box.pokemon[0], box), id: "actor", battleParticipated: true, battleEntryLevel: 10 };
const scene = () => normalizeRoomSnapshot({ ...createRoomSnapshot("Teste"), phase: "batalha", tokens: [token], initiative: ["actor"] });

test("scene rewards preserve fainting, conditions and the round while earning EVs once", () => {
    assert.throws(()=>awardRoomPokemonExperience(scene(),"actor",{xp:8,awardId:createExperienceAwardId()},[box]),/intervalo/);
    const before = endRoomBattle({ ...scene(), initiative: [] });
    const reward = { xp: 8, awardId: createExperienceAwardId() };
    const after = awardRoomPokemonExperience(before, "actor", reward, [box]);
    assert.equal(after.tokens[0].level, 12);
    assert.equal(after.tokens[0].xp, 1);
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

test("a shared Box with another local ID still recalculates every level-up attribute", () => {
    const before = endRoomBattle({ ...scene(), initiative: [] });
    const reward = { xp: 18, awardId: createExperienceAwardId() };
    const expected = awardRoomPokemonExperience(before, "actor", reward, [box]);
    const importedBox = { ...box, id: "another-device-box", shareId: box.shareId };
    const actual = awardRoomPokemonExperience(before, "actor", reward, [importedBox]);
    assert.deepEqual(actual, expected);
    assert.notDeepEqual(actual.tokens[0].originalStats, before.tokens[0].originalStats);
    assert.equal(actual.tokens[0].currentHp, 0);
});

test("a missing source Box cannot silently advance a level with obsolete stats", () => {
    const before = endRoomBattle({ ...scene(), initiative: [] });
    const frozen = JSON.stringify(before);
    assert.throws(() => awardRoomPokemonExperience(before, "actor", { xp: 8, awardId: createExperienceAwardId() }), /Traga a Box/);
    assert.equal(JSON.stringify(before), frozen);
});

test("Transform blocks scene XP until the real identity returns", () => {
    const copied = transformBattleToken({ ...token, currentHp: 1 }, { ...token, currentHp: 1, id: "target", speciesName: "pikachu", speciesId: 25 });
    assert.equal(copied.applied, true);
    const before = normalizeRoomSnapshot({ ...scene(), phase: "intervalo", initiative: [], battleEnded: true, tokens: [copied.token] });
    assert.match(getRoomExperienceBlockReason(before, "actor", [box]), /transformação/);
    assert.throws(() => awardRoomPokemonExperience(before, "actor", { xp: 8, awardId: createExperienceAwardId() }, [box]), /transformação/);
    assert.equal(before.tokens[0].level, token.level);
});

test("changing to interval alone does not release rewards before the confrontation ends", () => {
    const active = { ...scene(), phase: "intervalo", initiative: [], battleStarted: true };
    const reward = { xp: 8, awardId: createExperienceAwardId() };
    assert.match(getRoomExperienceBlockReason(active, "actor", [box]), /Encerre a batalha/);
    assert.throws(() => awardRoomPokemonExperience(active, "actor", reward, [box]), /Encerre a batalha/);
    const after = awardRoomPokemonExperience(endRoomBattle(active), "actor", reward, [box]);
    assert.equal(after.tokens[0].level, 12);
    assert.equal(after.tokens[0].currentHp, 0);
    assert.equal(after.tokens[0].status, "burn");
});

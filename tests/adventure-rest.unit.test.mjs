import test from "node:test";
import assert from "node:assert/strict";
import { getRestBlockReason, restPokemon } from "../src/core/adventureRules.js";
import { createRoomSnapshot, endRoomBattle, normalizeRoomToken } from "../src/core/room.js";
import { transformBattleToken } from "../src/core/specialMechanics.js";

const partner = () => normalizeRoomToken({ id: "partner", speciesName: "ditto", speciesId: 132,
    maxHp: 8, currentHp: 3, moves: ["transform"], pp: [4], status: "burn" });

test("a phase change cannot provide a mid-battle rest or erase the rolled order", () => {
    const token = partner();
    const active = { ...createRoomSnapshot(), phase: "intervalo", battleStarted: true, tokens: [token], initiative: [token.id] };
    assert.match(getRestBlockReason(token, active), /rodada/);
    assert.throws(() => restPokemon(token, "full", active), /rodada/);
    const betweenRounds = { ...active, initiative: [] };
    assert.match(getRestBlockReason(token, betweenRounds), /Encerre a batalha/);
    assert.throws(() => restPokemon(token, "short", betweenRounds), /Encerre a batalha/);
    const ended = endRoomBattle(betweenRounds);
    const rested = restPokemon(ended.tokens[0], "full", ended);
    assert.equal(rested.currentHp, 8); assert.equal(rested.status, "");
    assert.deepEqual(rested.pp, [null, null, null, null]);
    assert.equal(token.currentHp, 3); assert.equal(token.pp[0], 4);
});

test("rest cannot refill copied PP or persist another Pokémon's temporary identity", () => {
    const token = partner();
    const copied = transformBattleToken(token, { ...token, id: "foe", speciesName: "pikachu", speciesId: 25, moves: ["tackle"], pp: [15] });
    assert.equal(copied.applied, true);
    assert.match(getRestBlockReason(copied.token), /transformação/);
    for (const kind of ["short", "full"]) assert.throws(() => restPokemon(copied.token, kind), /transformação/);
    const mimicked = { ...token, specialState: { ...token.specialState, moveOverrides: [{ slot: 0, permanent: false }] } };
    assert.match(getRestBlockReason(mimicked), /cópia temporária/);
    assert.throws(() => restPokemon(mimicked, "full"), /cópia temporária/);
    const sketched = { ...mimicked, specialState: { ...mimicked.specialState, moveOverrides: [{ slot: 0, permanent: true }] } };
    assert.equal(getRestBlockReason(sketched), "");
    assert.equal(restPokemon(sketched, "full").currentHp, 8);
});

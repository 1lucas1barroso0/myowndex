import assert from "node:assert/strict";
import test from "node:test";
import { applyPokemonExperienceAward, createExperienceAwardId, normalizeGrowthData,
    allocatePokemonEvs, getAllocatedEvTotal, getChallengeReward, getFriendshipScale,
    adjustPokemonFriendship, EXPERIENCE_AWARD_LIMIT } from "../src/core/experience.js";
import { normalizePokemon, compactPokemon } from "../src/core/team.js";
import { normalizeAccountDocument, mergeAccountDocuments, recordAccountChanges } from "../src/core/accountDocument.js";
import { decodeShare, encodePokemonBundle, encodeTeam } from "../src/core/teamShare.js";
import { addTeamToSnapshot, changeRoomPhase, createRoomSnapshot, createTokenFromPokemon, normalizeRoomSnapshot,
    swapTeamPokemonInSnapshot, syncTeamsWithRoomProgress } from "../src/core/room.js";

const partner = () => normalizePokemon({ id: "pokemon", species: { id: 25, name: "pikachu",
    stats: [{ base_stat: 35, stat: { name: "hp" } }] }, level: 10, friendship: 255,
    rpg: { scaleVersion: 2, xp: 0, currentHp: 3 }, evs: {} });
const award = (pokemon, xp, timestamp) => applyPokemonExperienceAward(pokemon, { xp, awardId: createExperienceAwardId(timestamp) });

test("challenge XP uses inclusive level and count thresholds, independently and together", () => {
    for (const baseXp of [1, 2, 3]) {
        const common = { baseXp, winnerMaxLevel: 10, opponentMaxLevel: 19, winnerCount: 2, opponentCount: 3 };
        assert.equal(getChallengeReward(common).xp, baseXp);
        assert.equal(getChallengeReward({ ...common, opponentMaxLevel: 20 }).xp, baseXp * 2);
        assert.equal(getChallengeReward({ ...common, opponentCount: 4 }).xp, baseXp * 2);
        const both = getChallengeReward({ ...common, opponentMaxLevel: 20, opponentCount: 4 });
        assert.equal(both.xp, baseXp * 4);
        assert.equal(both.evs, both.xp * 2);
        assert.equal(both.reasons.length, 2);
        assert.equal(getChallengeReward({ ...common, opponentMaxLevel: 200, opponentCount: 40, battle: false }).xp, baseXp);
    }
});

test("winner advantages reduce the base before mixed multipliers with a final minimum of one", () => {
    const common = { baseXp: 3, winnerMaxLevel: 20, opponentMaxLevel: 10, winnerCount: 4, opponentCount: 2 };
    assert.deepEqual([getChallengeReward(common).xp, getChallengeReward(common).multiplier, getChallengeReward(common).penalties], [1, 1, 2]);
    const mixed = getChallengeReward({ ...common, winnerCount: 1, opponentCount: 2 });
    assert.deepEqual([mixed.adjustedBaseXp, mixed.multiplier, mixed.xp, mixed.evs], [2, 2, 4, 8]);
    const minimum = getChallengeReward({ ...common, baseXp: 1, winnerCount: 1, opponentCount: 2 });
    assert.deepEqual([minimum.adjustedBaseXp, minimum.multiplier, minimum.xp], [0, 2, 1]);
});

test("each integer acquisition grants double EVs once, including when a level resets XP", () => {
    const pokemon = { ...partner(), rpg: { ...partner().rpg, xp: 4 } };
    const awardId = createExperienceAwardId(100);
    const updated = applyPokemonExperienceAward(pokemon, { xp: 1, awardId });
    assert.equal(updated.level, 11);
    assert.equal(updated.rpg.xp, 0);
    assert.equal(updated.rpg.pendingEvs, 2);
    assert.equal(updated.friendship, 255);
    assert.equal(applyPokemonExperienceAward(updated, { xp: 1, awardId }), updated);
    assert.equal(pokemon.rpg.pendingEvs, 0, "awarding must not mutate the original");
    const large = award(partner(), 12, 101);
    assert.equal(large.level, 11, "one acquisition keeps the existing one-level reset rule");
    assert.equal(large.rpg.xp, 0);
    assert.equal(large.rpg.pendingEvs, 24);
    const aboveCap = applyPokemonExperienceAward({ ...partner(), level: 150 }, { xp: 1, awardId: createExperienceAwardId(103), levelCap: 100 });
    assert.equal(aboveCap.level, 150, "an existing free-mode level must never be reduced by an award");
    assert.equal(aboveCap.rpg.pendingEvs, 2);
    const fainted = applyPokemonExperienceAward({ ...partner(), customStats: { hp: 255 },
        rpg: { ...partner().rpg, xp: 4, currentHp: 0, status: "burn" } }, { xp: 1, awardId: createExperienceAwardId(104) });
    assert.equal(fainted.level, 11);
    assert.equal(fainted.rpg.currentHp, 0, "a level increase must not revive a fainted Pokémon");
    assert.equal(fainted.rpg.status, "burn");
    assert.equal(fainted.friendship, 255);
    assert.throws(() => award(partner(), 1.5, 102), /inteiro/);
});

test("retired receipts remain idempotent while award storage stays bounded", () => {
    let pokemon = partner();
    const firstId = createExperienceAwardId(1000);
    pokemon = applyPokemonExperienceAward(pokemon, { xp: 1, awardId: firstId });
    for (let index = 1; index <= EXPERIENCE_AWARD_LIMIT + 5; index++) pokemon = award(pokemon, 1, 1000 + index);
    assert.equal(pokemon.rpg.experienceAwards.length, EXPERIENCE_AWARD_LIMIT);
    assert.ok(pokemon.rpg.closedAward);
    assert.equal(applyPokemonExperienceAward(pokemon, { xp: 1, awardId: firstId }), pokemon);
    assert.equal(pokemon.rpg.pendingEvs, (EXPERIENCE_AWARD_LIMIT + 6) * 2);
    assert.deepEqual(normalizeGrowthData(pokemon.rpg), normalizeGrowthData(compactPokemon(pokemon).rpg));
});

test("individual and Box exports retain pending EVs and receipt idempotency", async () => {
    const awardId = createExperienceAwardId(1200);
    const pokemon = applyPokemonExperienceAward(partner(), { xp: 3, awardId });
    for (const code of [await encodeTeam({ id: "box", name: "Box", pokemon: [pokemon] }), await encodePokemonBundle([pokemon])]) {
        const decoded = await decodeShare(code);
        const imported = decoded.kind === "team" ? decoded.team.pokemon[0] : normalizePokemon(decoded.pokemon[0]);
        assert.equal(imported.rpg.pendingEvs, 6);
        assert.equal(imported.rpg.experienceAwards[0].id, awardId);
        assert.equal(applyPokemonExperienceAward(imported, { xp: 3, awardId }), imported);
        assert.equal(imported.friendship, 255);
    }
});

test("EV allocation spends the reserve while respecting both official caps", () => {
    let pokemon = { ...partner(), evs: { hp: 251, attack: 250 }, rpg: { ...partner().rpg, pendingEvs: 40 } };
    pokemon = allocatePokemonEvs(pokemon, { stat: "hp", amount: 20 });
    assert.equal(pokemon.evs.hp, 252);
    assert.equal(pokemon.rpg.pendingEvs, 39);
    pokemon = allocatePokemonEvs(pokemon, { stat: "defense", amount: 20 });
    assert.equal(pokemon.evs.defense, 8);
    assert.equal(getAllocatedEvTotal(pokemon), 510);
    assert.equal(pokemon.rpg.pendingEvs, 31);
    assert.equal(allocatePokemonEvs(pokemon, { stat: "speed", amount: 1 }), pokemon);
    assert.equal(allocatePokemonEvs(pokemon, { stat: "unknown", amount: 1 }), pokemon);
    const empty = partner();
    assert.equal(allocatePokemonEvs(empty, { stat: "speed", amount: 1 }), empty);
});

test("friendship remains a manual raw value, with floor conversion capped at 25", () => {
    assert.deepEqual([0, 5, 9, 10, 249, 250, 255].map(getFriendshipScale), [0, 0, 0, 1, 24, 25, 25]);
    const pokemon = { ...partner(), friendship: 70 };
    assert.equal(adjustPokemonFriendship(pokemon, 5).friendship, 75);
    assert.equal(adjustPokemonFriendship(pokemon, -50).friendship, 20);
    assert.equal(adjustPokemonFriendship({ ...pokemon, friendship: 250 }, 50).friendship, 255);
    assert.equal(adjustPokemonFriendship({ ...pokemon, friendship: 5 }, -50).friendship, 0);
    assert.equal(award(pokemon, 3, 200).friendship, 70);
});

test("independent offline rewards merge once instead of making competing collection copies", () => {
    const base = normalizeAccountDocument({ schema: 1,
        boxes: [{ id: "box", name: "Box", updatedAt: 1, pokemon: [partner()] }], dex: {}, preferences: {} });
    const firstId = createExperienceAwardId(300), secondId = createExperienceAwardId(301);
    const changed = (id, time) => recordAccountChanges(base, { boxes: base.boxes.map(box => ({ ...box,
        pokemon: box.pokemon.map(pokemon => applyPokemonExperienceAward(pokemon, { xp: 1, awardId: id })) })) }, time);
    const left = changed(firstId, 10), right = changed(secondId, 20);
    const merged = mergeAccountDocuments(left, right, base);
    assert.equal(merged.document.boxes.length, 1);
    const pokemon = merged.document.boxes[0].pokemon[0];
    assert.equal(pokemon.rpg.xp, 2);
    assert.equal(pokemon.rpg.pendingEvs, 4);
    assert.equal(pokemon.rpg.experienceAwards.length, 2);
    const repeated = mergeAccountDocuments(left, merged.document, base).document.boxes[0].pokemon[0];
    assert.equal(repeated.rpg.xp, 2);
    assert.equal(repeated.rpg.pendingEvs, 4);
    const same = mergeAccountDocuments(left, left, base).document.boxes[0].pokemon[0];
    assert.equal(same.rpg.pendingEvs, 2);
});

test("field progress preserves EV reserves, receipts and unchanged friendship through normalization", () => {
    const pokemon = award(partner(), 2, 400);
    const team = { id: "box", shareId: "box", name: "Box", pokemon: [pokemon] };
    const token = createTokenFromPokemon(pokemon, team);
    const snapshot = normalizeRoomSnapshot({ ...createRoomSnapshot(), tokens: [token] });
    assert.equal(snapshot.tokens[0].pendingEvs, 4);
    assert.equal(snapshot.tokens[0].experienceAwards.length, 1);
    assert.equal(snapshot.tokens[0].friendship, 255);
    const updated = syncTeamsWithRoomProgress([{ ...team, pokemon: [partner()] }], snapshot)[0].pokemon[0];
    assert.equal(updated.rpg.pendingEvs, 4);
    assert.equal(updated.rpg.experienceAwards.length, 1);
    assert.equal(updated.friendship, 255);
    const legacy = normalizeRoomSnapshot({ ...createRoomSnapshot(), tokens: [{ id: "old", pokemonId: "pokemon", teamId: "box", maxHp: 5, currentHp: 3, level: 10 }] });
    assert.equal(normalizeRoomSnapshot(legacy).tokens[0].growthVersion, 0);
    assert.equal(syncTeamsWithRoomProgress([team], legacy)[0].pokemon[0].rpg.pendingEvs, 4);
});

test("battle reward participation follows field entry and preserves pre-reward levels", () => {
    const team = { id: "team", shareId: "team", name: "Box", pokemon: [
        { ...partner(), id: "one", level: 10 }, { ...partner(), id: "two", level: 12 }, { ...partner(), id: "three", level: 50 },
    ] };
    const before = addTeamToSnapshot(createRoomSnapshot(), team, "ally", "", { activePokemonIds: ["one"], benchRemaining: true }).room;
    let battle = changeRoomPhase(before, "batalha");
    assert.equal(battle.tokens[0].battleParticipated, true);
    assert.equal(battle.tokens[0].battleEntryLevel, 10);
    assert.equal(battle.benchTokens.filter(token => token.battleParticipated).length, 0);
    const incoming = battle.benchTokens.find(token => token.pokemonId === "two");
    battle = swapTeamPokemonInSnapshot(battle, battle.tokens[0].id, incoming.id).room;
    assert.equal(battle.tokens[0].battleEntryLevel, 12);
    assert.equal([...battle.tokens, ...battle.benchTokens].filter(token => token.battleParticipated).length, 2);
    assert.equal(battle.benchTokens.find(token => token.pokemonId === "three").battleParticipated, false);
    const source = team.pokemon.find(pokemon => pokemon.id === "two");
    const rewarded = award(source, 12, 500);
    battle = normalizeRoomSnapshot({ ...battle, tokens: battle.tokens.map(token => ({ ...token, level: rewarded.level, xp: rewarded.rpg.xp })) });
    assert.equal(battle.tokens[0].level, 13);
    assert.equal(battle.tokens[0].battleEntryLevel, 12, "one reward must not change the comparison for the next participant");
    const next = changeRoomPhase(changeRoomPhase(battle, "intervalo"), "batalha");
    assert.equal(next.tokens[0].battleEntryLevel, 13);
    assert.equal(next.benchTokens.filter(token => token.battleParticipated).length, 0);
});

test("changing phases during an active order never refreshes battle resources or declarations", () => {
    const token = createTokenFromPokemon(partner(), { id: "box" });
    const active = normalizeRoomSnapshot({ ...createRoomSnapshot(), phase: "batalha", round: 3,
        tokens: [{ ...token, battleParticipated: true, battleEntryLevel: 10, activeMoveActions: 2,
            declaredMove: "protect", moves: ["protect"], declaredDamageClass: "status", priority: 4,
            stages: { attack: 2 } }], initiative: [token.id],
        trainerInterventions: [{ trainerKey: "trainer", round: 3 }],
        hitKillProtectionUsed: [token.id], hitKillProtectionDisabled: [token.id], hitKillSurvivalGrace: [token.id],
    });
    const restored = changeRoomPhase(changeRoomPhase(active, "exploracao"), "batalha");
    assert.deepEqual(restored, active);
});

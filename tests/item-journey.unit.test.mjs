import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAccountDocument } from "../src/core/accountDocument.js";
import { applyMoveConsequences } from "../src/core/automation.js";
import { addTeamToSnapshot, createRoomSnapshot, createTokenFromPokemon, startNewRoomBattle, syncTeamsWithRoomProgress } from "../src/core/room.js";
import { compactPokemon, getPokemonConsumedItem, normalizePokemon, normalizeTeam, replacePokemonHeldItem, STAT_KEYS } from "../src/core/team.js";
import { decodeShare, decodeTeam, encodePokemonBundle, encodeTeam } from "../src/core/teamShare.js";
import { assignHeldItem, consumeHeldItem, getHeldItemPatchBlockReason, isHeldItemActive, normalizeTraitState, recordTraitEvent, restoreHeldItem } from "../src/core/traitMechanics.js";

const makeTeam = (item = "focus-sash", rpg = {}) => normalizeTeam({
    id: "item-box", shareId: "item-share", updatedAt: 100, name: "Jornada",
    pokemon: [{ id: "item-partner", item, level: 10, ability: "keen-eye", moves: ["tackle"],
        species: { id: 16, name: "pidgey", species: { name: "pidgey" },
            stats: STAT_KEYS.map(stat => ({ base_stat: 50, stat: { name: stat } })),
            types: [{ type: { name: "normal" } }] },
        rpg: { scaleVersion: 2, ...rpg } }],
});
const consumeInRoom = (team, item = null) => {
    const room = addTeamToSnapshot(createRoomSnapshot("Itens"), team, "ally").room;
    const token = item == null ? room.tokens[0] : assignHeldItem(room.tokens[0], item);
    const consumed = consumeHeldItem(token, { reason: "Item usado", round: 1 });
    assert.equal(consumed.applied, true);
    return { ...room, tokens: [consumed.token] };
};
const otherTeam = item => normalizeTeam({ ...makeTeam(item), id: "other-box", shareId: "other-share",
    pokemon: [{ ...makeTeam(item).pokemon[0], id: "other-partner" }] });
const itemMove = (tokens, attacker, target, name) => applyMoveConsequences({ tokens,
    attackerId: attacker.id, targetId: target?.id, round: 1, consumePp: false,
    move: { name, accuracy: 100, power: null, damage_class: { name: "status" }, type: { name: "normal" },
        target: { name: name === "recycle" ? "user" : "selected-pokemon" },
        meta: { ailment: { name: "none" }, drain: 0, healing: 0 }, stat_changes: [] },
    resolution: { hit: true, moveConnected: true, damageHit: false, damage: 0, hitCount: 0,
        effectiveness: 1, profile: { damaging: false }, traitModifiers: { entries: [] } },
}).tokens;

test("consumed item markers are optional and belong only to the equipped item", () => {
    const original = makeTeam().pokemon[0];
    assert.equal(Object.hasOwn(original.rpg, "consumedItem"), false);
    const consumed = normalizePokemon({ ...original, rpg: { ...original.rpg, consumedItem: " Focus_Sash " } });
    assert.equal(getPokemonConsumedItem(consumed), "focus-sash");
    assert.equal(compactPokemon(consumed).rpg.consumedItem, "focus-sash");
    for (const item of ["oran-berry", "", "leftovers"]) {
        const replaced = normalizePokemon({ ...consumed, item });
        assert.equal(getPokemonConsumedItem(replaced), "");
        assert.equal(Object.hasOwn(replaced.rpg, "consumedItem"), false);
    }
    assert.equal(getPokemonConsumedItem(normalizePokemon({ ...original, rpg: { consumedItem: {} } })), "");
});

for (const item of ["focus-sash", "oran-berry", "sitrus-berry"]) {
    test(`${item} stays unavailable after recording progress and returning from its Box`, () => {
        const original = makeTeam(item);
        const room = consumeInRoom(original);
        const saved = syncTeamsWithRoomProgress([original], room)[0];
        assert.equal(saved.pokemon[0].item, item, "the original equipment choice remains identifiable");
        assert.equal(saved.pokemon[0].rpg.consumedItem, item);
        assert.equal(original.pokemon[0].rpg.consumedItem, undefined, "recording does not mutate the original Box");
        const returned = createTokenFromPokemon(saved.pokemon[0], saved);
        assert.equal(returned.item, "");
        assert.equal(isHeldItemActive(returned), false);
        const state = normalizeTraitState(returned.traitState, returned.item, returned.ability);
        assert.equal(state.item.originalId, item);
        assert.equal(state.item.consumed, true);
        const savedTeams = [saved];
        const secondSave = syncTeamsWithRoomProgress(savedTeams, { ...room, tokens: [returned] });
        assert.equal(secondSave, savedTeams, "an unchanged second save preserves the same teams");
        assert.equal(secondSave[0].pokemon[0].rpg.consumedItem, item);
    });
}

test("restoring the original item clears the saved unavailable state", () => {
    const original = makeTeam("focus-sash", { consumedItem: "focus-sash" });
    const token = createTokenFromPokemon(original.pokemon[0], original);
    const restored = restoreHeldItem(token, { round: 2 });
    assert.equal(restored.applied, true);
    const saved = syncTeamsWithRoomProgress([original], { ...createRoomSnapshot("Reposição"), tokens: [restored.token] })[0];
    assert.equal(Object.hasOwn(saved.pokemon[0].rpg, "consumedItem"), false);
    assert.equal(createTokenFromPokemon(saved.pokemon[0], saved).item, "focus-sash");
});

test("equipping a different item or explicitly replacing the same one starts with an available item", () => {
    const team = makeTeam("focus-sash", { consumedItem: "focus-sash" });
    const different = normalizePokemon({ ...team.pokemon[0], item: "oran-berry" });
    assert.equal(createTokenFromPokemon(different, team).item, "oran-berry");
    const replaced = normalizePokemon({ ...team.pokemon[0], rpg: { ...team.pokemon[0].rpg, consumedItem: "" } });
    assert.equal(createTokenFromPokemon(replaced, team).item, "focus-sash");
});

test("temporary item swaps and consumption never overwrite the Box's original equipment", () => {
    const original = makeTeam("focus-sash");
    const room = addTeamToSnapshot(createRoomSnapshot("Trick"), original, "ally").room;
    const borrowed = assignHeldItem(room.tokens[0], "oran-berry");
    const changed = syncTeamsWithRoomProgress([original], { ...room, tokens: [borrowed] })[0].pokemon[0];
    assert.equal(changed.item, "focus-sash");
    assert.equal(getPokemonConsumedItem(changed), "");
    const foreignConsumption = syncTeamsWithRoomProgress([original], consumeInRoom(original, "oran-berry"))[0].pokemon[0];
    assert.equal(foreignConsumption.item, "focus-sash");
    assert.equal(getPokemonConsumedItem(foreignConsumption), "", "a consumed borrowed item is not the original Focus Sash");
    const alreadyUsed = makeTeam("focus-sash", { consumedItem: "focus-sash" });
    const borrowedAfterUse = assignHeldItem(createTokenFromPokemon(alreadyUsed.pokemon[0], alreadyUsed), "leftovers");
    const saved = syncTeamsWithRoomProgress([alreadyUsed], { ...room, tokens: [borrowedAfterUse] })[0];
    assert.equal(saved.pokemon[0].rpg.consumedItem, "focus-sash", "borrowing another item cannot replenish the consumed original");
});

test("account normalization and both share codecs preserve unavailable original items", async () => {
    const supplied = replacePokemonHeldItem(makeTeam("sitrus-berry").pokemon[0], "sitrus-berry");
    const team = normalizeTeam({ ...makeTeam("sitrus-berry"), pokemon: [{ ...supplied,
        rpg: { ...supplied.rpg, consumedItem: "sitrus-berry", itemOrigin: { ...supplied.rpg.itemOrigin, sequence: 1 } } }] });
    const account = normalizeAccountDocument(JSON.parse(JSON.stringify({ boxes: [team],
        localTools: { generatorDraft: { results: [{ pokemon: team.pokemon[0], versionGroup: "auto" }] } } })));
    assert.equal(account.boxes[0].pokemon[0].rpg.consumedItem, "sitrus-berry");
    assert.equal(account.localTools.generatorDraft.results[0].pokemon.rpg.consumedItem, "sitrus-berry");
    const decodedTeam = await decodeTeam(await encodeTeam(team));
    assert.equal(decodedTeam.pokemon[0].rpg.consumedItem, "sitrus-berry");
    const decodedPokemon = await decodeShare(await encodePokemonBundle(team.pokemon));
    assert.equal(decodedPokemon.pokemon[0].rpg.consumedItem, "sitrus-berry");
    assert.equal(decodedPokemon.pokemon[0].item, "sitrus-berry");
    assert.deepEqual(decodedTeam.pokemon[0].rpg.itemOrigin, team.pokemon[0].rpg.itemOrigin);
    assert.deepEqual(decodedPokemon.pokemon[0].rpg.itemOrigin, team.pokemon[0].rpg.itemOrigin);
    assert.deepEqual(account.boxes[0].pokemon[0].rpg.itemOrigin, team.pokemon[0].rpg.itemOrigin);
});

test("Trick tracks two identical Focus Sash copies and spends only their real owner's item", () => {
    const own = makeTeam("focus-sash"), other = otherTeam("focus-sash");
    const first = { ...createTokenFromPokemon(own.pokemon[0], own), ownerPlayerId: "player-a" };
    const second = { ...createTokenFromPokemon(other.pokemon[0], other, 0, "opponent"), ownerPlayerId: "player-b" };
    const exchanged = itemMove([first, second], first, second, "trick");
    assert.equal(exchanged[0].traitState.item.origin.teamId, other.id);
    assert.equal(exchanged[1].traitState.item.origin.teamId, own.id);
    const spent = consumeHeldItem(exchanged[1], { round: 1 }).token;
    const scene = { ...createRoomSnapshot("Trick"), tokens: [exchanged[0], spent] };
    const saved = syncTeamsWithRoomProgress([own, other], scene);
    assert.equal(saved[0].pokemon[0].rpg.consumedItem, "focus-sash");
    assert.equal(getPokemonConsumedItem(saved[1].pokemon[0]), "");
    assert.equal(saved[0].pokemon[0].item, "focus-sash");
    assert.equal(saved[1].pokemon[0].item, "focus-sash");
    const ownOnly = syncTeamsWithRoomProgress([own], { ...scene, tokens: [spent] }, "player-a");
    assert.equal(ownOnly[0].pokemon[0].rpg.consumedItem, "focus-sash", "foreign holder and missing owner token do not hide consumption");
});

test("Thief carries item ownership and Recycle restores that exact borrowed copy", () => {
    const own = makeTeam("sitrus-berry"), other = otherTeam("");
    const first = createTokenFromPokemon(own.pokemon[0], own);
    const second = createTokenFromPokemon(other.pokemon[0], other, 0, "opponent");
    const stolen = itemMove([first, second], second, first, "thief");
    assert.equal(stolen[0].item, "");
    assert.equal(stolen[1].item, "sitrus-berry");
    assert.equal(stolen[1].traitState.item.origin.teamId, own.id);
    const spent = consumeHeldItem(stolen[1], { round: 1 }).token;
    const scene = { ...createRoomSnapshot("Thief"), tokens: [stolen[0], spent] };
    const saved = syncTeamsWithRoomProgress([own, other], scene);
    assert.equal(saved[0].pokemon[0].rpg.consumedItem, "sitrus-berry");
    assert.equal(saved[1].pokemon[0].item, "");
    const recycled = itemMove(scene.tokens, spent, null, "recycle");
    assert.equal(recycled[1].item, "sitrus-berry");
    assert.equal(recycled[1].traitState.item.origin.teamId, own.id);
    const restored = syncTeamsWithRoomProgress(saved, { ...scene, tokens: recycled });
    assert.equal(getPokemonConsumedItem(restored[0].pokemon[0]), "");
    assert.equal(restored[0].pokemon[0].rpg.itemOrigin.sequence, 2);
    assert.equal(getHeldItemPatchBlockReason(scene, { ...scene, tokens: recycled }), "");
});

test("pending borrowed-item consumption survives another item, ability events and a fresh battle", () => {
    const own = makeTeam("focus-sash"), other = otherTeam("oran-berry");
    const first = createTokenFromPokemon(own.pokemon[0], own);
    const second = createTokenFromPokemon(other.pokemon[0], other);
    const exchanged = itemMove([first, second], first, second, "switcheroo");
    let holder = assignHeldItem(consumeHeldItem(exchanged[1], { round: 1 }).token, "leftovers");
    for (let index = 0; index < 100; index++) holder = recordTraitEvent(holder,
        { kind: "ability", sourceId: "keen-eye", label: "Evento", round: index });
    assert.ok(holder.traitState.history.length <= 104);
    const fresh = startNewRoomBattle({ ...createRoomSnapshot("Continuação"), tokens: [exchanged[0], holder] });
    const saved = syncTeamsWithRoomProgress([own, other], fresh);
    assert.equal(saved[0].pokemon[0].rpg.consumedItem, "focus-sash");
    assert.equal(saved[1].pokemon[0].item, "oran-berry");
    assert.equal(getPokemonConsumedItem(saved[1].pokemon[0]), "");
});

test("a fresh same-name replacement cannot be consumed again by an older room snapshot", () => {
    const original = makeTeam("focus-sash"), oldRoom = consumeInRoom(original);
    const used = syncTeamsWithRoomProgress([original], oldRoom)[0];
    const replacement = normalizeTeam({ ...used, pokemon: [replacePokemonHeldItem(used.pokemon[0], "focus-sash")] });
    const afterStaleSave = syncTeamsWithRoomProgress([replacement], oldRoom)[0];
    assert.equal(getPokemonConsumedItem(afterStaleSave.pokemon[0]), "");
    assert.equal(afterStaleSave.pokemon[0].rpg.itemOrigin.id, replacement.pokemon[0].rpg.itemOrigin.id);
    assert.equal(createTokenFromPokemon(afterStaleSave.pokemon[0], afterStaleSave).item, "focus-sash");
});

test("PATCH accepts explicit restoration and harmless edits but rejects forged resets or erased consumption", () => {
    const source = consumeInRoom(makeTeam("focus-sash"));
    const token = source.tokens[0];
    assert.equal(getHeldItemPatchBlockReason(source, { ...source, tokens: [{ ...token, currentHp: 1 }] }), "");
    const omitted = { ...token, currentHp: 1 }; delete omitted.traitState;
    assert.equal(getHeldItemPatchBlockReason(source, { ...source, tokens: [omitted] }), "");
    for (const patch of [
        { ...token, item: "focus-sash" },
        { ...token, item: "focus-sash", traitState: {} },
        { ...token, traitState: {} },
        { ...token, item: "focus-sash", traitState: { ...token.traitState, item: { ...token.traitState.item, consumed: false, restored: true } } },
    ]) assert.match(getHeldItemPatchBlockReason(source, { ...source, tokens: [patch] }), /Restaurar item/);
    const restored = restoreHeldItem(token, { round: 2 }).token;
    assert.equal(getHeldItemPatchBlockReason(source, { ...source, tokens: [restored] }), "");
    const legacy = { ...token, traitState: { item: { originalId: "focus-sash", consumed: true } } };
    const legacyRoom = { ...source, tokens: [legacy] };
    assert.match(getHeldItemPatchBlockReason(legacyRoom, { ...source, tokens: [{ ...legacy, item: "focus-sash" }] }), /Restaurar item/);
    const team = makeTeam("focus-sash");
    const supplied = replacePokemonHeldItem(team.pokemon[0], "focus-sash");
    const fresh = { ...createTokenFromPokemon(supplied, team), id: legacy.id };
    assert.equal(getHeldItemPatchBlockReason(legacyRoom, { ...source, tokens: [fresh] }), "", "legacy rooms accept an explicitly supplied new Box copy");
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildInitiative, changeRoomPhase, createRoomSnapshot, getBattleLifecyclePatchBlockReason,
    getRoundMoveBlockReason, normalizeRoomSnapshot, startNewRoomBattle, swapTeamPokemonInSnapshot } from "../src/core/room.js";
import { actionChangesRoomState, getCaptureInterventionBlockReason, normalizeAuthoritativeRequest,
    resolveAuthoritativeAction } from "../server/authoritativeActions.js";

const token = (id, extra = {}) => ({ id, pokemonId: id, teamId: id === "opponent" ? "rivals" : "box", name: id,
    level: 10, maxHp: 10, currentHp: 10, moves: ["tackle"], pp: [20], side: id === "opponent" ? "opponent" : "ally",
    originalStats: { hp: 100, attack: 50, defense: 40, "special-attack": 50, "special-defense": 40, speed: id === "opponent" ? 50 : 100 }, ...extra });
const battle = (extra = {}) => normalizeRoomSnapshot({ ...createRoomSnapshot(), phase: "batalha", battleStarted: true,
    tokens: [token("first", { battleParticipated: true, battleEntryLevel: 10 }), token("opponent")],
    benchTokens: [token("reserve")], ...extra });
const request = extra => normalizeAuthoritativeRequest({ requestId: "start-battle-123456", action: "start-battle", expectedRevision: 3, ...extra });

test("changing phase between rounds preserves protections, interventions and battle entry levels", () => {
    const source = battle({ round: 3, tokens: [token("first", { level: 12, battleParticipated: true, battleEntryLevel: 10,
        lastActionRound: 2, activeMoveActions: 2, declaredMove: "tackle", priority: 0 })],
        hitKillProtectionUsed: ["token:first"], hitKillProtectionDisabled: ["token:reserve"],
        hitKillSurvivalGrace: ["token:first"], trainerInterventions: [{ trainerKey: "box", round: 3 }] });
    for (const phase of ["exploracao", "interpretacao", "intervalo"]) {
        assert.deepEqual(changeRoomPhase(changeRoomPhase(source, phase), "batalha"), source);
    }
});

test("the first Battle initializes participation once and only explicit New battle refreshes it", () => {
    const first = changeRoomPhase(normalizeRoomSnapshot({ ...createRoomSnapshot(), tokens: [token("first")] }), "batalha");
    assert.equal(first.battleStarted, true);
    assert.equal(first.tokens[0].battleParticipated, true);
    assert.equal(first.tokens[0].battleEntryLevel, 10);
    const advanced = { ...first, tokens: [{ ...first.tokens[0], level: 11 }], hitKillProtectionUsed: ["token:first"] };
    const resumed = changeRoomPhase(changeRoomPhase(advanced, "exploracao"), "batalha");
    assert.equal(resumed.tokens[0].battleEntryLevel, 10);
    assert.deepEqual(resumed.hitKillProtectionUsed, ["token:first"]);
    const fresh = startNewRoomBattle(resumed);
    assert.equal(fresh.tokens[0].battleEntryLevel, 11);
    assert.deepEqual(fresh.hitKillProtectionUsed, []);
});

test("legacy battles cannot regain resources by changing phase after persistence", () => {
    const legacy = { ...createRoomSnapshot(), phase: "exploracao", hitKillProtectionUsed: ["token:first"], tokens: [token("first")] };
    delete legacy.battleStarted;
    const restored = normalizeRoomSnapshot(JSON.parse(JSON.stringify(legacy)));
    assert.equal(restored.battleStarted, true);
    assert.deepEqual(changeRoomPhase(restored, "batalha").hitKillProtectionUsed, ["token:first"]);
    assert.equal(normalizeRoomSnapshot({ ...legacy, phase: "batalha", hitKillProtectionUsed: [] }).battleStarted, true);
});

test("New battle resets round, actions and temporary effects without recovering persistent resources", () => {
    const source = battle({ round: 4, tokens: [token("first", { currentHp: 0, status: "burn", friendship: 95, xp: 3,
        pp: [7], lastActionRound: 4, activeMoveActions: 5, declaredMove: "tackle", declaredDamageClass: "physical",
        stages: { attack: 2 }, volatileEffects: [{ id: "confusion", turns: 2 }], item: "",
        traitState: { item: { originalId: "focus-sash", consumed: true, consumedRound: 2 }, markers: ["choice-lock:tackle"] },
        battleParticipated: true, battleEntryLevel: 8 })], hitKillProtectionUsed: ["token:first"],
        hitKillProtectionDisabled: ["token:first"], hitKillSurvivalGrace: ["token:first"],
        trainerInterventions: [{ trainerKey: "box", round: 4 }] });
    const fresh = startNewRoomBattle(source), actor = fresh.tokens[0];
    assert.equal(fresh.round, 1);
    assert.deepEqual(fresh.initiative, []);
    for (const key of ["hitKillProtectionUsed", "hitKillProtectionDisabled", "hitKillSurvivalGrace", "trainerInterventions"]) assert.deepEqual(fresh[key], []);
    for (const key of ["currentHp", "status", "friendship", "xp", "pp", "item"]) assert.deepEqual(actor[key], source.tokens[0][key]);
    assert.equal(actor.traitState.item.consumed, true);
    assert.equal(actor.traitState.item.originalId, "focus-sash");
    assert.equal(actor.lastActionRound, 0);
    assert.equal(actor.activeMoveActions, 0);
    assert.equal(actor.declaredMove, "");
    assert.equal(actor.declaredDamageClass, "");
    assert.equal(actor.stages.attack, 0);
    assert.deepEqual(actor.volatileEffects, []);
    assert.equal(actor.battleParticipated, false, "a fainted partner has not joined the new battle");
    assert.equal(fresh.benchTokens[0].battleParticipated, false);
});

test("New battle requires Narrator authority and an ended round, and uses no random draws", () => {
    const source = battle({ round: 3 });
    assert.equal(actionChangesRoomState("start-battle"), true);
    assert.throws(() => resolveAuthoritativeAction({ request: request(), snapshot: source, role: "player" }), error => error.status === 403);
    assert.throws(() => resolveAuthoritativeAction({ request: request(), snapshot: { ...source, initiative: ["first"] }, role: "narrator" }), error => error.status === 409);
    assert.throws(() => request({ resetHp: true }), /não aceita dados de resultado/);
    const resolved = resolveAuthoritativeAction({ request: request(), snapshot: source, role: "narrator",
        random: () => { throw new Error("New battle cannot roll dice."); } });
    assert.equal(resolved.nextSnapshot.round, 1);
    assert.equal(resolved.nextSnapshot.battleStarted, true);
    assert.deepEqual(resolved.audit.rawDice, []);
    assert.equal(resolved.eventType, "system");
});

test("free training remains repeatable until initiative; after a round the next initiative is required", () => {
    const training = normalizeRoomSnapshot({ ...createRoomSnapshot(), phase: "batalha", tokens: [token("first")], battleStarted: false });
    const move = { name: "tackle", priority: 0 };
    assert.equal(getRoundMoveBlockReason({ snapshot: training, token: training.tokens[0], move }), "");
    const practiced = normalizeRoomSnapshot({ ...training, tokens: [{ ...training.tokens[0], lastActionRound: 1, activeMoveActions: 2 }] });
    assert.equal(practiced.battleStarted, false);
    assert.equal(getRoundMoveBlockReason({ snapshot: practiced, token: practiced.tokens[0], move }), "");
    const chosen = { ...practiced, tokens: [{ ...practiced.tokens[0], declaredMove: "tackle", declaredDamageClass: "physical", stages: { attack: 2 } }] };
    const rolled = buildInitiative(chosen, () => .4).room;
    assert.equal(rolled.tokens[0].lastActionRound, 0);
    assert.equal(rolled.tokens[0].activeMoveActions, 0);
    assert.equal(rolled.tokens[0].declaredMove, "tackle");
    assert.equal(rolled.tokens[0].stages.attack, 2);
    assert.equal(getRoundMoveBlockReason({ snapshot: rolled, token: rolled.tokens[0], move }), "");
    assert.equal(rolled.battleStarted, true);
    const between = normalizeRoomSnapshot({ ...rolled, initiative: [], round: 2 });
    assert.match(getRoundMoveBlockReason({ snapshot: between, token: between.tokens[0], move }), /role a iniciativa/);
    assert.match(getRoundMoveBlockReason({ snapshot: changeRoomPhase(between, "exploracao"), token: between.tokens[0], move }), /role a iniciativa/);
});

test("a healthy switch uses Other action in the current turn and cannot be repeated", () => {
    const source = battle({ round: 3, initiative: ["opponent", "first"], turnIndex: 0 });
    assert.match(swapTeamPokemonInSnapshot(source, "first", "reserve").reason, /Aguarde o turno/);
    const turn = { ...source, turnIndex: 1 };
    const locked = { ...turn, tokens: turn.tokens.map(actor => actor.id === "first" ? { ...actor, declaredMove: "tackle" } : actor) };
    assert.match(swapTeamPokemonInSnapshot(locked, "first", "reserve").reason, /Use Tackle/);
    const used = { ...turn, tokens: turn.tokens.map(actor => actor.id === "first" ? { ...actor, lastActionRound: 3 } : actor) };
    assert.match(swapTeamPokemonInSnapshot(used, "first", "reserve").reason, /já agiu/);
    const result = swapTeamPokemonInSnapshot(turn, "first", "reserve");
    assert.equal(result.swapped, true);
    assert.equal(result.incoming.lastActionRound, 3);
    assert.equal(result.outgoing.lastActionRound, 3);
    assert.equal(result.incoming.battleParticipated, true);
    assert.equal(swapTeamPokemonInSnapshot(result.room, "reserve", "first").swapped, false);
});

test("a fainted replacement is allowed outside its turn without gaining a second action", () => {
    const source = battle({ round: 3, initiative: ["opponent", "first"], turnIndex: 0,
        tokens: [token("first", { currentHp: 0 }), token("opponent")], benchTokens: [token("reserve", { lastActionRound: 3 })] });
    const result = swapTeamPokemonInSnapshot(source, "first", "reserve");
    assert.equal(result.swapped, true);
    assert.equal(result.incoming.lastActionRound, 3);
    assert.deepEqual(result.room.initiative, ["opponent", "reserve"]);
    const alreadyActed = { ...source, tokens: [token("first", { currentHp: 0, lastActionRound: 3 }), token("opponent")],
        benchTokens: [token("reserve", { lastActionRound: 0 })] };
    assert.equal(swapTeamPokemonInSnapshot(alreadyActed, "first", "reserve").incoming.lastActionRound, 3);
});

test("PATCH cannot clear battle records, reuse an action or reorder through a fake token addition", () => {
    const current = battle({ round: 3, initiative: ["first", "opponent"],
        tokens: [token("first", { lastActionRound: 3, activeMoveActions: 2, battleParticipated: true, battleEntryLevel: 10 }), token("opponent")],
        hitKillProtectionUsed: ["token:first"], trainerInterventions: [{ trainerKey: "box", round: 3 }] });
    const attempt = patch => getBattleLifecyclePatchBlockReason(current, { ...current, ...patch });
    assert.match(attempt({ battleStarted: false }), /Nova batalha/);
    assert.match(attempt({ hitKillProtectionUsed: [] }), /proteção/);
    assert.match(attempt({ trainerInterventions: [] }), /intervenção/);
    assert.match(attempt({ tokens: current.tokens.map(actor => actor.id === "first" ? { ...actor, lastActionRound: 0 } : actor) }), /já agiu/);
    assert.match(attempt({ tokens: current.tokens.map(actor => actor.id === "first" ? { ...actor, lastActionRound: 4 } : actor) }), /já agiu/);
    const future = { ...current.tokens[0], lastActionRound: 4 };
    assert.match(getRoundMoveBlockReason({ snapshot: current, token: future, move: { name: "tackle" } }), /já agiu/);
    assert.match(getBattleLifecyclePatchBlockReason({ ...current, turnIndex: 1 }, { ...current, tokens: [...current.tokens, token("extra", { hidden: true })], turnIndex: 0 }), /Próximo turno/);
    assert.match(attempt({ tokens: current.tokens.map(actor => actor.id === "first" ? { ...actor, battleEntryLevel: 11 } : actor) }), /participantes/);
    assert.match(attempt({ tokens: [...current.tokens, token("extra")], initiative: ["opponent", "first"] }), /ordem/);
    assert.equal(attempt({ phase: "exploracao", sceneNotes: "A história continua." }), "");
});

test("PATCH verifies swaps while accepting a legal switch and preserving the current order", () => {
    const current = battle({ round: 3, initiative: ["opponent", "first"], turnIndex: 0 });
    const fake = { ...current, tokens: [current.benchTokens[0], current.tokens[1]], benchTokens: [current.tokens[0]], initiative: ["opponent", "reserve"] };
    assert.match(getBattleLifecyclePatchBlockReason(current, fake), /Aguarde o turno/);
    const turn = { ...current, turnIndex: 1 };
    const legal = swapTeamPokemonInSnapshot(turn, "first", "reserve");
    assert.equal(getBattleLifecyclePatchBlockReason(turn, legal.room), "");
});

test("capture cannot reuse an intervention by hiding an active round behind Exploration", () => {
    const current = battle({ round: 3, initiative: ["first", "opponent"], tokens: [token("first"), token("opponent", { currentHp: 1 })] });
    const captureRequest = { action: "capture", trainerTokenId: "first", targetId: "opponent", ball: "poke-ball", wildConfirmed: true };
    const failed = resolveAuthoritativeAction({ request: captureRequest, snapshot: current, role: "narrator", species: { capture_rate: 1 }, random: () => .99 });
    assert.equal(failed.result.success, false);
    const hidden = changeRoomPhase(failed.nextSnapshot, "exploracao");
    assert.match(getCaptureInterventionBlockReason(hidden, hidden.tokens[0]), /já usou/);
    assert.throws(() => resolveAuthoritativeAction({ request: captureRequest, snapshot: hidden, role: "narrator", species: { capture_rate: 1 }, random: () => .99 }), error => error.status === 409);
});

test("capture intervention belongs to its battle even between rounds; the next round gets a new one", () => {
    const current = battle({ round: 3, initiative: [], tokens: [token("first"), token("opponent", { currentHp: 1 })] });
    const args = { request: { action: "capture", trainerTokenId: "first", targetId: "opponent", ball: "poke-ball", wildConfirmed: true },
        role: "narrator", species: { capture_rate: 1 }, random: () => .99 };
    const failed = resolveAuthoritativeAction({ ...args, snapshot: current });
    assert.equal(failed.nextSnapshot.trainerInterventions[0].battle, true);
    const exploring = changeRoomPhase(failed.nextSnapshot, "exploracao");
    assert.throws(() => resolveAuthoritativeAction({ ...args, snapshot: exploring }), error => error.status === 409);
    const nextRound = { ...exploring, round: 4 };
    const second = resolveAuthoritativeAction({ ...args, snapshot: nextRound });
    assert.equal(second.nextSnapshot.trainerInterventions[0].round, 4);
    assert.equal(second.nextSnapshot.trainerInterventions[0].battle, true);
    assert.throws(() => resolveAuthoritativeAction({ ...args, snapshot: second.nextSnapshot }), error => error.status === 409);
});

test("a fresh exploration capture never prevents initializing the first battle", () => {
    const fresh = normalizeRoomSnapshot({ ...createRoomSnapshot(), tokens: [token("first"), token("opponent", { currentHp: 1 })] });
    const args = { request: { action: "capture", trainerTokenId: "first", targetId: "opponent", ball: "poke-ball", wildConfirmed: true },
        role: "narrator", species: { capture_rate: 1 }, random: () => .99 };
    const first = resolveAuthoritativeAction({ ...args, snapshot: fresh });
    assert.equal(first.nextSnapshot.battleStarted, false);
    assert.equal(first.nextSnapshot.trainerInterventions[0].battle, false);
    assert.doesNotThrow(() => resolveAuthoritativeAction({ ...args, snapshot: first.nextSnapshot }));
    const starting = changeRoomPhase(first.nextSnapshot, "batalha");
    assert.deepEqual(starting.trainerInterventions, []);
    assert.equal(getBattleLifecyclePatchBlockReason(first.nextSnapshot, starting), "");
});

test("fresh private capture keeps free training and a participant entering between rounds joins the next order", () => {
    const training = normalizeRoomSnapshot({ ...createRoomSnapshot(), phase: "batalha", tokens: [token("first"), token("opponent", { currentHp: 1 })] });
    const captured = resolveAuthoritativeAction({ request: { action: "capture", trainerTokenId: "first", targetId: "opponent", ball: "poke-ball", wildConfirmed: true },
        snapshot: training, role: "narrator", species: { capture_rate: 1 }, random: () => .99 });
    assert.equal(normalizeRoomSnapshot(captured.nextSnapshot).battleStarted, false);
    const exploring = changeRoomPhase(battle({ round: 2 }), "exploracao");
    const switched = swapTeamPokemonInSnapshot(exploring, "first", "reserve");
    const rolled = buildInitiative(changeRoomPhase(switched.room, "batalha"), () => .4).room;
    const participant = rolled.tokens.find(actor => actor.id === "reserve");
    assert.equal(participant.battleParticipated, true);
    assert.equal(participant.battleEntryLevel, 10);
    const benched = swapTeamPokemonInSnapshot({ ...rolled, initiative: [], round: 3 }, "reserve", "first").outgoing;
    assert.equal(benched.battleParticipated, true);
});

test("removing a participant preserves the surviving current turn and adding one waits for the next order", () => {
    const current = battle({ round: 3, tokens: [token("first"), token("opponent"), token("third")],
        initiative: ["first", "opponent", "third"], turnIndex: 1 });
    const removedEarlier = { ...current, tokens: current.tokens.slice(1), initiative: ["opponent", "third"], turnIndex: 0 };
    assert.equal(getBattleLifecyclePatchBlockReason(current, removedEarlier), "");
    assert.match(getBattleLifecyclePatchBlockReason(current, { ...removedEarlier, turnIndex: 1 }), /Próximo turno/);
    const removedCurrent = { ...current, tokens: current.tokens.filter(actor => actor.id !== "opponent"), initiative: ["first", "third"], turnIndex: 1 };
    assert.equal(getBattleLifecyclePatchBlockReason(current, removedCurrent), "");
    const returned = { ...removedEarlier, tokens: [...removedEarlier.tokens, current.tokens[0]] };
    assert.equal(getBattleLifecyclePatchBlockReason(removedEarlier, returned), "");
});

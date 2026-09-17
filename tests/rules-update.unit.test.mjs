import test from "node:test";
import assert from "node:assert/strict";
import { buildInitiative, calculateMoveResolution, createRoomSnapshot, normalizeRoomSnapshot, applyEndOfRoundEffects, swapTeamPokemonInSnapshot } from "../src/core/room.js";
import { checkActionConditions } from "../src/core/battleConditions.js";
import { calculateCaptureChance, rollCapture } from "../src/core/capture.js";
import { getDamageTraitModifiers, getInitiativeTraitState } from "../src/core/traitMechanics.js";
import { normalizeAuthoritativeRequest, resolveCombatAction, resolveCaptureAction } from "../server/authoritativeActions.js";
import { applyMoveConsequences } from "../src/core/automation.js";
import { RPG_RULE_SECTIONS } from "../src/core/rpgRules.js";

const sequence = values => { let index = 0; return () => { assert.ok(index < values.length, "unexpected random draw"); return values[index++]; }; };
const token = (id, extra = {}) => ({ id, name: id, speciesName: "pikachu", level: 20, maxHp: 20, currentHp: 20, types: ["normal"], moves: ["tackle"], pp: [35], side: id === "a" ? "ally" : "opponent", stats: { attack: 2, defense: 2, speed: 2 }, originalStats: { attack: 40, defense: 40, speed: 40 }, ...extra });
const room = (a = {}, b = {}) => normalizeRoomSnapshot({ ...createRoomSnapshot("QA"), phase: "batalha", tokens: [token("a", a), token("b", b)] });
const move = { name: "tackle", power: 40, accuracy: null, pp: 35, type: { name: "normal" }, damage_class: { name: "physical" }, target: { name: "selected-pokemon" }, meta: {}, stat_changes: [] };
const request = { attackerId: "a", defenderId: "b", moveName: "tackle", mode: "normal" };
const captureRequest = { action: "capture", trainerTokenId: "a", targetId: "b", ball: "poke-ball", wildConfirmed: true };

test("initiative repeats only unresolved ties and audits every die, never IDs", () => {
  const result = buildInitiative(room(), sequence([0, 0, 0, 0, 0.5, 0.5, 0, 0.99]));
  assert.deepEqual(result.room.initiative, ["b", "a"]);
  assert.deepEqual(result.results[0].tieBreakRolls, [4, 6]);
  assert.deepEqual(result.results[1].tieBreakRolls, [4, 1]);
  assert.throws(() => buildInitiative(room(), () => 0), /Nenhuma ordem foi aplicada/);
});

test("all twenty weighted multi-hit outcomes yield exactly 35/35/15/15 percent", () => {
  const tally = {};
  for (let i = 0; i < 20; i++) {
    const resolution = calculateMoveResolution({ attacker: token("a"), defender: token("b"), move: { ...move, meta: { min_hits: 2, max_hits: 5 } }, random: sequence([0.8, 0.8, 0, 0, (i + 0.5) / 20]) });
    tally[resolution.hitCount] = (tally[resolution.hitCount] || 0) + 1;
  }
  assert.deepEqual(tally, { 2: 7, 3: 7, 4: 3, 5: 3 });
  for (const [item, ability, draws, count] of [["loaded-dice", "", [0], 4], ["loaded-dice", "", [0.99], 5], ["", "skill-link", [], 5]]) {
    const resolution = calculateMoveResolution({ attacker: token("a", { item, ability }), defender: token("b"), move: { ...move, meta: { min_hits: 2, max_hits: 5 } }, random: sequence([0.8, 0.8, 0, 0, ...draws]) });
    assert.equal(resolution.hitCount, count);
  }
});

test("a double six losing the contest stays potential, never an effective critical", () => {
  const resolution = calculateMoveResolution({ attacker: token("a"), defender: token("b", { stats: { defense: 99 } }), move, random: sequence([0.99, 0.99, 0, 0]) });
  assert.equal(resolution.attackTest.critical, true);
  assert.equal(resolution.criticalHit, false);
  assert.equal(resolution.damage, 0);
});

test("sleep draws its duration once, counts attempts and wakes before the next action", () => {
  let current = token("a", { status: "sleep" });
  for (let i = 0; i < 3; i++) {
    const result = checkActionConditions({ token: current, move, random: sequence(i === 0 ? [0.99] : []) });
    assert.equal(result.canAct, false);
    current = result.token;
    assert.equal(current.sleepTurns, 2 - i);
  }
  const awake = checkActionConditions({ token: current, move, random: sequence([]) });
  assert.equal(awake.canAct, true);
  assert.equal(awake.token.status, "");
  const snore = checkActionConditions({ token: token("a", { status: "sleep", sleepTurns: 1 }), move: { name: "snore" }, random: sequence([]) });
  assert.equal(snore.canAct, true);
  assert.equal(snore.token.sleepTurns, 0);
});

test("paralysis and thaw use the exact inclusive d100 boundaries", () => {
  for (const [status, draw, canAct] of [["paralysis", 0.24, false], ["paralysis", 0.25, true], ["freeze", 0.19, true], ["freeze", 0.20, false]]) {
    assert.equal(checkActionConditions({ token: token("a", { status }), move, random: sequence([draw]) }).canAct, canAct);
  }
  const thawed = checkActionConditions({ token: token("a", { status: "freeze" }), move: { name: "flame-wheel" }, random: sequence([]) });
  assert.equal(thawed.token.status, "");
  assert.equal(thawed.canAct, true);
});

test("a blocked combat action commits the condition but neither damage nor PP", () => {
  const snapshot = room({ status: "paralysis" });
  const resolved = resolveCombatAction({ snapshot, request, role: "narrator", move, random: sequence([0]) });
  assert.equal(resolved.result.blockedByCondition, true);
  assert.equal(resolved.nextSnapshot.tokens[0].pp[0], 35);
  assert.equal(resolved.nextSnapshot.tokens[0].lastActionRound, 1);
  assert.equal(resolved.nextSnapshot.tokens[1].currentHp, 20);
  const simulated = resolveCombatAction({ snapshot, request, role: "player", move, random: sequence([0]) });
  assert.equal(simulated.nextSnapshot, null);
  assert.equal(snapshot.tokens[0].lastActionRound, 0);
});

test("confusion persists through round end and self damage disables general survival", () => {
  const snapshot = room({ volatileEffects: [{ id: "confusion", turns: 2 }] });
  const ended = applyEndOfRoundEffects(snapshot, sequence([]));
  assert.equal(ended.room.tokens[0].volatileEffects[0].turns, 2);
  const resolved = resolveCombatAction({ snapshot, request, role: "narrator", move, random: sequence([0]) });
  assert.equal(resolved.nextSnapshot.tokens[0].currentHp, 18);
  assert.equal(resolved.nextSnapshot.tokens[0].volatileEffects[0].turns, 1);
  assert.ok(resolved.nextSnapshot.hitKillProtectionDisabled.includes("token:a"));
  const ending = checkActionConditions({ token: token("a", { volatileEffects: [{ id: "confusion", turns: 1 }] }), move, random: sequence([0.99]) });
  assert.equal(ending.token.volatileEffects.some(effect => effect.id === "confusion"), false);
});

test("burn, Guts, Facade, paralysis and Quick Feet preserve their exceptions", () => {
  const damage = (status, ability = "", name = "tackle") => getDamageTraitModifiers({ attacker: token("a", { status, ability }), defender: token("b"), move: { ...move, name } }).multiplier;
  assert.equal(damage("burn"), 0.5);
  assert.equal(damage("burn", "guts"), 1.5);
  assert.equal(damage("burn", "", "facade"), 1);
  assert.equal(getInitiativeTraitState(token("a", { status: "paralysis" })).multiplier, 0.5);
  assert.equal(getInitiativeTraitState(token("a", { status: "paralysis", ability: "quick-feet" })).multiplier, 1.5);
});

test("flinch cannot steal a completed action and Inner Focus prevents it", () => {
  for (const [lastActionRound, ability, expected] of [[0, "", true], [1, "", false], [0, "inner-focus", false]]) {
    const applied = applyMoveConsequences({ tokens: [token("a"), token("b", { lastActionRound, ability })], attackerId: "a", targetId: "b", move: { ...move, meta: { flinch_chance: 100 } }, resolution: { moveConnected: true, damageHit: false, hit: true, attackTest: {}, defenseTest: {} }, round: 1, random: sequence([0]) });
    assert.equal(applied.tokens[1].volatileEffects.some(effect => effect.id === "flinch"), expected);
  }
});

test("capture adaptation shows exact factors and rejects unsupported balls and invalid rates", () => {
  const full = calculateCaptureChance({ target: token("b"), captureRate: 255 });
  assert.equal(full.chance, 33);
  const prepared = calculateCaptureChance({ target: token("b", { currentHp: 1, status: "sleep" }), captureRate: 45, ball: "ultra-ball" });
  assert.equal(prepared.chance, 85);
  assert.equal(prepared.statusBonus, 2.5);
  assert.equal(rollCapture({ target: token("b"), captureRate: 255 }, sequence([0.32])).success, true);
  assert.equal(rollCapture({ target: token("b"), captureRate: 255 }, sequence([0.33])).success, false);
  assert.equal(rollCapture({ target: token("b"), captureRate: 0 }, sequence([0])).success, false);
  assert.equal(rollCapture({ target: token("b"), captureRate: 0, ball: "master-ball" }, sequence([])).success, true);
  assert.throws(() => calculateCaptureChance({ target: token("b"), captureRate: NaN }), /taxa/);
  assert.throws(() => calculateCaptureChance({ target: token("b"), captureRate: 45, ball: "net-ball" }), /guiada/);
});

test("capture accepts intent only, uses canonical HP and consumes one intervention on failure", () => {
  const normalized = normalizeAuthoritativeRequest({ ...captureRequest, requestId: "capture-test-123456", expectedRevision: 1 });
  for (const key of ["chance", "captureRate", "result", "success", "currentHp"]) {
    assert.throws(() => normalizeAuthoritativeRequest({ ...normalized, [key]: 100 }), /não aceita/);
  }
  const args = { request: normalized, snapshot: { ...room(), initiative: ["a", "b"], turnIndex: 1 }, role: "narrator", species: { capture_rate: 45 } };
  assert.throws(() => resolveCaptureAction({ ...args, role: "player" }), /Só o Narrador/);
  const failed = resolveCaptureAction({ ...args, random: sequence([0.99]) });
  assert.equal(failed.result.success, false);
  assert.equal(failed.result.chance, 5);
  assert.equal(failed.nextSnapshot.tokens[1].currentHp, 20);
  assert.throws(() => resolveCaptureAction({ ...args, snapshot: failed.nextSnapshot, random: sequence([]) }), /já usou/);
  const captured = resolveCaptureAction({ ...args, random: sequence([0]) });
  assert.equal(captured.nextSnapshot.tokens[1].captured, true);
  assert.equal(captured.nextSnapshot.tokens[1].hidden, true);
  assert.deepEqual(captured.nextSnapshot.initiative, ["a"]);
  assert.equal(captured.nextSnapshot.turnIndex, 0);
  assert.equal(captured.nextSnapshot.tokens[0].pp[0], 35);
});

test("switching preserves sleep, resets toxic and clears volatile conditions", () => {
  const snapshot = { ...room({ teamId: "team", status: "sleep", sleepTurns: 1, volatileEffects: [{ id: "confusion", turns: 2 }] }), benchTokens: [token("bench", { teamId: "team", status: "bad-poison", toxicCounter: 5 })] };
  const swapped = swapTeamPokemonInSnapshot(snapshot, "a", "bench");
  assert.equal(swapped.swapped, true);
  assert.equal(swapped.outgoing.sleepTurns, 1);
  assert.deepEqual(swapped.outgoing.volatileEffects, []);
  assert.equal(swapped.incoming.toxicCounter, 1);
  assert.equal(swapped.incoming.lastActionRound, 1);
});

test("guide contains explicit action economy, XP, safe rest and Trainer tests", () => {
  const text = JSON.stringify(RPG_RULE_SECTIONS);
  for (const pattern of [/Crítico|crítico potencial/, /1 XP.*2 XP.*3 XP/, /ação principal/, /Trocar preserva/, /Testes do Treinador/, /Encerrar uma sessão.*não restaura/, /adaptação explícita/]) assert.match(text, pattern);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildInitiative, createRoomSnapshot, declareRoomMove, getEffectiveMovePriority, getMovePriorityBlock, getRoundDeclarationPatchBlockReason, getRoundMoveBlockReason, normalizeRoomSnapshot } from "../src/core/room.js";
import { getSpecialMoveBlockReason } from "../src/core/specialMechanics.js";
import { setAbilitySuppressed } from "../src/core/traitMechanics.js";
import { applyAuthoritativeMovePriorities, resolveAuthoritativeAction } from "../server/authoritativeActions.js";

const stats = { hp: 200, attack: 80, defense: 80, "special-attack": 80, "special-defense": 80, speed: 80 };
const token = (id, extra = {}) => ({ id, name: id, side: id === "a" ? "ally" : "opponent", maxHp: 10, currentHp: 10, level: 10, moves: ["tackle", "quick-attack", "growl", "recover"], types: ["normal"], originalStats: stats, stats: Object.fromEntries(Object.keys(stats).map(key => [key, 4])), ...extra });
const move = (name = "tackle", extra = {}) => ({ name, priority: name === "quick-attack" ? 1 : 0, pp: 35, power: 40, accuracy: 100, type: { name: "normal" }, damage_class: { name: "physical" }, target: { name: "selected-pokemon" }, meta: { ailment: { name: "none" }, healing: 0, drain: 0 }, stat_changes: [], ...extra });
const room = () => normalizeRoomSnapshot({ ...createRoomSnapshot("Teste"), phase: "batalha", tokens: [token("a"), token("b")] });
const active = () => ({ ...declareRoomMove(room(), "a", move("tackle")), initiative: ["a", "b"], turnIndex: 0 });
const forbiddenEntropy = () => { throw new Error("Invalid actions must not draw entropy"); };
const resolve = (snapshot, request, random = forbiddenEntropy, refs = {}) => resolveAuthoritativeAction({ snapshot, request, role: "narrator", random, ...refs });

test("priority declarations are explicit preparation and can be erased as Outra ação", () => {
  const declared = declareRoomMove(room(), "a", move("quick-attack"));
  assert.equal(declared.tokens[0].priority, 1);
  assert.equal(declared.tokens[0].declaredMove, "quick-attack");
  assert.equal(declared.tokens[0].declaredDamageClass, "physical");
  const cleared = declareRoomMove(declared, "a", null);
  assert.equal(cleared.tokens[0].declaredMove, "");
  assert.equal(cleared.tokens[0].priority, 0);
  assert.equal(cleared.tokens[0].declaredDamageClass, "");
  assert.throws(() => declareRoomMove(active(), "a", null), /rodada já começou/);
  assert.throws(() => declareRoomMove(room(), "a", move("move-not-owned")), /ficha/);
  assert.throws(() => declareRoomMove({ ...room(), tokens: [token("a", { currentHp: 0 })] }, "a", move()), /disponível/);
  assert.throws(() => declareRoomMove({ ...room(), tokens: [token("a", { pp: [0, null, null, null] })] }, "a", move()), /sem PP/);
});

test("effective priority respects Prankster, full-HP Gale Wings, Triage and suppression", () => {
  const growl = move("growl", { damage_class: { name: "status" } });
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "prankster" }), move: growl }), 1);
  assert.equal(getEffectiveMovePriority({ token: setAbilitySuppressed(token("a", { ability: "prankster" }), true, "Teste"), move: growl }), 0);
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "prankster" }), move: move() }), 0);
  const wing = move("wing-attack", { type: { name: "flying" } });
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "gale-wings" }), move: wing }), 1);
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "gale-wings", currentHp: 9 }), move: wing }), 0);
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "triage" }), move: move("rest", { damage_class: { name: "status" } }) }), 3);
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "triage" }), move: move("drain-punch", { meta: { drain: 50 } }) }), 3);
  for (const name of ["swallow", "purify", "revival-blessing"]) assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "triage" }), move: move(name, { damage_class: { name: "status" } }) }), 3, `${name} retains the healing flag missing from PokeAPI metadata`);
  assert.equal(getEffectiveMovePriority({ token: token("a", { ability: "triage" }), move: move() }), 0);
});

test("canonical priority is recomputed at initiative from current HP and active ability", () => {
  let base = declareRoomMove({ ...room(), tokens: [token("a", { ability: "gale-wings", moves: ["wing-attack"] }), token("b")] }, "a", move("wing-attack", { type: { name: "flying" } }));
  assert.equal(base.tokens[0].priority, 1);
  base = { ...base, tokens: base.tokens.map(pokemon => pokemon.id === "a" ? { ...pokemon, currentHp: 5 } : pokemon) };
  const canonical = applyAuthoritativeMovePriorities(base, new Map([["wing-attack", move("wing-attack", { type: { name: "flying" } })]]));
  assert.equal(canonical.tokens[0].priority, 0);
  assert.equal(canonical.tokens[0].declaredDamageClass, "physical");
});

test("an active round cannot be rerolled or bypassed through a late declaration PATCH", () => {
  const before = active();
  assert.throws(() => buildInitiative(before, forbiddenEntropy), /rodada já começou/);
  assert.throws(() => resolve(before, { action: "initiative" }), /rodada já começou/);
  assert.throws(() => resolve(room(), { action: "advance-turn" }), /role a iniciativa/);
  assert.match(getRoundDeclarationPatchBlockReason(before, { ...before, tokens: before.tokens.map(pokemon => ({ ...pokemon, priority: 7 })) }), /já foram escolhidas/);
  assert.equal(getRoundDeclarationPatchBlockReason(before, { ...before, sceneNotes: "Anotação", tokens: before.tokens.map(pokemon => ({ ...pokemon, currentHp: 5 })) }), "");
  const legacyEdit = { ...before, tokens: before.tokens.map(pokemon => { const copy = { ...pokemon, currentHp: 5 }; delete copy.declaredDamageClass; return copy; }) };
  assert.equal(getRoundDeclarationPatchBlockReason(before, legacyEdit), "", "a cached client can edit HP without knowing the additive canonical category");
  assert.match(getRoundDeclarationPatchBlockReason(before, { ...before, tokens: before.tokens.map(pokemon => ({ ...pokemon, declaredDamageClass: "status" })) }), /já foram escolhidas/);
});

test("active turns allow exactly the declared move, one eligible actor, and one action", () => {
  const snapshot = active();
  const current = snapshot.tokens[0];
  assert.equal(getRoundMoveBlockReason({ snapshot, token: current, move: move() }), "");
  assert.match(getRoundMoveBlockReason({ snapshot, token: snapshot.tokens[1], move: move() }), /Aguarde o turno/);
  assert.match(getRoundMoveBlockReason({ snapshot, token: { ...current, lastActionRound: snapshot.round }, move: move() }), /já agiu/);
  assert.match(getRoundMoveBlockReason({ snapshot, token: current, move: move("quick-attack") }), /escolhido antes/);
  assert.match(getRoundMoveBlockReason({ snapshot, token: { ...current, currentHp: 0 }, move: move() }), /disponível/);
  assert.throws(() => resolve(snapshot, { action: "combat", attackerId: "b", defenderId: "a", moveName: "tackle", mode: "normal" }, forbiddenEntropy, { move: move() }), /Aguarde o turno/);
});

test("Outra ação cannot gain late priority, while practice without an order remains free", () => {
  const snapshot = { ...room(), initiative: ["a", "b"], turnIndex: 0 };
  assert.equal(getRoundMoveBlockReason({ snapshot, token: snapshot.tokens[0], move: move() }), "");
  assert.match(getRoundMoveBlockReason({ snapshot, token: snapshot.tokens[0], move: move("quick-attack") }), /próxima iniciativa/);
  assert.equal(getRoundMoveBlockReason({ snapshot: room(), token: room().tokens[0], move: move("quick-attack") }), "");
});

test("combat preserves the chosen action until round end and refuses a second action without entropy", () => {
  const snapshot = active();
  const response = resolve(snapshot, { action: "combat", attackerId: "a", defenderId: "b", moveName: "tackle", mode: "normal" }, () => 0.5, { move: move() });
  assert.equal(response.nextSnapshot.tokens[0].declaredMove, "tackle");
  assert.equal(response.nextSnapshot.tokens[0].lastActionRound, snapshot.round);
  assert.throws(() => resolve(response.nextSnapshot, { action: "combat", attackerId: "a", defenderId: "b", moveName: "tackle", mode: "normal" }, forbiddenEntropy, { move: move() }), /já agiu/);
  const ended = resolve({ ...response.nextSnapshot, turnIndex: 1 }, { action: "advance-turn" }, () => 0.5);
  assert.equal(ended.nextSnapshot.round, snapshot.round + 1);
  assert.deepEqual(ended.nextSnapshot.initiative, []);
  assert.ok(ended.nextSnapshot.tokens.every(pokemon => pokemon.declaredMove === "" && pokemon.declaredDamageClass === "" && pokemon.priority === 0));
});

test("a condition that prevents action spends the turn without PP and cannot be retried in the same round", () => {
  const snapshot = { ...active(), tokens: active().tokens.map(pokemon => pokemon.id === "a" ? { ...pokemon, status: "sleep", sleepTurns: 1, pp: [35, null, null, null] } : pokemon) };
  const response = resolve(snapshot, { action: "combat", attackerId: "a", defenderId: "b", moveName: "tackle", mode: "normal" }, forbiddenEntropy, { move: move() });
  assert.equal(response.result.blockedByCondition, true);
  assert.equal(response.nextSnapshot.tokens[0].lastActionRound, 1);
  assert.equal(response.nextSnapshot.tokens[0].pp[0], 35);
  assert.equal(response.nextSnapshot.tokens[0].declaredMove, "tackle");
  assert.throws(() => resolve(response.nextSnapshot, { action: "combat", attackerId: "a", defenderId: "b", moveName: "tackle", mode: "normal" }, forbiddenEntropy, { move: move() }), /já agiu/);
});

test("conditional priority attacks cannot use a retained declaration after the target acted", () => {
  const defender = { ...token("b"), declaredMove: "quick-attack", declaredDamageClass: "physical", priority: 1, lastActionRound: 1 };
  for (const name of ["sucker-punch", "thunderclap", "upper-hand"]) assert.match(getSpecialMoveBlockReason({ move: move(name), attacker: token("a"), defender, round: 1 }), /já agiu/);
  assert.match(getSpecialMoveBlockReason({ move: move("sucker-punch"), defender: { ...defender, lastActionRound: 0, declaredDamageClass: "status" }, round: 1 }), /movimento de dano/);
  assert.match(getSpecialMoveBlockReason({ move: move("upper-hand"), defender: { ...defender, lastActionRound: 0, priority: 0 }, round: 1 }), /prioridade positiva/);
});

test("a legal conditional attack that fails spends PP and the action, without damaging its target", () => {
  const attack = move("sucker-punch", { priority: 1 });
  let snapshot = normalizeRoomSnapshot({ ...room(), tokens: [token("a", { moves: ["sucker-punch"], pp: [5] }), token("b", { declaredMove: "growl", declaredDamageClass: "status" })] });
  snapshot = { ...declareRoomMove(snapshot, "a", attack), initiative: ["a", "b"], turnIndex: 0 };
  const response = resolve(snapshot, { action: "combat", attackerId: "a", defenderId: "b", moveName: "sucker-punch", mode: "normal" }, () => 0.5, { move: attack });
  assert.equal(response.nextSnapshot.tokens[0].pp[0], 4);
  assert.equal(response.nextSnapshot.tokens[0].lastActionRound, 1);
  assert.equal(response.nextSnapshot.tokens[1].currentHp, 10);
  assert.equal(response.result.targetResults[0].resolution.moveConnected, false);
  assert.match(response.result.targetResults[0].resolution.specialBlockReason, /movimento de dano/);
  assert.throws(() => resolve(response.nextSnapshot, { action: "combat", attackerId: "a", defenderId: "b", moveName: "sucker-punch", mode: "normal" }, forbiddenEntropy, { move: attack }), /já agiu/);
});

test("Prankster and Psychic Terrain protections affect the hit rather than initiative order", () => {
  const growl = move("growl", { damage_class: { name: "status" } });
  assert.match(getMovePriorityBlock({ token: token("a", { ability: "prankster" }), defender: token("b", { types: ["dark"] }), move: growl }).reason, /Dark/);
  assert.equal(getMovePriorityBlock({ token: token("a", { ability: "prankster" }), defender: token("b", { side: "ally", types: ["dark"] }), move: growl }), null);
  assert.match(getMovePriorityBlock({ token: token("a"), defender: token("b"), move: move("quick-attack"), terrain: "psiquico" }).reason, /Psychic Terrain/);
  assert.equal(getMovePriorityBlock({ token: token("a"), defender: token("b", { types: ["flying"] }), move: move("quick-attack"), terrain: "psiquico" }), null);
  assert.equal(getMovePriorityBlock({ token: token("a"), defender: token("b", { ability: "levitate" }), move: move("quick-attack"), terrain: "psiquico" }), null);
  const wing = move("wing-attack", { type: { name: "flying" } });
  const damagedGaleWings = token("a", { ability: "gale-wings", currentHp: 5 });
  assert.equal(getEffectiveMovePriority({ token: damagedGaleWings, move: wing }), 0);
  assert.match(getMovePriorityBlock({ token: damagedGaleWings, defender: token("b"), move: wing, terrain: "psiquico", priority: 1 }).reason, /Psychic Terrain/, "a rolled priority stays in force even after full HP is lost");
  assert.equal(getMovePriorityBlock({ token: token("a", { ability: "prankster" }), defender: token("b", { types: ["dark"] }), move: move("perish-song", { target: { name: "all-pokemon" }, damage_class: { name: "status" } }) }), null);
});

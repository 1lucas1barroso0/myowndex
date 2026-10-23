import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTeam, mergeImportedTeam } from '../src/core/team.js';
import { createTokenFromPokemon, createRoomSnapshot, normalizeRoomSnapshot, syncTeamsWithRoomProgress, hasNewerBoxEdit, addTeamToSnapshot, refreshRoomPokemonFromBox } from '../src/core/room.js';
import { restoreTeraShift } from '../src/core/battleGimmicks.js';
import { awardRoomPokemonExperience, getRoomExperienceBlockReason } from '../src/core/roomExperience.js';
import { createExperienceAwardId } from '../src/core/experience.js';
import { encodeTeam, decodeTeam } from '../src/core/teamShare.js';
import { copyObservedMove, transformBattleToken, revertBattleTransform } from '../src/core/specialMechanics.js';

// Regression cases independently reproduced from the local integration review.
const keys = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
const boxFor = ({ id = 25, name = 'pikachu', hp = 35, level = 20, moves = ['tackle'], pp = [8] } = {}) => normalizeTeam({
  id: 'box', shareId: 'share', updatedAt: 1,
  pokemon: [{ id: 'partner', level, ability: name === 'terapagos' ? 'tera-shift' : 'static', moves,
    species: { id, name, stats: keys.map(key => ({ stat: { name: key }, base_stat: key === 'hp' ? hp : 50 })), types: [{ type: { name: 'normal' } }] },
    rpg: { scaleVersion: 3, currentHp: 4, xp: 0, pp } }],
});
const sceneFor = token => normalizeRoomSnapshot({ ...createRoomSnapshot(), phase: 'intervalo', tokens: [token] });

test('newer imported growth must survive synchronization from an older scene', () => {
  const box = boxFor();
  const token = createTokenFromPokemon(box.pokemon[0], box);
  // Automatic battle progress does not increment editRevision, so equal
  // revisions across devices are a normal state rather than malformed input.
  const incoming = { ...box, updatedAt: 2, pokemon: [{ ...box.pokemon[0], level: 30,
    rpg: { ...box.pokemon[0].rpg, xp: 7, currentHp: 1, pendingEvs: 14 } }] };
  const imported = mergeImportedTeam([box], incoming).teams;
  const saved = syncTeamsWithRoomProgress(imported, sceneFor(token))[0].pokemon[0];
  assert.equal(hasNewerBoxEdit(imported, token), true);
  const refreshed = refreshRoomPokemonFromBox(sceneFor(token), imported);
  assert.equal(hasNewerBoxEdit(imported, refreshed.tokens[0]), false);
  assert.deepEqual(syncTeamsWithRoomProgress(imported, refreshed)[0].pokemon[0], saved);
  assert.deepEqual([saved.level, saved.rpg.xp, saved.rpg.pendingEvs, saved.rpg.currentHp], [30, 7, 14, 1]);
});

const mimicFixture = () => {
  const box = boxFor({ id: 235, name: 'smeargle', hp: 55, moves: ['mimic', 'sketch', 'tackle'], pp: [10, 1, 30] });
  const token = createTokenFromPokemon(box.pokemon[0], box);
  const target = { ...token, id: 'enemy', name: 'Alvo', specialState: { history: [{ moveName: 'surf', round: 1 }] } };
  const copied = copyObservedMove(token, target, 'mimic');
  assert.equal(copied.applied, true);
  return { box, target, spent: { ...copied.token, pp: [4, 1, 29, null] } };
};

test('Mimic must not hide PP consumed by an unrelated move', () => {
  const { box, spent } = mimicFixture();
  const saved = syncTeamsWithRoomProgress([box], sceneFor(spent))[0].pokemon[0];
  assert.equal(saved.rpg.pp[2], 29);
});

test('Sketch must persist only its own permanent move override', () => {
  const { box, target, spent } = mimicFixture();
  const sketched = copyObservedMove(spent, { ...target, specialState: { history: [{ moveName: 'flamethrower', round: 2 }] } }, 'sketch');
  assert.equal(sketched.applied, true);
  const saved = syncTeamsWithRoomProgress([box], sceneFor(sketched.token))[0].pokemon[0];
  assert.deepEqual(saved.moves, ['mimic', 'flamethrower', 'tackle', '']);
});

test('Tera Shift XP must preserve current-form stats and update the reversion baseline', () => {
  const box = boxFor({ id: 1024, name: 'terapagos', hp: 90, level: 10 });
  // Public add-team API activates Tera Shift even in exploration, where XP
  // is available; this does not require constructing an impossible phase.
  const before = addTeamToSnapshot(createRoomSnapshot(), box).room;
  const token = before.tokens[0];
  assert.equal(token.speciesId, 10276);
  assert.equal(getRoomExperienceBlockReason(before, token.id, [box]), "");
  const awarded = awardRoomPokemonExperience(before, token.id, { xp: 10, awardId: createExperienceAwardId() }, [box]).tokens[0];
  const reverted = restoreTeraShift(awarded);
  const expected = createTokenFromPokemon({ ...box.pokemon[0], level: awarded.level }, box);
  assert.deepEqual(reverted.originalStats, expected.originalStats);
  const expectedForm = addTeamToSnapshot(createRoomSnapshot(), { ...box, pokemon: [{ ...box.pokemon[0], level: awarded.level }] }).room.tokens[0];
  assert.deepEqual(awarded.originalStats, expectedForm.originalStats);
  const saved = syncTeamsWithRoomProgress([box], { ...before, tokens: [awarded] })[0];
  assert.equal(saved.pokemon[0].rpg.currentHp, reverted.currentHp);
  assert.equal(saved.pokemon[0].level, awarded.level);
  const edited = mergeImportedTeam([saved], { ...saved, updatedAt: saved.updatedAt + 1, pokemon: [{ ...saved.pokemon[0], level: 20 }] }).teams;
  const refreshed = refreshRoomPokemonFromBox({ ...before, tokens: [awarded] }, edited).tokens[0];
  assert.equal(refreshed.speciesId, 10276);
  assert.equal(restoreTeraShift(refreshed).originalStats.hp, createTokenFromPokemon(edited[0].pokemon[0], edited[0]).originalStats.hp);
});


test('Mimic and permanent Sketch survive a nested Transform and JSON round trip correctly', () => {
  const { box, target, spent } = mimicFixture();
  const sketched = copyObservedMove(spent, { ...target, specialState: { history: [{ moveName: 'flamethrower' }] } }, 'sketch').token;
  const transformed = transformBattleToken(sketched, target).token;
  const scene = sceneFor(JSON.parse(JSON.stringify(transformed)));
  const saved = syncTeamsWithRoomProgress([box], scene)[0].pokemon[0];
  assert.deepEqual(saved.moves, ['mimic', 'flamethrower', 'tackle', '']);
  assert.equal(saved.rpg.pp[2], 29);
  const restored = revertBattleTransform(scene.tokens[0]).token;
  assert.equal(restored.specialState.moveOverrides.length, 2);
  assert.equal(scene.tokens[0].specialState.transform !== null, true, 'sync leaves the scene transformed');
});

test('an exported newer Box keeps partner identity, source revision and spent rest through import and refresh', async () => {
  const box = boxFor();
  const token = createTokenFromPokemon(box.pokemon[0], box);
  const incoming = { ...box, updatedAt: box.updatedAt + 1, pokemon: [{ ...box.pokemon[0], level: 30, rpg: { ...box.pokemon[0].rpg, currentHp: 1, xp: 7, shortRestUsed: true } }] };
  const decoded = await decodeTeam(await encodeTeam(incoming));
  assert.equal(decoded.pokemon[0].id, box.pokemon[0].id);
  assert.equal(decoded.pokemon[0].rpg.shortRestUsed, true);
  const imported = mergeImportedTeam([box], decoded).teams;
  assert.equal(hasNewerBoxEdit(imported, token), true);
  const refreshed = refreshRoomPokemonFromBox(sceneFor(token), imported);
  assert.equal(refreshed.tokens[0].pokemonId, token.pokemonId);
  assert.equal(refreshed.tokens[0].level, 30);
  assert.equal(refreshed.tokens[0].currentHp, 1);
  assert.equal(refreshed.tokens[0].shortRestUsed, true);
  const saved = syncTeamsWithRoomProgress(imported, refreshed);
  assert.strictEqual(syncTeamsWithRoomProgress(saved, refreshed), saved);
});

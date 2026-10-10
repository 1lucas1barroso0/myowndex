import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addTeamToSnapshot, changeRoomPhase, createRoomSnapshot, normalizeRoomSnapshot, startNewRoomBattle } from "../src/core/room.js";
import { normalizeTeam } from "../src/core/team.js";
import { applyGimmick, getGimmickChoices } from "../src/core/battleGimmicks.js";
import { battleMovePresentation, moveVariantForResolution } from "../src/core/battleMovePresentation.js";

const text = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const source = {
  id: "rescue-box",
  name: "Box de regressão",
  pokemon: ["first", "chosen", "reserve"].map((id, index) => ({
    id, nickname: id, level: 30 + index, nature: "hardy", formName: "charizard",
    moves: ["flamethrower", "protect", "", ""],
    rpg: { xp: index + 2 }, item: "charizardite-x", teraType: "water",
    species: {
      id: 6, name: "charizard",
      stats: [
        ["hp", 78], ["attack", 84], ["defense", 78],
        ["special-attack", 109], ["special-defense", 85], ["speed", 100],
      ].map(([name, base_stat]) => ({ stat: { name }, base_stat })),
      sprites: { front_default: "/sprites/6.png" },
    },
  })),
};

test("recent PC changes never replace an explicit Box choice with the first Pokémon", () => {
  const roster = normalizeTeam(source);
  const selected = addTeamToSnapshot(createRoomSnapshot("Recuperação"), roster, "ally", "", {
    activePokemonIds: ["chosen"], benchRemaining: true,
  });
  assert.deepEqual(selected.tokens.map(pokemon => pokemon.pokemonId), ["chosen"]);
  assert.deepEqual(selected.room.benchTokens.map(pokemon => pokemon.pokemonId), ["first", "reserve"]);
  const later = addTeamToSnapshot(selected.room, roster, "ally", "", {
    activePokemonIds: ["reserve"], benchRemaining: true,
  });
  assert.deepEqual(later.tokens.map(pokemon => pokemon.pokemonId), ["reserve"]);
  assert.deepEqual(later.room.tokens.map(pokemon => pokemon.pokemonId), ["chosen", "reserve"]);
  assert.deepEqual(later.room.benchTokens.map(pokemon => pokemon.pokemonId), ["first"]);
});

test("four story phases retain notes and spent protection until a new battle starts", () => {
  const key = "pokemon:rescue-box:chosen";
  let room = normalizeRoomSnapshot({
    ...createRoomSnapshot("Quatro fases"),
    phase: "batalha", battleStarted: true,
    sceneNotes: "Registro do Narrador",
    hitKillProtectionUsed: [key], hitKillProtectionDisabled: [key],
  });
  for (const phase of ["exploracao", "interpretacao", "intervalo", "batalha"]) {
    room = changeRoomPhase(room, phase);
    assert.equal(room.phase, phase);
    assert.equal(room.sceneNotes, "Registro do Narrador");
    assert.deepEqual(room.hitKillProtectionUsed, [key]);
    assert.deepEqual(room.hitKillProtectionDisabled, [key]);
  }
  const renewed = startNewRoomBattle(room);
  assert.deepEqual(renewed.hitKillProtectionUsed, []);
  assert.deepEqual(renewed.hitKillProtectionDisabled, []);
});

test("Mega visibly changes the actual form, and Max moves keep their original PP source", () => {
  const token = {
    ...addTeamToSnapshot(createRoomSnapshot(), normalizeTeam(source), "ally", "", {
      activePokemonIds: ["chosen"],
    }).tokens[0],
    currentHp: 20, maxHp: 30, item: "charizardite-x",
    types: ["fire", "flying"], originalTypes: ["fire", "flying"],
  };
  const formData = {
    id: 10034, name: "charizard-mega-x",
    sprites: { front_default: "/sprites/10034.png" },
    types: [{ type: { name: "fire" } }, { type: { name: "dragon" } }],
    stats: [
      ["hp", 78], ["attack", 130], ["defense", 111],
      ["special-attack", 130], ["special-defense", 85], ["speed", 100],
    ].map(([name, base_stat]) => ({ stat: { name }, base_stat })),
    abilities: [{ ability: { name: "tough-claws" } }],
  };
  assert.ok(getGimmickChoices(token).some(option => option.id === "mega"));
  const result = applyGimmick(token, "mega", { formData });
  assert.equal(result.applied, true);
  assert.equal(result.token.speciesName, "charizard-mega-x");
  assert.deepEqual(result.token.types, ["fire", "dragon"]);
  assert.notEqual(result.token.sprite, token.sprite);
  const move = {
    name: "flamethrower", power: 90, type: { name: "fire" },
    damage_class: { name: "special" }, pp: 15,
  };
  const shown = battleMovePresentation({
    ...token, speciesName: "charizard-gmax",
    gimmickState: { active: "gmax", used: ["gmax"] },
  }, move);
  assert.equal(shown.label, "G-Max Wildfire");
  assert.equal(shown.source, "flamethrower");
  assert.equal(moveVariantForResolution(move, shown).name, "g-max-wildfire");
  assert.equal(move.pp, 15);
});

test("XP comes from stored Pokémon state and the field does not ask for it again", async () => {
  const [room, experience, browser] = await Promise.all([
    text("src/components/Room/RpgRoom.jsx"),
    text("src/components/Shared/ExperienceAward.jsx"),
    text("tests/browser-gimmicks-phases.mjs"),
  ]);
  assert.match(room, /Quem entra em campo/);
  assert.match(room, /token-xp-readout/);
  assert.match(room, /selectedToken\.level/);
  assert.doesNotMatch(room, /id="room-token-xp"/);
  assert.match(experience, /<summary>Ganhar XP<\/summary>/);
  assert.match(browser, /Informe um valor inteiro/);
});

test("release caching revalidates without discarding pending room writes", async () => {
  const [pkg, sw, app, room] = await Promise.all([
    text("package.json"), text("public/sw.js"),
    text("src/App.jsx"), text("src/components/Room/RpgRoom.jsx"),
  ]);
  const version = JSON.parse(pkg).version;
  assert.match(sw, new RegExp(`myowndex-shell-v${version.replace(/\./g, "\\.")}`));
  assert.match(app, /myowndex:prepare-update/);
  assert.match(app, /\/api\/version/);
  assert.match(app, /visibilitychange/);
  assert.match(room, /myowndex:prepare-update/);
});

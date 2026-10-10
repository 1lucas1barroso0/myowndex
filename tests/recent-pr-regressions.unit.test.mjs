import assert from "node:assert/strict";
import test from "node:test";
import { applyGimmick, canUseZMove, endGimmick, getGimmickChoices } from "../src/core/battleGimmicks.js";
import { battleMovePresentation, moveVariantForResolution } from "../src/core/battleMovePresentation.js";
import { applyStageChange } from "../src/core/automation.js";
import { createRoomSnapshot, normalizeRoomToken } from "../src/core/room.js";
import { resolveCombatAction } from "../server/authoritativeActions.js";

const move = (name, type, power, category = "physical", target = "selected-pokemon") => ({
    name, power, type: { name: type }, damage_class: { name: category },
    target: { name: target }, accuracy: 80, pp: 10, priority: 0, meta: {},
});
const token = extra => normalizeRoomToken({
    id: "user", pokemonId: "user", teamId: "one", side: "ally", name: "Eevee",
    speciesName: "eevee", formName: "eevee", speciesId: 133, maxHp: 30, currentHp: 30,
    level: 40, item: "eevium-z", types: ["normal"], originalTypes: ["normal"],
    stats: { attack: 10, defense: 10, "special-attack": 10, "special-defense": 10, speed: 10 },
    originalStats: { attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    moves: ["last-resort", "", "", ""], pp: [10, null, null, null], stages: {}, ...extra,
});
const combat = (user, selected, foe = token({ id: "foe", side: "opponent", item: "", types: ["normal"], stats:{attack:1,defense:1,"special-attack":1,"special-defense":1,speed:1}, originalStats:{attack:5,defense:5,"special-attack":5,"special-defense":5,speed:5} }), useZMove = false) => resolveCombatAction({
    snapshot: { ...createRoomSnapshot(), phase: "batalha", battleStarted: true, initiative: [user.id,foe.id], turnIndex:0, tokens: [{...user,declaredMove:selected.name}, foe] },
    role: "narrator", request: { attackerId: user.id, defenderId: foe.id, moveName: selected.name, mode: "normal", useZMove },
    move: selected, random: () => 0.5,
});

test("Max conversion uses the official reduced table and 100-power boundary", () => {
    const user = token({ gimmickState: { active: "dyna" } });
    assert.equal(battleMovePresentation(user, move("close-combat", "fighting", 120)).power, 95);
    assert.equal(battleMovePresentation(user, move("sludge-bomb", "poison", 90)).power, 90);
    assert.equal(battleMovePresentation(user, move("earthquake", "ground", 100)).power, 130);
    assert.equal(battleMovePresentation(user, move("seismic-toss", "fighting", null)).power, 75);
    assert.equal(battleMovePresentation(user, move("bullet-seed", "grass", 25)).power, 130);
});

test("converted Max/Z attacks select one target, always connect on accuracy and retain base PP", () => {
    const base = move("earthquake", "ground", 100, "physical", "all-other-pokemon");
    for (const [user, options] of [[token({ gimmickState: { active: "dyna" } }), {}], [token({ item: "groundium-z" }), { useZMove: true }]]) {
        const converted = moveVariantForResolution(base, battleMovePresentation(user, base, options));
        assert.equal(converted.target.name, "selected-pokemon");
        assert.equal(converted.accuracy, null);
        assert.equal(base.pp, 10);
        assert.equal(base.target.name, "all-other-pokemon");
    }
});

test("Extreme Evoboost raises five stats without damaging a foe and spends one base PP", () => {
    const result = combat(token(), move("last-resort", "normal", 140), undefined, true);
    assert.equal(result.result.usedMove.name, "Extreme Evoboost");
    assert.equal(result.nextSnapshot.tokens[1].currentHp, 30);
    for (const stat of ["attack", "defense", "special-attack", "special-defense", "speed"]) assert.equal(result.nextSnapshot.tokens[0].stages[stat], 2);
    assert.equal(result.nextSnapshot.tokens[0].pp[0], 9);
});

test("Guardian of Alola uses three quarters of current HP, not a generic power", () => {
    const user = token({ speciesName: "tapu-koko", formName: "tapu-koko", item: "tapunium-z", moves: ["natures-madness", "", "", ""] });
    const selected = move("natures-madness", "fairy", null, "special");
    assert.equal(canUseZMove(user, selected), true);
    const result = combat(user, selected, undefined, true);
    assert.equal(result.result.usedMove.name, "Guardian of Alola");
    assert.equal(result.nextSnapshot.tokens[1].currentHp, 8);
});

test("Z eligibility respects Alolan identity, cap Pikachu and Ultra Necrozma", () => {
    const thunderbolt = move("thunderbolt", "electric", 90, "special");
    const raichu = token({ speciesName: "raichu-alola", formName: "raichu-alola", item: "aloraichium-z", moves: ["thunderbolt"] });
    assert.equal(canUseZMove(raichu, thunderbolt), true);
    assert.equal(canUseZMove(token({ speciesName: "pikachu", formName: "pikachu", item: "pikashunium-z", moves: ["thunderbolt"] }), thunderbolt), false);
    assert.equal(canUseZMove(token({ speciesName: "pikachu", formName: "pikachu-world-cap", item: "pikashunium-z", moves: ["thunderbolt"] }), thunderbolt), true);
    assert.equal(canUseZMove(token({ speciesName: "necrozma", formName: "necrozma", item: "ultranecrozium-z", moves: ["photon-geyser"] }), move("photon-geyser", "psychic", 100, "special")), false);
});

test("Gigantamax uses the actual Toxtricity and Urshifu form and preserves abilities", () => {
    for (const form of ["toxtricity-low-key", "toxtricity-amped", "urshifu-rapid-strike", "urshifu-single-strike"]) {
        const species = form.startsWith("toxtricity") ? "toxtricity" : "urshifu";
        const user = token({ speciesName: species, formName: form, item: "", dynamaxLevel: 10, canGMax: true, ability: "technician" });
        assert.equal(getGimmickChoices(user).find(x => x.id === "gmax").form, `${form}-gmax`);
        const formData = { name: `${form}-gmax`, id: 10199, stats: [], types: [{ type: { name: "electric" } }], abilities: [{ ability: { name: "punk-rock" } }] };
        assert.equal(applyGimmick(user, "gmax", { formData }).token.ability, "technician");
    }
});

test("ending Dynamax retains stat changes earned during the transformation", () => {
    const user = token({ item: "", dynamaxLevel: 10 });
    const transformed = applyGimmick(user, "dyna").token;
    const boosted = applyStageChange(transformed, "attack", 1);
    const restored = endGimmick(boosted);
    assert.equal(restored.stages.attack, 1);
    assert.equal(restored.stats.attack, boosted.stats.attack);
});

test("a calling status move becomes Max Guard without requiring a called move", () => {
    const user = token({ item: "", moves: ["metronome"], pp: [10], gimmickState: { active: "dyna" } });
    const result = combat(user, move("metronome", "normal", null, "status", "user"));
    assert.equal(result.result.usedMove.name, "Max Guard");
    assert.equal(result.nextSnapshot.tokens[0].pp[0], 9);
});

import {getPokemonSpriteSources,isPokemonSpriteSource2D} from "../src/core/pokemonSpriteSources.js";
test("Silicobra never falls back to the mislabeled Sandaconda artwork in any palette or angle", () => {
 for (const view of ["", "shiny", "back", "back/shiny"]) {
  const src="https://raw.githubusercontent.com/PokeAPI/sprites/d72f64eb74912747cb5c5579061ced4842ba0a98/sprites/pokemon/versions/generation-v/black-white/animated/"+(view?view+"/":"")+"843.gif";
  const result=getPokemonSpriteSources({pokemonId:843,src,shiny:view.includes("shiny")});
  assert.ok(result.animated[0].startsWith("/sprites/native/2d-"));
  assert.ok(result.animated[0].endsWith(".apng"));
  assert.equal(isPokemonSpriteSource2D(src),false);
  assert.equal(isPokemonSpriteSource2D(result.animated[0]),true);
 }
});

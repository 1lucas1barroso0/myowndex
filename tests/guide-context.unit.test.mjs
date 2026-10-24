import assert from "node:assert/strict";
import test from "node:test";
import { RPG_RULE_SECTIONS } from "../src/core/rpgRules.js";
import { GUIDE_PLAYER_SCENES } from "../src/core/guidePlayerScenes.js";
import { GUIDE_RULE_CONTEXTS } from "../src/core/guideRuleContexts.js";

test("all 50 trainer rules teach the situation and context before technical calculations", () => {
    const rules = RPG_RULE_SECTIONS.flatMap(section => section.rules);
    assert.equal(rules.length, 50);
    assert.equal(Object.keys(GUIDE_PLAYER_SCENES).length, 50);
    assert.equal(Object.keys(GUIDE_RULE_CONTEXTS).length, 50);
    for (const rule of rules) {
        const scene = GUIDE_PLAYER_SCENES[rule.id], context = GUIDE_RULE_CONTEXTS[rule.id];
        assert.equal(typeof scene, "string", `missing scene: ${rule.id}`);
        assert.equal(typeof context, "string", `missing context: ${rule.id}`);
        assert.ok(scene.split(/\s+/).length >= 20, `scene must explain actions: ${rule.id}`);
        assert.ok(scene.split(/\s+/).length <= 85, `scene too long for children: ${rule.id}`);
        assert.ok(context.split(/\s+/).length <= 65, `context too long for children: ${rule.id}`);
        assert.ok(!/\b(?:TODO|PLACEHOLDER|lorem ipsum)\b/.test(scene+" "+context), `unfinished copy: ${rule.id}`);
    }
    const poison = GUIDE_PLAYER_SCENES["6.2"];
    assert.match(poison, /Scarlet\/Violet/);
    assert.match(poison, /Ekans.*Poison Sting.*Pikachu/);
    assert.match(poison, /se acertar e conseguir envenená-lo/i);
    assert.match(poison, /continua(?:r)? envenenado/i);
    assert.doesNotMatch(poison, /3\s*\/\s*16|d100|3 HP para dividir/);
    assert.match(GUIDE_RULE_CONTEXTS["6.2"], /Veneno|veneno/);
    assert.match(GUIDE_PLAYER_SCENES["6.1"], /Jigglypuff.*Sing.*Eevee/);
    assert.match(GUIDE_PLAYER_SCENES["6.5"], /Golbat.*Supersonic.*Pikachu/);
    assert.match(GUIDE_PLAYER_SCENES["5.3"], /Scarlet\/Violet.*Combusken.*Double Kick.*Torchic/);
    assert.match(GUIDE_PLAYER_SCENES["7.5"], /Bulbasaur.*Vine Whip.*Geodude/);
    assert.match(GUIDE_PLAYER_SCENES["3.4"], /RPG/);
    for (const rule of rules) assert.equal(GUIDE_PLAYER_SCENES[rule.id], rule.example);
});

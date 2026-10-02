import assert from "node:assert/strict";
import test from "node:test";
import { formatName, formatType } from "../src/core/mechanics.js";
import { cleanDescription, describeSpecies, describeTrait } from "../src/core/descriptions.js";
import { getAbilityProfile, getItemProfile } from "../src/core/traitMechanics.js";

test("catalogue names retain English spelling, punctuation and acronyms without changing IDs", () => {
    const examples = [
        ["mr-mime", "Mr. Mime"], ["nidoran-f", "Nidoran♀"], ["ho-oh", "Ho-Oh"],
        ["type-null", "Type: Null"], ["porygon-z", "Porygon-Z"], ["pp-up", "PP Up"],
        ["tm01", "TM01"], ["will-o-wisp", "Will-O-Wisp"], ["u-turn", "U-turn"],
        ["charizard-mega-x", "Mega Charizard X"], ["raichu-alola", "Alolan Raichu"],
        ["groudon-primal", "Primal Groudon"], ["meowth-gmax", "Gigantamax Meowth"],
    ];
    for (const [slug, expected] of examples) assert.equal(formatName(slug), expected);
    assert.equal(formatType("grass"), "Grass");
    assert.equal(formatType("poison"), "Poison");
    const sturdy = getAbilityProfile("sturdy");
    assert.equal(sturdy.id, "sturdy");
    assert.equal(sturdy.title, "Sturdy");
    const sash = getItemProfile("focus-sash");
    assert.equal(sash.id, "focus-sash");
    assert.equal(sash.title, "Focus Sash");
    assert.equal(getItemProfile("example-berry").title, "Example Berry");
});

test("catalogue proportions display percentages and disclose approximations while retaining original source", () => {
    const entry = { language: { name: "en" }, effect: "At 1/3 HP or less, Grass-type moves deal 1.5× damage; 1/16 recovery is separate." };
    const original = structuredClone(entry);
    const description = describeTrait("ability", "overgrow", { effect_entries: [entry] });
    assert.match(description.catalog.text, /≈ 33,33% HP/);
    assert.match(description.catalog.text, /6,25% recovery/);
    assert.match(description.catalog.text, /1\.5× damage/);
    assert.deepEqual(entry, original);
    assert.equal(cleanDescription("Recovers ½ HP; costs one quarter of max HP."), "Recovers 50% HP; costs 25% of max HP.");
    assert.equal(cleanDescription("one-third; 2/3; 3/4"), "≈ 33,33%; ≈ 66,67%; 75%");
});

test("species category uses its original English name even when a translated catalogue entry exists", () => {
    const description = describeSpecies({
        genera: [{ language: { name: "pt" }, genus: "Pokémon Semente" }, { language: { name: "en" }, genus: "Seed Pokémon" }],
        habitat: { name: "grassland" }, growth_rate: { name: "medium-slow" },
    }, { height: 7, weight: 69 });
    assert.equal(description.facts[0], "Seed Pokémon");
    assert.match(description.facts.join(" "), /Grassland/);
    assert.match(description.facts.join(" "), /Medium Slow/);
    assert.match(description.facts.join(" "), /0,7 m.*6,9 kg/);
});

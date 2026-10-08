import assert from "node:assert/strict";
import test from "node:test";
import { getSamePokemonForms } from "../src/core/pokemonFormChoices.js";

const varieties = names => names.map((name, index) => ({
    is_default: index === 0,
    pokemon: { name, url: `https://pokeapi.co/api/v2/pokemon/${name}/` },
}));
const choices = (names, name, speciesId) => getSamePokemonForms(varieties(names), { name, speciesId }).map(entry => entry.pokemon.name);

test("PC form choices never change a Pokémon's region, fixed sex, size or fighting style", () => {
    for (const [speciesId, names] of [
        [52, ["meowth", "meowth-alola", "meowth-galar"]],
        [678, ["meowstic-male", "meowstic-female"]],
        [876, ["indeedee-male", "indeedee-female"]],
        [902, ["basculegion-male", "basculegion-female"]],
        [916, ["oinkologne-male", "oinkologne-female"]],
        [710, ["pumpkaboo-average", "pumpkaboo-small", "pumpkaboo-large", "pumpkaboo-super"]],
        [711, ["gourgeist-average", "gourgeist-small", "gourgeist-large", "gourgeist-super"]],
        [745, ["lycanroc-midday", "lycanroc-midnight", "lycanroc-dusk"]],
        [128, ["tauros", "tauros-paldea-combat-breed", "tauros-paldea-blaze-breed", "tauros-paldea-aqua-breed"]],
        [901, ["ursaluna", "ursaluna-bloodmoon"]],
    ]) for (const name of names) assert.deepEqual(choices(names, name, speciesId), [name], name);
});

test("Gigantamax belongs to the exact Toxtricity or Urshifu identity, not to the other variant", () => {
    for (const [speciesId, stableNames] of [
        [849, ["toxtricity-amped", "toxtricity-low-key"]],
        [892, ["urshifu-single-strike", "urshifu-rapid-strike"]],
    ]) {
        const names = stableNames.flatMap(name => [name, `${name}-gmax`]);
        for (const stable of stableNames) for (const current of [stable, `${stable}-gmax`]) {
            assert.deepEqual(choices(names, current, speciesId), [stable, `${stable}-gmax`], current);
        }
    }
});

test("the current Mega forms retain Meowstic sex and require Eternal Flower Floette", () => {
    const meowstic = ["meowstic-male", "meowstic-male-mega", "meowstic-female", "meowstic-female-mega"];
    for (const current of meowstic.slice(0, 2)) assert.deepEqual(choices(meowstic, current, 678), meowstic.slice(0, 2));
    for (const current of meowstic.slice(2)) assert.deepEqual(choices(meowstic, current, 678), meowstic.slice(2));
    const floette = ["floette", "floette-eternal", "floette-mega"];
    assert.deepEqual(choices(floette, "floette", 670), ["floette"]);
    for (const current of floette.slice(1)) assert.deepEqual(choices(floette, current, 670), floette.slice(1));
});

test("Zen Mode and Totem states keep the same regional individual", () => {
    const darmanitan = ["darmanitan-standard", "darmanitan-zen", "darmanitan-galar-standard", "darmanitan-galar-zen"];
    for (const name of darmanitan.slice(0, 2)) assert.deepEqual(choices(darmanitan, name, 555), darmanitan.slice(0, 2));
    for (const name of darmanitan.slice(2)) assert.deepEqual(choices(darmanitan, name, 555), darmanitan.slice(2));
    const raticate = ["raticate", "raticate-alola", "raticate-totem-alola"];
    assert.deepEqual(choices(raticate, "raticate", 20), ["raticate"]);
    for (const name of raticate.slice(1)) assert.deepEqual(choices(raticate, name, 20), raticate.slice(1));
    const marowak = ["marowak", "marowak-alola", "marowak-totem"];
    assert.deepEqual(choices(marowak, "marowak", 105), ["marowak"]);
    for (const name of marowak.slice(1)) assert.deepEqual(choices(marowak, name, 105), marowak.slice(1));
});

test("ordinary reversible forms remain available while regional and special individuals stay apart", () => {
    const charizard = ["charizard", "charizard-mega-x", "charizard-mega-y", "charizard-gmax"];
    for (const name of charizard) assert.deepEqual(choices(charizard, name, 6), charizard);
    const meowth = ["meowth", "meowth-gmax", "meowth-alola", "meowth-galar"];
    for (const name of meowth.slice(0, 2)) assert.deepEqual(choices(meowth, name, 52), meowth.slice(0, 2));
    const rotom = ["rotom", "rotom-heat", "rotom-wash", "rotom-fan", "rotom-frost", "rotom-mow"];
    for (const name of rotom) assert.deepEqual(choices(rotom, name, 479), rotom);
    const rockruff = ["rockruff", "rockruff-own-tempo"];
    for (const name of rockruff) assert.deepEqual(choices(rockruff, name, 744), [name]);
    const pikachu = ["pikachu", "pikachu-gmax", "pikachu-starter"];
    assert.deepEqual(choices(pikachu, "pikachu-gmax", 25), pikachu.slice(0, 2));
    assert.deepEqual(choices(pikachu, "pikachu-starter", 25), ["pikachu-starter"]);
});

test("the approved grouped cosmetic policy is preserved instead of inventing new segregated identities", () => {
    for (const [speciesId, names] of [
        [422, ["shellos", "shellos-east"]],
        [666, ["vivillon", "vivillon-polar", "vivillon-sun"]],
        [925, ["maushold-family-of-four", "maushold-family-of-three"]],
    ]) for (const name of names) assert.deepEqual(choices(names, name, speciesId), names);
});

test("catalogue choice filtering never rewrites historical Pokémon or removes its current selection", () => {
    const entries = varieties(["indeedee-male", "indeedee-female"]);
    const identity = { name: "indeedee-female", formKey: "indeedee-male", speciesId: 876, nickname: "Minha parceira", rpg: { xp: 9 } };
    const snapshot = structuredClone({ entries, identity });
    const selected = getSamePokemonForms(entries, identity);
    assert.deepEqual(selected.map(entry => entry.pokemon.name), ["indeedee-female"]);
    assert.strictEqual(selected[0], entries[1], "the original catalogue entry and URL are retained");
    assert.deepEqual({ entries, identity }, snapshot);
    assert.deepEqual(getSamePokemonForms(null, identity), []);
    assert.deepEqual(getSamePokemonForms(entries, {}), []);
});

import assert from "node:assert/strict";
import test from "node:test";
import animatedSprites from "../src/data/animated-sprites.json" with { type: "json" };
import nativeSprites from "../src/data/native-sprites.json" with { type: "json" };
import nativeCoverage from "../src/data/native-sprite-coverage.json" with { type: "json" };
import species from "../src/data/species.json" with { type: "json" };
import forms from "../src/data/forms.json" with { type: "json" };
import { buildDexCatalogue } from "../src/core/dexCatalogue.js";
import { getPokemonSpriteSources } from "../src/core/pokemonSpriteSources.js";
import { getPokemonSpriteScale, POKEMON_HEIGHTS } from "../src/core/pokemonHeights.js";

const front = key => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${key}.png`;

test("native Pokémon animation has a pinned availability index and offline static recovery", () => {
    assert.match(animatedSprites.commit, /^[0-9a-f]{40}$/);
    assert.equal(new Set(animatedSprites.regular).size, animatedSprites.regular.length);
    assert.equal(new Set(animatedSprites.shiny).size, animatedSprites.shiny.length);
    for (let id = 1; id <= 649; id += 1) assert.ok(animatedSprites.regular.includes(String(id)));
    const choices = getPokemonSpriteSources({ pokemonId: 25 });
    assert.match(choices.animated[0], new RegExp(`/${animatedSprites.commit}/.*animated/25\\.gif$`));
    assert.equal(choices.static[0], "/sprites/25.png");
    assert.ok(choices.static.every(url => !url.endsWith(".gif")));
});

test("regional and named cosmetic animations keep their exact identity", () => {
    for (const key of ["10100", "422-east", "666-sun"]) {
        const choices = getPokemonSpriteSources({ pokemonId: Number(key.split("-")[0]), spriteKey: key, src: front(key) });
        assert.ok(choices.animated.length, key);
        assert.ok([...choices.animated, ...choices.static].every(url => url.endsWith(`/${key}.gif`) || url.endsWith(`/${key}.png`)));
    }
    const east = getPokemonSpriteSources({ pokemonId: 422, src: front("422-east"), candidates: [front(422)], strictAppearance: true });
    assert.ok(east.animated[0].endsWith("/422-east.gif"));
    assert.ok(!east.static.includes(front(422)));
});

test("shiny animation and recovery never fall back to the regular palette", () => {
    const choices = getPokemonSpriteSources({ pokemonId: 25, shiny: true });
    assert.ok(choices.animated[0].endsWith("/animated/shiny/25.gif"));
    assert.equal(choices.static[0], front("shiny/25"));
    assert.ok(!choices.static.includes("/sprites/25.png"));
    const fromToken = getPokemonSpriteSources({ pokemonId: 25, src: choices.animated[0] });
    assert.ok(fromToken.animated[0].endsWith("/animated/shiny/25.gif"));
    const missingShiny = getPokemonSpriteSources({ pokemonId: 715, shiny: true });
    assert.ok(missingShiny.animated[0].endsWith("/other/showdown/shiny/715.gif"));
    assert.equal(missingShiny.static[0], front("shiny/715"));
});

test("missing animations never invent URLs or erase fixed form appearance", () => {
    const key = "999999-unavailable-appearance";
    const choices = getPokemonSpriteSources({ pokemonId: 999999, spriteKey: key, src: front(key) });
    assert.deepEqual(choices.animated, []);
    assert.ok(choices.static.every(url => url.endsWith(`/${key}.png`)));
    const opaque = getPokemonSpriteSources({ pokemonId: 422, src: "/my-shellos-east.png", strictAppearance: true });
    assert.deepEqual(opaque, { animated: [], static: ["/my-shellos-east.png"] });
    for (const view of ["female", "back", "back/shiny/female"]) {
        const source = front(`${view}/25`);
        const choices = getPokemonSpriteSources({ pokemonId: 25, src: source });
        assert.ok(choices.animated.length, view);
        assert.ok(choices.animated.every(url => url.includes(`/${view}/25.gif`)), view);
        assert.ok(choices.static.every(url => url.includes(`/${view}/25.png`)), view);
    }
    const source = front("forms/999999");
    assert.deepEqual(getPokemonSpriteSources({ pokemonId: 25, src: source }), { animated: [], static: [source] });
});

test("null sprites and absent resources remain safe and use only valid fallback identities", () => {
    assert.deepEqual(getPokemonSpriteSources({ src: null, pokemonId: null, candidates: null }), { animated: [], static: [] });
    const choices = getPokemonSpriteSources({ pokemonId: 1025, src: null });
    assert.equal(choices.animated[0], nativeSprites.local["1025"][""].animated);
    assert.ok(choices.static.includes(front(1025)));
    assert.deepEqual(getPokemonSpriteSources({ pokemonId: 0, spriteKey: "../../25", candidates: [null, ""] }), { animated: [], static: [] });
});

test("Toedscool and Scovillain use verified exact Showdown animations in every available angle and palette", () => {
    assert.match(animatedSprites.showdownTree, /^[0-9a-f]{40}$/);
    for (const id of [948, 952]) for (const view of ["", "shiny", "back", "back/shiny"]) {
        const src = front(`${view ? `${view}/` : ""}${id}`);
        const choices = getPokemonSpriteSources({ pokemonId: id, src });
        assert.ok(animatedSprites.showdown[view].includes(String(id)));
        assert.ok(choices.animated[0].endsWith(`/other/showdown/${view ? `${view}/` : ""}${id}.gif`));
        assert.ok(choices.static.every(url => !url.endsWith(".gif")));
    }
});

test("every National Dex species has an animated identity in both palettes without fetching a catalogue", () => {
    assert.equal(species.length, 1025);
    for (const entry of species) for (const shiny of [false, true]) {
        const id = Number(entry.url.match(/\/(\d+)\/$/)[1]);
        const choices = getPokemonSpriteSources({ pokemonId: id, shiny });
        assert.ok(choices.animated.length, `${entry.name}${shiny ? " shiny" : ""}`);
        assert.ok(choices.static.length, `${entry.name} has reduced-motion recovery`);
    }
});

test("native and external animation tokens retain exact identity and static recovery when reused in a room", () => {
    for (const [key, views] of Object.entries(nativeSprites.local)) for (const [view, source] of Object.entries(views)) {
        const reused = getPokemonSpriteSources({ pokemonId: Number(key.split("-")[0]), src: source.animated });
        assert.ok(reused.animated.includes(source.animated), `${key}/${view}`);
        assert.ok(reused.static.includes(source.static), `${key}/${view} static recovery`);
    }
    for (const key of Object.keys(nativeSprites.external)) for (const view of ["", "shiny", "back", "back/shiny"]) {
        const source = getPokemonSpriteSources({ pokemonId: Number(key.split("-")[0]), spriteKey: key, src: front(`${view ? `${view}/` : ""}${key}`) });
        for (const url of source.animated) {
            const reused = getPokemonSpriteSources({ src: url });
            assert.ok(reused.animated.includes(url), `${key}/${view}`);
            assert.ok(reused.static.length, `${key}/${view}`);
        }
    }
});

test("bundled availability has no duplicate or unsafe keys in any animated view", () => {
    for (const views of [{ "": animatedSprites.regular, shiny: animatedSprites.shiny, ...animatedSprites.views }, animatedSprites.showdown]) {
        for (const keys of Object.values(views)) {
            assert.equal(new Set(keys).size, keys.length);
            assert.ok(keys.every(key => /^[0-9]+(?:-[a-z0-9-]+)?$/.test(key)));
        }
    }
    assert.equal(buildDexCatalogue(species, forms).length, 1112);
});

test("all exposed Dex choices and persistent appearances animate in both exact palettes", () => {
    const catalogue = buildDexCatalogue(species, forms);
    for (const entry of catalogue) for (const shiny of [false, true]) {
        const choices = getPokemonSpriteSources({ pokemonId: entry.pokemonId, spriteKey: entry.spriteKey, shiny });
        assert.ok(choices.animated.length, `${entry.choiceKey}${shiny ? " shiny" : ""}`);
        assert.ok(choices.static.length, `${entry.choiceKey} reduced motion`);
    }
    assert.deepEqual(nativeCoverage.missingDex, []);
});

test("the complete technical catalogue is audited without hiding unavailable identities", () => {
    const missingResources = [];
    for (const [id, name] of Object.entries(nativeSprites.pokemonResources)) for (const view of ["", "shiny", "back", "back/shiny"]) {
        const choices = getPokemonSpriteSources({ pokemonId: Number(id), src: front(`${view ? `${view}/` : ""}${id}`) });
        if (!choices.animated.length) missingResources.push({ id, name, view });
    }
    const missingForms = [];
    for (const [formId, key] of Object.entries(nativeSprites.formKeys)) for (const view of ["", "shiny"]) {
        const choices = getPokemonSpriteSources({ spriteKey: key, src: front(`forms/${view ? `${view}/` : ""}${formId}`) });
        if (!choices.animated.length) missingForms.push({ formId, key, view });
    }
    assert.equal(nativeCoverage.catalogueCommit, nativeSprites.catalogueCommit);
    assert.equal(nativeCoverage.pokemonResources, Object.keys(nativeSprites.pokemonResources).length);
    assert.equal(nativeCoverage.formIds, Object.keys(nativeSprites.formKeys).length);
    assert.deepEqual(missingResources, nativeCoverage.missingResources);
    assert.deepEqual(missingForms, nativeCoverage.missingForms);
});

test("cosmetic form-resource IDs resolve to their exact sprite keys instead of becoming Pokémon IDs", () => {
    assert.equal(Object.keys(nativeSprites.formKeys).length, 1579);
    assert.equal(Object.keys(nativeSprites.pokemonResources).length, 1351);
    for (const entry of forms.defaults.concat(forms.entries)) {
        assert.equal(nativeSprites.formKeys[String(entry.formId)], entry.spriteKey, entry.name);
        for (const shiny of [false, true]) {
            const formUrl = front(`forms/${shiny ? "shiny/" : ""}${entry.formId}`);
            const fromForm = getPokemonSpriteSources({ pokemonId: entry.pokemonId, src: formUrl });
            const fromKey = getPokemonSpriteSources({ pokemonId: entry.pokemonId, spriteKey: entry.spriteKey, shiny });
            assert.ok(fromForm.animated.length, `${entry.name}${shiny ? " shiny" : ""}`);
            assert.deepEqual(fromForm.animated, fromKey.animated, entry.name);
        }
    }
    const unknownUrl = front("forms/999999");
    assert.ok(getPokemonSpriteSources({ spriteKey: "666-sun", src: unknownUrl, strictAppearance: true }).animated.every(url => url.endsWith("/666-sun.gif")));
});

test("mixed source candidates cannot erase shiny palettes, back angles or visible gender differences", () => {
    for (const view of ["shiny", "female", "back", "back/shiny/female"]) {
        const source = front(`${view}/25`);
        const choices = getPokemonSpriteSources({ pokemonId: 25, src: source, candidates: [front(25), front("female/25"), front("back/25")] });
        assert.ok(choices.animated.every(url => url.includes(`/${view}/25.gif`)));
        assert.ok(choices.static.every(url => url.includes(`/${view}/25.png`)));
    }
    const lowPower = getPokemonSpriteSources({ spriteKey: "10268-low-power-mode", shiny: true });
    assert.equal(lowPower.animated[0], nativeSprites.local["10268"].shiny.animated);
});

test("official heights keep small Pokémon visible and preserve increasing proportions", () => {
    const increasing = [1, 3, 4, 12, 24, 145, 1000];
    const scales = increasing.map(height => getPokemonSpriteScale(0, height));
    assert.ok(scales.every(value => value > 0.72 && value < 1));
    assert.ok(scales.every((value, index) => index === 0 || value > scales[index - 1]));
    assert.equal(getPokemonSpriteScale(25), getPokemonSpriteScale(0, POKEMON_HEIGHTS[25]));
    assert.ok(getPokemonSpriteScale(10114) > getPokemonSpriteScale(103));
    assert.equal(getPokemonSpriteScale(0, null), 1);
});

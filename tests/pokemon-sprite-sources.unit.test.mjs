import assert from "node:assert/strict";
import test from "node:test";
import animatedSprites from "../src/data/animated-sprites.json" with { type: "json" };
import nativeSprites from "../src/data/native-sprites.json" with { type: "json" };
import nativeCoverage from "../src/data/native-sprite-coverage.json" with { type: "json" };
import species from "../src/data/species.json" with { type: "json" };
import forms from "../src/data/forms.json" with { type: "json" };
import { buildDexCatalogue } from "../src/core/dexCatalogue.js";
import { getPokemonSpriteIdentity, getPokemonSpriteProvenance, getPokemonSpriteSources, isPokemonSpriteSource2D } from "../src/core/pokemonSpriteSources.js";
import { getPokemonSpriteScale, POKEMON_HEIGHTS } from "../src/core/pokemonHeights.js";

const front = key => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${key}.png`;
const pinned = key => front(key).replace("/master/", `/${animatedSprites.commit}/`);

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
    assert.equal(choices.static[0], pinned("shiny/25"));
    assert.ok(!choices.static.includes("/sprites/25.png"));
    const fromToken = getPokemonSpriteSources({ pokemonId: 25, src: choices.animated[0] });
    assert.ok(fromToken.animated[0].endsWith("/animated/shiny/25.gif"));
    const missingShiny = getPokemonSpriteSources({ pokemonId: 715, shiny: true });
    assert.equal(missingShiny.animated[0], nativeSprites.local["715"].shiny.animated);
    assert.equal(missingShiny.static[0], nativeSprites.local["715"].shiny.static);
    assert.ok([...missingShiny.animated, ...missingShiny.static].every(isPokemonSpriteSource2D));
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
    assert.deepEqual(getPokemonSpriteSources({ pokemonId: 25, src: source }), { animated: [], static: [] });
});

test("null sprites and absent resources remain safe and use only valid fallback identities", () => {
    assert.deepEqual(getPokemonSpriteSources({ src: null, pokemonId: null, candidates: null }), { animated: [], static: [] });
    const choices = getPokemonSpriteSources({ pokemonId: 1025, src: null });
    assert.equal(choices.animated[0], nativeSprites.local["1025"][""].animated);
    assert.equal(choices.static[0], nativeSprites.local["1025"][""].static);
    assert.ok(!choices.static.includes(front(1025)), "an unverified modern PNG cannot become a 3D fallback");
    assert.deepEqual(getPokemonSpriteSources({ pokemonId: 0, spriteKey: "../../25", candidates: [null, ""] }), { animated: [], static: [] });
});

test("Toedscool, Scovillain and Cinderace use verified authored 2D in every angle and palette", () => {
    for (const id of [815, 948, 952]) for (const view of ["", "shiny", "back", "back/shiny"]) {
        const src = front(`${view ? `${view}/` : ""}${id}`);
        const choices = getPokemonSpriteSources({ pokemonId: id, src });
        assert.equal(choices.animated[0], nativeSprites.local[String(id)][view].animated);
        assert.equal(choices.static[0], nativeSprites.local[String(id)][view].static);
        assert.ok([...choices.animated, ...choices.static].every(isPokemonSpriteSource2D));
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
            const auditedGap = nativeCoverage.missingForms.some(gap => gap.formId === String(entry.formId) && gap.view === (shiny ? "shiny" : ""));
            assert.equal(fromForm.animated.length === 0, auditedGap, `${entry.name}${shiny ? " shiny" : ""}: unavailable art must stay explicit`);
            assert.deepEqual(fromForm.animated, fromKey.animated, entry.name);
        }
    }
    const unknownUrl = front("forms/999999");
    assert.ok(getPokemonSpriteSources({ spriteKey: "666-sun", src: unknownUrl, strictAppearance: true }).animated.every(url => url.endsWith("/666-sun.gif")));
});

test("3D historical room tokens migrate to the same exact 2D identity without becoming candidates", () => {
    for (const id of [815, 948, 952]) for (const view of ["", "shiny", "back", "back/shiny"]) {
        const token = `https://raw.githubusercontent.com/PokeAPI/sprites/old-commit/sprites/pokemon/other/showdown/${view ? `${view}/` : ""}${id}.gif`;
        assert.equal(isPokemonSpriteSource2D(token), false);
        const choices = getPokemonSpriteSources({ src: token });
        assert.equal(choices.animated[0], nativeSprites.local[String(id)][view].animated);
        assert.equal(choices.static[0], nativeSprites.local[String(id)][view].static);
        assert.ok(!choices.animated.includes(token));
    }
    const token = "https://raw.githubusercontent.com/smogon/sprites/master/src/models/smaushold-b-s.gif";
    assert.deepEqual(getPokemonSpriteIdentity(token), { key: "10257", view: "back/shiny" });
    assert.equal(getPokemonSpriteSources({ src: token }).animated[0], nativeSprites.local["10257"]["back/shiny"].animated);
    for (const token of [front("other/home/815"), front("other/official-artwork/815"), front("forms/999999")]) {
        assert.equal(getPokemonSpriteProvenance(token), null);
        assert.ok(getPokemonSpriteSources({ src: token }).static.every(isPokemonSpriteSource2D));
    }
});

test("every selected catalogue animation and recovery has positive 2D provenance", () => {
    for (const id of Object.keys(nativeSprites.pokemonResources)) for (const view of ["", "shiny", "back", "back/shiny"]) {
        const choices = getPokemonSpriteSources({ src: front(`${view ? `${view}/` : ""}${id}`) });
        for (const url of [...choices.animated, ...choices.static]) {
            assert.ok(isPokemonSpriteSource2D(url), `${id}/${view}: ${url}`);
            assert.equal(getPokemonSpriteProvenance(url).verified, true);
        }
    }
    assert.equal(isPokemonSpriteSource2D("https://example.com/unverified.gif"), false, "moving bytes do not establish authored 2D provenance");
    assert.equal(getPokemonSpriteProvenance(null), null);
});

test("local decorative masters retain their own exact BW animation and provenance", () => {
    for (const [key, master] of Object.entries(nativeSprites.companions)) {
        const choices = getPokemonSpriteSources({ src: master.animated, candidates: [master.static], pokemonId: Number(key), strictAppearance: true });
        assert.deepEqual(choices, { animated: [master.animated], static: [master.static] });
        assert.ok([...choices.animated, ...choices.static].every(isPokemonSpriteSource2D));
    }
});

test("historical native tokens keep their appearance when current immutable art replaces them", () => {
    for (const [token, identity] of Object.entries(nativeSprites.legacyTokens)) {
        assert.deepEqual(getPokemonSpriteIdentity(token, { spriteKey: identity.key, shiny: identity.view.includes("shiny") }), identity, token);
        const current = nativeSprites.local[identity.key]?.[identity.view];
        const choices = getPokemonSpriteSources({ src: token });
        assert.ok(choices.animated.includes(current.animated), token);
        assert.ok(choices.static.includes(current.static), token);
    }
    assert.ok(!getPokemonSpriteSources({ src: "/sprites/native/10084-back.gif" }).animated.includes("/sprites/native/10084-back.gif"), "the old Pop Star drawing must not be shown as Libre");
});

test("content deduplication preserves contextual form identity and exact palette", () => {
    for (const [base, form, view] of [["758", "10129", ""], ["133", "10159", "female"]]) {
        const source = nativeSprites.local[base][view].animated;
        assert.equal(source, nativeSprites.local[form][view].animated, "fixture really shares authored pixels");
        assert.deepEqual(getPokemonSpriteIdentity(source, { pokemonId: Number(form) }), { key: form, view });
        assert.deepEqual(getPokemonSpriteIdentity(source, { pokemonId: Number(base) }), { key: base, view });
    }
    const source = nativeSprites.local["1000"].back.animated;
    assert.equal(source, nativeSprites.local["1000"]["back/shiny"].animated);
    assert.deepEqual(getPokemonSpriteIdentity(source, { pokemonId: 1000, shiny: false }), { key: "1000", view: "back" });
    assert.deepEqual(getPokemonSpriteIdentity(source, { pokemonId: 1000, shiny: true }), { key: "1000", view: "back/shiny" });
    assert.deepEqual(getPokemonSpriteIdentity(nativeSprites.local["10033"][""].animated, { pokemonId: 3 }), { key: "10033", view: "" }, "a distinct Mega appearance must not become the original species");
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

test("physical height remains linear while portraits choose their own framing", () => {
    const increasing = [1, 3, 4, 12, 24, 145, 1000];
    const scales = increasing.map(height => getPokemonSpriteScale(0, height));
    assert.deepEqual(scales, increasing.map(height => height / 10));
    assert.ok(scales.every((value, index) => index === 0 || value > scales[index - 1]));
    assert.equal(getPokemonSpriteScale(25), getPokemonSpriteScale(0, POKEMON_HEIGHTS[25]));
    assert.ok(getPokemonSpriteScale(10114) > getPokemonSpriteScale(103));
    assert.equal(getPokemonSpriteScale(0, null), 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import animatedSprites from "../src/data/animated-sprites.json" with { type: "json" };
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

test("shiny animation and recovery stay shiny before a regular variant fallback", () => {
    const choices = getPokemonSpriteSources({ pokemonId: 25, shiny: true });
    assert.ok(choices.animated[0].endsWith("/animated/shiny/25.gif"));
    assert.equal(choices.static[0], front("shiny/25"));
    assert.ok(!choices.static.includes("/sprites/25.png"));
    const fromToken = getPokemonSpriteSources({ pokemonId: 25, src: choices.animated[0] });
    assert.ok(fromToken.animated[0].endsWith("/animated/shiny/25.gif"));
    const missingShiny = getPokemonSpriteSources({ pokemonId: 715, shiny: true });
    assert.deepEqual(missingShiny.animated, []);
    assert.equal(missingShiny.static[0], front("shiny/715"));
});

test("missing animations never invent URLs or erase fixed form appearance", () => {
    const key = "869-ruby-cream-berry-sweet";
    const choices = getPokemonSpriteSources({ pokemonId: 869, spriteKey: key, src: front(key) });
    assert.deepEqual(choices.animated, []);
    assert.ok(choices.static.every(url => url.endsWith(`/${key}.png`)));
    const opaque = getPokemonSpriteSources({ pokemonId: 422, src: "/my-shellos-east.png", strictAppearance: true });
    assert.deepEqual(opaque, { animated: [], static: ["/my-shellos-east.png"] });
    for (const view of ["female", "back", "forms"]) {
        const source = front(`${view}/25`);
        assert.deepEqual(getPokemonSpriteSources({ pokemonId: 25, src: source }), { animated: [], static: [source] });
    }
});

test("null sprites and absent resources remain safe and use only valid fallback identities", () => {
    assert.deepEqual(getPokemonSpriteSources({ src: null, pokemonId: null, candidates: null }), { animated: [], static: [] });
    const choices = getPokemonSpriteSources({ pokemonId: 1025, src: null });
    assert.deepEqual(choices.animated, []);
    assert.deepEqual(choices.static, [front(1025)]);
    assert.deepEqual(getPokemonSpriteSources({ pokemonId: 0, spriteKey: "../../25", candidates: [null, ""] }), { animated: [], static: [] });
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

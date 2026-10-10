import assert from "node:assert/strict";
import test from "node:test";
import { getPokemonDisplayHeight, getPokemonHeight, getPokemonSceneReferenceHeight, getPokemonSpriteScale } from "../src/core/pokemonHeights.js";
import { getPokemonSpriteFraming } from "../src/core/pokemonSpriteFraming.js";
import { createSpriteActivityRegistry } from "../src/core/spriteActivity.js";
import framing from "../src/data/sprite-framing.json" with { type: "json" };
import nativeSprites from "../src/data/native-sprites.json" with { type: "json" };

const flush = () => new Promise(resolve => queueMicrotask(resolve));
const events = () => {
    const handlers = new Map();
    return {
        handlers,
        addEventListener(name, callback) { handlers.set(name, callback); },
        removeEventListener(name, callback) { if (handlers.get(name) === callback) handlers.delete(name); },
        fire(name) { handlers.get(name)?.(); },
    };
};
const makeEnvironment = () => {
    const observers = [];
    const media = { ...events(), matches: false };
    const document = { ...events(), hidden: false, querySelectorAll: () => [] };
    const window = {
        matchMedia: () => media,
        IntersectionObserver: class {
            constructor(callback) { this.callback = callback; this.elements = new Set(); this.disconnected = false; observers.push(this); }
            observe(element) { this.elements.add(element); }
            unobserve(element) { this.elements.delete(element); }
            disconnect() { this.disconnected = true; this.elements.clear(); }
        },
    };
    return { window, document, media, observers };
};

test("physical scale does not cap or compress the documented smallest and largest bodies", () => {
    const entries = [{ pokemonId: 669 }, { pokemonId: 321 }, { pokemonId: 10190 }];
    const reference = getPokemonSceneReferenceHeight(entries);
    assert.equal(reference, 1000);
    assert.equal(getPokemonSpriteScale(321, undefined, reference) / getPokemonSpriteScale(669, undefined, reference), 145);
    assert.equal(getPokemonSpriteScale(10190, undefined, reference), 1);
    assert.equal(getPokemonHeight(10114), 109, "Alolan Exeggutor retains its own physical height");
    assert.equal(getPokemonHeight(0, undefined), null, "unknown size is not invented");
    assert.equal(getPokemonDisplayHeight(null), null);
    assert.equal(getPokemonSceneReferenceHeight(null), 10);
    for (const invalid of [0, -2, NaN, Infinity, "invalid"]) assert.equal(getPokemonSpriteScale(25, undefined, invalid), 1);
});

test("displayed forms determine physical height before a token's original species", () => {
    const src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10114.png";
    assert.equal(getPokemonDisplayHeight({ src, pokemonId: 103 }), 109);
    assert.equal(getPokemonDisplayHeight({ pokemonId: 103, spriteKey: "10114" }), 109);
    assert.equal(getPokemonDisplayHeight({ src, pokemonId: 103, height: 120 }), 120);
    assert.equal(getPokemonDisplayHeight({ src: "/unknown-portrait.png", pokemonId: 103 }), 20);
    assert.equal(getPokemonSceneReferenceHeight([{ src, pokemonId: 103 }, { pokemonId: 25 }]), 109);
});

test("deduplicated pixel art preserves distinct physical bodies and displayed transformations", () => {
    const salazzle = nativeSprites.local["758"][""].animated;
    assert.equal(salazzle, nativeSprites.local["10129"][""].animated, "the base and Totem use the same authored pixels");
    assert.equal(getPokemonDisplayHeight({ src: salazzle, pokemonId: 758 }), 12);
    assert.equal(getPokemonDisplayHeight({ src: salazzle, pokemonId: 10129 }), 21);
    assert.equal(getPokemonDisplayHeight({ src: salazzle, pokemonId: 758, spriteKey: "10129" }), 21, "an explicit displayed form keeps priority");
    assert.equal(getPokemonSceneReferenceHeight([{ src: salazzle, pokemonId: 758 }, { src: salazzle, pokemonId: 10129 }]), 21);

    const cinderace = nativeSprites.local["815"][""].animated;
    assert.equal(getPokemonDisplayHeight({ src: cinderace, pokemonId: 132 }), 14, "Transform displays the copied body instead of Ditto's original size");
    const alolanExeggutor = `https://raw.githubusercontent.com/PokeAPI/sprites/${framing.pokeapiCommit}/sprites/pokemon/10114.png`;
    assert.equal(getPokemonDisplayHeight({ src: alolanExeggutor, pokemonId: 571 }), 109, "Illusion displays the disguise instead of Zoroark's original size");
});

test("framing removes only measured transparent margins and never invents an unknown aspect ratio", () => {
    assert.equal(framing.measurement, "alpha-union-all-authored-frames");
    assert.ok(Object.keys(framing.assets).length > 5800);
    assert.ok(Object.keys(framing.assets).every(source => !source.includes("/models/")), "unused 3D render dimensions do not enter the 2D presentation index");
    for (const [source, [width, height, x, y, bodyWidth, bodyHeight]] of Object.entries(framing.assets)) {
        assert.ok(width > 0 && height > 0 && x >= 0 && y >= 0 && bodyWidth > 0 && bodyHeight > 0, source);
        assert.ok(x + bodyWidth <= width && y + bodyHeight <= height, source);
    }
    const joltik = getPokemonSpriteFraming(`https://raw.githubusercontent.com/PokeAPI/sprites/${framing.pokeapiCommit}/sprites/pokemon/595.png`);
    assert.equal(joltik.known, true);
    assert.ok(joltik.bodyHeight < joltik.height / 2, "small bodies get genuine individual camera framing instead of losing their pixels in a padded canvas");
    assert.equal(getPokemonSpriteFraming("https://example.org/custom-portrait.png").known, false);
    assert.equal(getPokemonSpriteFraming("https://raw.githubusercontent.com/PokeAPI/sprites/different-revision/sprites/pokemon/595.png").known, false, "a different source revision is not cropped using an unrelated measurement");
});

test("every bundled catalogue appearance has measured framing for animation and reduced motion", () => {
    for (const [identity, views] of Object.entries(nativeSprites.local)) {
        for (const [view, asset] of Object.entries(views)) {
            for (const source of [asset.animated, asset.static].filter(Boolean)) {
                assert.equal(getPokemonSpriteFraming(source).known, true, `${identity} (${view || "front"}): ${source}`);
            }
        }
    }
});

test("a full collection shares one observer and changes only affected sprite subscriptions", async () => {
    const environment = makeEnvironment();
    const registry = createSpriteActivityRegistry(environment);
    const states = Array.from({ length: 1000 }, () => []);
    const elements = states.map(() => ({}));
    const cleanups = elements.map((element, index) => registry.subscribe(element, value => states[index].push(value)));
    await flush();
    assert.equal(environment.observers.length, 1);
    assert.equal(environment.media.handlers.size, 1);
    assert.equal(environment.document.handlers.size, 1);
    assert.ok(states.every(state => state.length === 1 && !state[0].visible));
    environment.observers[0].callback([{ target: elements[8], isIntersecting: true }]);
    await flush();
    assert.equal(states[8].length, 2);
    assert.equal(states[8].at(-1).visible, true);
    assert.ok(states.every((state, index) => index === 8 || state.length === 1), "scrolling one body does not force 999 redundant updates");
    environment.observers[0].callback([{ target: elements[8], isIntersecting: true }]);
    await flush();
    assert.equal(states[8].length, 2, "duplicate intersection events do not restart authentic animation");
    cleanups.forEach(cleanup => cleanup());
    assert.equal(environment.observers[0].disconnected, true);
    assert.equal(environment.media.handlers.size, 0);
    assert.equal(environment.document.handlers.size, 0);
});

test("background tabs, covered game screens and reduced motion update the same shared scheduler", async () => {
    const environment = makeEnvironment();
    const registry = createSpriteActivityRegistry(environment);
    const element = { covered: false, closest() { return this.covered ? {} : null; } };
    const values = [];
    const cleanup = registry.subscribe(element, state => values.push(state));
    environment.observers[0].callback([{ target: element, isIntersecting: true }]);
    await flush();
    assert.equal(values.at(-1).visible, true);
    environment.document.hidden = true;
    environment.document.fire("visibilitychange");
    await flush();
    assert.equal(values.at(-1).visible, false);
    environment.document.hidden = false;
    environment.document.fire("visibilitychange");
    environment.media.matches = true;
    environment.media.fire("change");
    await flush();
    assert.deepEqual(values.at(-1), { ready: true, visible: true, reducedMotion: true });
    element.covered = true;
    environment.media.fire("change");
    await flush();
    assert.equal(values.at(-1).visible, false);
    element.covered = false;
    environment.document.querySelectorAll = () => [{ closest: () => null, getClientRects: () => [{}], contains: () => false }];
    environment.media.fire("change");
    await flush();
    assert.equal(values.at(-1).visible, false, "a modal pauses the underlying world while leaving its own sprites active");
    cleanup();
});

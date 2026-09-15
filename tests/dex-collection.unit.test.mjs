import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeDexSearch, selectDexSpecies, urlForView, viewFromUrl } from "../src/core/dexCollection.js";
const species = [[25, "pikachu"], [122, "mr-mime"], [29, "nidoran-f"], [83, "farfetchd"], [1, "bulbasaur"]].map(([id, name]) => ({ name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` }));

test("dex search understands padded numbers, accents, punctuation and gender", () => {
  for (const [query, expected] of [["#0025", "pikachu"], ["Mr. Mime", "mr-mime"], ["nídoran ♀", "nidoran-f"], ["Farfetch’d", "farfetchd"]]) {
    assert.deepEqual(selectDexSpecies(species, { query }).map(p => p.name), [expected]);
  }
  assert.equal(normalizeDexSearch("Pokémon"), "pokemon");
  assert.deepEqual(selectDexSpecies(species, { query: "0000" }), []);
});

test("favorites combine with search and sorting without mutating the catalogue", () => {
  const original = structuredClone(species);
  assert.deepEqual(selectDexSpecies(species, { favorites: ["25", "1"], onlyFavorites: true }).map(p => p.name), ["bulbasaur", "pikachu"]);
  assert.deepEqual(selectDexSpecies(species, { favorites: [], onlyFavorites: true }), []);
  assert.deepEqual(selectDexSpecies(species, { favorites: ["25"], onlyFavorites: true, query: "mime" }), []);
  assert.equal(selectDexSpecies(species, { order: "reverse" })[0].name, "mr-mime");
  assert.equal(selectDexSpecies(species, { order: "name" })[0].name, "bulbasaur");
  assert.deepEqual(species, original);
});

test("navigation round trips all four areas without dropping an adventure invite", () => {
  for (const view of ["room", "pokedex", "teambuilder", "guide"]) {
    const next = new URL(urlForView("https://example.com/?room=ABC123&key=example#notes", view), "https://example.com");
    assert.equal(viewFromUrl(next), view);
    assert.equal(next.searchParams.get("room"), "ABC123");
    assert.equal(next.searchParams.get("key"), "example");
    assert.equal(next.hash, "#notes");
  }
  assert.equal(viewFromUrl("https://example.com/?abrir=unknown"), undefined);
});

const luminance = hex => {
  const c = hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
test("both game-edition themes keep normal text above WCAG AA contrast", async () => {
  const css = await readFile(new URL("../src/game-edition.css", import.meta.url), "utf8");
  for (const block of [css.match(/:root\s*\{([^}]+)/)[1], css.match(/html\[data-theme="night"\]\s*\{([^}]+)/)[1]]) {
    const tokens = Object.fromEntries([...block.matchAll(/--ui-([a-z]+):\s*#([a-f0-9]{6});/gi)].map(m => [m[1], m[2]]));
    for (const [foreground, background] of [["ink", "panel"], ["muted", "panel"], ["muted", "raised"], ["blue", "selected"]]) {
      const values = [luminance(tokens[foreground]), luminance(tokens[background])].sort((a,b) => b-a);
      assert.ok((values[0]+.05)/(values[1]+.05) >= 4.5, `${foreground} on ${background}`);
    }
    assert.ok((1.05)/(luminance(tokens.accent)+.05) >= 4.5, "white on action red");
  }
});

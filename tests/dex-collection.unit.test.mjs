import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DEX_GENERATIONS, debutGeneration, normalizeDexSearch, selectDexSpecies, urlForView, viewFromUrl } from "../src/core/dexCollection.js";
const species = [[25, "pikachu"], [122, "mr-mime"], [29, "nidoran-f"], [83, "farfetchd"], [1, "bulbasaur"]].map(([id, name]) => ({ name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` }));

test("generation filters respect every National Dex debut boundary, including Hisui and Pecharunt", () => {
  const catalogue = Array.from({ length: 1026 }, (_, i) => ({ name: `pokemon-${i + 1}`, url: `https://pokeapi.co/api/v2/pokemon-species/${i + 1}/` }));
  for (const generation of DEX_GENERATIONS.slice(1)) {
    const selected = selectDexSpecies(catalogue, { generation: generation.id });
    assert.equal(selected.length, generation.end - generation.start + 1);
    assert.equal(selected[0].name, `pokemon-${generation.start}`);
    assert.equal(selected.at(-1).name, `pokemon-${generation.end}`);
  }
  assert.equal(debutGeneration(905).label, "VIII");
  assert.equal(debutGeneration(1025).label, "IX");
  assert.equal(debutGeneration(1026), undefined);
  assert.equal(selectDexSpecies(catalogue).length, 1026);
  assert.deepEqual(selectDexSpecies(catalogue, { generation: "2", query: "0025" }), []);
  assert.deepEqual(selectDexSpecies(catalogue, { generation: "1", favorites: ["25"], onlyFavorites: true }).map(p => p.name), ["pokemon-25"]);
});

test("dex search understands padded numbers, accents, punctuation and gender", () => {
  for (const [query, expected] of [["#0025", "pikachu"], ["Mr. Mime", "mr-mime"], ["nídoran ♀", "nidoran-f"], ["Farfetch’d", "farfetchd"]]) {
    assert.deepEqual(selectDexSpecies(species, { query }).map(p => p.name), [expected]);
  }
  assert.equal(normalizeDexSearch("Pokémon"), "pokemon");
  assert.deepEqual(selectDexSpecies(species, { query: "0000" }), []);
});

test("dex search accepts explicit National Dex intervals and keeps fixed forms with their species number", () => {
  const catalogue = [
    { name: "rattata", url: "https://pokeapi.co/api/v2/pokemon-species/19/" },
    { name: "rattata-alola", url: "https://pokeapi.co/api/v2/pokemon-species/19/", speciesId: 19, pokemonId: 10091, formKey: "rattata-alola", generation: 7 },
    { name: "raichu", url: "https://pokeapi.co/api/v2/pokemon-species/26/" },
    { name: "sandshrew", url: "https://pokeapi.co/api/v2/pokemon-species/27/" },
  ];
  assert.deepEqual(selectDexSpecies(catalogue, { query: "19-26" }).map(p => p.name), ["rattata", "rattata-alola", "raichu"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "#0026 a #0019" }).map(p => p.name), ["rattata", "rattata-alola", "raichu"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "19..26", generation: "7" }).map(p => p.name), ["rattata-alola"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "1026-1030" }), []);
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
test("both journey themes keep normal text and primary actions above WCAG AA contrast", async () => {
  const css = await readFile(new URL("../src/journey.css", import.meta.url), "utf8");
  const blocks = [css.match(/(?:html)?:root\s*\{([^}]+)/)[1], css.match(/html\[data-theme="night"\]\s*\{([^}]+)/)[1]];
  for (const [index, block] of blocks.entries()) {
    const tokens = Object.fromEntries([...block.matchAll(/--ui-([a-z]+):\s*#([a-f0-9]{6});/gi)].map(m => [m[1], m[2]]));
    for (const [foreground, background] of [["ink", "panel"], ["muted", "panel"], ["muted", "raised"], ["blue", "selected"], ["accent", "panel"]]) {
      const values = [luminance(tokens[foreground]), luminance(tokens[background])].sort((a,b) => b-a);
      const ratio = (values[0]+.05)/(values[1]+.05);
      assert.ok(ratio >= 4.5, `theme ${index}: ${foreground} on ${background}, ${ratio.toFixed(2)}:1`);
    }
  }
  const primaryAction = css.match(/:is\(\.room-primary-button,[^{]*\{([^}]+)/)[1];
  const background = primaryAction.match(/background:\s*#([a-f0-9]{6})/i)[1];
  assert.match(primaryAction, /color:\s*#fff\b/);
  assert.ok(1.05/(luminance(background)+.05) >= 4.5, "white text on the primary action");
});

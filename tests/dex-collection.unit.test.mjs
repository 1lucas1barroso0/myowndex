import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DEX_GENERATIONS, debutGeneration, dexEntryRegion, normalizeDexSearch, parseDexRange, selectDexSpecies, urlForView, viewFromUrl } from "../src/core/dexCollection.js";
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
  assert.equal(selectDexSpecies(catalogue).length, 1025);
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
  assert.deepEqual(selectDexSpecies(catalogue, { query: "19-26" }).map(p => p.name), ["rattata", "raichu"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "19-26", variantMode: "separate" }).map(p => p.name), ["rattata", "rattata-alola", "raichu"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "#0026 a #0019" }).map(p => p.name), ["rattata", "raichu"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "19..26", generation: "7" }).map(p => p.name), ["rattata-alola"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "1026-1030" }), []);
});

test("a matching later identity represents its National entry in compact display", () => {
  const catalogue = [
    { name: "rattata-alola", speciesId: 19, formKey: "rattata-alola", isPrimarySpecies: false, generation: 7, types: ["dark", "normal"] },
    { name: "rattata", speciesId: 19, isPrimarySpecies: true, generation: 1, types: ["normal"] },
    { name: "ursaluna", speciesId: 901, isPrimarySpecies: true, generation: 8, types: ["normal", "ground"] },
    { name: "ursaluna-bloodmoon", speciesId: 901, formKey: "ursaluna-bloodmoon", isPrimarySpecies: false, generation: 9, types: ["normal", "ground"] },
  ];
  assert.deepEqual(selectDexSpecies(catalogue, { generation: "7" }).map(entry => entry.name), ["rattata-alola"]);
  assert.deepEqual(selectDexSpecies(catalogue, { types: ["dark", "normal"] }).map(entry => entry.name), ["rattata-alola"]);
  assert.deepEqual(selectDexSpecies(catalogue, { generation: "9" }).map(entry => entry.name), ["ursaluna-bloodmoon"]);
  assert.deepEqual(selectDexSpecies(catalogue).map(entry => entry.name), ["rattata", "ursaluna"], "prefer an eligible original even when the variant occurs first");
  assert.equal(selectDexSpecies(catalogue, { variantMode: "separate" }).length, 4);
});

test("region filters use canonical regional identities rather than costume or Totem words", () => {
  const catalogue = [
    { name: "rattata-alola", speciesId: 19, generation: 7, isPrimarySpecies: false },
    { name: "pikachu-alola-cap", speciesId: 25, formKey: "pikachu-alola-cap", generation: 7, region: "alola" },
    { name: "raticate-totem-alola", speciesId: 20, formKey: "raticate-totem-alola", generation: 7 },
    { name: "rowlet", speciesId: 722, generation: 7 },
  ];
  assert.equal(dexEntryRegion(catalogue[0]), "alola");
  for (const entry of catalogue.slice(1)) assert.equal(dexEntryRegion(entry), "", entry.name);
  assert.deepEqual(selectDexSpecies(catalogue, { regions: ["alola"] }).map(entry => entry.name), ["rattata-alola"]);
});

test("changing the display mode preserves every filter and the eligible National entries", () => {
  const catalogue = [
    { name: "meowth", speciesId: 52, isPrimarySpecies: true, generation: 1, types: ["normal"] },
    { name: "meowth-galar", speciesId: 52, formKey: "meowth-galar", isPrimarySpecies: false, generation: 8, types: ["steel"] },
    { name: "meowth-alola", speciesId: 52, formKey: "meowth-alola", isPrimarySpecies: false, generation: 7, types: ["dark"] },
  ];
  const filters = Object.freeze({ generation: "8", regions: Object.freeze(["galar"]), types: Object.freeze(["steel"]), minNumber: 50, maxNumber: 55 });
  const before = JSON.stringify(filters);
  const grouped = selectDexSpecies(catalogue, { ...filters, variantMode: "grouped" });
  const separate = selectDexSpecies(catalogue, { ...filters, variantMode: "separate" });
  assert.deepEqual(grouped.map(entry => entry.name), ["meowth-galar"]);
  assert.deepEqual(separate.map(entry => entry.name), ["meowth-galar"]);
  assert.equal(JSON.stringify(filters), before);
});

test("dex filters support open ranges, multiple types and optional regional segregation", () => {
  const catalogue = [
    { name: "rattata", speciesName: "rattata", speciesId: 19, isPrimarySpecies: true, types: ["normal"], url: "https://pokeapi.co/api/v2/pokemon-species/19/" },
    { name: "rattata-alola", speciesName: "rattata", speciesId: 19, pokemonId: 10091, isPrimarySpecies: false, formKey: "rattata-alola", formIdentifier: "alola", generation: 7, types: ["dark", "normal"], url: "https://pokeapi.co/api/v2/pokemon-species/19/" },
    { name: "sableye", speciesName: "sableye", speciesId: 302, isPrimarySpecies: true, types: ["dark", "ghost"], url: "https://pokeapi.co/api/v2/pokemon-species/302/" },
    { name: "aron", speciesName: "aron", speciesId: 304, isPrimarySpecies: true, types: ["steel", "rock"], url: "https://pokeapi.co/api/v2/pokemon-species/304/" },
    { name: "miraidon", speciesName: "miraidon", speciesId: 1008, isPrimarySpecies: true, types: ["electric", "dragon"], url: "https://pokeapi.co/api/v2/pokemon-species/1008/" },
  ];
  assert.deepEqual(parseDexRange("a partir de 304"), [304, 1025]);
  assert.deepEqual(parseDexRange("até 302"), [1, 302]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "a partir de 304" }).map(p => p.speciesId), [304, 1008]);
  assert.deepEqual(selectDexSpecies(catalogue, { minNumber: 300, maxNumber: 400 }).map(p => p.speciesId), [302, 304]);
  assert.deepEqual(selectDexSpecies(catalogue, { types: ["dark", "ghost"] }).map(p => p.name), ["sableye"]);
  assert.deepEqual(selectDexSpecies(catalogue).map(p => p.name), ["rattata", "sableye", "aron", "miraidon"]);
  assert.deepEqual(selectDexSpecies(catalogue, { variantMode: "separate", regions: ["alola"] }).map(p => p.name), ["rattata-alola"]);
  assert.deepEqual(selectDexSpecies(catalogue, { query: "alola" }).map(p => p.name), ["rattata-alola"]);
  assert.equal(dexEntryRegion(catalogue[1]), "alola");
});

test("fixed forms have independent favorites while legacy numeric species favorites remain valid", () => {
  const catalogue = [
    { name: "rattata", url: "https://pokeapi.co/api/v2/pokemon-species/19/" },
    { name: "rattata-alola", url: "https://pokeapi.co/api/v2/pokemon-species/19/", speciesId: 19, pokemonId: 10091, formKey: "rattata-alola", generation: 7 },
  ];
  assert.deepEqual(selectDexSpecies(catalogue, { favorites: ["19"], onlyFavorites: true }).map(p => p.name), ["rattata"]);
  assert.deepEqual(selectDexSpecies(catalogue, { favorites: ["form:rattata-alola"], onlyFavorites: true }).map(p => p.name), ["rattata-alola"]);
});

test("a named primary form keeps legacy species favorites and remains searchable by form", () => {
  const unownA = {
    name: "unown", speciesName: "unown", pokemonName: "unown", speciesId: 201,
    url: "https://pokeapi.co/api/v2/pokemon-species/201/", formKey: "unown-a",
    formIdentifier: "a", formId: 201, generation: 2, isPrimarySpecies: true,
  };
  assert.deepEqual(selectDexSpecies([unownA], { query: "unown a" }).map(p => p.formKey), ["unown-a"]);
  assert.deepEqual(selectDexSpecies([unownA], { favorites: ["201"], onlyFavorites: true }).map(p => p.formKey), ["unown-a"]);
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

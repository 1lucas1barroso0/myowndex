import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { MYOWNDEX_TERMS } from "../src/core/copy.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("the same Pokédex concepts use one canonical vocabulary across current screens", async () => {
  assert.equal(MYOWNDEX_TERMS.dexEntry, "entrada da Pokédex");
  assert.equal(MYOWNDEX_TERMS.variant, "variante");
  assert.equal(MYOWNDEX_TERMS.regionalVariant, "variante regional");
  assert.equal(MYOWNDEX_TERMS.form, "forma");
  assert.equal(MYOWNDEX_TERMS.debutGeneration, "geração de estreia");
  assert.equal(MYOWNDEX_TERMS.variantRegion, "região da variante");
  assert.equal(MYOWNDEX_TERMS.referenceGame, "jogo de referência");
  assert.equal(MYOWNDEX_TERMS.encounter, "encontro");

  const [app, filters, generator, record, editor, pc, guide] = await Promise.all([
    read("../src/App.jsx"),
    read("../src/components/Pokedex/DexFilters.jsx"),
    read("../src/components/Generator/GeneratorModal.jsx"),
    read("../src/components/Pokedex/PokemonModal.jsx"),
    read("../src/components/Teambuilder/PokemonEditor.jsx"),
    read("../src/components/Teambuilder/Teambuilder.jsx"),
    read("../src/core/rpgRules.js"),
  ]);

  assert.match(app, /Variante regional/);
  assert.match(app, /Geração de estreia/);
  assert.match(filters, /Geração de estreia/);
  assert.match(filters, /Região da variante/);
  assert.match(generator, /Pokémon ou variante/);
  assert.match(generator, /Jogo de referência/);
  assert.match(generator, /Região da variante/);
  assert.match(record, /Formas do mesmo Pokémon/);
  assert.match(record, /"Variante" : "Forma"/);
  assert.match(editor, /Forma do mesmo Pokémon/);
  assert.match(pc, /Jogo de referência/);
  assert.match(guide, /Variantes, formas e transformações/);

  assert.doesNotMatch(generator, /Pokémon ou forma|prévia/i);
  assert.doesNotMatch(filters, /Refinar Pokédex|Separar variantes distintas/);
  assert.doesNotMatch(app, /Regional ·/);
});

test("current terminology guide defines entry, variant, form, debut generation and variant region without synonyms", async () => {
  const guide = await read("../docs/voice-and-terminology.md");
  for (const phrase of [
    "**entrada da Pokédex**",
    "**variante**",
    "**variante regional**",
    "**forma**",
    "**geração de estreia**",
    "**região da variante**",
    "**jogo de referência**",
    "**encontro**",
  ]) assert.ok(guide.includes(phrase), phrase);
  assert.match(guide, /Uma entrada antiga pode ter uma variante que estreou em uma geração posterior/);
});

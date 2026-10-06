import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("generator explains selection, filters and sheet options without mixing their jobs", async () => {
  const source = await readFile(new URL("../src/components/Generator/GeneratorModal.jsx", import.meta.url), "utf8");

  assert.match(source, /Cada entrada da Pokédex tem a mesma chance de ser escolhida/);
  assert.match(source, /Jogo de referência/);
  assert.match(source, /Geração de estreia/);
  assert.match(source, /Não escolhe um jogo/);
  assert.match(source, /Região da variante/);
  assert.match(source, /Não inclui todos os Pokémon da região/);
  assert.match(source, /Os dois caminhos não se misturam/);
  assert.match(source, /Uma variante de uma entrada antiga pode ter uma geração de estreia mais nova/);
  assert.match(source, /Ter mais variantes nunca dá mais chance à entrada/);
  assert.match(source, /Elas não aumentam nem diminuem a chance de uma entrada da Pokédex aparecer/);
  assert.match(source, /Criar um novo encontro\?/);
  assert.match(source, /Continuar neste encontro/);
  assert.doesNotMatch(source, /prévia/i);
  assert.doesNotMatch(source, /Pokémon ou forma/);
});

test("choosing an exact Pokémon clears random-pool filters", async () => {
  const source = await readFile(new URL("../src/components/Generator/GeneratorModal.jsx", import.meta.url), "utf8");
  const chooseBlock = source.slice(source.indexOf("const choosePokemon"), source.indexOf("const selectedPokemonChoice"));
  for (const expected of ["type: ''", "generation: 0", "region: ''", "legendary: 'all'"]) {
    assert.ok(chooseBlock.includes(expected), expected);
  }
});

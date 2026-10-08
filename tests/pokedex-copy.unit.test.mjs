import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Pokédex filter instructions stay simple and player-facing", async () => {
  const filters = await readFile(new URL("../src/components/Pokedex/DexFilters.jsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(filters, /Escolha até dois tipos\. Se escolher dois, o Pokémon precisa ter os dois\./);
  assert.match(filters, /Escolha como a lista mostra variantes que o MyOwnDex trata como Pokémon diferentes\./);
  assert.match(filters, /Uma entrada evita repetição na lista\./);
  assert.match(filters, />Uma entrada<\/button>/);
  assert.match(filters, />Separar variantes<\/button>/);
  assert.match(filters, /Número na Pokédex Nacional/);
  assert.doesNotMatch(filters, /intercambi[aá]vel|segrega(?:ção|r)|identidade narrativa|mecânicas próprias/i);

  assert.match(app, /Buscar por nome, número ou intervalo/);
  assert.match(app, /Nenhum Pokémon foi encontrado\. Tente mudar os filtros\./);
});

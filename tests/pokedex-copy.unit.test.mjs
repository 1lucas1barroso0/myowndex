import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Pokédex filter instructions stay simple and player-facing", async () => {
  const filters = await readFile(new URL("../src/components/Pokedex/DexFilters.jsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(filters, /Escolha até dois tipos\. Se escolher dois, o Pokémon precisa ter os dois\./);
  assert.match(filters, /Variantes são alternativas que o MyOwnDex trata como Pokémon diferentes\./);
  assert.match(filters, /Uma entrada mantém a lista compacta\./);
  assert.match(filters, /Geração de estreia/);
  assert.match(filters, /Região da variante/);
  assert.match(filters, /Um Pokémon comum não entra só por ter estreado nessa região/);
  assert.match(filters, />Uma entrada<\/button>/);
  assert.match(filters, />Mostrar variantes<\/button>/);
  assert.match(filters, /Número na Pokédex Nacional/);
  assert.doesNotMatch(filters, /intercambi[aá]vel|segrega(?:ção|r)|identidade narrativa|mecânicas próprias/i);
  const regionToggle = filters.slice(filters.indexOf("const toggleRegion"), filters.indexOf("return <section"));
  assert.doesNotMatch(regionToggle, /onVariantModeChange/, "region is a filter, not a display mode");
  const compactButton = filters.split("\n").find(line => line.includes(">Uma entrada</button>")) || "";
  assert.ok(compactButton);
  assert.doesNotMatch(compactButton, /onRegionsChange/, "display mode never clears a real filter");

  assert.match(app, /Buscar por nome, número ou intervalo/);
  assert.match(app, /Geração de estreia/);
  assert.match(app, /Variante regional/);
  assert.match(app, /Nenhum Pokémon foi encontrado\. Tente mudar os filtros\./);
});

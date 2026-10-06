import assert from "node:assert/strict";
import test from "node:test";
import {
  DEX_GENERATIONS,
  DEX_REGIONS,
  debutGeneration,
  dexEntryFavoriteKey,
  dexEntryGeneration,
  dexEntryNumber,
  dexEntryRegion,
  dexEntryTypes,
  normalizeDexSearch,
  parseDexRange,
  selectDexSpecies,
} from "../src/core/dexCollection.js";

const catalogue = [
  { name: "bulbasaur", speciesName: "bulbasaur", speciesId: 1, isPrimarySpecies: true, types: ["grass", "poison"] },
  { name: "rattata", speciesName: "rattata", speciesId: 19, isPrimarySpecies: true, types: ["normal"] },
  { name: "rattata-alola", speciesName: "rattata", speciesId: 19, isPrimarySpecies: false, formKey: "rattata-alola", formIdentifier: "alola", generation: 7, types: ["dark", "normal"] },
  { name: "vulpix", speciesName: "vulpix", speciesId: 37, isPrimarySpecies: true, types: ["fire"] },
  { name: "vulpix-alola", speciesName: "vulpix", speciesId: 37, isPrimarySpecies: false, formKey: "vulpix-alola", formIdentifier: "alola", generation: 7, types: ["ice"] },
  { name: "meowth", speciesName: "meowth", speciesId: 52, isPrimarySpecies: true, types: ["normal"] },
  { name: "meowth-galar", speciesName: "meowth", speciesId: 52, isPrimarySpecies: false, formKey: "meowth-galar", formIdentifier: "galar", generation: 8, types: ["steel"] },
  { name: "wooper", speciesName: "wooper", speciesId: 194, isPrimarySpecies: true, types: ["water", "ground"] },
  { name: "wooper-paldea", speciesName: "wooper", speciesId: 194, isPrimarySpecies: false, formKey: "wooper-paldea", formIdentifier: "paldea", generation: 9, types: ["poison", "ground"] },
  { name: "sableye", speciesName: "sableye", speciesId: 302, isPrimarySpecies: true, types: ["dark", "ghost"] },
  { name: "aron", speciesName: "aron", speciesId: 304, isPrimarySpecies: true, types: ["steel", "rock"] },
  { name: "miraidon", speciesName: "miraidon", speciesId: 1008, isPrimarySpecies: true, types: ["electric", "dragon"] },
];

const key = entry => entry.formKey || entry.name;

function referenceSelect(entries, options = {}) {
  const rawQuery = String(options.query ?? "").trim();
  const normalized = normalizeDexSearch(rawQuery);
  const numericRange = parseDexRange(rawQuery);
  const numericQuery = !numericRange && /^\d+$/.test(normalized) ? Number(normalized) : null;
  const textQuery = Boolean(rawQuery && numericQuery === null && !numericRange);
  const selected = new Set(options.favorites || []);
  const types = [...new Set((Array.isArray(options.types) ? options.types : [])
    .map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, 2);
  const allowedRegions = new Set(DEX_REGIONS.map(region => region.id));
  const regions = new Set((Array.isArray(options.regions) ? options.regions : []).filter(region => allowedRegions.has(region)));
  const generation = DEX_GENERATIONS.find(gen => gen.id === String(options.generation ?? "all")) || DEX_GENERATIONS[0];
  const order = ["number", "reverse", "name"].includes(options.order) ? options.order : "number";
  const min = Number.isInteger(Number(options.minNumber)) && Number(options.minNumber) >= 1 ? Math.min(1025, Number(options.minNumber)) : 1;
  const max = Number.isInteger(Number(options.maxNumber)) && Number(options.maxNumber) >= 1 ? Math.min(1025, Number(options.maxNumber)) : 1025;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  return entries.filter(entry => {
    const number = dexEntryNumber(entry);
    if (number < lower || number > upper) return false;

    const entryGeneration = dexEntryGeneration(entry);
    if (generation.id !== "all" && entryGeneration?.id !== generation.id
      && !(!entry.generation && number >= generation.start && number <= generation.end)) return false;

    const searchable = [entry.name, entry.speciesName, entry.pokemonName, entry.formKey, entry.formIdentifier]
      .filter(Boolean).map(normalizeDexSearch);
    const matchesQuery = !rawQuery
      || (numericRange ? number >= numericRange[0] && number <= numericRange[1]
        : numericQuery !== null ? number === numericQuery
          : searchable.some(value => value.includes(normalized)));
    if (!matchesQuery) return false;

    const favorite = selected.has(dexEntryFavoriteKey(entry));
    if (options.onlyFavorites && !favorite) return false;
    if (regions.size && !regions.has(dexEntryRegion(entry))) return false;
    const entryTypes = dexEntryTypes(entry);
    if (types.length && !types.every(type => entryTypes.includes(type))) return false;

    if (entry.isPrimarySpecies === false && options.variantMode !== "separate" && !regions.size
      && !(textQuery && matchesQuery) && !(options.onlyFavorites && favorite)) return false;
    return true;
  }).sort((a, b) => {
    if (order === "name") {
      const difference = String(a.speciesName || a.name).localeCompare(String(b.speciesName || b.name), "pt-BR");
      if (difference) return difference;
    }
    const numberDifference = dexEntryNumber(a) - dexEntryNumber(b);
    if (numberDifference) return numberDifference * (order === "reverse" ? -1 : 1);
    const primaryDifference = Number(a.isPrimarySpecies === false) - Number(b.isPrimarySpecies === false);
    if (primaryDifference) return primaryDifference;
    return String(a.formKey || a.name).localeCompare(String(b.formKey || b.name), "pt-BR");
  });
}

test("every supported Pokédex filter composes with every other filter", () => {
  const queries = ["", "rattata", "alola", "302", "19-52", "a partir de 300", "até 52"];
  const generations = ["all", "1", "3", "7", "8", "9", "future"];
  const typeSets = [[], ["normal"], ["dark"], ["DARK", "normal"], ["steel"], ["ground", "poison"]];
  const regionSets = [[], ["alola"], ["galar"], ["paldea"], ["alola", "galar"], ["unknown"]];
  const variantModes = ["grouped", "separate"];
  const bounds = [["", ""], [19, 304], [304, 19]];
  const favoriteModes = [false, true];
  const orders = ["number", "reverse", "name", "unknown"];
  const favorites = ["1", "302", "form:rattata-alola", "form:meowth-galar", "form:wooper-paldea"];

  let combinations = 0;
  for (const query of queries)
    for (const generation of generations)
      for (const types of typeSets)
        for (const regions of regionSets)
          for (const variantMode of variantModes)
            for (const [minNumber, maxNumber] of bounds)
              for (const onlyFavorites of favoriteModes)
                for (const order of orders) {
                  const options = { query, generation, types, regions, variantMode, minNumber, maxNumber, onlyFavorites, order, favorites };
                  assert.deepEqual(
                    selectDexSpecies(catalogue, options).map(key),
                    referenceSelect(catalogue, options).map(key),
                    JSON.stringify({ query, generation, types, regions, variantMode, minNumber, maxNumber, onlyFavorites, order })
                  );
                  combinations += 1;
                }

  assert.equal(combinations, 84672);
});

test("invalid saved filter values fall back safely instead of breaking the Pokédex", () => {
  const result = selectDexSpecies(catalogue, {
    generation: "future",
    regions: ["unknown"],
    order: "unknown",
    types: ["DARK", "dark"],
    variantMode: "old-mode",
  });
  assert.deepEqual(result.map(key), ["sableye"]);
  assert.equal(debutGeneration(1008).id, "9");
});

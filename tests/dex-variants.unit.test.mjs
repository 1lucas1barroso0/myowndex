import assert from "node:assert/strict";
import test from "node:test";
import { getDexVariantMeta, getSamePokemonForms } from "../src/core/dexVariants.js";

test("regional variants are separable without changing their National Dex number", () => {
  for (const [name, speciesId] of [
    ["rattata-alola", 19],
    ["meowth-galar", 52],
    ["darmanitan-galar-standard", 555],
    ["growlithe-hisui", 58],
    ["wooper-paldea", 194],
    ["tauros-paldea-aqua-breed", 128],
  ]) {
    const meta = getDexVariantMeta({ name, speciesId });
    assert.equal(meta.separable, true, name);
    assert.equal(meta.kind, "regional", name);
  }
});

test("forms that function as different Pokemon can be listed separately", () => {
  for (const entry of [
    { name: "wormadam-sandy", speciesId: 413 },
    { name: "basculin-white-striped", speciesId: 550 },
    { name: "meowstic-female", speciesId: 678 },
    { name: "pumpkaboo-super", speciesId: 710 },
    { name: "lycanroc-dusk", speciesId: 745 },
    { name: "toxtricity-low-key", speciesId: 849 },
    { name: "indeedee-female", speciesId: 876 },
    { name: "urshifu-rapid-strike", speciesId: 892 },
    { name: "ursaluna-bloodmoon", speciesId: 901 },
    { name: "basculegion-female", speciesId: 902 },
    { name: "oinkologne-female", speciesId: 916 },
    { name: "squawkabilly-yellow-plumage", speciesId: 931 },
    { name: "tatsugiri-droopy", speciesId: 978 },
    { name: "gimmighoul-roaming", speciesId: 999 },
    { name: "pikachu-starter", speciesId: 25 },
    { name: "rockruff-own-tempo", speciesId: 744 },
    { name: "floette-eternal", speciesId: 670 },
  ]) {
    const meta = getDexVariantMeta(entry);
    assert.equal(meta.separable, true, entry.name);
  }
});

test("purely aesthetic forms remain grouped exactly like before the segregation feature", () => {
  for (const entry of [
    { name: "unown-b", speciesId: 201 },
    { name: "shellos-east", speciesId: 422 },
    { name: "gastrodon-east", speciesId: 423 },
    { name: "frillish-female", speciesId: 592 },
    { name: "jellicent-female", speciesId: 593 },
    { name: "vivillon-polar", speciesId: 666 },
    { name: "pyroar-female", speciesId: 668 },
    { name: "flabebe-blue", speciesId: 669 },
    { name: "floette-blue", speciesId: 670 },
    { name: "florges-blue", speciesId: 671 },
    { name: "alcremie-rainbow-swirl-star-sweet", speciesId: 869 },
    { name: "maushold-family-of-three", speciesId: 925 },
    { name: "dudunsparce-three-segment", speciesId: 982 },
    { name: "magearna-original", speciesId: 801 },
    { name: "zarude-dada", speciesId: 893 },
  ]) {
    const meta = getDexVariantMeta(entry);
    assert.equal(meta.separable, false, entry.name);
    assert.equal(meta.kind, "grouped", entry.name);
  }
});

test("interchangeable forms never receive the new segregation, even with mechanical changes", () => {
  for (const entry of [
    { name: "deoxys-attack", speciesId: 386 },
    { name: "rotom-wash", speciesId: 479 },
    { name: "giratina-origin", speciesId: 487 },
    { name: "shaymin-sky", speciesId: 492 },
    { name: "arceus-fire", speciesId: 493 },
    { name: "furfrou-heart", speciesId: 676 },
    { name: "oricorio-pom-pom", speciesId: 741 },
    { name: "silvally-fire", speciesId: 773 },
    { name: "ogerpon-wellspring-mask", speciesId: 1017 },
  ]) {
    const meta = getDexVariantMeta(entry);
    assert.equal(meta.separable, false, entry.name);
    assert.equal(meta.kind, "grouped", entry.name);
  }
});

test("region words inside costumes or Totem states do not create false regional variants", () => {
  for (const entry of [
    { name: "pikachu-alola-cap", speciesId: 25 },
    { name: "raticate-totem-alola", speciesId: 20 },
    { name: "marowak-totem", speciesId: 105 },
  ]) {
    assert.equal(getDexVariantMeta(entry).separable, false, entry.name);
  }
});


test("Pokédex and PC expose only forms of the same Pokemon in form switchers", () => {
  const rattata = [
    { is_default: true, pokemon: { name: "rattata", url: "rattata" } },
    { is_default: false, pokemon: { name: "rattata-alola", url: "rattata-alola" } },
  ];
  assert.deepEqual(
    getSamePokemonForms(rattata, 19, { currentName: "rattata" }).map(entry => entry.pokemon.name),
    ["rattata"],
  );
  assert.deepEqual(
    getSamePokemonForms(rattata, 19, { currentName: "rattata-alola", currentFormKey: "rattata-alola" }).map(entry => entry.pokemon.name),
    ["rattata-alola"],
  );

  const deoxys = [
    { is_default: true, pokemon: { name: "deoxys-normal", url: "normal" } },
    { is_default: false, pokemon: { name: "deoxys-attack", url: "attack" } },
    { is_default: false, pokemon: { name: "deoxys-defense", url: "defense" } },
  ];
  assert.deepEqual(
    getSamePokemonForms(deoxys, 386, { currentName: "deoxys-normal" }).map(entry => entry.pokemon.name),
    ["deoxys-normal", "deoxys-attack", "deoxys-defense"],
    "interchangeable forms remain choices inside the same Pokemon",
  );

  const lycanroc = [
    { is_default: true, pokemon: { name: "lycanroc-midday", url: "midday" } },
    { is_default: false, pokemon: { name: "lycanroc-midnight", url: "midnight" } },
    { is_default: false, pokemon: { name: "lycanroc-dusk", url: "dusk" } },
  ];
  assert.deepEqual(
    getSamePokemonForms(lycanroc, 745, { currentName: "lycanroc-midday" }).map(entry => entry.pokemon.name),
    ["lycanroc-midday"],
    "distinct variants do not appear as if they were switchable forms",
  );
});

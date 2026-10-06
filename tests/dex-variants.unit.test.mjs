import assert from "node:assert/strict";
import test from "node:test";
import { getDexVariantMeta } from "../src/core/dexVariants.js";

test("regional variants are separable without changing their National Dex number", () => {
  for (const name of ["rattata-alola", "meowth-galar", "growlithe-hisui", "wooper-paldea"]) {
    const meta = getDexVariantMeta({ name, speciesId: 19 });
    assert.equal(meta.separable, true, name);
    assert.equal(meta.kind, "regional", name);
  }
});

test("non-interchangeable variants can be listed separately", () => {
  assert.equal(getDexVariantMeta({ name: "unown-b", speciesId: 201 }).separable, true);
  assert.equal(getDexVariantMeta({ name: "shellos-east", speciesId: 422 }).separable, true);
  assert.equal(getDexVariantMeta({ name: "indeedee-female", speciesId: 876 }).separable, true);
});

test("interchangeable forms stay inside the species record", () => {
  for (const entry of [
    { name: "deoxys-attack", speciesId: 386 },
    { name: "rotom-wash", speciesId: 479 },
    { name: "furfrou-heart", speciesId: 676 },
    { name: "oricorio-pom-pom", speciesId: 741 },
    { name: "arceus-fire", speciesId: 493 },
  ]) {
    const meta = getDexVariantMeta(entry);
    assert.equal(meta.separable, false, entry.name);
    assert.equal(meta.kind, "interchangeable", entry.name);
  }
});

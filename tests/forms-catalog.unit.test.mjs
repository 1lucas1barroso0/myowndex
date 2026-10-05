import assert from "node:assert/strict";
import test from "node:test";
import forms from "../src/data/forms.json" with { type: "json" };

test("persistent-form catalogue is complete, deterministic and excludes collapsed battle transformations", () => {
  assert.equal(forms.schemaVersion, 1);
  assert.equal(forms.sourceCommit, "bc92d3b6029ef1abe9e7ad424c400b338f3c11fe");
  assert.equal(forms.defaults.length, 52);
  assert.equal(forms.entries.length, 379);
  assert.equal(forms.defaults.length + forms.entries.length, 431);
  const names = new Set();
  for (const entry of [...forms.defaults, ...forms.entries]) {
    assert.match(entry.name, /^[a-z0-9-]+$/);
    assert.ok(Number.isInteger(entry.formId) && entry.formId > 0);
    assert.ok(Number.isInteger(entry.pokemonId) && entry.pokemonId > 0);
    assert.ok(Number.isInteger(entry.speciesId) && entry.speciesId >= 1 && entry.speciesId <= 1025);
    assert.ok(Number.isInteger(entry.generation) && entry.generation >= 1 && entry.generation <= 9);
    assert.match(entry.spriteKey, /^[0-9]+(?:-[a-z0-9-]+)?$/);
    assert.ok(Array.isArray(entry.types) && entry.types.length >= 1 && entry.types.length <= 2);
    if (entry.pastTypes) {
      for (const past of entry.pastTypes) {
        assert.ok(Number.isInteger(past.generation) && past.generation >= 1 && past.generation <= 9);
        assert.ok(Array.isArray(past.types) && past.types.length >= 1 && past.types.length <= 2);
      }
    }
    assert.equal(names.has(entry.name), false, `duplicate form ${entry.name}`);
    names.add(entry.name);
  }
  for (const name of [
    "shaymin-sky",
    "hoopa-unbound",
    "eternatus-eternamax",
    "koraidon-limited-build",
    "miraidon-drive-mode",
    "minior-red",
  ]) assert.equal(names.has(name), false, `${name} must remain grouped with its reversible state`);
  const rotomWash = forms.entries.find(entry => entry.name === "rotom-wash");
  assert.deepEqual(rotomWash?.pastTypes, [{ generation: 4, types: ["electric", "ghost"] }]);

  for (const name of [
    "unown-a",
    "alcremie-vanilla-cream-strawberry-sweet",
    "rattata-alola",
    "deoxys-attack",
    "furfrou-heart",
    "alcremie-rainbow-swirl-star-sweet",
    "ursaluna-bloodmoon",
  ]) assert.equal(names.has(name), true, `${name} must be independently selectable`);
});

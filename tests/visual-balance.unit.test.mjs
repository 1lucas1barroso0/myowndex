import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const src = path => readFile(new URL("../src/" + path, import.meta.url), "utf8");
test("blue-tinted selection replaces default yellow without hiding meaningful progress", async () => {
  const journey = await src("journey.css");
  const art = await src("game-art-direction.css");
  assert.match(journey, /--ui-selected:\s*#e8f2fa/);
  assert.doesNotMatch(journey, /--ui-selected:\s*#ffdc3b/i);
  assert.match(art, /\.dex-heading,\.guide-hero\)::after\s*\{\s*content:none/);
  assert.match(art, /\.room-phase-options button\.is-selected\s*\{/);
});
test("Pokémon profiles and journey panel have no painted ellipse or fixed shadow", async () => {
  const record = await src("pokedex-record.css");
  const pc = await src("pc-retro.css");
  const art = await src("game-art-direction.css");
  assert.match(record, /\.record-sprite-ground\s*\{\s*display:none/);
  assert.match(record, /\.record-sprite-stage\s*\{[^}]*background:transparent/);
  assert.match(pc, /\.editor-portrait\s*\{[^}]*background:transparent/);
  assert.match(pc, /\.rpg-journey-panel\s*\{[^}]*background:var\(--ui-panel\)/);
  assert.match(art, /\.pokemon-companion > \.pokemon-sized-sprite\s*\{\s*filter:none/);
});

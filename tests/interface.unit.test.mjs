import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the interface keeps dedicated responsive layouts through phone widths", async () => {
  const [css, room, layout] = await Promise.all([
    read("src/index.css"),
    read("src/components/Room/RpgRoom.jsx"),
    read("app/layout.tsx"),
  ]);
  for (const breakpoint of ["1280px", "900px", "640px", "390px"]) {
    assert.match(css, new RegExp(`max-width:\\s*${breakpoint}`));
  }
  assert.match(room, /room-mobile-nav/);
  assert.match(room, /mobilePane === "field"/);
  assert.match(layout, /device-width/);
  assert.match(layout, /maximumScale:\s*5/);
});

test("the public interface does not revive the retired RPG label or English recovery copy", async () => {
  const sources = await Promise.all([
    read("src/App.jsx"),
    read("src/components/ErrorBoundary.jsx"),
    read("src/components/Pokedex/PokemonModal.jsx"),
    read("src/components/Teambuilder/Teambuilder.jsx"),
    read("src/core/rpgRules.js"),
  ]);
  const text = sources.join("\n");
  assert.doesNotMatch(text, /RPG Anime/);
  assert.doesNotMatch(text, /Recovery Mode|Reload MyOwnDex|Close share code|Add to Team/);
  assert.match(text, /label:\s*"RPG"/);
});

test("offline support caches the shell and sprites but never private room APIs", async () => {
  const worker = await read("public/sw.js");
  assert.match(worker, /myowndex-shell-v5/);
  assert.match(worker, /raw\.githubusercontent\.com/);
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
});

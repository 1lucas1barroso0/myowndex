import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatCount,
  formatCanonicalItemName,
  formatPartnerArrival,
  formatPokemonCount,
  formatPokemonInScene,
  formatRemainingPp,
  MYOWNDEX_TERMS,
  RPG_STATUS_LABELS,
} from "../src/core/copy.js";

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
  assert.match(room, /savedSession=\{loadRoomSession\(\)\}/);
  assert.match(layout, /device-width/);
  assert.match(layout, /maximumScale:\s*5/);
});

test("the public interface keeps the RPG name and the canonical area labels", async () => {
  const sources = await Promise.all([
    read("src/App.jsx"),
    read("src/components/ErrorBoundary.jsx"),
    read("src/components/Pokedex/PokemonModal.jsx"),
    read("src/components/Teambuilder/Teambuilder.jsx"),
    read("src/core/rpgRules.js"),
  ]);
  const text = sources.join("\n");
  assert.doesNotMatch(text, /RPG Anime/);
  assert.doesNotMatch(text, /Sala RPG/);
  assert.doesNotMatch(text, /\bVGC\b/);
  assert.doesNotMatch(text, /Recovery Mode|Reload MyOwnDex|Close share code|Add to Team/);
  assert.match(text, /label:\s*"RPG"/);
  assert.match(text, />Aventura<\/button>/);
  assert.match(text, />Guia<\/button>/);
});

test("the editorial glossary keeps names, agreement and Pokémon plurals consistent", () => {
  assert.equal(MYOWNDEX_TERMS.room, "Central da Aventura");
  assert.equal(MYOWNDEX_TERMS.adventure, "aventura");
  assert.equal(MYOWNDEX_TERMS.guide, "Guia do Treinador");
  assert.equal(MYOWNDEX_TERMS.pokeBall, "Poké Ball");
  assert.equal(formatCanonicalItemName("luxury-ball"), "Luxury Ball");
  assert.equal(formatCanonicalItemName("poke-ball"), "Poké Ball");
  assert.equal(RPG_STATUS_LABELS.paralysis, "Paralisado");
  assert.equal(formatCount(1, "Box", "Boxes"), "1 Box");
  assert.equal(formatCount(2, "Box", "Boxes"), "2 Boxes");
  assert.equal(formatPokemonCount(1), "1 Pokémon encontrado");
  assert.equal(formatPokemonCount(3), "3 Pokémon encontrados");
  assert.equal(formatPokemonInScene(1), "1 Pokémon em cena");
  assert.equal(formatRemainingPp(1), "Resta 1 PP.");
  assert.equal(formatRemainingPp(3), "Restam 3 PP.");
  assert.equal(formatPartnerArrival(1), "1 parceiro chegou com suas informações.");
  assert.equal(formatPartnerArrival(4), "4 parceiros chegaram com suas informações.");
});

test("visible copy avoids robotic system language", async () => {
  const sources = await Promise.all([
    read("src/App.jsx"),
    read("src/components/ErrorBoundary.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Pokedex/AbilityCard.jsx"),
    read("src/components/Pokedex/MoveAccordion.jsx"),
    read("src/components/Pokedex/PokemonModal.jsx"),
    read("src/components/Room/AudioDeck.jsx"),
    read("src/components/Room/Battlefield.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Teambuilder/PokemonEditor.jsx"),
    read("src/components/Teambuilder/Teambuilder.jsx"),
  ]);
  const text = sources.join("\n");
  assert.doesNotMatch(text, /Sistema Online|Cache Offline|Rotom automático|Resolução reativa/);
  assert.doesNotMatch(text, /Trainer OS|Rotom Lab|Studio Rotom|Registro compartilhado/);
  assert.doesNotMatch(text, /Sincronizando forma|Sincronizando prioridade|Modo de recuperação/);
  assert.doesNotMatch(text, /Tipagem|G-Max|D-Max|Sem Movimento|p\/ Nv\./);
  assert.doesNotMatch(text, /Sala RPG|Sala ao vivo|Conecte a sala/);
  assert.match(text, /Gigantamax|Nível Dynamax|Aventura neste aparelho|Central da Aventura/);
});

test("offline support caches the shell and sprites but never private room APIs", async () => {
  const worker = await read("public/sw.js");
  assert.match(worker, /myowndex-shell-v9\.1/);
  assert.match(worker, /raw\.githubusercontent\.com/);
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /SKIP_WAITING/);
  assert.match(worker, /myowndex-maskable-512-v91\.png/);
});

test("voice calls are room-scoped, accessible and locally controllable", async () => {
  const [room, voice, route] = await Promise.all([
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/VoiceCall.jsx"),
    read("app/api/rooms/[code]/call/route.ts"),
  ]);
  assert.match(room, /<VoiceCall session=\{session\} role=\{role\}/);
  assert.match(voice, /Chamada de voz/);
  assert.match(voice, /falando agora/);
  assert.match(voice, /Volume da chamada/);
  assert.match(voice, /Sons discretos de entrada e conexão/);
  assert.match(voice, /Silenciar/);
  assert.match(voice, /não é gravado pelo MyOwnDex/);
  assert.match(voice, /echoCancellation:\s*true/);
  assert.match(route, /connection_id = \?/);
  assert.match(route, /CALL_MEMBER_LIMIT = 12/);
  assert.match(route, /recipient_id = \?/);
});

test("installation, safe updates and both visual themes are first-class", async () => {
  const [installer, appearance, manifest, layout, css, app] = await Promise.all([
    read("src/components/Shared/InstallMyOwnDex.jsx"),
    read("src/components/Shared/AppearanceControl.jsx"),
    read("app/manifest.ts"),
    read("app/layout.tsx"),
    read("src/index.css"),
    read("src/App.jsx"),
  ]);
  assert.match(installer, /beforeinstallprompt/);
  assert.match(installer, /Adicionar à Tela de Início/);
  assert.match(installer, /Adicionar ao Dock/);
  assert.match(appearance, /prefers-color-scheme: dark/);
  assert.match(appearance, /myowndex_appearance_v1/);
  assert.match(manifest, /myowndex-app-192-v91\.png/);
  assert.match(manifest, /purpose:\s*"maskable"/);
  assert.match(manifest, /shortcuts:/);
  assert.match(layout, /shortcut:\s*"\/icons\/myowndex-shortcut-96-v91\.png"/);
  assert.match(layout, /apple-touch-icon-v91\.png/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /data-theme="night"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(app, /Uma nova versão do MyOwnDex está pronta/);
  assert.match(app, /myowndex-icon-v91\.svg/);
});

test("the adventure exposes every modifier and explains movement resolution", async () => {
  const [room, combat, rules] = await Promise.all([
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/core/rpgRules.js"),
  ]);
  assert.match(room, /STAGE_STAT_KEYS\.map/);
  assert.match(room, /Neutralizar todos/);
  assert.match(combat, /Efeito por precisão|resolutionLabel/);
  assert.match(combat, /não exige selecionar um adversário/);
  assert.match(rules, /Os sete modificadores/);
  assert.match(rules, /Uma precisão numérica — inclusive 100%/);
});

test("the internal Guide is the canonical source and explains hit kill protection", async () => {
  const [guide, rules] = await Promise.all([
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/core/rpgRules.js"),
  ]);
  assert.doesNotMatch(guide, /target="_blank"/);
  assert.match(guide, /Todas as regras necessárias para jogar estão reunidas aqui/);
  assert.match(rules, /Proteção contra hit kill/);
  assert.match(rules, /três vezes o HP atual/);
  assert.match(rules, /Acertos críticos superam o limite de dano/);
});

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
import { describeMove, describeSpecies, describeTrait } from "../src/core/descriptions.js";

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
  assert.match(css, /\.battlefield-board\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?min-height:\s*0;/);
  assert.doesNotMatch(css, /\.battlefield-board\s*\{[^}]*min-height:\s*(?:27|24|21|18\.5)rem/);
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
    read("src/components/Room/SpecialMechanicsPanel.jsx"),
    read("src/components/Room/TraitMechanicsPanel.jsx"),
    read("src/core/specialMechanics.js"),
    read("src/core/traitMechanics.js"),
  ]);
  const text = sources.join("\n");
  assert.doesNotMatch(text, /Sistema Online|Cache Offline|Rotom automático|Resolução reativa/);
  assert.doesNotMatch(text, /Trainer OS|Rotom Lab|Studio Rotom|Registro compartilhado/);
  assert.doesNotMatch(text, /Sincronizando forma|Sincronizando prioridade|Modo de recuperação/);
  assert.doesNotMatch(text, /Tipagem|G-Max|D-Max|Sem Movimento|p\/ Nv\./);
  assert.doesNotMatch(text, /Sala RPG|Sala ao vivo|Conecte a sala/);
  assert.doesNotMatch(text, /Automação integral|Automação contextual|Resolução guiada|Mecânica especial automatizada/);
  assert.match(text, /Gigantamax|Nível Dynamax|Aventura neste aparelho|Central da Aventura/);
});

test("descriptions explain what happens without hiding missing or foreign catalog text", () => {
  const tackle = describeMove({
    name: "tackle",
    power: 40,
    pp: 35,
    accuracy: 100,
    priority: 0,
    type: { name: "normal" },
    damage_class: { name: "physical" },
    target: { name: "selected-pokemon" },
    meta: { ailment: { name: "none" }, min_hits: null, max_hits: null, drain: 0, healing: 0 },
    stat_changes: [],
    effect_entries: [{ language: { name: "en" }, effect: "Inflicts regular damage." }],
  }, { isTTRPG: true });
  assert.match(tackle.facts.join(" "), /Ataque de quem age contra a Defesa do alvo/);
  assert.match(tackle.facts.join(" "), /escolher um Pokémon como alvo/);
  assert.match(tackle.facts.join(" "), /precisão base é 100%/);
  assert.match(tackle.facts.join(" "), /Exige contato direto/);
  assert.match(tackle.facts.join(" "), /35 PP/);
  assert.equal(tackle.catalog.code, "en");
  assert.match(tackle.catalog.label, /inglês/);

  const recover = describeMove({
    name: "recover",
    pp: 5,
    accuracy: null,
    type: { name: "normal" },
    damage_class: { name: "status" },
    target: { name: "user" },
    meta: { ailment: { name: "none" }, drain: 0, healing: 50 },
    stat_changes: [],
    effect_entries: [],
  });
  assert.match(recover.facts.join(" "), /não causa dano direto/i);
  assert.match(recover.facts.join(" "), /não é preciso escolher outro Pokémon/i);
  assert.match(recover.facts.join(" "), /Não há teste de precisão próprio/);
  assert.match(recover.facts.join(" "), /Recupera 50% do HP máximo/);

  const trait = describeTrait("ability", "example-power", {
    effect_entries: [{ language: { name: "en" }, short_effect: "Works only in a specific situation." }],
  });
  assert.match(trait.summary, /descrição oficial permanece visível/i);
  assert.match(trait.handling, /regra à vista/i);
  assert.equal(trait.catalog.code, "en");

  const species = describeSpecies({ flavor_text_entries: [], capture_rate: 45 }, { height: 10, weight: 100 });
  assert.match(species.summary, /sem preencher lacunas por suposição/i);
  assert.match(species.facts.join(" "), /45 em 255/);
});

test("offline support caches the shell and sprites but never private room APIs", async () => {
  const [worker, app] = await Promise.all([read("public/sw.js"), read("src/App.jsx")]);
  assert.match(worker, /myowndex-shell-v9\.11\.1/);
  assert.match(worker, /raw\.githubusercontent\.com/);
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /SKIP_WAITING/);
  assert.match(worker, /then\(\(\) => self\.skipWaiting\(\)\)/);
  assert.match(worker, /myowndex-maskable-512-v91\.png/);
  assert.match(app, /document\.readyState === "complete"/);
  assert.match(app, /updateViaCache: "none"/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /current\.update\(\)/);
});

test("Guide rolls expose their secure source, selected mode and local sequence", async () => {
  const guide = await read("src/components/Guide/TrainerGuide.jsx");
  assert.match(guide, /Sorteio seguro ativo/);
  assert.match(guide, /ATTRIBUTE_MODE_LABELS\[attributeResult\.mode\]/);
  assert.match(guide, /percentResult\.advantage \? "Vantagem · menor de dois" : "Rolagem normal"/);
  assert.match(guide, /Conferir sequência deste aparelho/);
  assert.match(guide, /myowndex_guide_roll_history_v1/);
  assert.match(guide, /últimas 30 rolagens ficam salvas neste aparelho/);
  assert.match(guide, /nunca troca resultados para interromper uma sequência/);
});

test("game style and adventure phase use compact tabs with complete help on demand", async () => {
  const [app, styleControl, room, phaseControl, rules, roomCore, css] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Shared/GameStyleControl.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/AdventurePhaseControl.jsx"),
    read("src/core/rpgRules.js"),
    read("src/core/room.js"),
    read("src/index.css"),
  ]);
  assert.match(app, /<GameStyleControl value=\{experienceMode\}/);
  assert.doesNotMatch(app, /className="mode-select"/);
  assert.match(styleControl, /role="radiogroup"/);
  assert.match(styleControl, /aria-checked=\{selected\}/);
  assert.match(styleControl, /ArrowRight/);
  assert.match(styleControl, /choice-help-popover/);
  assert.match(styleControl, /selectedMode\.description/);
  assert.doesNotMatch(styleControl, /GB|GBA|3DS|consoleLabel/);
  assert.doesNotMatch(rules, /consoleLabel/);
  assert.match(room, /<AdventurePhaseControl/);
  assert.doesNotMatch(room, /<select value=\{snapshot\.phase\}/);
  assert.match(phaseControl, /aria-readonly=\{readOnly\}/);
  assert.match(phaseControl, /selectedPhase\.description/);
  assert.match(phaseControl, /choice-help-popover/);
  assert.doesNotMatch(phaseControl, /consoleLabel/);
  assert.doesNotMatch(roomCore, /consoleLabel/);
  assert.match(roomCore, /Percorra rotas, investigue lugares/);
  assert.match(roomCore, /Organize o campo, declare movimentos/);
  const iconContract = css.slice(css.indexOf("Sistema visual raiz do ícone 9.10.0"));
  assert.ok(iconContract.length > 500);
  for (const token of ["--dex-case", "--dex-bezel", "--dex-screen", "--dex-lens-cyan", "--dex-led-green"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(iconContract, /\.game-style-options/);
  assert.match(iconContract, /\.room-phase-options/);
  assert.match(iconContract, /\.choice-help-popover/);
  assert.match(iconContract, /min-height:\s*2\.35rem/);
  assert.match(css, /max-width:\s*390px/);
});

test("the icon-root emphasis contract restores critical rules without hiding content", async () => {
  const [app, guide, room, combat, css, documentation] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/index.css"),
    read("docs/icon-visual-system.md"),
  ]);
  assert.doesNotMatch(guide, /<span className="guide-pill">/);
  assert.match(guide, /guide-damage-ceiling/);
  assert.match(guide, /data-rule-id="3\.3"/);
  assert.match(guide, /data-rule-id="3\.4"/);
  assert.match(guide, /guide-rule-card/);
  assert.match(combat, /Limite comum/);
  assert.match(combat, /Dano calculado/);
  assert.match(combat, /Dano \{role === "narrator" \? "aplicado" : "simulado"\}/);
  assert.match(combat, /combat-consequence-hit-kill/);
  assert.match(combat, /combat-consequence-trait/);
  assert.match(combat, /combat-result-metric is-ceiling/);
  assert.match(combat, /\$\{defender\.name \|\| "O Pokémon escolhido"\} receberá o movimento/);
  assert.match(app, /className="status-notice-action"/);
  assert.match(app, /className="status-notice-close"/);
  assert.doesNotMatch(app, /status-notice[^\n]*bg-white\/70/);
  assert.doesNotMatch(room, /room-live-led/);
  assert.match(guide, /className="guide-hero-lens"/);
  assert.doesNotMatch(guide, /guide-hero-lens absolute -bottom/);

  const integrityContract = css.slice(css.indexOf("ICON-ROOT EMPHASIS + CONTENT-INTEGRITY CONTRACT 9.10.0"));
  assert.ok(integrityContract.length > 5000);
  assert.doesNotMatch(integrityContract, /text-overflow:\s*ellipsis|line-clamp/);
  assert.match(integrityContract, /prefers-contrast:\s*more/);
  assert.match(integrityContract, /forced-colors:\s*active/);
  assert.match(integrityContract, /prefers-reduced-motion:\s*reduce/);
  assert.match(integrityContract, /safe-area-inset-top/);
  assert.match(integrityContract, /\.choice-help\[open\] \.choice-help-popover/);
  assert.match(integrityContract, /\.combat-result\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(integrityContract, /html\[data-theme="night"\] \.token-tera/);
  assert.match(documentation, /ícone oficial do MyOwnDex é a origem/);
  assert.match(documentation, /nunca pode ser truncado/);

  const pointFixes = css.slice(css.indexOf("Point fixes 9.10.2"));
  assert.ok(pointFixes.length > 2500);
  assert.match(pointFixes, /\.status-notice\.is-reversible[\s\S]*?--dex-led-pink/);
  assert.match(pointFixes, /button\.status-notice-action[\s\S]*?background:\s*var\(--dex-lens-cyan\)/);
  assert.doesNotMatch(pointFixes, /room-live-led/);
  assert.match(pointFixes, /\.guide-hero-lens[\s\S]*?top:\s*50%;[\s\S]*?border-radius:\s*50%/);
  assert.doesNotMatch(pointFixes, /--dex-led-yellow/);

  const luminance = hex => {
    const channels = hex.match(/[0-9a-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const yellow = luminance("FDE047");
  const ink = luminance("0F172A");
  const contrast = (yellow + 0.05) / (ink + 0.05);
  assert.ok(contrast >= 13, `yellow/ink contrast was ${contrast.toFixed(2)}:1`);
});

test("the icon is the single palette root in every visual and generated color", async () => {
  const [css, icon, mechanics, room, joinRoute] = await Promise.all([
    read("src/index.css"),
    read("public/icons/myowndex-icon-v91.svg"),
    read("src/core/mechanics.js"),
    read("src/core/room.js"),
    read("app/api/rooms/[code]/join/route.ts"),
  ]);
  const allowed = new Set([
    "#450A0A", "#7F1D1D", "#991B1B", "#B91C1C", "#EF4444", "#FB7185",
    "#FDE047", "#4ADE80", "#0F172A", "#075985", "#0E7490", "#0EA5E9",
    "#38BDF8", "#67E8F9", "#BAE6FD", "#CBD5E1", "#ECFEFF", "#F0FDFF", "#F8FAFC", "#FFFFFF",
  ]);
  const iconColors = [...new Set(icon.match(/#[0-9a-f]{6}/gi)?.map(color => color.toUpperCase()) || [])];
  assert.ok(iconColors.length >= 12);
  for (const color of iconColors) assert.ok(allowed.has(color), `cor inesperada no ícone: ${color}`);
  for (const color of iconColors) assert.match(css.toUpperCase(), new RegExp(color));

  const generatedColors = [
    mechanics.slice(mechanics.indexOf("export const TYPE_COLORS"), mechanics.indexOf("export const MATCHUPS")),
    room.slice(room.indexOf("export const ROOM_SCENARIOS"), room.indexOf("export const STATUS_LABELS")),
    joinRoute.slice(joinRoute.indexOf("const ACCENTS"), joinRoute.indexOf("export async function POST")),
  ].join("\n").match(/#[0-9a-f]{6}/gi)?.map(color => color.toUpperCase()) || [];
  assert.ok(generatedColors.length >= 20);
  for (const color of generatedColors) assert.ok(allowed.has(color), `cor dinâmica fora do ícone: ${color}`);

  const collectVisualSources = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async entry => {
      const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) return collectVisualSources(child);
      if (!/\.(?:css|html|js|jsx|ts|tsx)$/i.test(entry.name)) return [];
      return [{ path: child.pathname, text: await readFile(child, "utf8") }];
    }));
    return nested.flat();
  };
  const visualSources = (await Promise.all([
    collectVisualSources(new URL("../src/", import.meta.url)),
    collectVisualSources(new URL("../app/", import.meta.url)),
    collectVisualSources(new URL("../public/", import.meta.url)),
  ])).flat();
  const allowedRgb = new Set([...allowed].map(color => color.slice(1).match(/../g)
    .map(value => Number.parseInt(value, 16)).join(",")));
  for (const source of visualSources) {
    const hexColors = source.text.match(/#[0-9a-f]{3,8}\b/gi) || [];
    for (const literal of hexColors) {
      let value = literal.slice(1);
      if (value.length === 3 || value.length === 4) value = [...value].map(character => character.repeat(2)).join("");
      const rootColor = `#${value.slice(0, 6).toUpperCase()}`;
      assert.ok(allowed.has(rootColor), `cor fora do ícone em ${source.path}: ${literal}`);
    }
    const rgbColors = source.text.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi);
    for (const literal of rgbColors) {
      const triplet = `${literal[1]},${literal[2]},${literal[3]}`;
      assert.ok(allowedRgb.has(triplet), `RGB fora do ícone em ${source.path}: ${literal[0]}`);
    }
  }

  assert.match(css, /html\[data-theme="night"\] \.app-root \[class~="bg-white"\]/);
  assert.match(css, /\.app-root \[class\*="text-red-"\]/);
  assert.match(css, /\.pokemon-modal-shell/);
  assert.match(css, /\.pc-main-panel/);
  assert.match(css, /\.room-section/);
  assert.match(css, /\.trainer-guide \.rule-section/);

  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  };
  for (const pair of [["#0F172A", "#ECFEFF"], ["#ECFEFF", "#B91C1C"], ["#67E8F9", "#0F172A"], ["#0F172A", "#FDE047"]]) {
    assert.ok(contrast(...pair) >= 4.5, `contraste insuficiente: ${pair.join(" / ")}`);
  }
});

test("Link Cable previews selective imports and Adventure invitations open in one step", async () => {
  const [teamBuilder, room, roomClient] = await Promise.all([
    read("src/components/Teambuilder/Teambuilder.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/core/roomClient.js"),
  ]);
  assert.match(teamBuilder, /Pokémon escolhidos/);
  assert.match(teamBuilder, /Box de destino/);
  assert.match(teamBuilder, /Adicionar à Box escolhida/);
  assert.match(teamBuilder, /Conferir conteúdo/);
  assert.match(room, /Link ou convite da aventura/);
  assert.match(room, /Enviar convite/);
  assert.match(roomClient, /searchParams\.set\("abrir", "aventura"\)/);
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
  const nightContract = css.slice(css.indexOf("Contrato visual ROM 9.6"));
  assert.ok(nightContract.length > 500);
  assert.doesNotMatch(nightContract, /#fff(?:fff)?\b|rgba?\(\s*255\s*,\s*255\s*,\s*255/i);
  assert.match(nightContract, /--rom-coral/);
  assert.match(nightContract, /--night-gold:\s*var\(--rom-coral\)/);
  assert.match(nightContract, /\[class~="text-white"\]/);
  assert.match(nightContract, /\[class\*="bg-blue-50"\]/);
  assert.match(nightContract, /\.pc-partner-card\.is-selected/);
  assert.match(nightContract, /\.rotom-automation-bar/);
  assert.match(nightContract, /\.room-live-orb/);
  assert.match(nightContract, /::-moz-range-thumb/);
  const pixelContract = css.slice(css.indexOf("Contrato de interface Game Boy + DS 9.6.1"));
  assert.ok(pixelContract.length > 500);
  assert.match(pixelContract, /--rom-text-special/);
  assert.match(pixelContract, /\[class\*="text-red-"\]/);
  assert.match(pixelContract, /image-rendering:\s*pixelated/);
  assert.match(pixelContract, /background-size:\s*8px 8px/);
  assert.doesNotMatch(pixelContract, /\bcolor\s*:\s*(?:#(?:b91c1c|991b1b|dc2626|ef4444|e11d48|be123c|ff6075|ff8292|ff9aaa|f04f64|a72143)|var\(--rom-coral(?:-deep)?\))/i);
  const breathableContract = css.slice(css.indexOf("Contrato ultraclean responsivo 9.7.0"));
  assert.ok(breathableContract.length > 500);
  assert.match(breathableContract, /--breath-page/);
  assert.match(breathableContract, /overflow-y:\s*auto/);
  assert.match(breathableContract, /\.app-header-primary/);
  assert.match(breathableContract, /\.pc-partner-grid/);
  assert.match(breathableContract, /\.room-role-help/);
  assert.match(breathableContract, /\.pokemon-modal-shell/);
  assert.match(breathableContract, /\.guide-rule-list/);
  assert.match(breathableContract, /--night-violet/);
  assert.doesNotMatch(breathableContract, /#fff(?:fff)?\b|rgba?\(\s*255\s*,\s*255\s*,\s*255/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(app, /Uma nova versão do MyOwnDex está pronta/);
  assert.match(app, /myowndex-icon-v91\.svg/);
  assert.match(app, /app-header-primary/);
  assert.match(app, /min-h-\[100dvh\]/);
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

test("unique Pokémon and exceptional Moves expose state, narrative and automation level", async () => {
  const [panel, combat, battlefield, rules, mechanics] = await Promise.all([
    read("src/components/Room/SpecialMechanicsPanel.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/components/Room/Battlefield.jsx"),
    read("src/core/rpgRules.js"),
    read("src/core/specialMechanics.js"),
  ]);
  assert.match(panel, /Mecânicas únicas/);
  assert.match(panel, /Voltar à forma original/);
  assert.match(panel, /Sketch gravado/);
  assert.match(combat, /Mecânica excepcional/);
  assert.match(combat, /Movimento resultante/);
  assert.match(battlefield, /getBattleDisplayIdentity/);
  assert.match(rules, /Transform copia aparência/);
  assert.match(rules, /Sketch troca permanentemente/);
  assert.match(mechanics, /O MyOwnDex resolve quando a condição acontece/);
  assert.match(mechanics, /imposter/);
  assert.match(mechanics, /illusion/);
});

test("Abilities and held items expose official context, lifecycle, narrative and vivid contrast", async () => {
  const [panel, room, combat, battlefield, mechanics, css, rules, descriptions] = await Promise.all([
    read("src/components/Room/TraitMechanicsPanel.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/components/Room/Battlefield.jsx"),
    read("src/core/traitMechanics.js"),
    read("src/index.css"),
    read("src/core/rpgRules.js"),
    read("src/core/descriptions.js"),
  ]);
  assert.match(panel, /explanation\.catalog/);
  assert.match(descriptions, /Descrição do catálogo/);
  assert.match(panel, /Registrar ativação/);
  assert.match(panel, /Consumir ou remover/);
  assert.match(panel, /Restaurar item/);
  assert.match(room, /<TraitMechanicsPanel/);
  assert.match(combat, /traitModifiers/);
  assert.match(combat, /Cloud Nine ou Air Lock/);
  assert.match(battlefield, /room-token-traits/);
  assert.match(mechanics, /weakness-policy/);
  assert.match(mechanics, /neutralizing-gas/);
  assert.match(css, /Contrato de contraste 9\.5/);
  assert.match(css, /\.token-traits/);
  assert.match(css, /\.combat-trait-line/);
  assert.match(rules, /Cada habilidade tem gatilho, estado e histórico/);
  assert.match(rules, /Itens segurados possuem estado próprio na cena/);
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

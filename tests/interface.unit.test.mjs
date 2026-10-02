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
  assert.equal(RPG_STATUS_LABELS.paralysis, "Paralysis");
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
  assert.match(text, /Gigantamax|Nível Dynamax|Aventura neste dispositivo|Central da Aventura/);
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
  const packageJson = JSON.parse(await read("package.json"));
  assert.ok(worker.includes(`myowndex-shell-v${packageJson.version}`), "a release must invalidate the previous shell cache");
  assert.match(worker, /raw\.githubusercontent\.com/);
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /SKIP_WAITING/);
  assert.doesNotMatch(worker, /then\(\(\) => self\.skipWaiting\(\)\)/);
  assert.match(worker, /request\.headers\.get\("RSC"\)/);
  assert.match(worker, /myowndex-maskable-512-v91\.png/);
  assert.match(app, /document\.readyState === "complete"/);
  assert.match(app, /updateViaCache: "none"/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /current\.update\(\)/);
});

test("local rolls keep exact modes, a clean result and manageable local history", async () => {
  const [guide, panel, rolls] = await Promise.all([
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Shared/LocalDicePanel.jsx"),
    read("src/core/localRolls.js"),
  ]);
  assert.match(guide, /<LocalDicePanel/);
  assert.doesNotMatch(panel, /Seguro e offline|Resultado registrado|Detalhes e segurança|>Mantido</);
  assert.doesNotMatch(panel, /placeholder=/, "dice fields use persistent labels instead of examples inside inputs");
  assert.match(panel, /rollLabel\(result/);
  assert.match(panel, /Vantagem · menor de dois d100/);
  assert.match(panel, /Desvantagem · maior de dois d100/);
  assert.match(panel, /Histórico/);
  assert.match(rolls, /myowndex_guide_roll_history_v1/);
  assert.match(panel, /Até 100 resultados salvos/);
  assert.match(panel, /Apagar histórico/);
  assert.match(rolls, /clearLocalRolls/);
  assert.match(panel, /if\(lock\.current \|\| !ready/);
  assert.match(panel, /event\.repeat/);
  assert.match(panel, /Baixar histórico/);
});

test("game style and adventure phase use compact tabs with complete help on demand", async () => {
  const [app, styleControl, room, phaseControl, rules, roomCore, css] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Shared/GameStyleControl.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/AdventurePhaseControl.jsx"),
    read("src/core/rpgRules.js"),
    read("src/core/room.js"),
    read("src/journey.css"),
  ]);
  assert.match(app, /<GameStyleControl value=\{experienceMode\}/);
  assert.doesNotMatch(app, /className="mode-select"/);
  assert.match(styleControl, /role="radiogroup"/);
  assert.match(styleControl, /aria-checked=\{selected\}/);
  assert.match(styleControl, /ArrowRight/);
  assert.match(styleControl, /mode\.description/);
  assert.match(styleControl, /data-mode=\{mode\.id\}/);
  assert.doesNotMatch(styleControl, /GB|GBA|3DS|consoleLabel/);
  assert.doesNotMatch(rules, /consoleLabel/);
  assert.match(room, /<AdventurePhaseControl/);
  assert.doesNotMatch(room, /<select value=\{snapshot\.phase\}/);
  assert.match(phaseControl, /aria-readonly=\{readOnly\}/);
  assert.match(phaseControl, /selectedPhase\.description/);
  assert.match(phaseControl, /room-phase-help-content/);
  assert.doesNotMatch(phaseControl, /consoleLabel/);
  assert.doesNotMatch(roomCore, /consoleLabel/);
  assert.match(roomCore, /Percorra rotas, investigue lugares/);
  assert.match(roomCore, /Organize o campo, declare movimentos/);
  assert.match(css, /\.game-style-options/);
  assert.match(css, /\.room-phase-help-content/);
  assert.match(css, /\.choice-help-popover/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.room-phase-help-content[^{]*\{[^}]*display:\s*block/);
});

test("the common presentation preserves critical rules without hiding content", async () => {
  const [app, guide, room, combat, css, guideCss, documentation] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/journey.css"),
    read("src/guide.css"),
    read("docs/icon-visual-system.md"),
  ]);
  assert.doesNotMatch(guide, /<span className="guide-pill">/);
  assert.match(guide, /guide-damage-limit-card/);
  assert.match(guide, /guide-hit-kill-flow/);
  assert.doesNotMatch(guide, /guide-damage-ceiling|guide-critical-rules/);
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
  assert.match(room, /Registrar autocusto/);
  assert.match(room, /−1 HP/);
  assert.match(room, /Trocar com o banco/);
  assert.match(room, /Fazer a troca/);
  assert.match(room, /Encerrada por autocusto/);
  assert.match(guide, /className="guide-companion pixelated"/);
  assert.doesNotMatch(guide, /guide-hero-lens absolute -bottom/);

  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(guideCss, /\.guide-damage-limit-card/);
  assert.match(guideCss, /\.guide-hit-kill-card/);
  assert.match(documentation, /Sword\/Shield/);
  assert.match(documentation, /HeartGold\/SoulSilver/);
  assert.match(documentation, /não deve desaparecer para caber/);
});

test("all module surfaces share tokens while preserving distinct selected states", async () => {
  const [css, guideCss, recordCss, pcCss] = await Promise.all([
    read("src/journey.css"), read("src/guide.css"), read("src/pokedex-record.css"), read("src/pc-retro.css"),
  ]);
  for (const token of ["--ui-panel", "--ui-ink", "--ui-muted", "--ui-line", "--ui-blue", "--ui-selected"]) {
    assert.ok(css.includes(token), `missing shared presentation token ${token}`);
  }
  for (const [source, selector] of [[css, ".game-panel"], [css, ".room-section"], [guideCss, ".guide-calculator"], [recordCss, ".record-shell"], [pcCss, ".pc-workspace.pc-retro"]]) {
    assert.ok(source.includes(selector), `missing presentation for ${selector}`);
  }
  assert.match(css, /:focus-visible[^{]*\{[^}]*outline:\s*3px/);
  assert.match(css, /\.nav-capsule\.is-active[^{]*\{[^}]*background:\s*#222b30/);
  assert.match(recordCss, /\.record-tabs button\[aria-selected=(?:"true"|true)\][^{]*\{[^}]*background:\s*#222b30/);
});

test("PC controls use the shared presentation after geometry and retain local saving copy", async () => {
  const [room, css, globals] = await Promise.all([
    read("src/components/Room/RpgRoom.jsx"),
    read("src/pc-retro.css"),
    read("app/globals.css"),
  ]);
  assert.match(room, /writeStorage\(LOCAL_ROOM_STORAGE_KEY/);
  assert.match(room, /saveRoomSession/);
  assert.match(css, /\.pc-workspace\.pc-retro[^{]*\{[^}]*color:\s*var\(--ui-ink\)/);
  assert.match(css, /\.pc-main-panel[^{]*\{[^}]*background:\s*var\(--ui-panel\)/);
  assert.match(css, /\.pc-partner-card\.is-selected/);
  assert.match(css, /\.pc-action-button/);
  assert.ok(globals.indexOf("../src/journey.css") > globals.indexOf("../src/index.css"));
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

test("safe shell updates and both visual themes remain available without an install guide button", async () => {
  const [appearance, manifest, layout, css, app] = await Promise.all([
    read("src/components/Shared/AppearanceControl.jsx"),
    read("app/manifest.ts"),
    read("app/layout.tsx"),
    read("src/journey.css"),
    read("src/App.jsx"),
  ]);
  assert.doesNotMatch(app, /InstallMyOwnDex|Pronto para explorar/);
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
  assert.match(app, /app-header-primary/);
  assert.match(css, /min-height:\s*100dvh/);
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
  assert.match(combat, /resolution\.defenseTest\?\.fumble/);
  assert.match(combat, /resolveCombatAction/);
  assert.match(await read("server/authoritativeActions.js"), /hitKillSurvivalGrace/);
  assert.match(rules, /Os sete modificadores/);
  assert.match(rules, /Uma precisão numérica — inclusive 100%/);
  assert.match(rules, /erros críticos do defensor/);
  assert.match(rules, /Sturdy, Focus Sash e efeitos equivalentes são proteções próprias e adicionais/);
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

test("the adventure battle screen uses opposing HUDs and keeps hit kill state separate from self-cost", async () => {
  const [battlefield, room, css] = await Promise.all([
    read("src/components/Room/Battlefield.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/index.css"),
  ]);
  assert.match(battlefield, /battlefield-depth-front/);
  assert.match(battlefield, /room-token-status-card/);
  assert.match(battlefield, /isSelected && <span className="room-token-status-card"/);
  assert.match(battlefield, /aria-expanded=\{isSelected\}/);
  assert.match(battlefield, /room-token-hp-row/);
  assert.match(battlefield, /aria-pressed=\{isSelected\}/);
  assert.match(room, /token-battle-vitals/);
  assert.match(room, /Proteção contra hit kill/);
  assert.match(room, /Registrar autocusto/);
  assert.match(room, /token-self-damage-action/);
  assert.doesNotMatch(room, /if \(result\.tokens\[0\]\) setSelectedTokenId/);
  assert.match(css, /\.room-token\.hud-right \.room-token-status-card/);
  assert.match(css, /\.room-token\.hud-left \.room-token-status-card/);
  assert.match(css, /\.battlefield-depth\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?background:\s*transparent;/);
  assert.match(css, /\.token-hit-kill-meter/);
  assert.match(room, /rollInFlight\.current/);
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
  const [guide, rules, localPanel] = await Promise.all([
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/core/rpgRules.js"),
    read("src/components/Shared/LocalDicePanel.jsx"),
  ]);
  assert.doesNotMatch(guide, /target="_blank"/);
  assert.match(guide, /RPG_RULE_SECTIONS\.map/);
  assert.match(guide, /Pesquisar regras/);
  assert.match(rules, /Proteção contra hit kill/);
  assert.match(rules, /três vezes o HP máximo/);
  assert.match(rules, /uma única vez por batalha/);
  assert.match(rules, /trocar o Pokémon, curá-lo ou levá-lo novamente ao HP máximo não restaura/);
  assert.match(rules, /Movimentos de múltiplos acertos são resolvidos hit por hit/);
  assert.match(rules, /Somente dano realmente causado conta/);
  assert.match(rules, /reduz o próprio HP/);
  assert.match(rules, /Acertos críticos superam o limite de dano/);
  assert.match(localPanel, /lock\.current/);
  assert.match(localPanel, /entry\.id/);
});

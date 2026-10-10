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
const interfaceFiles = async root => (await readdir(new URL(`../${root}/`, import.meta.url), { recursive: true }))
  .filter(path => /\.(?:jsx|tsx|css|html)$/i.test(path))
  .map(path => `${root}/${path}`);

test("physical phones keep mobile density even with a desktop-sized layout viewport", async () => {
  const [collectionCss, diceCss, shellCss] = await Promise.all([
    read("src/playful-collection.css"),
    read("src/local-dice.css"),
    read("src/game-shell.css"),
  ]);
  assert.match(collectionCss, /max-device-width:\s*700px/);
  assert.match(collectionCss, /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)\s*!important/);
  assert.match(diceCss, /max-device-width:\s*700px/);
  assert.match(diceCss, /width:\s*calc\(100vw - \.75rem\)\s*!important/);
  assert.match(shellCss, /min-width:\s*700px[\s\S]*max-device-width:\s*700px/);
  assert.match(shellCss, /html\s*\{\s*font-size:\s*18px;/);
});

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
  assert.match(room, /savedSession=\{loadRoomSession\(\{ scope: storageScope \}\)\}/);
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
  assert.match(text, />Aventura<\/(?:span|button)>/);
  assert.match(text, />Guia<\/(?:span|button)>/);
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

test("the game interface never uses placeholders as instructions or decoration", async () => {
  const paths = [...await interfaceFiles("src"), ...await interfaceFiles("app")];
  for (const path of paths) {
    const source = await read(path);
    assert.doesNotMatch(source, /\bplaceholder\s*=/i, `${path} must use a visible game-facing label or help instead of a placeholder`);
    assert.doesNotMatch(source, /::placeholder/i, `${path} must not carry placeholder-only styling`);
  }
});

test("visible copy avoids robotic system language", async () => {
  const sources = await Promise.all([
    read("src/App.jsx"),
    read("src/components/ErrorBoundary.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Pokedex/AbilityCard.jsx"),
    read("src/components/Pokedex/MoveAccordion.jsx"),
    read("src/components/Pokedex/PokemonModal.jsx"),
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
  assert.equal(trait.summary, "Works only in a specific situation.");
  assert.equal(trait.handling, "", "no generic explanation delegates an unknown rule to the player");
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
  assert.match(worker, /myowndex-dex-v105-96\.png/);
  assert.doesNotMatch(worker, /myowndex-rotomdex-v101|myowndex-(?:icon|app|maskable|shortcut).*v91|favicon-v91/);
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
  assert.doesNotMatch(guide, /LocalDicePanel/, "Dados has one home instead of a second copy inside the Guide");
  assert.doesNotMatch(panel, /Seguro e offline|Resultado registrado|Detalhes e segurança|>Mantido</);
  assert.doesNotMatch(panel, /\bplaceholder\s*=/i);
  assert.match(panel, /rollLabel\(result/);
  assert.match(panel, /Vale o menor d100/);
  assert.match(panel, /Vale o maior d100/);
  assert.doesNotMatch(panel, /Probabilidades|Resultados possíveis|Superar dificuldade:|local-dice-equation/);
  assert.match(panel, /Histórico/);
  assert.match(rolls, /myowndex_guide_roll_history_v1/);
  assert.match(panel, /Nenhuma rolagem ainda/);
  assert.match(panel, /Apagar histórico/);
  assert.match(rolls, /clearLocalRolls/);
  assert.doesNotMatch(panel, /if\(lock\.current \|\| applyingAccount\.current \|\| !ready/, "local rolls must not wait for storage hydration or an account merge");
  assert.match(panel, /remoteAdventure && \(lock\.current \|\| applyingAccount\.current\)/, "only an authoritative remote request owns the request lock");
  assert.match(panel, /LOCAL_ROLL_LIMIT/, "the local history cap must be explicitly available to the roll handler");
  assert.match(panel, /writeStorage\(LOCAL_ROLL_HISTORY_KEY,mergeLocalRolls\(\[receipt\],cached\),\{scope\}\)/, "local history keeps a scope-captured browser mirror");
  assert.match(panel, /setResult\(receipt\);[\s\S]*pendingReceipts\.current\.set[\s\S]*setHistory\(current=>mergeLocalRolls\(\[receipt\],current\)\)[\s\S]*writeStorage\(LOCAL_ROLL_HISTORY_KEY[\s\S]*saveLocalRollDurable/, "the session history is updated before either persistence path");
  assert.doesNotMatch(panel, /disabled=\{!ready \|\| Boolean\(configuration\.error\)\}/, "storage hydration must never disable a local roll");
  assert.doesNotMatch(panel, /unlockTimer/, "local rolling has no persistence-driven cooldown");
  assert.match(panel, /event\.repeat/);
  assert.match(panel, /Baixar histórico/);
});

test("Dados remains global and also opens on demand inside an adventure", async () => {
  const [app, guide, room, dialog, panel] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Shared/LocalDiceDialog.jsx"),
    read("src/components/Shared/LocalDicePanel.jsx"),
  ]);
  assert.match(app, /aria-label="Abrir Dados"/);
  assert.match(app, /context=\{diceRoomContext \? "aventura" : "central"\}/);
  assert.doesNotMatch(guide, /LocalDicePanel/);
  assert.match(room, /AdventureDicePanel context="aventura"/);
  assert.match(room, /diceOpen && <AdventureDicePanel/);
  assert.doesNotMatch(room, /QuickRoller|Rolagem rápida/);
  assert.match(room, />Ações<\/button>/);
  assert.doesNotMatch(room, />Dados e ações<\/button>/);
  assert.match(dialog, /context=\{context\}/);
  assert.match(panel, /const inAdventure=context==="aventura"/);
  assert.match(panel, /!inAdventure && <div className="local-dice-pages"/);
  assert.match(panel, /!inAdventure && <details className="local-dice-history"/);
  assert.match(panel, /action:"quick-free"/);
  assert.match(app, /Projeto de fãs · <a[^>]*href="https:\/\/pokeapi\.co\/about"/);
  assert.match(app, /aria-expanded=\{diceOpen\}/);
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
  const [app, guide, room, combat, css, guideCss, documentation, protection] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
    read("src/journey.css"),
    read("src/guide.css"),
    read("docs/icon-visual-system.md"),
    read("src/components/Shared/HitKillExplanation.jsx"),
  ]);
  assert.doesNotMatch(guide, /<span className="guide-pill">/);
  assert.match(guide, /guide-damage-limit-card/);
  assert.match(guide, /<HitKillExplanation/);
  assert.match(room, /<HitKillExplanation expanded/);
  assert.match(protection, /guide-hit-kill-flow/);
  assert.match(protection, /protectionRule\?\.bullets\?\.map/);
  assert.doesNotMatch(guide, /guide-damage-ceiling|guide-critical-rules/);
  assert.match(guide, /data-rule-id=\{rule\.id\}/);
  assert.doesNotMatch(guide, /data-rule-id="3\.[34]"/);
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
  assert.match(room, /Pagar HP/);
  assert.match(room, /selfInflicted: true, amount: selfCostHp/);
  assert.match(room, /HP a pagar/);
  assert.match(room, /Trocar com o banco/);
  assert.match(room, /Fazer a troca/);
  assert.match(room, /Indisponível/);
  assert.match(guide, /<PokemonCompanion place="guide"/);
  assert.doesNotMatch(guide, /guide-hero-lens absolute -bottom/);

  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /overflow-wrap:\s*normal/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(guideCss, /\.guide-damage-limit-card/);
  assert.match(guideCss, /\.guide-hit-kill-overview/);
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
  assert.match(manifest, /myowndex-dex-v105-/);
  assert.match(manifest, /purpose:\s*"maskable"/);
  assert.match(manifest, /shortcuts:/);
  assert.match(layout, /shortcut:\s*"\/icons\/myowndex-dex-v105-96\.png"/);
  assert.match(layout, /myowndex-dex-v105-/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /data-theme="night"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(app, /Uma nova versão do MyOwnDex está pronta/);
  assert.match(app, /myowndex-dex-v105-96\.png/);
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
  assert.match(rules, /estágios de −6 a \+6 em Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, Precisão e Evasão/);
  assert.match(rules, /chance numérica, até 100%/);
  assert.match(rules, /erro crítico da defesa/);
  assert.match(rules, /Sturdy, Focus Sash e semelhantes são chances separadas/);
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
  assert.match(rules, /Sketch aprende permanentemente/);
  assert.match(mechanics, /O MyOwnDex resolve quando a condição acontece/);
  assert.match(mechanics, /imposter/);
  assert.match(mechanics, /illusion/);
});

test("the adventure field keeps readable selected health outside the movable Pokémon", async () => {
  const [battlefield, room, css] = await Promise.all([
    read("src/components/Room/Battlefield.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/battlefield-polish.css"),
  ]);
  assert.match(battlefield, /aria-pressed=\{isSelected\}/);
  assert.match(battlefield, /battlefield-focus/);
  assert.match(battlefield, /battle && snapshot\.settings\.showHp/);
  assert.match(battlefield, /STATUS_LABELS\[selectedToken\.status\]/);
  assert.doesNotMatch(battlefield, /room-token-status-card|battlefield-depth-front/);
  assert.match(room, /token-battle-vitals/);
  assert.match(room, /Proteção contra hit kill/);
  assert.match(room, /Pagar HP/);
  assert.match(room, /selfInflicted: true, amount: selfCostHp/);
  assert.match(room, /token-self-damage-action/);
  assert.doesNotMatch(room, /if \(result\.tokens\[0\]\) setSelectedTokenId/);
  assert.match(css, /battlefield-focus-health/);
  assert.doesNotMatch(css, /@keyframes[^}]*sprite|animation:\s*(?:pokemon|idle)/, "Pokémon motion belongs to authored sprite frames and the shared activity scheduler");
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
  assert.match(panel, /<AbilityCard/);
  assert.match(panel, /<ItemCard/);
  assert.doesNotMatch(panel, /Gatilho:.*Conforme|explanation\.catalog/);
  assert.match(descriptions, /Descrição do catálogo/);
  assert.match(panel, /Registrar ativação/);
  assert.match(panel, /Consumir ou remover/);
  assert.match(panel, /Restaurar item/);
  assert.match(room, /<TraitMechanicsPanel/);
  assert.match(combat, /traitModifiers/);
  assert.match(combat, /Cloud Nine ou Air Lock/);
  assert.match(battlefield, /getTraitStatus/);
  assert.match(battlefield, /traits\.abilityActive/);
  assert.match(battlefield, /traits\.itemConsumed/);
  assert.match(mechanics, /weakness-policy/);
  assert.match(mechanics, /neutralizing-gas/);
  assert.match(css, /Contrato de contraste 9\.5/);
  assert.match(css, /\.token-traits/);
  assert.match(css, /\.combat-trait-line/);
  assert.match(rules, /precisa estar ativa e cumprir seu gatilho/);
  assert.match(rules, /Um item pode estar ativo, consumido, removido, trocado ou restaurado/);
});

test("the internal Guide is the canonical source and explains hit kill protection", async () => {
  const [guide, rules, localPanel, localPokemon, combat] = await Promise.all([
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/core/rpgRules.js"),
    read("src/components/Shared/LocalDicePanel.jsx"),
    read("src/components/Shared/LocalPokemonDice.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
  ]);
  assert.doesNotMatch(guide, /target="_blank"/);
  assert.match(guide, /RPG_RULE_SECTIONS\.map/);
  assert.match(guide, /Pesquisar regras/);
  assert.match(rules, /Proteção contra hit kill/);
  assert.match(rules, /três vezes o HP máximo/);
  assert.match(rules, /uma vez por Pokémon em cada batalha/);
  assert.match(rules, /Depois de usada, curar, trocar ou voltar ao campo não a devolve/);
  assert.match(rules, /Em um movimento de vários acertos, conte cada hit/);
  assert.match(rules, /Só conta o dano que chega ao Pokémon/);
  assert.match(rules, /tirar o próprio HP/);
  assert.match(rules, /acerto crítico.*pode passar do limite comum/);
  assert.match(rules, /regra oficial mais recente e corrigida/);
  assert.match(rules, /1 em 8 de chance de perder a ação/);
  assert.match(rules, /25% de chance de descongelar/);
  assert.match(localPanel, /lock\.current/);
  assert.match(localPanel, /entry\.id/);
  assert.match(rules, /rola os dois lados/);
  assert.match(rules, /sem precisar multiplicar números grandes/);
  assert.match(localPanel, /\["attribute","2d6","Teste"\]/);
  assert.doesNotMatch(localPanel, /Teste simples|Para testes simples/);
  assert.match(localPanel, /<LocalPokemonDice/);
  assert.doesNotMatch(localPanel, /Probabilidades|local-dice-equation/);
  assert.match(localPokemon, /CombatAssistant/);
  assert.match(localPokemon, /"opponent","Oponente"/);
  assert.doesNotMatch(localPokemon, /Oponente selvagem/);
  assert.match(localPokemon, /CaptureAssistant/);
  assert.match(rules, /Aventura e Dados seguem a mesma regra/);
  assert.match(guide, /Atributo ÷ 10/);
  assert.match(guide, /HP ÷ 10/);
  assert.doesNotMatch(guide, /÷ 20/);
  assert.match(combat, /Atributos e modificadores foram aplicados automaticamente/);
  assert.doesNotMatch(combat, /attackTest\.total/);
  assert.doesNotMatch(combat, /contestAttributes\.attacker/);
});


test("game art direction is imported last and preserves the approved content layer", async () => {
  const [globals, art] = await Promise.all([
    read("app/globals.css"),
    read("src/game-art-direction.css"),
  ]);
  assert.ok(globals.trimEnd().endsWith('@import "../src/game-art-direction.css";\n@import "../src/living-pokemon.css";'));
  for (const selector of [".adventure-intro", ".room-lobby-card", ".dex-entry-main", ".local-dice-dialog", ".account-dialog"]) {
    assert.ok(art.includes(selector), `missing art-direction treatment for ${selector}`);
  }
  assert.match(art, /prefers-reduced-motion:\s*reduce/);
  assert.match(art, /forced-colors:\s*active/);
  assert.doesNotMatch(art, /content:\s*["'](?:Entrar|Criar conta|Rolar|Pokédex|Aventura)["']/i);
});


test("joyful identity keeps one Pokémon companion on every primary surface without decorative discs", async () => {
  const [app, room, pc, guide, dice, generator, account, art, layout, manifest] = await Promise.all([
    read("src/App.jsx"),
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Teambuilder/Teambuilder.jsx"),
    read("src/components/Guide/TrainerGuide.jsx"),
    read("src/components/Shared/LocalDiceDialog.jsx"),
    read("src/components/Generator/GeneratorModal.jsx"),
    read("src/components/Account/AccountModal.jsx"),
    read("src/game-art-direction.css"),
    read("app/layout.tsx"),
    read("app/manifest.ts"),
  ]);
  assert.match(app, /<PokemonCompanion place="pokedex"/);
  assert.doesNotMatch(app, /className="opening-companion"/, "the pending indicator does not duplicate the Pokédex companion");
  assert.match(room, /<PokemonCompanion place="adventure"/);
  assert.match(pc, /<PokemonCompanion place="pc"/);
  assert.match(guide, /<PokemonCompanion place="guide"/);
  assert.match(dice, /<PokemonCompanion place="dice"/);
  assert.match(generator, /<PokemonCompanion place="generator"/);
  assert.match(account, /<PokemonCompanion place="account"/);
  assert.doesNotMatch(account, /<h2[^>]*>Seu MyOwnDex<\/h2>/);
  assert.match(account, /<h2 id=\{titleId\}>Cartão de Treinador<\/h2>/);
  assert.match(art, /\.pokemon-companion::before[\s\S]*content:none\s*!important;[\s\S]*display:none\s*!important;/);
  assert.doesNotMatch(art, /game-shadow-float/);
  for (const source of [app, layout, manifest]) assert.match(source, /myowndex-dex-v105-/);
  assert.doesNotMatch(app + layout + manifest, /myowndex-rotomdex-v101|myowndex-icon-v91|favicon-v91/);
});


test("native transparent companions keep clean stages and readable proportional sprites", async () => {
  const [companion, art] = await Promise.all([
    read("src/components/Shared/PokemonCompanion.jsx"),
    read("src/game-art-direction.css"),
  ]);
  assert.match(companion, /\/sprites\/companions\/\$\{companion\.id\}\.gif/);
  assert.doesNotMatch(companion, /myowndex-companion-idle|myowndex-companion-pop/);
  assert.doesNotMatch(art, /@keyframes myowndex-companion-(?:idle|pop)/);
  assert.match(art, /\.pokemon-companion::before,[\s\S]*content:none\s*!important/);
  assert.match(art, /\.pokemon-card-sprite-frame[\s\S]*background:transparent\s*!important/);
  assert.doesNotMatch(art, /--pokemon-scale:\s*1\s*!important/);
  assert.match(art, /\.pokemon-card-sprite-frame \.pokemon-sized-sprite[\s\S]*transform:none\s*!important/);
  assert.match(art, /\.dex-heading[\s\S]*grid-template-areas:"title partner" "count partner"/);
});

test("all visible app identity references use one Pokédex do MyOwnDex master asset", async () => {
  const [app, layout, manifest, worker] = await Promise.all([
    read("src/App.jsx"), read("app/layout.tsx"), read("app/manifest.ts"), read("public/sw.js"),
  ]);
  for (const source of [app, layout, manifest, worker]) assert.match(source, /myowndex-dex-v105-/);
  assert.doesNotMatch(app + layout + manifest + worker, /myowndex-rotomdex-v101|myowndex-(?:icon|app|maskable|shortcut).*v(?:91|100)|favicon-v(?:91|100)/);
  const master = await readFile(new URL("../public/icons/myowndex-dex-v105-master.png", import.meta.url));
  assert.equal(master.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "the current identity has one real portable PNG master");
  assert.ok(master.readUInt32BE(16) >= 512 && master.readUInt32BE(20) >= 512, "the master preserves detail for high-resolution icons");
});

test("local dice submit has no click-count throttle", async () => {
  const panel = await read("src/components/Shared/LocalDicePanel.jsx");
  assert.doesNotMatch(panel, /event\.detail\s*>\s*1/);
  assert.match(panel, /setHistory\(current=>mergeLocalRolls\(\[receipt\],current\)\)/);
});

test("optional Box multi-selection, battle utilities, Porygon centerpiece and XP copy stay consistent", async () => {
  const [room, pc, experience, art, controls] = await Promise.all([
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Teambuilder/Teambuilder.jsx"),
    read("src/components/Shared/ExperienceAward.jsx"),
    read("src/game-art-direction.css"),
    read("src/room-controls.css"),
  ]);
  assert.match(room, /activePokemonIds: requested/);
  assert.match(room, /Escolher vários Pokémon/);
  assert.match(room, /chosenTeamPokemonIds.includes\(pokemon.id\)/);
  assert.match(room, /token-management-grid/);
  assert.match(controls, /room-team-multiple-choice/);
  assert.match(pc, /pc-mascot-stage/);
  assert.match(art, /\.pc-mascot-stage/);
  assert.match(experience, /<summary>Ganhar XP<\/summary>/);
  assert.match(experience, /<legend>Recompensas pelo desafio<\/legend>/);
});

test("adventure renders a full scene outside battle and keeps independent sprite resize gestures", async () => {
    const room = await read("src/components/Room/RpgRoom.jsx");
    const field = await read("src/components/Room/Battlefield.jsx");
    assert.match(room, /compact=\{false\}/);
    assert.match(field, /room-token-resize-handle/);
    assert.match(field, /sceneScale: resize.scale/);
    assert.match(field, /event.stopPropagation\(\)/);
});

test("installation UI stays invisible while the PWA retains standalone identity", async () => {
    const [manifest, css, app, globalStyles, art] = await Promise.all([
        read("app/manifest.ts"), read("src/game-shell.css"), read("src/App.jsx"),
        read("app/globals.css"), read("src/game-art-direction.css"),
    ]);
    assert.doesNotMatch(app, /AppInstallControl|Instalar aplicativo|Instalar o MyOwnDex/);
    assert.doesNotMatch(css, /app-install-button|app-install-dialog/);
    assert.match(manifest, /display: "standalone"/);
    assert.match(manifest, /start_url: "\/\?abrir=aventura"/);
    assert.match(css, /display-mode: standalone/);
    assert.match(globalStyles, /weather-effects\.css/);
    assert.match(art, /\.pc-mascot-stage::before \{\s*content: none; display: none;/);
    assert.match(art, /\.pc-mascot-stage \{[^}]*border: 0; border-radius: 0;/);
});

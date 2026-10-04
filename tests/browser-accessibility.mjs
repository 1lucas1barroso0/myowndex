// Optional end-to-end accessibility audit. Install Playwright and axe-core as
// described in docs/VALIDACAO.md. QA account changes require a loopback server;
// all catalog, Box, Generator and local adventure data use an isolated context.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = process.env.MYOWNDEX_AXE_PATH || require.resolve('axe-core/axe.min.js');
const axeSource = await fs.readFile(axePath, 'utf8');
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000';
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname);
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
const report = [];
page.on('pageerror', error => errors.push(error.message));
const stats = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
const pokemon = (id, name, bases, type, ability) => ({ id, name, species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` }, types: [{ slot: 1, type: { name: type } }], stats: bases.map((base_stat, i) => ({ base_stat, stat: { name: stats[i] } })), height: 7, weight: 69, sprites: { front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` }, abilities: [{ slot: 1, is_hidden: false, ability: { name: ability, url: `https://pokeapi.co/api/v2/ability/${ability}/` } }], moves: ['tackle', 'growl'].map((move, i) => ({ move: { name: move, url: `https://pokeapi.co/api/v2/move/${move}/` }, version_group_details: ['red-blue', 'scarlet-violet'].map(game => ({ level_learned_at: i + 1, move_learn_method: { name: 'level-up' }, version_group: { name: game } })) })) });
const bulba = pokemon(1, 'bulbasaur', [45, 49, 49, 65, 65, 45], 'grass', 'overgrow');
const pika = pokemon(25, 'pikachu', [35, 55, 40, 50, 50, 90], 'electric', 'static');
const species = (data) => ({ id: data.id, name: data.name, capture_rate: 45, gender_rate: 1, base_happiness: 70, habitat: { name: 'grassland' }, growth_rate: { name: 'medium-slow' }, is_legendary: false, is_mythical: false, generation: { name: 'generation-i' }, varieties: [{ is_default: true, pokemon: { name: data.name, url: `https://pokeapi.co/api/v2/pokemon/${data.id}/` } }], genera: [{ genus: 'Seed Pokémon', language: { name: 'en' } }], flavor_text_entries: [{ flavor_text: 'A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.', language: { name: 'en' }, version: { name: 'red' } }, { flavor_text: 'For some time after its birth, it uses the nutrients that are packed into the seed on its back in order to grow.', language: { name: 'en' }, version: { name: 'scarlet' } }], evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' } });
const move = name => ({ id: name === 'growl' ? 45 : 33, name, accuracy: 100, power: name === 'growl' ? null : 40, pp: name === 'growl' ? 40 : 35, priority: 0, type: { name: 'normal' }, damage_class: { name: name === 'growl' ? 'status' : 'physical' }, target: { name: 'selected-pokemon' }, effect_entries: [{ language: { name: 'en' }, effect: name === 'growl' ? "Lowers the target's Attack by one stage." : 'Inflicts regular damage.' }], meta: { ailment: { name: 'none' }, category: { name: name === 'growl' ? 'net-good-stats' : 'damage' }, min_hits: null, max_hits: null, crit_rate: 0, flinch_chance: 0 }, stat_changes: name === 'growl' ? [{ stat: { name: 'attack' }, change: -1 }] : [] });
await context.route('https://pokeapi.co/api/v2/**', async route => {
    const [, , kind, name] = new URL(route.request().url()).pathname.split('/').filter(Boolean);
    const partner = name === '25' || name === 'pikachu' ? pika : bulba;
    let body;
    if (kind === 'pokemon') body = partner;
    else if (kind === 'pokemon-species') body = name ? species(partner) : { count: 2, results: [bulba, pika].map(entry => ({ name: entry.name, url: `https://pokeapi.co/api/v2/pokemon-species/${entry.id}/` })) };
    else if (kind === 'move') body = name ? move(name) : { count: 2, results: ['tackle', 'growl'].map(entry => ({ name: entry, url: `https://pokeapi.co/api/v2/move/${entry}/` })) };
    else if (kind === 'evolution-chain') body = { chain: { species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' }, evolves_to: [{ species: { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon-species/2/' }, evolves_to: [] }] } };
    else if (kind === 'ability') body = name ? { id: 65, name, effect_entries: [{ language: { name: 'en' }, effect: name === 'overgrow' ? 'When this Pokémon has 1/3 or less of its HP remaining, its Grass-type moves inflict 1.5× as much regular damage.' : 'Contact with this Pokémon may cause paralysis.' }] } : { count: 2, results: ['overgrow', 'static'].map(entry => ({ name: entry, url: `https://pokeapi.co/api/v2/ability/${entry}/` })) };
    else if (kind === 'item') body = name ? { id: 234, name, category: { name: 'held-items' }, effect_entries: [{ language: { name: 'en' }, effect: 'Heals the holder by 1/16 of its maximum HP each turn.' }] } : { count: 1, results: [{ name: 'leftovers', url: 'https://pokeapi.co/api/v2/item/leftovers/' }] };
    else body = { name, effect_entries: [], results: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await context.addInitScript(({ bulba, pika }) => {
    if (localStorage.getItem('myowndex_a11y_seeded')) return;
    localStorage.setItem('myowndex_a11y_seeded', 'true');
    localStorage.setItem('myowndex_rotom_v4', JSON.stringify({ schema: 5, savedAt: Date.now(), teams: [{ id: 'a11y-box', shareId: 'a11y-box', name: 'Amigos da jornada', updatedAt: Date.now(), versionGroup: 'scarlet-violet', rpgScale: 2, pokemon: [
        { id: 'a11y-bulba', nickname: 'Buba', species: bulba, level: 20, genderRate: 1, nature: 'hardy', ability: 'overgrow', item: 'leftovers', moves: ['tackle', 'growl', '', ''], ivs: {}, evs: {}, rpg: { currentHp: 5, pp: [35, 40, null, null], xp: 0 } },
        { id: 'a11y-pika', nickname: 'Pika', species: pika, level: 20, nature: 'hardy', ability: 'static', moves: ['tackle', '', '', ''], ivs: {}, evs: {}, rpg: { currentHp: 4, pp: [35, null, null, null], xp: 0 } },
    ] }] }));
}, { bulba, pika });

const nav = async name => page.getByRole('button', { name, exact: true }).click();
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(':scope > summary').click(); };
const writeReport = () => fs.writeFile(process.env.MYOWNDEX_ACCESSIBILITY_REPORT || '/tmp/myowndex-accessibility-report.json', JSON.stringify({ report, errors }, null, 2));
const screenshot = async (name, selector, theme = 'Claro') => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme === 'Escuro' ? 'night' : 'day'; }, theme);
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `/tmp/myowndex41-a11y-${name}.png` });
};

async function checkpoint(label, widths = [390], themes = ['Claro', 'Escuro'], roomPane = null) {
    for (const width of widths) for (const theme of themes) {
        await page.setViewportSize({ width, height: 844 });
        if (roomPane) {
            const tab = page.locator('.room-mobile-nav button').filter({ hasText: roomPane });
            if (await tab.isVisible()) {
                await tab.click();
                const selectedPane = { Equipe: 'roster', Campo: 'field', Ações: 'tools' }[roomPane];
                assert.equal(await page.locator(`.room-${selectedPane}`).isVisible(), true, `${roomPane} opens its mobile panel`);
            }
        }
        // A modal makes the underlying appearance radio inert. Change the theme
        // through the same persisted attribute used by that control, without
        // disturbing the user's open form or tab.
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme === 'Escuro' ? 'night' : 'day'; }, theme);
        // Let finite entrance animations finish; transient opacity is not the
        // settled UI's contrast. Reduced-motion behavior is checked separately.
        await page.waitForTimeout(600);
        await page.waitForFunction(() => document.title.trim().length > 0);
        await page.addScriptTag({ content: axeSource });
        const result = await page.evaluate(async () => {
            const audit = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
            const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).clipPath !== 'inset(50%)' && !element.closest('[inert],[aria-hidden="true"]') && (!element.closest('details:not([open])') || element.closest('details:not([open])').querySelector(':scope > summary')?.contains(element));
            const dialog = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(visible).at(-1);
            const root = dialog || document;
            const controls = [...root.querySelectorAll('button,input,select,textarea,summary,a[href],[role="radio"]')].filter(element => visible(element) && !element.disabled && !element.closest('nextjs-portal'));
            const escaped = controls.filter(element => { const r = element.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label') || element.innerText || element.name, class: element.className }));
            const smallTargets = controls.filter(element => {
                if (['checkbox', 'radio'].includes(element.type)) return false; // axe verifies their labels; their label is the touch target.
                const rect = element.getBoundingClientRect();
                return rect.height < 43.5 || rect.width < 43.5;
            }).map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label') || element.innerText || element.name, class: element.className, width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }));
            const violations = audit.violations.map(entry => ({ id: entry.id, impact: entry.impact, nodes: entry.nodes.map(node => ({ target: node.target, summary: node.failureSummary, html: node.html.replace(/value="[^"]*"/g, 'value="[redacted]"').replace(/(<textarea[^>]*>).*?(<\/textarea>)/gs, '$1[redacted]$2').replace(/(<code[^>]*>).*?(<\/code>)/gs, '$1[redacted]$2').slice(0,450) })) }));
            const smallText = [...root.querySelectorAll('label,small,dt,dd,p,h1,h2,h3,h4,button,summary,span')].filter(element => visible(element) && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()) && Number.parseFloat(getComputedStyle(element).fontSize) < 14).map(element => ({ text: element.textContent.trim().slice(0,100), class: element.className, size: Number.parseFloat(getComputedStyle(element).fontSize) }));
            return { violations, escaped, smallTargets, smallText, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, dialog: dialog ? { width: dialog.clientWidth, scroll: dialog.scrollWidth } : null };
        });
        report.push({ label, width, theme, ...result });
        await writeReport();
        console.log(JSON.stringify({ label, width, theme, violations: result.violations.map(entry => ({ id: entry.id, nodes: entry.nodes.length })), escaped: result.escaped.length, smallTargets: result.smallTargets }));
    }
}

async function dialogKeyboard(dialog, trigger, closeName) {
    await page.getByRole('button', { name: closeName, exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'reverse Tab stays in the open dialog');
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'Tab stays in the open dialog');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Escape restores focus to the opening control');
}

let qaAccount = null;
let qaRoom = null;
const qaPassword = 'MyOwnDex accessibility QA! 2026';
try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor();
    for (const name of ['Abrir a Pokédex', 'Abrir o PC do Bill', 'Abrir o Guia do Treinador', 'Abrir a Central da Aventura']) {
        await nav(name); await checkpoint(name, [320, 1280]);
    }
    const credits = page.locator('.game-credits');
    assert.equal(await credits.evaluate(element => element.open), false, 'Credits stay optional');
    await credits.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await credits.evaluate(element => element.open), true, 'Keyboard opens credits');
    await checkpoint('Créditos: leitura e teclado', [320, 1280]);
    await credits.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await credits.evaluate(element => element.open), false, 'Keyboard closes credits');
    await nav('Abrir a Pokédex');
    const recordTrigger = page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true });
    await recordTrigger.click();
    const record = page.locator('.record-shell');
    await record.getByRole('button', { name: /Adicionar à equipe/ }).waitFor();
    await checkpoint('Pokédex: perfil, habilidades e evolução', [320, 1280]);
    const translation = record.getByRole('button', { name: 'Ver tradução do registro em português', exact: true });
    if (await translation.count()) {
        await translation.click();
        assert.equal(await record.locator('.species-description p').getAttribute('lang'), 'pt-BR');
        await checkpoint('Pokédex: registro em português');
    }
    await record.getByRole('tab', { name: 'Tipos', exact: true }).click();
    await checkpoint('Pokédex: tipos', [320]);
    await record.getByRole('tab', { name: 'Movimentos', exact: true }).click();
    await record.locator('.record-move-toggle').first().click();
    await checkpoint('Pokédex: movimento expandido', [320, 1280]);
    await dialogKeyboard(record, recordTrigger, 'Fechar registro da Pokédex');

    await nav('Abrir o PC do Bill');
    await page.locator('.pc-partner-card').first().click();
    const editor = page.locator('.pokemon-editor');
    await editor.waitFor();
    for (const summary of ['Consultar habilidade e item', 'Progresso da jornada', 'Características e transformações', 'Treinamento']) {
        await openDetails(editor.locator('details').filter({ has: page.locator(':scope > summary').filter({ hasText: summary }) }).first());
    }
    await checkpoint('PC: ficha completa com habilidades, item, IVs e EVs', [320, 1280]);
    await screenshot('pc-journey-night', '.rpg-journey-panel', 'Escuro');
    await page.getByRole('button', { name: 'Compartilhar', exact: true }).click();
    await checkpoint('PC: compartilhamento', [320]);
    await page.getByRole('button', { name: 'Fechar compartilhamento', exact: true }).click();
    await page.getByRole('button', { name: /Importar Pokémon ou Box/ }).click();
    await checkpoint('PC: importação', [320]);
    await page.getByRole('button', { name: /Fechar importação/ }).click();
    await page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    const generator = page.locator('.generator-dialog');
    for (const disclosure of await generator.locator('.generator-customize').all()) await openDetails(disclosure);
    await checkpoint('Gerador: todas as opções', [320, 1280]);
    await openDetails(generator.locator('.generator-customize').filter({ has: page.getByText('Personalizar o encontro', { exact: true }) }));
    await generator.getByRole('combobox', { name: 'Espécie a gerar' }).selectOption('1');
    await generator.getByRole('combobox', { name: 'Quantidade de Pokémon' }).selectOption('2');
    await generator.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await generator.locator('.generator-partner').nth(1).waitFor();
    await openDetails(generator.locator('.generator-partner-details').first());
    await checkpoint('Gerador: encontro e ficha', [320, 1280]);
    await screenshot('generator-result', '.generator-result-heading');
    await generator.getByRole('button', { name: 'Remover Bulbasaur da prévia', exact: true }).first().click();
    await checkpoint('Gerador: confirmação de remoção', [320]);
    await page.getByRole('button', { name: 'Voltar à prévia', exact: true }).click();
    await dialogKeyboard(generator, page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).filter({ visible: true }).first(), 'Fechar gerador');

    await nav('Abrir o Guia do Treinador');
    await page.getByLabel('Pesquisar regras').fill('dano');
    await checkpoint('Guia: regras abertas por busca', [320, 1280]);
    await page.getByLabel('Pesquisar regras').fill('');
    await openDetails(page.locator('.guide-calculator'));
    await checkpoint('Guia: calculadora', [320]);

    const diceTrigger = page.getByRole('button', { name: 'Abrir Dados', exact: true }).filter({ visible: true }).first();
    await diceTrigger.click();
    const dice = page.getByRole('dialog', { name: 'Dados', exact: true });
    await openDetails(dice.locator('.local-dice-options'));
    await dice.getByRole('button', { name: 'Rolar 2d6', exact: true }).click();
    await dice.locator('.local-dice-result').waitFor();
    await openDetails(dice.locator('.local-dice-history'));
    await checkpoint('Dados: 2d6, resultado e histórico', [320, 1280]);
    await dice.getByRole('button', { name: 'd100 Chance', exact: true }).click();
    await checkpoint('Dados: d100', [320]);
    await dice.getByRole('button', { name: 'dX Livre', exact: true }).click();
    await checkpoint('Dados: dX', [320]);
    await dice.getByRole('button', { name: 'Campo', exact: true }).click();
    await dice.getByRole('combobox', { name: 'Pokémon da Box', exact: true }).selectOption('a11y-box:a11y-bulba');
    await dice.getByRole('button', { name: 'Trazer para o campo', exact: true }).click();
    await openDetails(dice.locator('.local-pokemon-setup'));
    await dice.getByRole('combobox', { name: 'Pokémon da Box', exact: true }).selectOption('a11y-box:a11y-pika');
    await dice.getByRole('button', { name: 'Oponente', exact: true }).click();
    await dice.getByRole('button', { name: 'Trazer para o campo', exact: true }).click();
    await dice.getByRole('button', { name: 'Rolar iniciativa', exact: true }).click();
    const combat = dice.locator('details.room-tool').filter({ has: page.getByText('Usar um movimento', { exact: true }) });
    await openDetails(combat);
    await combat.getByRole('combobox', { name: 'Usuário', exact: true }).selectOption({ label: 'Buba' });
    await combat.getByRole('combobox', { name: 'Movimento', exact: true }).selectOption('tackle');
    await combat.getByRole('combobox', { name: 'Alvo', exact: true }).selectOption({ label: 'Pika' });
    await combat.getByRole('button', { name: 'Usar Tackle', exact: true }).click();
    await combat.locator('.combat-result-summary').waitFor();
    for (const label of ['Disputa entre Pokémon', 'Captura', 'Condições do campo']) await openDetails(dice.locator('details.room-tool').filter({ has: page.getByText(label, { exact: true }) }));
    await checkpoint('Dados: campo, turno, movimento, disputa, captura e condições', [320, 1280]);
    await screenshot('field-initiative', '.local-pokemon-initiative');
    await screenshot('field-result', '.combat-result-summary');
    await openDetails(combat.locator('.combat-result-details'));
    await checkpoint('Dados: detalhes completos da jogada', [320]);
    await dialogKeyboard(dice, diceTrigger, 'Fechar dados');

    await nav('Abrir a Central da Aventura');
    await page.getByRole('button', { name: 'Começar uma aventura local', exact: false }).click();
    await page.locator('.room-app').waitFor();
    const teamPane = page.locator('.room-mobile-nav button').filter({ hasText: 'Equipe' });
    if (await teamPane.isVisible()) await teamPane.click();
    await page.getByRole('combobox', { name: 'Quem entra em campo', exact: true }).selectOption({ label: 'Buba' });
    await page.getByRole('button', { name: 'Entrar como aliado', exact: true }).click();
    await page.getByRole('combobox', { name: 'Quem entra em campo', exact: true }).selectOption({ label: 'Pika' });
    await page.getByRole('button', { name: 'Entrar como oponente', exact: true }).click();
    for (const pane of ['Equipe', 'Campo', 'Ações']) {
        const button = page.locator('.room-mobile-nav button').filter({ hasText: pane });
        if (await button.isVisible()) await button.click();
        if (pane === 'Ações') for (const tool of await page.locator('.room-tools > details').all()) await openDetails(tool);
        await checkpoint(`Aventura local: ${pane}`, [320, 1280], ['Claro', 'Escuro'], pane);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await openDetails(page.locator('.battlefield-environment'));
    await openDetails(page.locator('.room-notes-panel'));
    await openDetails(page.locator('.room-participants'));
    await checkpoint('Aventura: preparação do campo, notas e participantes', [320, 1280], ['Claro', 'Escuro'], 'Campo');
    await page.locator('.room-token').first().click();
    const inspector = page.locator('.token-inspector');
    await inspector.waitFor();
    for (const disclosure of await inspector.locator(':scope > details').all()) await openDetails(disclosure);
    await checkpoint('Aventura: ficha rápida, modificadores, habilidades e item', [320, 1280], ['Claro', 'Escuro'], 'Campo');
    await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
    await checkpoint('Aventura: confirmação de encerramento', [320]);
    await page.getByRole('button', { name: 'Continuar aventura', exact: true }).click();

    if (local) {
        await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
        await page.getByRole('button', { name: 'Encerrar aventura', exact: true }).click();
        const lobby = page.locator('.room-lobby-card.is-narrator');
        await lobby.getByLabel('Nome da aventura', { exact: true }).fill('Jornada de acessibilidade QA');
        await lobby.getByLabel('Seu nome na aventura', { exact: true }).fill('Narradora QA');
        await lobby.getByRole('button', { name: 'Abrir nova aventura', exact: true }).click();
        await page.locator('.room-app').waitFor();
        qaRoom = await page.evaluate(() => JSON.parse(localStorage.getItem('myowndex_live_room_v1')));
        await page.setViewportSize({ width: 1280, height: 900 });
        for (const tool of await page.locator('.room-tools > details').all()) await openDetails(tool);
        await checkpoint('Aventura compartilhada: Narrador, convite e chamada', [320, 1280], ['Claro', 'Escuro'], 'Ações');
        const player = await page.evaluate(async room => {
            const response = await fetch(`/api/rooms/${room.code}/join`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-myowndex-room-protocol': '3' }, body: JSON.stringify({ inviteCode: room.inviteCode, displayName: 'Jogadora QA' }) });
            if (!response.ok) throw new Error('QA player could not join disposable room');
            const result = await response.json();
            const session = { code: result.code, key: result.playerKey, role: 'player', playerId: result.playerId, displayName: 'Jogadora QA', local: false };
            localStorage.setItem('myowndex_live_room_v1', JSON.stringify(session));
            return session.playerId;
        }, qaRoom);
        assert.ok(player);
        await page.reload();
        await page.locator('.room-app').waitFor();
        for (const tool of await page.locator('.room-tools > details').all()) await openDetails(tool);
        for (const pane of ['Equipe', 'Campo', 'Ações']) await checkpoint(`Aventura compartilhada: Jogador, ${pane}`, [320, 1280], ['Claro', 'Escuro'], pane);
    }

    const accountTrigger = page.locator('.account-header-button');
    await accountTrigger.click();
    const account = page.locator('.account-dialog');
    for (const label of ['Entrar', 'Criar conta', 'Recuperar acesso']) {
        await account.getByRole('button', { name: label, exact: true }).click();
        await checkpoint(`Conta: ${label}`, [320, 1280]);
    }
    if (local) {
        await account.getByRole('button', { name: 'Criar conta', exact: true }).click();
        qaAccount = `qa_a11y_${Date.now().toString(36)}`;
        await account.getByLabel('Nome de usuário', { exact: true }).fill(qaAccount);
        await account.getByLabel('Nome do Treinador', { exact: true }).fill('Treinadora da jornada');
        await account.getByLabel('Senha', { exact: true }).fill(qaPassword);
        const importChoice = account.getByRole('checkbox', { name: 'Adicionar meus dados deste dispositivo.', exact: true });
        if (await importChoice.count()) await importChoice.uncheck();
        await account.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
        await account.locator('.account-recovery-codes code').nth(7).waitFor();
        for (const disclosure of await account.locator('.account-disclosure').all()) await openDetails(disclosure);
        await checkpoint('Conta: cartão, recuperação e configurações', [320, 1280]);
    }
    await dialogKeyboard(account, accountTrigger, 'Fechar conta');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await nav('Abrir a Pokédex'); await checkpoint('Zoom 200%: Pokédex', [1280]);
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await nav('Abrir o Guia do Treinador');
    assert.equal(await page.locator('[data-companion-place="guide"] img').evaluate(element => getComputedStyle(element).animationName), 'none');
    await checkpoint('Movimento reduzido: Guia', [320]);
    await writeReport();
    const failures = report.flatMap(entry => [...entry.violations.map(violation => ({ label: entry.label, width: entry.width, theme: entry.theme, ...violation })), ...(entry.escaped.length ? [{ label: entry.label, escaped: entry.escaped }] : []), ...(entry.pageWidth > entry.viewport + 1 ? [{ label: entry.label, pageWidth: entry.pageWidth, viewport: entry.viewport }] : []), ...(entry.dialog && entry.dialog.scroll > entry.dialog.width + 1 ? [{ label: entry.label, dialog: entry.dialog }] : [])]);
    // Child-friendly target sizing is audited along with WCAG. Native checkbox
    // and radio hit areas are their enclosing labels, not the drawn 20px box.
    const smallTargets = report.flatMap(entry => entry.smallTargets.map(target => ({ label: entry.label, width: entry.width, theme: entry.theme, ...target })));
    const smallText = report.flatMap(entry => entry.smallText.map(text => ({ label: entry.label, width: entry.width, theme: entry.theme, ...text })));
    if (process.env.MYOWNDEX_ACCESSIBILITY_AUDIT !== '1') {
        assert.deepEqual(failures, [], 'WCAG AA and responsive accessibility regressions');
        assert.deepEqual(smallTargets, [], 'Interactive touch targets must be at least 44px');
        assert.deepEqual(smallText, [], 'Visible text must be at least 14px at the normal scale');
        assert.deepEqual(errors, [], 'No runtime errors');
    }
    console.log(`Accessibility audit: ${report.length} states, ${failures.length} WCAG/layout findings, ${smallTargets.length} small targets, ${smallText.length} small text findings, ${errors.length} page errors.`);
} finally {
    if (qaAccount) {
        // This test only creates accounts on the explicitly guarded QA server.
        await page.evaluate(async password => {
            const session = await fetch('/api/account/session', { credentials: 'same-origin' }).then(response => response.json());
            if (session.account?.id) await fetch('/api/account/delete', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-myowndex-account': session.account.id }, body: JSON.stringify({ password }) });
        }, qaPassword).catch(() => {});
    }
    if (qaRoom) {
        await context.request.delete(`${new URL(baseUrl).origin}/api/rooms/${qaRoom.code}`, { headers: { origin: new URL(baseUrl).origin, 'x-myowndex-room-protocol': '3', 'x-myowndex-room-key': qaRoom.key }, data: {} }).catch(() => {});
    }
    await writeReport();
    await browser.close();
}

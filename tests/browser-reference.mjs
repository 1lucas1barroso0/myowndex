// Browser regression for official game histories, bilingual references and touch layouts.
// Uses public catalogue data and isolated browser storage; never creates a remote room.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { cleanDescription } from '../src/core/descriptions.js';

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000';
const catalog = JSON.parse(await fs.readFile(new URL('../public/catalog/v1/species-0.json', import.meta.url), 'utf8'));
const canonical = [...catalog.entries['1']].filter(entry => !entry[3]).sort((a, b) => b[2] - a[2]);
const pair = entry => catalog.texts[entry[1]];
const text = () => page.locator('.species-description > p');
const normalize = value => value.replace(/\s+/g, ' ').trim();

async function layout(label) {
    const result = await page.locator('.record-shell').evaluate(shell => {
        const visible = element => element.getClientRects().length && !element.closest('[hidden],.sr-only') && getComputedStyle(element).visibility !== 'hidden';
        const outside = [...shell.querySelectorAll('button,label,summary,h2,h3,h4,select')].filter(visible).flatMap(element => {
            const box = element.getBoundingClientRect();
            return box.left < -1 || box.right > innerWidth + 1 ? [element.innerText || element.getAttribute('aria-label')] : [];
        });
        const small = [...shell.querySelectorAll('button')].filter(visible).filter(element => element.getBoundingClientRect().height < 43.5).map(element => element.innerText);
        const selectors = [...shell.querySelectorAll('.room-select')].map(element => {
            const label = element.querySelector('.room-select-value');
            const native = element.querySelector('select');
            return { selected: native.selectedOptions[0]?.textContent.trim(), label: label.textContent.trim(), clipped: label.scrollWidth > label.clientWidth + 1 };
        });
        return { pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, outside, small, selectors };
    });
    assert.ok(result.pageWidth <= result.viewport + 1, label);
    assert.deepEqual(result.outside, [], label);
    assert.deepEqual(result.small, [], label);
    for (const select of result.selectors) {
        assert.equal(select.label, select.selected, label);
        assert.equal(select.clipped, false, label);
    }
    checks.push({ label, ...result });
}

async function openRecord(name) {
    await page.getByRole('searchbox', { name: 'Nome ou número', exact: true }).fill(name);
    await page.getByRole('button', { name: `Consultar ${name} na Pokédex`, exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).waitFor({ timeout: 45000 });
}

async function setLanguage(language) {
    const button = page.locator('.record-language-toggle');
    if ((await button.innerText()).trim() !== language) await button.click();
}

try {
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor({ timeout: 60000 });
    await page.locator('.game-style-options [data-mode="game"]').click();
    await openRecord('Bulbasaur');
    await page.getByLabel('Registro de', { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByLabel('Registro de', { exact: true }).inputValue(), 'auto');
    assert.equal(normalize(await text().innerText()), normalize(cleanDescription(pair(canonical[0])[0])));
    await setLanguage('PT');
    assert.equal(normalize(await text().innerText()), normalize(cleanDescription(pair(canonical[0])[1])));
    checks.push({ label: 'latest paired record EN/PT', game: canonical[0][0] });
    const old = canonical.find(entry => entry[0] === 'red') || canonical.at(-1);
    await page.getByLabel('Registro de', { exact: true }).selectOption(old[0]);
    assert.equal(normalize(await text().innerText()), normalize(cleanDescription(pair(old)[1])));
    await setLanguage('EN');
    assert.equal(normalize(await text().innerText()), normalize(cleanDescription(pair(old)[0])));
    checks.push({ label: 'historical paired record EN/PT', game: old[0] });
    const ability = page.locator('.record-ability-card').first();
    await ability.locator('.reference-language-toggle').waitFor({ timeout: 30000 });
    assert.equal((await ability.locator('.reference-language-toggle').innerText()).trim(), 'PT');
    assert.ok((await ability.locator('.reference-text > p').innerText()).length > 20);
    assert.doesNotMatch(await ability.innerText(), /Conforme a descrição|deixa a decisão com o grupo|regra à vista|nenhuma exceção seja escondida/i);
    const translatedAbility = await ability.locator('.reference-text > p').innerText();
    await ability.locator('.reference-language-toggle').click();
    assert.equal(await ability.locator('.reference-text > p').getAttribute('lang'), 'en');
    assert.notEqual(await ability.locator('.reference-text > p').innerText(), translatedAbility);
    checks.push({ label: 'concrete ability reference EN/PT', name: await ability.locator('h4').innerText() });
    for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ['normal', 'night']) {
            await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
            await layout(`profile ${theme} ${width}`);
        }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('tab', { name: 'Movimentos', exact: true }).click();
    const games = page.getByLabel('Jogo', { exact: true });
    const values = await games.locator('option').evaluateAll(options => options.map(option => option.value));
    assert.ok(values.includes('red-blue') && values.includes('sword-shield'), 'available actual official games');
    assert.ok(values.length > 10, 'historical learnsets are available');
    assert.equal(await games.inputValue(), 'auto');
    await games.selectOption('red-blue');
    const tackle = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Tackle$/ }) });
    await tackle.locator('.record-move-toggle').click();
    await tackle.locator('.record-move-facts').waitFor({ timeout: 30000 });
    assert.equal(await tackle.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Poder$/ }) }).locator('dd').innerText(), '35');
    assert.equal(await tackle.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Precisão$/ }) }).locator('dd').innerText(), '95%');
    await tackle.locator('.reference-language-toggle').waitFor({ timeout: 30000 });
    await tackle.locator('.reference-language-toggle').click();
    assert.equal(await tackle.locator('.reference-text > p').getAttribute('lang'), 'en');
    checks.push({ label: 'Red/Blue Tackle actual historical values and EN/PT', power: 35, accuracy: 95 });
    const growl = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Growl$/ }) });
    await growl.locator('.record-move-toggle').click();
    await growl.locator('.record-move-facts').waitFor({ timeout: 30000 });
    await growl.getByText('Na batalha', { exact: true }).click();
    assert.match(await growl.locator('.move-human-facts').innerText(), /escolher um Pokémon/);
    assert.doesNotMatch(await growl.locator('.move-human-facts').innerText(), /todos os oponentes|contato/);
    assert.match(await growl.locator('.reference-text > p').innerText(), /1 estágio/);
    checks.push({ label: 'Red/Blue Growl keeps its single-battle target and correct stage' });
    for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await layout(`moves ${width}`);
    }
    await games.selectOption('sword-shield');
    await page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Tackle$/ }) }).locator('.record-move-toggle').click();
    const latestTackle = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Tackle$/ }) });
    await latestTackle.locator('.record-move-facts').waitFor({ timeout: 30000 });
    assert.equal(await latestTackle.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Poder$/ }) }).locator('dd').innerText(), '40');
    const modernGrowl = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Growl$/ }) });
    await modernGrowl.locator('.record-move-toggle').click();
    await modernGrowl.locator('.record-move-facts').waitFor({ timeout: 30000 });
    await modernGrowl.getByText('Na batalha', { exact: true }).click();
    assert.match(await modernGrowl.locator('.move-human-facts').innerText(), /todos os oponentes/);
    checks.push({ label: 'Sword/Shield Growl uses its current spread target' });
    await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
    await openRecord('Gimmighoul');
    await page.getByLabel('Registro de', { exact: true }).waitFor({ timeout: 30000 });
    assert.match(await text().innerText(), /treasure chest/i);
    await page.getByRole('button', { name: 'Roaming', exact: true }).click();
    await page.locator('.record-form-label').filter({ hasText: 'Roaming' }).waitFor();
    await page.getByLabel('Registro de', { exact: true }).selectOption('pokemon-go:gimmighoul-roaming');
    assert.doesNotMatch(await text().innerText(), /born inside a treasure chest/i);
    await setLanguage('PT');
    assert.equal(await text().getAttribute('lang'), 'pt-BR');
    checks.push({ label: 'Gimmighoul Chest/Roaming official paired entries stay separate' });
    await layout('Roaming form');
    await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
    await page.locator('.game-style-options [data-mode="rpg"]').click();
    await openRecord('Bulbasaur');
    await page.getByRole('tab', { name: 'Movimentos', exact: true }).click();
    await page.getByLabel('Jogo', { exact: true }).selectOption('red-blue');
    const rpgTackle = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Tackle$/ }) });
    await rpgTackle.locator('.record-move-toggle').click();
    await rpgTackle.locator('.record-move-facts').waitFor({ timeout: 30000 });
    assert.equal(await rpgTackle.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Poder$/ }) }).locator('dd').innerText(), '4');
    assert.equal(await rpgTackle.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Precisão$/ }) }).locator('dd').innerText(), '100%');
    const rpgGrowl = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Growl$/ }) });
    await rpgGrowl.locator('.record-move-toggle').click();
    await rpgGrowl.locator('.record-move-facts').waitFor({ timeout: 30000 });
    await rpgGrowl.getByText('Na batalha', { exact: true }).click();
    assert.match(await rpgGrowl.locator('.move-human-facts').innerText(), /todos os oponentes/);
    checks.push({ label: 'PR23 RPG old-game repertoire keeps current power/accuracy/spread target and division by10' });
    await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
    await openRecord('Audino');
    const healer = page.locator('.record-ability-card').filter({ has: page.getByRole('heading', { name: 'Healer', exact: true }) });
    await healer.locator('.reference-language-toggle').waitFor({ timeout: 30000 });
    assert.match(await healer.locator('.reference-text > p').innerText(), /50%/);
    assert.doesNotMatch(await healer.locator('.reference-text > p').innerText(), /30%/);
    await healer.locator('.reference-language-toggle').click();
    assert.equal(await healer.locator('.reference-text > p').getAttribute('lang'), 'en');
    assert.match(await healer.locator('.reference-text > p').innerText(), /50%/);
    checks.push({ label: 'PR23 Healer displays current Champions 50% in both languages' });
    await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
    await openRecord('Bulbasaur');
    await page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).click();
    await page.getByLabel('Jogo de referência', { exact: true }).selectOption('red-blue');
    await page.locator('.pc-partner-card').first().click();
    const editor = page.locator('.pokemon-editor');
    await editor.getByLabel('Movimento 1', { exact: true }).fill('tackle');
    const moveField = editor.locator('.editor-move-field').first();
    await moveField.locator('summary').waitFor({ timeout: 30000 });
    await moveField.locator('summary').click();
    const fact = (field, label) => field.locator('.editor-move-facts > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
    assert.equal(await fact(moveField, 'Poder').innerText(), '4');
    assert.equal(await fact(moveField, 'Precisão').innerText(), '100%');
    await editor.getByLabel('Movimento 2', { exact: true }).fill('protect');
    const protect = editor.locator('.editor-move-field').nth(1);
    await protect.locator('summary').waitFor({ timeout: 30000 });
    await protect.locator('summary').click();
    assert.equal(await fact(protect, 'PP máximo').innerText(), '5');
    assert.equal(await protect.getByLabel('PP atual', { exact: true }).inputValue(), '5');
    checks.push({ label: 'PC old-game repertoire keeps current RPG power/accuracy and Champions Protect PP' });
    await page.locator('.game-style-options [data-mode="game"]').click();
    await page.waitForFunction(() => document.querySelector('.editor-move-field .editor-move-facts dd')?.textContent === '35');
    assert.equal(await fact(moveField, 'Poder').innerText(), '35');
    assert.equal(await fact(moveField, 'Precisão').innerText(), '95%');
    checks.push({ label: 'PC Jogos displays actual Red/Blue Tackle power/accuracy without overwriting the partner' });
    // An intentionally empty upstream description must finish loading. This
    // isolated fixture verifies a real source gap without inventing its rule.
    const emptyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    try {
        const abilities = JSON.parse(await fs.readFile(new URL('../public/catalog/v1/ability.json', import.meta.url), 'utf8'));
        abilities.entries.overgrow = { id: 65, flavors: [] };
        await emptyContext.route('**/catalog/v1/ability.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(abilities) }));
        await emptyContext.route('**/api/v2/ability/65/', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 65, name: 'overgrow', effect_entries: [], flavor_text_entries: [] }) }));
        const emptyPage = await emptyContext.newPage();
        emptyPage.on('pageerror', error => errors.push(error.message));
        await emptyPage.goto(baseUrl);
        await emptyPage.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).click({ timeout: 60000 });
        const emptyAbility = emptyPage.locator('.record-ability-card').filter({ has: emptyPage.getByRole('heading', { name: 'Overgrow', exact: true }) });
        await emptyAbility.getByText('A fonte deste registro ainda não fornece uma descrição.', { exact: true }).waitFor({ timeout: 30000 });
        assert.doesNotMatch(await emptyAbility.innerText(), /Consultando|Conforme a descrição|regra à vista/);
        checks.push({ label: 'empty ability source settles and never displays an invented rule' });
    } finally {
        await emptyContext.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ checks: checks.length, results: checks, pageErrors: errors }, null, 2));
} finally {
    await context.close();
    await browser.close();
}

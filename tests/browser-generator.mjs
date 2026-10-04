// Optional real-catalog browser verification; this uses only an isolated PC.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { decodeShare } from '../src/core/teamShare.js';
import { normalizeAccountDocument } from '../src/core/accountDocument.js';

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const report = [];
page.on('pageerror', error => errors.push(error.message));
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000';
const dialog = page.locator('.generator-dialog');
const open = async () => { await page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click(); await dialog.waitFor(); await dialog.locator('.generator-content').waitFor(); };
const close = async () => { await dialog.getByRole('button', { name: 'Fechar gerador' }).click(); await dialog.waitFor({ state: 'detached' }); };

async function verify(label) {
    const result = await dialog.evaluate(element => {
        const visible = node => node.getClientRects().length && (!node.closest('details:not([open])') || node.closest('details:not([open])').querySelector(':scope > summary')?.contains(node));
        const controls = [...element.querySelectorAll('button,input,.room-select,summary,h2,h3,dd')].filter(visible);
        const escaped = controls.filter(node => { const rect = node.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; }).map(node => node.innerText || node.getAttribute('aria-label'));
        const undersized = controls.filter(node => ['BUTTON', 'SUMMARY'].includes(node.tagName) && node.getBoundingClientRect().height < 43.5).map(node => node.innerText);
        const truncated = controls.filter(node => !['INPUT', 'SELECT'].includes(node.tagName) && node.scrollWidth > node.clientWidth + 2 && ['hidden', 'clip'].includes(getComputedStyle(node).overflowX)).map(node => node.innerText);
        const brokenWords = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let textNode;
        while ((textNode = walker.nextNode())) {
            const parent = textNode.parentElement;
            if (!parent || !visible(parent) || !parent.closest('.generator-partner-choice,.generator-moves,.generator-partner-facts,.generator-result-heading')) continue;
            for (const match of textNode.textContent.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(textNode, match.index);
                range.setEnd(textNode, match.index + match[0].length);
                const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => Math.round(rect.top)));
                if (lines.size > 1) brokenWords.push({ word: match[0], container: parent.className });
            }
        }
        const selects = [...element.querySelectorAll('.room-select')].filter(visible).map(field => {
            const select = field.querySelector('select');
            const full = select.selectedOptions[0]?.textContent.replace(/\s+/g, ' ').trim();
            const displayed = field.querySelector('.room-select-value').textContent.replace(/\s+/g, ' ').trim();
            return { full, displayed };
        });
        return { escaped, undersized, truncated, brokenWords, selects, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    assert.deepEqual(result.escaped, [], `${label}: elements escaped`);
    assert.deepEqual(result.undersized, [], `${label}: small targets`);
    assert.deepEqual(result.truncated, [], `${label}: clipped labels`);
    assert.deepEqual(result.brokenWords, [], `${label}: words split across lines`);
    assert.ok(result.pageWidth <= result.viewport + 1, `${label}: horizontal overflow`);
    assert.ok(result.selects.every(select => select.full === select.displayed), `${label}: selected values cut`);
    report.push(label);
}

try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).waitFor({ timeout: 60000 });
    await open();
    await dialog.getByText('Personalizar o encontro', { exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Espécie a gerar' }).selectOption('1');
    await dialog.getByRole('combobox', { name: 'Quantidade de Pokémon' }).selectOption('2');
    await dialog.getByRole('combobox', { name: 'Jogo dos Pokémon gerados' }).selectOption('scarlet-violet');
    await dialog.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.generator-partner').length === 2, { timeout: 60000 });
    assert.equal(await dialog.locator('.generator-moves').first().innerText(), 'Vine Whip\nGrowl\nTackle');
    report.push('real latest learnset and two partners');
    await dialog.locator('.generator-partner-details summary').first().click();
    await dialog.getByLabel('Apelido', { exact: true }).first().fill('Um parceiro com um apelido bem comprido para testar a ficha');
    const singleDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Exportar Bulbasaur', exact: true }).first().click();
    const downloaded = await singleDownload;
    const file = await downloaded.path();
    const decoded = await decodeShare(await fs.readFile(file, 'utf8'));
    assert.equal(decoded.kind, 'pokemon');
    assert.equal(decoded.pokemon[0].speciesName, 'bulbasaur');
    assert.ok(decoded.pokemon[0].nickname.startsWith('Um parceiro'));
    report.push('individual export imports correctly');
    await dialog.getByLabel('Nome da Box', { exact: true }).fill('Equipe do gerador');
    await dialog.getByRole('button', { name: 'Guardar 2 no PC' }).click();
    await dialog.locator('.generator-partner.is-saved').last().waitFor({ timeout: 30000 });
    assert.equal(await dialog.locator('.generator-partner.is-saved').count(), 2);
    report.push('new Box saved all generated partners');
    const boxDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Exportar Box', exact: true }).click();
    const decodedBox = await decodeShare(await fs.readFile(await (await boxDownload).path(), 'utf8'));
    assert.equal(decodedBox.kind, 'team');
    assert.equal(decodedBox.team.pokemon.length, 2);
    report.push('Box export imports correctly after saving');
    await close();
    await page.getByRole('button', { name: 'Abrir o PC do Bill' }).click();
    await page.getByRole('button', { name: 'Equipe do gerador, 2 de 6 Pokémon', exact: true }).waitFor();
    await open();
    assert.equal(await dialog.locator('.generator-partner.is-saved').count(), 2);
    report.push('closed/reopened preview and PC both preserve partners');
    await dialog.getByRole('combobox', { name: 'Quantidade de Pokémon' }).selectOption('1');
    await dialog.getByText('Personalizar o encontro', { exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Espécie a gerar' }).selectOption('1');
    await dialog.getByRole('button', { name: 'Gerar outros Pokémon' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.generator-partner').length === 1 && !document.querySelector('.generator-partner.is-saved'), { timeout: 60000 });
    const existingTarget = await dialog.getByRole('combobox', { name: 'Box de destino dos Pokémon gerados' }).locator('option').allTextContents();
    assert.ok(existingTarget.some(text => text.includes('Equipe do gerador · 4 vagas')));
    const boxId = await dialog.getByRole('combobox', { name: 'Box de destino dos Pokémon gerados' }).locator('option').evaluateAll(options => options.find(option => option.textContent.includes('Equipe do gerador')).value);
    await dialog.getByRole('combobox', { name: 'Box de destino dos Pokémon gerados' }).selectOption(boxId);
    await dialog.getByRole('button', { name: 'Guardar 1 no PC' }).click();
    await dialog.locator('.generator-partner.is-saved').waitFor({ timeout: 30000 });
    report.push('individual generated partner appended to existing Box');
    for (const theme of ['Claro', 'Escuro']) {
        await close();
        await page.getByRole('radio', { name: theme, exact: true }).click();
        await open();
        await dialog.getByText('Personalizar o encontro', { exact: true }).click();
        for (const width of [320, 390, 768, 1280, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await verify(`generated preview ${theme} ${width}`);
        }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: '/tmp/myowndex-generator-dark-390.png', fullPage: true });
    await close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await open();
    assert.equal(await dialog.locator('.generator-partner.is-saved').count(), 1);
    report.push('scoped durable draft survives page reload');
    await dialog.getByText('Personalizar o encontro', { exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Espécie a gerar' }).selectOption('1');
    await dialog.getByRole('button', { name: 'Gerar outros Pokémon' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.generator-partner').length === 1 && !document.querySelector('.generator-partner.is-saved'));
    await dialog.getByRole('button', { name: 'Gerar outros Pokémon' }).click();
    await page.getByRole('alertdialog', { name: 'Gerar outros Pokémon?' }).waitFor();
    assert.ok(await page.locator('.confirm-dialog-overlay').evaluate(element => Number(getComputedStyle(element).zIndex) > Number(getComputedStyle(document.querySelector('.generator-overlay')).zIndex)));
    assert.equal(await dialog.getAttribute('inert'), '');
    await page.getByRole('button', { name: 'Voltar à prévia' }).click();
    assert.equal(await dialog.locator('.generator-partner').count(), 1);
    report.push('unsaved replacement confirmation stays visible above generator and preserves draft');
    await close();
    await open();
    assert.equal(await dialog.locator('.generator-partner:not(.is-saved)').count(), 1);
    report.push('unsaved results survive closing without forcing a Box');
    const incoming = await page.evaluate(() => {
        const value = JSON.parse(localStorage.getItem('myowndex_generator_v1'));
        value.results[0].pokemon.id += '_synced';
        value.results[0].pokemon.nickname = 'Encontro em outro dispositivo';
        return value;
    });
    const originalNickname = await dialog.getByLabel('Apelido', { exact: true }).first().inputValue();
    const incomingDocument = normalizeAccountDocument({ localTools: { generatorDraft: incoming }, preferences: { appearance: 'night' } });
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('myowndex:account-document', { detail: { scope: 'other_account', document: value } })), incomingDocument);
    assert.equal(await dialog.getByLabel('Apelido', { exact: true }).first().inputValue(), originalNickname);
    assert.equal(await dialog.locator('.generator-sync-choice').count(), 0);
    report.push('generator ignores another account document while open');
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('myowndex:account-document', { detail: { scope: null, document: value } })), incomingDocument);
    await dialog.locator('.generator-partner-details summary').first().click();
    const nickname = dialog.getByLabel('Apelido', { exact: true }).first();
    await page.waitForFunction(() => document.querySelector('.generator-partner-details input')?.value === 'Encontro em outro dispositivo');
    report.push('idle generator refreshes the scoped final account draft without closing');
    const newer = structuredClone(incoming);
    newer.results[0].pokemon.id += '_next';
    newer.results[0].pokemon.nickname = 'Recebido durante a edição';
    await nickname.fill('Meu apelido em edição');
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('myowndex:account-document', { detail: { scope: null, document: value } })), normalizeAccountDocument({ localTools: { generatorDraft: newer }, preferences: { appearance: 'night' } }));
    await dialog.getByRole('button', { name: 'Exportar atual e ver prévia', exact: true }).waitFor();
    assert.equal(await nickname.inputValue(), 'Meu apelido em edição');
    assert.equal(await nickname.evaluate(element => element === document.activeElement), true);
    report.push('incoming account draft never replaces unfinished typing or steals focus');
    await page.setViewportSize({ width: 320, height: 900 });
    await verify('remote draft choice 320');
    const preservedDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Exportar atual e ver prévia', exact: true }).click();
    const preserved = await decodeShare(await fs.readFile(await (await preservedDownload).path(), 'utf8'));
    assert.equal(preserved.pokemon[0].nickname, 'Meu apelido em edição');
    await page.waitForFunction(() => document.querySelector('.generator-partner-details input')?.value === 'Recebido durante a edição');
    assert.equal(await dialog.locator('.generator-sync-choice').count(), 0);
    report.push('explicit remote draft choice exports the current partners before switching');
    await close();
    // Keep a genuine browser IndexedDB snapshot while removing its local
    // mirror. Quota failure must not hide or overwrite the durable draft.
    await page.evaluate(async () => {
        const key = 'myowndex_generator_v1';
        const value = JSON.parse(localStorage.getItem(key));
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('myowndex-player-data-v1', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction('snapshots', 'readwrite');
                transaction.objectStore('snapshots').put({ key, value, writtenAt: Date.now() + 1000, localFingerprint: null });
                transaction.oncomplete = () => { db.close(); resolve(); };
                transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
            };
        });
        localStorage.removeItem(key);
        localStorage.removeItem(`myowndex_snapshot_meta:${key}`);
    });
    await context.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'myowndex_generator_v1' || key === 'myowndex_snapshot_meta:myowndex_generator_v1') throw new DOMException('Test quota', 'QuotaExceededError');
            return original.call(this, key, value);
        };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await open();
    await dialog.locator('.generator-partner:not(.is-saved)').waitFor({ timeout: 30000 });
    assert.equal(await dialog.locator('.generator-partner:not(.is-saved)').count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('myowndex_generator_v1')), null);
    report.push('IndexedDB-only draft survives local mirror quota and guest bootstrap');
    await close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await open();
    await dialog.locator('.generator-partner:not(.is-saved)').waitFor({ timeout: 30000 });
    assert.equal(await dialog.locator('.generator-partner:not(.is-saved)').count(), 1);
    report.push('closing and autosaving an IndexedDB-only draft never replace it with an empty mirror');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: report.length, checks: report, pageErrors: errors }, null, 2));
} catch (error) {
    await page.screenshot({ path: '/tmp/myowndex-generator-failure.png', fullPage: true });
    await fs.writeFile('/tmp/myowndex-generator-failure.txt', await page.locator('body').innerText());
    throw error;
} finally { await context.close(); await browser.close(); }

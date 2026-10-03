// Optional browser regression. Run with the Playwright setup in VALIDACAO.md.
// Uses an isolated browser and real catalog records; never changes a remote room.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const proxyServer = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ['--no-sandbox'],
    ...(proxyServer ? { proxy: { server: proxyServer, bypass: 'localhost,127.0.0.1,::1' } } : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
const report = [];
const widths = [320, 390, 768, 1280, 1440];
const themes = ['Claro', 'Escuro'];
const navLabels = ['Abrir a Pokédex', 'Abrir o PC do Bill', 'Abrir o Guia do Treinador', 'Abrir a Central da Aventura'];
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3001';
const normalize = text => text.replace(/\s+/g, ' ').trim();
page.on('pageerror', error => errors.push(error.message));

async function check(label, selector = '.app-root') {
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(selector => {
        const scope = document.querySelector(selector);
        if (!scope) return { missing: selector };
        const normalize = text => text.replace(/\s+/g, ' ').trim();
        const visible = element => element instanceof HTMLElement && element.getClientRects().length
            && !element.closest('[inert],.sr-only') && getComputedStyle(element).visibility !== 'hidden'
            && getComputedStyle(element).clipPath === 'none'
            && (!element.closest('details:not([open])')
                || element.closest('details:not([open])').querySelector(':scope > summary')?.contains(element));
        const controls = [...scope.querySelectorAll('button,input,select,textarea,summary,h1,h2,h3,h4,label,dt,dd')].filter(visible);
        const outside = controls.flatMap(element => {
            const rect = element.getBoundingClientRect();
            return rect.width && (rect.left < -1 || rect.right > innerWidth + 1)
                ? [{ tag: element.tagName, text: normalize(element.innerText || element.getAttribute('aria-label') || '').slice(0, 100), left: rect.left, right: rect.right }]
                : [];
        });
        const clipped = controls.filter(element => !['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)).flatMap(element => {
            const style = getComputedStyle(element);
            return ((element.scrollWidth > element.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX))
                || (element.scrollHeight > element.clientHeight + 2 && ['hidden', 'clip'].includes(style.overflowY)))
                ? [{ tag: element.tagName, text: normalize(element.innerText).slice(0, 100), width: element.clientWidth, scroll: element.scrollWidth }]
                : [];
        });
        // The native picker can look correctly sized while truncating its actual value.
        // Compare the real selected option and every visible text rectangle to its field.
        const selects = [...scope.querySelectorAll('.room-select')].filter(visible).map(field => {
            const value = field.querySelector('.room-select-value');
            const select = field.querySelector('select');
            const arrow = field.querySelector('.room-select-chevron');
            const rect = field.getBoundingClientRect();
            const valueRect = value.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(value);
            const glyphs = [...range.getClientRects()].filter(rect => rect.width && rect.height);
            const arrowRect = arrow?.getBoundingClientRect();
            return {
                selected: normalize(select.selectedOptions[0]?.textContent || ''),
                visible: normalize(value.innerText),
                fieldWidth: rect.width,
                lines: [...new Set(glyphs.map(rect => Math.round(rect.top)))].length,
                glyphsOutside: glyphs.filter(glyph => glyph.left < valueRect.left - 1 || glyph.right > valueRect.right + 1
                    || glyph.top < rect.top - 1 || glyph.bottom > rect.bottom + 1).map(glyph => ({ left: glyph.left, right: glyph.right, top: glyph.top, bottom: glyph.bottom })),
                arrowOverlap: Boolean(arrowRect && glyphs.some(glyph => glyph.right > arrowRect.left + 1
                    && glyph.bottom > arrowRect.top + 1 && glyph.top < arrowRect.bottom - 1)),
                height: rect.height,
            };
        });
        const staticSelector = 'button,label,summary,h1,h2,h3,h4,dt,.record-species-facts dd,.record-measurements dd';
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const brokenWords = [];
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || !visible(parent) || !parent.closest(staticSelector)
                || parent.closest('option,script,style,.room-select-value,.room-token,.initiative-list,.pc-partner-card,.pc-box-list')) continue;
            for (const match of node.textContent.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)) {
                if (match[0].length < 2) continue;
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const rects = [...range.getClientRects()].filter(rect => rect.width && rect.height);
                if (new Set(rects.map(rect => Math.round(rect.top))).size > 1)
                    brokenWords.push({ word: match[0], parent: parent.className });
            }
        }
        const initiativeContrast = [...scope.querySelectorAll('.room-section:has(.initiative-list) button:disabled')].filter(visible).map(button => {
            const rgb = color => color.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
            let parent = button;
            let background = [255, 255, 255];
            while (parent) {
                const candidate = rgb(getComputedStyle(parent).backgroundColor);
                if ((candidate[3] ?? 1) >= 0.95) { background = candidate.slice(0, 3); break; }
                parent = parent.parentElement;
            }
            const style = getComputedStyle(button);
            const raw = rgb(style.color);
            const alpha = Number(style.opacity) * (raw[3] ?? 1);
            const foreground = raw.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha));
            const luminance = color => color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
                .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
            const luminances = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
            return { text: button.textContent.trim(), opacity: Number(style.opacity), ratio: (luminances[0] + 0.05) / (luminances[1] + 0.05) };
        });
        const emptyInitiativeVisible = [...scope.querySelectorAll('.initiative-list li.is-empty')].some(visible);
        return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, outside, clipped, selects, brokenWords, initiativeContrast, emptyInitiativeVisible };
    }, selector);
    report.push({ label, ...result });
    assert.ok(!result.missing, `${label}: missing ${selector}`);
    assert.ok(result.pageWidth <= result.viewport + 1, `${label}: horizontal page overflow`);
    assert.deepEqual(result.outside, [], `${label}: a control or heading leaves the screen`);
    assert.deepEqual(result.clipped, [], `${label}: a label is clipped`);
    assert.deepEqual(result.brokenWords, [], `${label}: a static word splits across lines`);
    for (const select of result.selects) {
        assert.equal(select.visible, select.selected, `${label}: the complete selected option is not visible`);
        assert.deepEqual(select.glyphsOutside, [], `${label}: selected option leaves its field (${select.visible})`);
        assert.equal(select.arrowOverlap, false, `${label}: selected option overlaps its arrow (${select.visible})`);
        assert.ok(select.height >= 43.5, `${label}: a selector lacks its touch target`);
    }
    for (const button of result.initiativeContrast) assert.ok(button.ratio >= 3,
        `${label}: disabled initiative text remains too faint (${button.text}: ${button.ratio.toFixed(2)})`);
    if (result.emptyInitiativeVisible) assert.equal(result.initiativeContrast.length, 2, `${label}: empty initiative must verify both disabled actions`);
    console.log(JSON.stringify(report.at(-1)));
}

async function nav(name) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(80);
}

async function appearance(theme) {
    await page.getByRole('radio', { name: theme, exact: true }).click();
    await page.waitForFunction(id => document.documentElement.dataset.theme === id, theme === 'Claro' ? 'normal' : 'night');
}

async function viewport(width) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
}

async function openDetails(locator) {
    if (!await locator.evaluate(element => element.open)) await locator.locator(':scope > summary').click();
}

async function screenshot(path, locator) {
    if (locator) await locator.scrollIntoViewIfNeeded();
    await page.screenshot({ path });
}

async function header() {
    const metrics = await page.locator('.app-header').evaluate(element => {
        const appearance = element.querySelector('.appearance-control').getBoundingClientRect();
        const choices = [...element.querySelectorAll('.appearance-options [role="radio"]')].map(button => ({ text: button.textContent.trim(), ...button.getBoundingClientRect().toJSON() }));
        const modes = [...element.querySelectorAll('.game-style-options [role="radio"]')].map(button => ({ text: button.textContent.trim(), ...button.getBoundingClientRect().toJSON() }));
        const mode = element.querySelector('.game-style-control').getBoundingClientRect();
        return { width: appearance.width, choices, modes, overlap: appearance.left < mode.right - 1 && appearance.right > mode.left + 1 && appearance.top < mode.bottom - 1 && appearance.bottom > mode.top + 1 };
    });
    // CSS pixels: an enlarged zoomed target must remain enlarged.
    const zoom = await page.evaluate(() => Number(getComputedStyle(document.documentElement).zoom) || 1);
    assert.ok(metrics.width / zoom <= 250, 'appearance must remain compact');
    assert.deepEqual(metrics.choices.map(choice => choice.text), ['Claro', 'Escuro']);
    assert.deepEqual(metrics.modes.map(mode => mode.text), ['RPG', 'Jogos', 'Livre']);
    assert.equal(metrics.overlap, false, 'appearance and modes overlap');
    for (const button of [...metrics.choices, ...metrics.modes]) assert.ok(button.width / zoom >= 43.5 && button.height / zoom >= 43.5, 'header must retain touch targets');
}

async function openRecord(name) {
    await nav('Abrir a Pokédex');
    await page.getByRole('searchbox', { name: 'Nome ou número', exact: true }).fill(name);
    await page.getByRole('button', { name: `Consultar ${name} na Pokédex`, exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).waitFor({ timeout: 30000 });
    await page.locator('.record-evolution-node').first().waitFor({ timeout: 30000 });
}

async function closeRecord() {
    await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
}

async function pane(name) {
    const button = page.locator('.room-mobile-nav button').filter({ hasText: name });
    if (await button.isVisible()) await button.click();
}

const combat = page.locator('.room-tools > .room-tool').filter({ has: page.locator(':scope > summary strong', { hasText: /^Resolver um movimento$/ }) });
const capture = page.locator('.room-tools > .room-tool').filter({ has: page.locator(':scope > summary strong', { hasText: /^Captura$/ }) });

async function roomWidths(prefix) {
    for (const theme of themes) {
        await appearance(theme);
        for (const width of widths) {
            await viewport(width);
            for (const name of ['Equipe', 'Campo', 'Dados e ações']) {
                await pane(name);
                await check(`${prefix}-${theme}-${width}-${name}`, '.room-app');
                if (name === 'Equipe') {
                    const buttons = await page.locator('.room-initiative button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
                    if (await page.locator('.room-roster').isVisible()) for (const height of buttons) assert.ok(height >= 43.5, 'initiative buttons need readable touch targets');
                }
                if (theme === 'Claro' && width === 1280 && name === 'Dados e ações') await screenshot(`/tmp/myowndex-space-${prefix}-light-1280.png`, combat);
                if (theme === 'Escuro' && width === 390 && name === 'Dados e ações') await screenshot(`/tmp/myowndex-space-${prefix}-dark-390.png`, capture);
            }
        }
    }
}

try {
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor();
    for (const theme of themes) {
        await appearance(theme);
        for (const width of widths) {
            await viewport(width);
            for (const name of navLabels) {
                await nav(name);
                await header();
                await check(`header-${theme}-${width}-${name}`);
            }
        }
    }

    for (const theme of themes) {
        await appearance(theme);
        await openRecord('Bulbasaur');
        const description = page.locator('.species-description');
        const original = normalize(await description.locator('p').first().innerText());
        assert.match(original, /seed|plant|back/i, 'the original English catalog record must be visible');
        assert.match(await page.locator('.record-measurements').innerText(), /0,7 m/);
        assert.match(await page.locator('.record-measurements').innerText(), /6,9 kg/);
        for (const width of widths) {
            await viewport(width);
            await page.getByRole('button', { name: 'Traduzir registro para português', exact: true }).click();
            const translated = normalize(await description.locator('p').first().innerText());
            assert.notEqual(translated, original, 'translation must change the descriptive prose');
            assert.match(translated, /semente|planta|costas/i);
            assert.equal(await description.locator('p').first().getAttribute('lang'), 'pt-BR');
            await check(`record-${theme}-${width}-Português`, '.record-shell');
            if (theme === 'Escuro' && width === 390) await screenshot('/tmp/myowndex-space-record-dark-390.png', description);
            await page.getByRole('button', { name: 'Ver registro original em inglês', exact: true }).click();
            assert.equal(normalize(await description.locator('p').first().innerText()), original);
            await check(`record-${theme}-${width}-English`, '.record-shell');
            if (theme === 'Claro' && width === 1280) await screenshot('/tmp/myowndex-space-record-light-1280.png', description);
        }
        const requests = [];
        const listener = request => requests.push(request.url());
        page.on('request', listener);
        await context.setOffline(true);
        await page.getByRole('button', { name: 'Traduzir registro para português', exact: true }).click();
        await page.getByRole('button', { name: 'Ver registro original em inglês', exact: true }).click();
        assert.equal(normalize(await description.locator('p').first().innerText()), original);
        assert.deepEqual(requests, [], 'switching description languages must work locally without an API or AI');
        await check(`record-${theme}-offline-language-toggle`, '.record-shell');
        page.off('request', listener);
        await context.setOffline(false);
        await closeRecord();
    }

    await viewport(1280);
    for (const name of ['Bulbasaur', 'Venusaur']) {
        await openRecord(name);
        await page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).click();
    }
    await page.locator('.pc-partner-card').first().click();
    const training = page.locator('.pokemon-training-panel');
    await openDetails(training);
    const stats = await page.locator('.pokemon-stat-row h4').allTextContents();
    assert.equal(stats.length, 6);
    const ivs = [12, 13, 14, 15, 16, 17];
    const evs = [84, 72, 60, 48, 36, 24];
    for (let index = 0; index < stats.length; index++) {
        await page.getByRole('spinbutton', { name: `IVs de ${stats[index]}`, exact: true }).fill(String(ivs[index]));
        await page.getByRole('spinbutton', { name: `EVs de ${stats[index]}`, exact: true }).fill(String(evs[index]));
    }
    const nicknames = ['Bulbasaur parceiro da floresta com um nome comprido', 'Venusaur guardião do jardim com um nome comprido'];
    const moves = [
        ['swords-dance', 'poison-powder', 'solar-beam', 'leech-seed'],
        ['10-000-000-volt-thunderbolt', 'never-ending-nightmare', 'continental-crush', 'light-that-burns-the-sky'],
    ];
    for (let index = 0; index < 2; index++) {
        await page.locator('.pc-partner-card').nth(index).click();
        await page.getByLabel('Apelido', { exact: true }).fill(nicknames[index]);
        for (let move = 0; move < 4; move++) await page.getByLabel(`Movimento ${move + 1}`, { exact: true }).fill(moves[index][move]);
    }
    await page.getByLabel('Nome da Box', { exact: true }).fill('Equipe da floresta e do jardim com uma identificação bastante comprida');
    await page.locator('.pc-partner-card').first().click();
    await page.getByLabel('Natureza', { exact: true }).selectOption('sassy');
    for (const name of ['Progresso da jornada', 'Características e transformações', 'Treinamento'])
        await openDetails(page.locator('.pokemon-editor details').filter({ has: page.locator(':scope > summary', { hasText: name }) }).first());
    await page.getByLabel('Condição', { exact: true }).selectOption('bad-poison');
    await page.getByLabel('Tipo Tera', { exact: true }).selectOption('electric');
    await page.waitForFunction(() => {
        const pokemon = JSON.parse(localStorage.getItem('myowndex_rotom_v4'))?.teams?.[0]?.pokemon?.[0];
        return pokemon?.ivs?.hp === 12 && pokemon?.evs?.hp === 84 && pokemon?.ivs?.speed === 17 && pokemon?.evs?.speed === 24 && pokemon?.nature === 'sassy';
    });
    await page.reload();
    await page.locator('.pc-partner-card').first().click();
    for (const name of ['Progresso da jornada', 'Características e transformações', 'Treinamento'])
        await openDetails(page.locator('.pokemon-editor details').filter({ has: page.locator(':scope > summary', { hasText: name }) }).first());
    for (let index = 0; index < stats.length; index++) {
        assert.equal(await page.getByRole('spinbutton', { name: `IVs de ${stats[index]}`, exact: true }).inputValue(), String(ivs[index]));
        assert.equal(await page.getByRole('spinbutton', { name: `EVs de ${stats[index]}`, exact: true }).inputValue(), String(evs[index]));
    }
    for (const theme of themes) {
        await appearance(theme);
        for (const width of widths) {
            await viewport(width);
            await header();
            await check(`editor-${theme}-${width}-optional-panels-and-persisted-training`);
            if (theme === 'Claro' && width === 320) await screenshot('/tmp/myowndex-space-editor-light-320.png', training);
        }
    }
    await viewport(1280);
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    assert.equal(await page.locator('.pc-box-count').innerText(), '2');
    await nav('Abrir a Central da Aventura');
    await page.getByRole('button', { name: 'Começar uma aventura local', exact: false }).click();
    await page.locator('.room-app').waitFor();
    await pane('Dados e ações');
    await openDetails(combat);
    await openDetails(capture);
    assert.equal(await combat.getByRole('combobox', { name: 'Usuário', exact: true }).isDisabled(), true);
    assert.equal(await combat.getByRole('combobox', { name: 'Movimento', exact: true }).isDisabled(), true);
    assert.match(await combat.innerText(), /Sem Pokémon em campo/);
    assert.match(await combat.innerText(), /Sem movimentos na ficha|Nenhum movimento/);
    await roomWidths('room-empty');

    await viewport(1280);
    const boxes = await page.getByRole('combobox', { name: 'Box', exact: true }).locator('option').evaluateAll(options => options.map(option => option.value));
    assert.equal(boxes.length, 2);
    await page.getByRole('combobox', { name: 'Box', exact: true }).selectOption(boxes[0]);
    await page.getByRole('combobox', { name: 'Quem entra em campo', exact: true }).selectOption({ label: nicknames[0] });
    await page.getByRole('button', { name: 'Entrar como aliado', exact: true }).click();
    await page.getByRole('combobox', { name: 'Box', exact: true }).selectOption(boxes[1]);
    await page.getByRole('combobox', { name: 'Quem entra em campo', exact: true }).selectOption({ label: nicknames[1] });
    await page.getByRole('button', { name: 'Entrar como oponente', exact: true }).click();
    assert.equal(await page.locator('.room-token').count(), 2);
    await page.locator('.room-token').first().click();
    await page.locator('.token-inspector').waitFor();
    await page.getByRole('button', { name: 'Rolar iniciativa', exact: true }).click();
    assert.equal(await page.locator('.initiative-list > li:not(.is-empty)').count(), 2);
    const attackers = await combat.getByRole('combobox', { name: 'Usuário', exact: true }).locator('option').evaluateAll(options => options.filter(option => option.value).map(option => ({ value: option.value, text: option.textContent })));
    const longAttacker = attackers.find(option => option.text === nicknames[1]);
    assert.ok(longAttacker, 'opponent must be selectable by its full nickname');
    await combat.getByRole('combobox', { name: 'Usuário', exact: true }).selectOption(longAttacker.value);
    await combat.getByRole('combobox', { name: 'Movimento', exact: true }).selectOption('light-that-burns-the-sky');
    await combat.getByRole('combobox', { name: 'Situação da disputa', exact: true }).selectOption('disadvantage');
    const trainers = await capture.getByRole('combobox', { name: 'Equipe em campo', exact: true }).locator('option').evaluateAll(options => options.filter(option => option.value).map(option => option.value));
    const targets = await capture.getByRole('combobox', { name: 'Alvo selvagem', exact: true }).locator('option').evaluateAll(options => options.filter(option => option.value).map(option => option.value));
    assert.equal(trainers.length, 1);
    assert.equal(targets.length, 1);
    await capture.getByRole('combobox', { name: 'Equipe em campo', exact: true }).selectOption(trainers[0]);
    await capture.getByRole('combobox', { name: 'Alvo selvagem', exact: true }).selectOption(targets[0]);
    await capture.getByRole('combobox', { name: 'Poké Ball', exact: true }).selectOption('premier-ball');
    assert.equal(await page.locator('.token-switch-control .room-select').count(), 1, 'a retained reserve needs a readable selector');
    await roomWidths('room-populated');

    await viewport(1280);
    for (const theme of themes) {
        await appearance(theme);
        await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
        for (const name of navLabels) {
            await nav(name);
            await header();
            if (name === 'Abrir a Central da Aventura') {
                await openDetails(combat);
                await openDetails(capture);
            }
            await check(`zoom-200-${theme}-${name}`);
        }
        await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    }
    assert.deepEqual(errors, []);
    const output = process.env.MYOWNDEX_SPACE_REPORT || '/tmp/myowndex-space-browser-report.json';
    await fs.writeFile(output, JSON.stringify({ report, errors }, null, 2));
    console.log(`Passed ${report.length} spacing checkpoints; no page errors.`);
} catch (error) {
    await page.screenshot({ path: '/tmp/myowndex-space-failure.png' }).catch(() => {});
    await fs.writeFile('/tmp/myowndex-space-browser-failure.json', JSON.stringify({ report, errors }, null, 2));
    throw error;
} finally {
    await context.setOffline(false).catch(() => {});
    await browser.close();
}

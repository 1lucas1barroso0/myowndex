// Optional production-browser regression: setup is documented in VALIDACAO.md.
// This flow uses real catalog data and an isolated browser's own local storage.
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
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
const page = await context.newPage();
const errors = [];
const report = [];
page.on('pageerror', error => errors.push(error.message));
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3001';
const widths = [320, 390, 768, 1280];
const themes = ['Claro', 'Escuro'];
const themeIds = { Claro: 'normal', Escuro: 'night' };
const fractionPattern = /\b\d+\s*[/⁄]\s*\d+\b|[¼½¾⅓⅔⅛⅜⅝⅞]/;

async function check(label, scopeSelector = '.app-root') {
    const result = await page.evaluate(selector => {
        const scope = document.querySelector(selector);
        if (!scope) return { missing: selector };
        const rendered = element => element instanceof HTMLElement
            && element.getClientRects().length > 0
            && !element.closest('[inert],.sr-only')
            && getComputedStyle(element).visibility !== 'hidden'
            && getComputedStyle(element).clipPath === 'none';
        const selectors = 'input,select,textarea,button,summary,h1,h2,h3,h4,label,dt,dd';
        const outside = [...scope.querySelectorAll(selectors)].filter(rendered).flatMap(element => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
                ? [{ tag: element.tagName, text: (element.innerText || element.getAttribute('aria-label') || '').slice(0, 90), left: rect.left, right: rect.right }]
                : [];
        });
        const clipped = [...scope.querySelectorAll('h1,h2,h3,h4,label,summary,button,dt,dd')].filter(rendered).flatMap(element => {
            const style = getComputedStyle(element);
            const horizontal = element.scrollWidth > element.clientWidth + 2;
            const vertical = element.scrollHeight > element.clientHeight + 2;
            return (horizontal && ['hidden', 'clip'].includes(style.overflowX)) || (vertical && ['hidden', 'clip'].includes(style.overflowY))
                ? [{ tag: element.tagName, text: element.innerText.slice(0, 90), width: element.clientWidth, scroll: element.scrollWidth }]
                : [];
        });
        // Compare each word's actual glyph rectangles, rather than trusting CSS declarations.
        const staticSelector = 'button,label,summary,h1,h2,h3,h4,dt,dd,.record-evolution-name,.record-move-name,.guide-hit-kill-heading,.guide-hit-kill-flow strong';
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const brokenWords = [];
        let textNode;
        while ((textNode = walker.nextNode())) {
            const parent = textNode.parentElement;
            if (!parent || !rendered(parent) || !parent.closest(staticSelector) || parent.closest('option,script,style')) continue;
            for (const match of textNode.textContent.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)) {
                if (match[0].length < 2) continue;
                const range = document.createRange();
                range.setStart(textNode, match.index);
                range.setEnd(textNode, match.index + match[0].length);
                const glyphRects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
                const lines = new Set(glyphRects.map(rect => Math.round(rect.top)));
                if (lines.size > 1) brokenWords.push({ word: match[0], container: parent.className, lines: [...lines] });
            }
        }
        const dialog = document.querySelector('.record-shell');
        return {
            viewport: innerWidth,
            pageWidth: document.documentElement.scrollWidth,
            outside,
            clipped,
            brokenWords,
            dialog: dialog ? { width: dialog.clientWidth, scrollWidth: dialog.scrollWidth, height: dialog.clientHeight, maxHeight: innerHeight } : null,
        };
    }, scopeSelector);
    report.push({ label, ...result });
    assert.ok(!result.missing, `${label}: missing ${scopeSelector}`);
    assert.ok(result.pageWidth <= result.viewport + 1, `${label}: page overflows horizontally`);
    assert.deepEqual(result.outside, [], `${label}: controls or labels leave the viewport`);
    assert.deepEqual(result.clipped, [], `${label}: titles or labels are clipped`);
    assert.deepEqual(result.brokenWords, [], `${label}: static words split across lines`);
    if (result.dialog) {
        assert.ok(result.dialog.scrollWidth <= result.dialog.width + 1, `${label}: record overflows horizontally`);
        assert.ok(result.dialog.height < result.dialog.maxHeight, `${label}: record exceeds the viewport height`);
    }
    console.log(JSON.stringify(report.at(-1)));
}

async function nav(name) {
    await page.getByRole('button', { name, exact: true }).click();
}

async function appearance(theme) {
    const choices = page.locator('.appearance-options [role="radio"]');
    assert.equal(await choices.count(), 2, 'appearance must offer exactly two choices');
    assert.deepEqual(await choices.allTextContents(), ['Claro', 'Escuro']);
    await page.getByRole('radio', { name: theme, exact: true }).click();
    await page.waitForFunction(themeId => document.documentElement.dataset.theme === themeId, themeIds[theme]);
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

async function openDetails(locator) {
    if (!await locator.evaluate(element => element.open)) await locator.locator(':scope > summary').click();
}

async function screenshot(path, selector) {
    if (selector) await page.locator(selector).first().evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await page.screenshot({ path });
}

try {
    await context.addInitScript(() => {
        if (!localStorage.getItem('myowndex_polish_legacy_fixture')) {
            localStorage.setItem('myowndex_appearance_v1', JSON.stringify('system'));
            localStorage.setItem('myowndex_polish_legacy_fixture', '1');
        }
    });
    await page.goto(baseUrl);
    // The initial offline shell may claim this page and reload it once.
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'night'
        && JSON.parse(localStorage.getItem('myowndex_appearance_v1')) === 'night');
    await check('legacy-system-migrates-to-dark');
    await appearance('Claro');
    await page.reload();
    await page.getByRole('radio', { name: 'Claro', exact: true }).waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'normal'
        && JSON.parse(localStorage.getItem('myowndex_appearance_v1')) === 'normal');
    assert.equal(await page.getByRole('radio', { name: 'Claro', exact: true }).getAttribute('aria-checked'), 'true');
    await check('explicit-light-survives-reload-and-dark-system');

    for (const theme of themes) {
        await appearance(theme);
        await openRecord('Bulbasaur');
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
            await page.waitForTimeout(200);
            assert.equal(await page.locator('.record-evolution-path').count(), 1);
            assert.equal(await page.locator('.record-evolution-node').count(), 3);
            assert.equal(await page.locator('.record-evolution-node[aria-current="step"]').innerText(), 'Bulbasaur');
            assert.deepEqual(await page.locator('.record-evolution-name').allTextContents(), ['Bulbasaur', 'Ivysaur', 'Venusaur']);
            assert.equal(await page.locator('.record-measurements dd').count(), 2);
            assert.doesNotMatch(await page.locator('.record-body').innerText(), fractionPattern);
            await check(`${theme}-${width}-bulbasaur-profile`, '.record-shell');
            if (theme === 'Claro' && width === 1280) {
                await page.locator('.record-shell').evaluate(element => { element.scrollTop = 0; });
                await screenshot('/tmp/polish-record-light-1280.png');
            }
            if (theme === 'Escuro' && width === 390) await screenshot('/tmp/polish-record-dark-390.png', '.species-description');

            await page.getByRole('tab', { name: 'Movimentos', exact: true }).click();
            const growl = page.locator('.record-move-card').filter({ has: page.locator('.record-move-name', { hasText: /^Growl$/ }) });
            await growl.locator('.record-move-toggle').click();
            await growl.locator('.record-move-facts').waitFor();
            await openDetails(growl.locator('.record-move-rules'));
            assert.match(await growl.innerText(), /Growl/);
            assert.match(await growl.innerText(), /Na batalha/);
            assert.doesNotMatch(await growl.innerText(), fractionPattern);
            assert.equal(await growl.locator('.record-move-facts dt').filter({ hasText: /^Poder$/ }).count(), 0, 'status move must not show a redundant empty power');
            await check(`${theme}-${width}-growl-rules`, '.record-shell');
            if (theme === 'Claro' && width === 390) await screenshot('/tmp/polish-moves-light-390.png', '.record-move-card.is-open');
        }
        await closeRecord();
    }

    for (const theme of themes) {
        await appearance(theme);
        await openRecord('Eevee');
        const paths = page.locator('.record-evolution-path');
        assert.equal(await paths.count(), 8);
        const evolvedNames = [];
        for (const path of await paths.all()) {
            assert.equal(await path.locator('.record-evolution-node').count(), 2);
            assert.equal(await path.locator('[aria-current="step"]').innerText(), 'Eevee');
            evolvedNames.push(await path.locator('.record-evolution-name').last().innerText());
        }
        assert.deepEqual(evolvedNames.sort(), ['Espeon', 'Flareon', 'Glaceon', 'Jolteon', 'Leafeon', 'Sylveon', 'Umbreon', 'Vaporeon'].sort());
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await page.locator('.record-evolution-list').scrollIntoViewIfNeeded();
            await check(`${theme}-${width}-eevee-eight-branches`, '.record-shell');
            if (theme === 'Claro' && width === 320) {
                await page.locator('.record-evolution-path').first().scrollIntoViewIfNeeded();
                await screenshot('/tmp/polish-eevee-eight-branches-320.png');
            }
        }
        await closeRecord();
    }

    await openRecord('Bulbasaur');
    await page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).click();
    await page.locator('.pc-partner-card').first().click();
    const training = page.locator('.pokemon-training-panel');
    await openDetails(training);
    const stats = await page.locator('.pokemon-stat-row h4').allTextContents();
    assert.equal(stats.length, 6);
    const ivs = [17, 18, 19, 20, 21, 22];
    const evs = [84, 72, 60, 48, 36, 24];
    for (let index = 0; index < stats.length; index++) {
        await page.getByRole('spinbutton', { name: `IVs de ${stats[index]}`, exact: true }).fill(String(ivs[index]));
        await page.getByRole('spinbutton', { name: `EVs de ${stats[index]}`, exact: true }).fill(String(evs[index]));
    }
    await page.waitForFunction(() => {
        const pokemon = JSON.parse(localStorage.getItem('myowndex_rotom_v4'))?.teams?.[0]?.pokemon?.[0];
        return pokemon?.ivs?.hp === 17 && pokemon?.evs?.hp === 84 && pokemon?.ivs?.speed === 22 && pokemon?.evs?.speed === 24;
    });
    await page.reload();
    await page.locator('.pc-partner-card').first().click();
    await openDetails(training);
    for (let index = 0; index < stats.length; index++) {
        assert.equal(await page.getByRole('spinbutton', { name: `IVs de ${stats[index]}`, exact: true }).inputValue(), String(ivs[index]));
        assert.equal(await page.getByRole('spinbutton', { name: `EVs de ${stats[index]}`, exact: true }).inputValue(), String(evs[index]));
        assert.equal(await page.getByRole('slider', { name: `Ajustar EVs de ${stats[index]}`, exact: true }).inputValue(), String(evs[index]));
    }
    assert.match(await page.locator('.pokemon-ev-budget').innerText(), /324 EVs/);
    await check('six-stat-ivs-evs-persist-after-reload');
    for (const theme of themes) {
        await appearance(theme);
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await training.locator(':scope > summary').scrollIntoViewIfNeeded();
            assert.equal(await page.locator('.pokemon-stat-row').count(), 6);
            assert.equal(await training.locator('input[type="number"]').count(), 12);
            assert.equal(await training.locator('input[type="range"]').count(), 6);
            await check(`${theme}-${width}-training-six-stats`);
            if (theme === 'Claro' && width === 320) await screenshot('/tmp/polish-training-light-320.png', '.pokemon-training-heading');
            if (theme === 'Escuro' && width === 1280) await screenshot('/tmp/polish-training-dark-1280.png', '.pokemon-training-heading');
        }
    }

    await nav('Abrir o Guia do Treinador');
    const protection = page.locator('.guide-rule-card[data-rule-id="3.4"]');
    await openDetails(protection);
    await openDetails(protection.locator('.guide-hit-kill-full-rule'));
    assert.equal(await protection.locator('.guide-hit-kill-flow > li').count(), 3);
    assert.match(await protection.innerText(), /1 HP/);
    assert.match(await protection.innerText(), /Sturdy/);
    assert.match(await protection.innerText(), /Focus Sash/);
    assert.match(await protection.innerText(), /Substitute/);
    const dice = page.locator('.local-dice-panel');
    const free = dice.locator('.local-dice-tabs button').filter({ hasText: 'dX' });
    await free.click();
    assert.equal(await free.locator('small').innerText(), 'Livre');
    await dice.getByLabel('Quantidade', { exact: true }).fill('3');
    await dice.getByRole('combobox', { name: /^Dado\b/ }).selectOption('12');
    await dice.getByLabel('Modificador', { exact: true }).fill('2');
    await openDetails(dice.locator('.local-dice-probability'));
    await openDetails(dice.locator('.local-dice-history'));
    for (const theme of themes) {
        await appearance(theme);
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await protection.locator(':scope > summary').scrollIntoViewIfNeeded();
            assert.doesNotMatch(await protection.innerText(), fractionPattern);
            await check(`${theme}-${width}-hit-kill-complete-rule`);
            if (theme === 'Claro' && width === 390) await screenshot('/tmp/polish-guide-hit-kill-light-390.png', '.guide-rule-card[data-rule-id="3.4"]');
            await dice.getByRole('button', { name: 'Rolar 3d12', exact: true }).click();
            await dice.locator('.local-dice-result').waitFor();
            const total = Number(await dice.locator('.local-dice-total').innerText());
            assert.ok(Number.isInteger(total) && total >= 5 && total <= 38);
            assert.equal(await dice.locator('.local-dice-faces > li').count(), 3);
            assert.equal(await dice.getByRole('button', { name: /Copiar/i }).count(), 0);
            assert.doesNotMatch(await dice.innerText(), fractionPattern);
            assert.doesNotMatch(await dice.locator('.local-dice-probability').innerText(), /Cada dado é independente/i);
            assert.ok(await dice.locator('.local-dice-history > div > ol > li').count() > 0);
            await dice.locator('.local-dice-history').scrollIntoViewIfNeeded();
            await check(`${theme}-${width}-free-dice-result-and-history`);
            if (theme === 'Escuro' && width === 390) await screenshot('/tmp/polish-dice-dark-390.png', '.local-dice-result');
        }
    }
    assert.equal(await dice.locator('.local-dice-history > div > ol > li').count(), 8);
    assert.deepEqual(errors, []);
    const output = process.env.MYOWNDEX_POLISH_REPORT || '/tmp/myowndex-polish-browser-report.json';
    await fs.writeFile(output, JSON.stringify({ report, errors }, null, 2));
    console.log(`Passed ${report.length} polish checkpoints; no page errors.`);
} catch (error) {
    await page.screenshot({ path: '/tmp/polish-failure.png' }).catch(() => {});
    await fs.writeFile('/tmp/myowndex-polish-browser-failure.json', JSON.stringify({ report, errors }, null, 2));
    throw error;
} finally {
    await browser.close();
}

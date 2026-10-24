// Exercise the Guide's search and calculator in an isolated, slower mobile UI.
import assert from 'node:assert/strict';
import { RPG_RULE_SECTIONS } from '../src/core/rpgRules.js';
const expectedRuleIds = RPG_RULE_SECTIONS.flatMap(section => section.rules.map(rule => String(rule.id))).sort();
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], checks = [], timings = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.fallback() : route.abort());
try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Abrir o Guia do Treinador', exact: true }).click();
    const guide = page.locator('.trainer-guide'), search = guide.getByRole('searchbox', { name: 'Pesquisar regras' });
    await search.waitFor();
    assert.equal(await guide.locator('.guide-rule-card').count(), expectedRuleIds.length);
    assert.deepEqual((await guide.locator('.guide-rule-card').evaluateAll(cards => cards.map(card => card.dataset.ruleId))).sort(), expectedRuleIds);
    const searchFor = async value => {
        await search.fill(value);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    for (const theme of ['Claro', 'Escuro']) {
        await page.getByRole('radio', { name: theme, exact: true }).click();
        for (const width of [320, 390, 768, 1280, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            if (width <= 700) await page.locator('.app-curtain-grip').press('End');
            const started = Date.now();
            await searchFor('AÇÃO');
            const accented = await guide.locator('.guide-rule-card').evaluateAll(cards => cards.map(card => card.dataset.ruleId));
            await searchFor('acao');
            assert.deepEqual(await guide.locator('.guide-rule-card').evaluateAll(cards => cards.map(card => card.dataset.ruleId)), accented);
            assert.ok(accented.length > 0);
            await searchFor('1 em 8');
            assert.ok(await guide.locator('.guide-rule-card').count() > 0);
            await searchFor('__nada_encontrado__');
            await guide.getByText('Nenhuma regra encontrada. Tente outro termo.', { exact: true }).waitFor();
            await searchFor('');
            assert.equal(await guide.locator('.guide-rule-card').count(), expectedRuleIds.length);
            timings.push({ theme, width, sequenceMs: Date.now() - started });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || scrollY !== 0), false);
            checks.push(`search accents, proportions, empty/reset ${theme} ${width}`);
        }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const rule = guide.locator('.guide-rule-card').first();
    await rule.locator(':scope > summary').click();
    assert.equal(await rule.evaluate(element => element.open), true);
    await guide.locator('.guide-calculator > summary').click();
    await guide.getByLabel('Nível atual', { exact: true }).fill('20');
    assert.equal(await rule.evaluate(element => element.open), true, 'calculator updates preserve the manually opened rule');
    await searchFor('__nada_encontrado__');
    await guide.getByRole('button', { name: 'Como aguentar um golpe decisivo', exact: true }).click();
    const protection = guide.locator('[data-rule-id="3.4"]');
    await page.waitForFunction(() => document.querySelector('[data-rule-id="3.4"]')?.open);
    assert.equal(await guide.locator('.guide-rule-card').count(), expectedRuleIds.length);
    assert.equal(await protection.locator('.guide-hit-kill-full-rule').evaluate(element => element.open), true);
    assert.equal(await protection.locator(':scope > summary').evaluate(element => element === document.activeElement), true);
    await protection.locator(':scope > summary').press('Enter');
    assert.equal(await protection.evaluate(element => element.open), false);
    checks.push('calculator, preserved disclosure, protection jump and keyboard toggle');
    if (process.env.MYOWNDEX_REVIEW_IMAGES === '1') {
        for (const theme of ['Claro', 'Escuro']) {
            await page.getByRole('radio', { name: theme, exact: true }).click();
            await searchFor('dano');
            await page.screenshot({ path: `/tmp/myowndex-guide-252-${theme}.png` });
        }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ checks, timings, cpuSlowdown: 4, errors }, null, 2));
} catch (error) {
    await page.screenshot({ path: '/tmp/myowndex-guide-252-failure.png' });
    await fs.writeFile('/tmp/myowndex-guide-252-failure.txt', await page.locator('body').innerText());
    throw error;
} finally { await context.close(); await browser.close(); }

import assert from 'node:assert/strict';
const { chromium, firefox } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MYOWNDEX_SMOKE_URL || 'http://127.0.0.1:3000';
for (const [name, engine] of [['Chromium', chromium], ['Firefox', firefox]]) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(base);
        await page.locator('.dex-grid').waitFor();
        for (const [width, height] of [[320, 653], [390, 844], [1280, 900], [3200, 1800], [3840, 2160], [844, 390]]) {
            await page.setViewportSize({ width, height });
            await page.waitForFunction(() => {
                const grid = document.querySelector('.dex-grid');
                const card = grid?.firstElementChild;
                if (!card) return false;
                const style = getComputedStyle(grid);
                const columns = style.gridTemplateColumns.split(/\s+/).length;
                const row = card.getBoundingClientRect().height + parseFloat(style.rowGap);
                const required = columns * (Math.ceil(document.querySelector('#main-content').clientHeight / row) + 1);
                return grid.children.length >= required && grid.children.length % columns === 0;
            });
            const count = await page.locator('.dex-entry').count();
            assert.ok(count < 400, `${name} ${width}: avoid mounting the whole catalogue to fill a screen`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            const identities = await page.locator('.dex-entry-main').evaluateAll(cards => cards.map(card => card.getAttribute('aria-label')));
            assert.equal(new Set(identities).size, identities.length, 'No duplicate or invented cards');
        }
        // A different search can have the same result count and row height.
        // Resetting its window must still complete the last loaded row.
        let resetColumns;
        for (const width of [1100, 1000, 900, 1400, 1600]) {
            await page.setViewportSize({ width, height: 390 });
            resetColumns = await page.locator('.dex-grid').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length);
            if (12 % resetColumns) break;
        }
        assert.ok(12 % resetColumns, 'Exercise a width where the initial window needs a completed row');
        const search = page.locator('#pokemon-search');
        await search.fill('1-60');
        await page.waitForFunction(columns => document.querySelector('.dex-count')?.textContent.startsWith('60 ') && document.querySelectorAll('.dex-entry').length % columns === 0, resetColumns);
        await search.fill('61-120');
        await page.waitForFunction(columns => document.querySelectorAll('.dex-entry').length % columns === 0 && document.querySelector('.dex-number')?.textContent.includes('0061'), resetColumns);
        await page.setViewportSize({ width: 1280, height: 900 });
        await search.fill('1-19');
        await page.waitForFunction(() => document.querySelector('.dex-count')?.textContent.startsWith('19 '));
        while (await page.locator('.dex-entry').count() < 19) {
            const loaded = await page.locator('.dex-entry').count();
            await page.locator('#main-content').press('End');
            await page.waitForFunction(loaded => document.querySelectorAll('.dex-entry').length > loaded, loaded);
        }
        assert.equal(await page.locator('.dex-entry').count(), 19);
        assert.equal(await page.getByRole('button', { name: 'Mostrar mais Pokémon', exact: true }).count(), 0);
        await page.locator('.dex-discovery > summary').click();
        await page.getByRole('button', { name: 'Conhecer Bulbasaur', exact: true }).click();
        await page.locator('.species-description > p[lang="pt-BR"]').waitFor();
        assert.equal(await page.locator('.species-description > p').getAttribute('lang'), 'pt-BR');
        await page.getByRole('button', { name: 'Ver registro original em inglês', exact: true }).click();
        assert.equal(await page.locator('.species-description > p').getAttribute('lang'), 'en');
        await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
        assert.equal(await search.inputValue(), '1-19', 'Exploration keeps the search');
        await search.fill('');
        await page.locator('.dex-load-more').waitFor();
        const before = await page.locator('.dex-entry').count();
        await page.locator('.dex-load-more').scrollIntoViewIfNeeded();
        await page.waitForFunction(before => document.querySelectorAll('.dex-entry').length > before, before);
        await page.getByRole('button', { name: 'Abrir o Guia do Treinador', exact: true }).click();
        await page.getByRole('searchbox', { name: 'Pesquisar regras', exact: true }).fill('Poison');
        await page.getByRole('button', { name: 'Ver todas as regras', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('.guide-rule-card').length === 50);
        assert.equal(await page.locator('.guide-rule-card').count(), 50);
        assert.equal(await page.getByRole('searchbox', { name: 'Pesquisar regras', exact: true }).evaluate(input => input === document.activeElement), true, 'Reset keeps keyboard focus at the search');
        await page.getByRole('button', { name: 'Abrir o PC do Bill', exact: true }).click();
        await page.getByRole('button', { name: 'Abrir primeira Box', exact: true }).click();
        await page.getByRole('button', { name: '+ Adicionar Pokémon', exact: true }).click();
        await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).click();
        await page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).click();
        await page.getByRole('button', { name: 'Abrir ficha de Bulbasaur, nível 5', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click();
        await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
        assert.equal(await page.locator('.pc-partner-card').count(), 1, 'Optional account does not interrupt the prepared team');
        assert.deepEqual(errors, []);
        console.log(`${name}: responsive rows, progressive scrolling, completed filter, bilingual record, preserved search and 50 rules verified.`);
    } catch (error) {
        console.error(name, await page.url(), await page.evaluate(() => ({ cards: document.querySelectorAll('.dex-entry').length, columns: document.querySelector('.dex-grid') && getComputedStyle(document.querySelector('.dex-grid')).gridTemplateColumns, search: document.querySelector('#pokemon-search')?.value, first: document.querySelector('.dex-number')?.textContent })));
        throw error;
    } finally { await context.close(); await browser.close(); }
}

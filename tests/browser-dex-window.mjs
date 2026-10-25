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
        const search = page.locator('#pokemon-search');
        await search.fill('1-19');
        await page.waitForFunction(() => document.querySelectorAll('.dex-entry').length === 19);
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
        assert.deepEqual(errors, []);
        console.log(`${name}: responsive rows, progressive scrolling, completed filter, bilingual record, preserved search and 50 rules verified.`);
    } finally { await context.close(); await browser.close(); }
}

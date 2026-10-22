// Disposable mobile encounter: exercise actions, not just opening the tool.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
const checks = [];
const timings = [];
page.on('pageerror', error => errors.push(error.message));
const API = 'https://pokeapi.co/api/v2/';
const species = { id: 1, name: 'bulbasaur', gender_rate: 1, base_happiness: 70, is_legendary: false, is_mythical: false,
    varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: `${API}pokemon/1/` } }] };
const pokemon = { id: 1, name: 'bulbasaur', species: { name: 'bulbasaur', url: `${API}pokemon-species/1/` },
    types: [{ slot: 1, type: { name: 'grass' } }], sprites: { front_default: '' },
    stats: [45, 49, 49, 65, 65, 45].map((base_stat, index) => ({ base_stat, stat: { name: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'][index] } })),
    abilities: [{ is_hidden: false, slot: 1, ability: { name: 'overgrow' } }],
    moves: ['tackle', 'growl', 'vine-whip'].map(name => ({ move: { name, url: `${API}move/${name}/` }, version_group_details: [{ version_group: { name: 'scarlet-violet' }, move_learn_method: { name: 'level-up' }, level_learned_at: 1 }] })) };
let holdRequests = true;
const waiting = [];
let notifyRequest;
const requestStarted = new Promise(resolve => { notifyRequest = resolve; });
await context.route(`${API}**`, async route => {
    const [, , kind, name] = new URL(route.request().url()).pathname.split('/').filter(Boolean);
    if (kind === 'pokemon-species' && holdRequests) {
        notifyRequest();
        await new Promise(resolve => waiting.push(resolve));
    }
    const body = kind === 'pokemon' ? pokemon : kind === 'pokemon-species' ? species
        : kind === 'version-group' ? { id: 25, generation: { url: `${API}generation/9/` } }
        : { name, pp: 35, type: { name: 'normal' }, damage_class: { name: 'physical' } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await context.addInitScript(() => {
    window.generatorTasks = [];
    new PerformanceObserver(list => window.generatorTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true });
    // Delay completion notification, leaving the browser's genuine transaction
    // and durability semantics intact. Failure affects this disposable draft only.
    const completion = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...completion, set(callback) {
        completion.set.call(this, callback && function(event) {
            if (window.generatorSlowStorage && this.mode === 'readwrite') setTimeout(() => callback.call(this, event), 800);
            else callback.call(this, event);
        });
    } });
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        if (window.generatorFailStorage && key.includes('myowndex_generator_v1')) throw new DOMException('Test quota', 'QuotaExceededError');
        return setItem.call(this, key, value);
    };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...args) {
        if (window.generatorFailStorage && value?.key?.includes('myowndex_generator_v1')) throw new DOMException('Test quota', 'QuotaExceededError');
        return put.call(this, value, ...args);
    };
});
const dialog = page.locator('.generator-dialog');
const confirm = page.getByRole('alertdialog');
const open = async () => {
    await page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await dialog.locator('.generator-content').waitFor();
};
const close = async () => {
    await dialog.getByRole('button', { name: 'Fechar gerador' }).click();
    await dialog.waitFor({ state: 'detached' });
};
const assertConfirmation = async () => {
    await confirm.waitFor();
    const state = await confirm.evaluate(element => {
        const overlay = element.parentElement;
        const rect = element.getBoundingClientRect();
        const button = element.querySelector('.confirm-dialog-confirm');
        const target = button.getBoundingClientRect();
        return { above: Number(getComputedStyle(overlay).zIndex) > Number(getComputedStyle(document.querySelector('.generator-overlay')).zIndex),
            receivesTouches: button.contains(document.elementFromPoint(target.x + target.width / 2, target.y + target.height / 2)),
            fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
            backgroundInert: document.querySelector('.generator-overlay').inert };
    });
    assert.deepEqual(state, { above: true, receivesTouches: true, fits: true, backgroundInert: true });
};
const clear = async () => {
    await dialog.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
    await assertConfirmation();
    await confirm.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await dialog.locator('.generator-partner').count(), 0);
};
try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await page.goto(process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await open();
    await dialog.getByText('Escolher quem pode aparecer', { exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Escolher um Pokémon ou forma específicos' }).selectOption('species:1');
    await dialog.getByRole('combobox', { name: 'Quantidade de Pokémon' }).selectOption('6');
    await dialog.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.generator-options')?.getAttribute('aria-busy') === 'true');
    let deadline;
    try {
        await Promise.race([requestStarted, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Generation did not request the species')), 30000); })]);
    } finally { clearTimeout(deadline); }
    await dialog.getByRole('button', { name: 'Cancelar geração' }).click();
    holdRequests = false;
    waiting.splice(0).forEach(resolve => resolve());
    await page.waitForFunction(() => document.querySelector('.generator-options')?.getAttribute('aria-busy') === 'false');
    assert.equal(await dialog.locator('.generator-partner').count(), 0);
    checks.push('slow network generation can be cancelled without late results');
    await dialog.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await dialog.locator('.generator-partner').nth(5).waitFor();
    await dialog.locator('.generator-partner-details summary').first().click();
    let started = Date.now();
    await dialog.getByLabel('Apelido', { exact: true }).first().pressSequentially('Parceiro mobile', { delay: 20 });
    timings.push({ action: 'typing 15 characters (20 ms delay)', ms: Date.now() - started });
    assert.equal(await dialog.getByLabel('Apelido', { exact: true }).first().inputValue(), 'Parceiro mobile');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('myowndex_generator_v1') || '{}').results?.[0]?.pokemon.nickname === 'Parceiro mobile');
    await close(); await open();
    assert.equal(await dialog.locator('.generator-partner').count(), 6);
    checks.push('six partners and nickname survive close/reopen');
    for (const theme of ['Claro', 'Escuro']) {
        await close(); await page.getByRole('radio', { name: theme, exact: true }).click(); await open();
        for (const width of [320, 390, 768, 1280, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            started = Date.now();
            await dialog.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
            await assertConfirmation();
            timings.push({ action: `open clear ${theme} ${width}`, ms: Date.now() - started });
            if (width === 390 && process.env.MYOWNDEX_REVIEW_IMAGES === '1') await page.screenshot({ path: `/tmp/myowndex-generator-confirm-${theme}.png` });
            await confirm.getByRole('button', { name: 'Voltar ao encontro', exact: true }).tap();
            assert.equal(await dialog.locator('.generator-partner').count(), 6);
            checks.push(`clear confirmation visible, touchable and cancellable ${theme} ${width}`);
        }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog.getByRole('button', { name: 'Criar novo encontro', exact: true }).click();
    await assertConfirmation();
    await confirm.getByRole('button', { name: 'Continuar neste encontro', exact: true }).click();
    assert.equal(await dialog.locator('.generator-partner').count(), 6);
    checks.push('replacement confirmation preserves encounter on cancel');
    const choice = dialog.getByRole('checkbox', { name: 'Selecionar Bulbasaur', exact: true }).first();
    await choice.uncheck(); assert.equal(await choice.isChecked(), false); await choice.check();
    await page.evaluate(() => { window.generatorFailStorage = true; });
    await dialog.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
    await confirm.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await dialog.locator('.generator-partner').count(), 6);
    await dialog.getByRole('alert').filter({ hasText: 'Não foi possível limpar' }).waitFor();
    await page.evaluate(() => { window.generatorFailStorage = false; window.generatorSlowStorage = true; });
    await dialog.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
    await confirm.getByRole('button', { name: 'Limpar encontro', exact: true }).tap();
    await confirm.getByRole('button', { name: 'Limpando encontro…', exact: true }).waitFor();
    assert.equal(await confirm.getAttribute('aria-busy'), 'true');
    assert.equal(await confirm.getByRole('button', { name: 'Limpando encontro…', exact: true }).isDisabled(), true);
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await dialog.locator('.generator-partner').count(), 0);
    await page.evaluate(() => { window.generatorSlowStorage = false; });
    checks.push('failed persistence retains all partners; slow persistence shows busy confirmation');
    await close(); await page.reload({ waitUntil: 'domcontentloaded' }); await open();
    assert.equal(await dialog.locator('.generator-partner').count(), 0);
    checks.push('confirmed clear survives reload');
    // Generate again and exercise individual removal, then the final clear.
    await dialog.getByText('Escolher quem pode aparecer', { exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Escolher um Pokémon ou forma específicos' }).selectOption('species:1');
    await dialog.getByRole('combobox', { name: 'Quantidade de Pokémon' }).selectOption('6');
    await dialog.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await dialog.locator('.generator-partner').nth(5).waitFor();
    await dialog.locator('.generator-partner-details summary').first().click();
    await dialog.getByRole('button', { name: 'Remover Bulbasaur do encontro', exact: true }).first().click();
    await assertConfirmation();
    await confirm.getByRole('button', { name: 'Remover do encontro', exact: true }).click();
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await dialog.locator('.generator-partner').count(), 5);
    await clear();
    checks.push('individual removal and repeated generation/clear remain usable');
    assert.equal(await page.evaluate(() => window.scrollX === 0 && window.scrollY === 0), true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: checks.length, checks, timings, cpuSlowdown: 6, pageErrors: errors }, null, 2));
} catch (error) {
    await page.screenshot({ path: '/tmp/myowndex-generator-mobile-failure.png' });
    await fs.writeFile('/tmp/myowndex-generator-mobile-failure.txt', await page.locator('body').innerText());
    throw error;
} finally {
    holdRequests = false; waiting.splice(0).forEach(resolve => resolve());
    await context.close(); await browser.close();
}

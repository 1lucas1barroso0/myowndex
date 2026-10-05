// Guest-only scenario audit: all scenery, themes and screen sizes preserve the battle.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createRoomSnapshot, normalizeRoomSnapshot, ROOM_SCENARIOS, ROOM_WEATHERS, ROOM_TERRAINS } from '../src/core/room.js';

const require = createRequire(import.meta.url);
const axeSource = await fs.readFile(process.env.MYOWNDEX_AXE_PATH || require.resolve('axe-core/axe.min.js'), 'utf8');
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3001';
const outputDir = process.env.MYOWNDEX_SCENARIO_REPORT_DIR || '/tmp/myowndex45-scenes';
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [], remoteRoomRequests = [], checks = [], states = [], assets = [];
const token = (id, name, speciesId, side, x, y) => ({ id, name, speciesId, speciesName: name.toLowerCase(), sprite: `/sprites/${speciesId}.png`, side, x, y, level: 20, currentHp: 12, maxHp: 20, stats: { hp: 20, attack: 5, defense: 5, 'special-attack': 5, 'special-defense': 5, speed: 5 }, types: ['normal'], moves: ['tackle', '', '', ''], pp: [9, null, null, null] });
const seed = normalizeRoomSnapshot({ ...createRoomSnapshot('Nossos cenários'), phase: 'batalha', round: 3, hitKillProtectionUsed: ['token:little'], hitKillProtectionDisabled: ['token:large'], tokens: [token('little', 'Caterpie', 10, 'ally', 25, 75), token('large', 'Onix', 95, 'opponent', 75, 25)] });
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/rooms/**', route => { remoteRoomRequests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`); return route.abort(); });
await context.route('https://pokeapi.co/api/v2/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, name: 'bulbasaur', abilities: [], moves: [], stats: [], types: [{ type: { name: 'grass' } }], sprites: {}, species: { name: 'bulbasaur' }, flavor_text_entries: [] }) }));
await context.addInitScript(seed => {
    if (localStorage.getItem('scenarios-qa-seeded')) return;
    localStorage.setItem('scenarios-qa-seeded', '1');
    localStorage.setItem('myowndex_live_room_v1', JSON.stringify({ code: 'LOCAL', key: 'local-scenarios-qa', role: 'narrator', displayName: 'Narrador', local: true }));
    localStorage.setItem('myowndex_local_room_v1', JSON.stringify({ code: 'LOCAL', title: seed.title, revision: 0, updatedAt: new Date().toISOString(), snapshot: seed, players: [], events: [], media: [] }));
}, seed);

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot);
const preservedState = snapshot => ({ tokens: snapshot.tokens, initiative: snapshot.initiative, round: snapshot.round, turnIndex: snapshot.turnIndex, hitKillProtectionUsed: snapshot.hitKillProtectionUsed, hitKillProtectionDisabled: snapshot.hitKillProtectionDisabled, interventionUsed: snapshot.interventionUsed });
const field = page.locator('.battlefield-card');
const environment = field.locator('.battlefield-environment');
const board = field.locator('.battlefield-board');
const pane = async () => { const nav = page.locator('.room-mobile-nav'); if (await nav.isVisible()) await nav.getByRole('button', { name: 'Campo', exact: true }).click(); };
const select = async (label, key, value) => {
    await field.getByRole('combobox', { name: label, exact: true }).selectOption(value);
    await page.waitForFunction(({ key, value }) => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot[key] === value, { key, value });
};
const verifyImage = async scene => {
    await page.waitForFunction(id => { const image = document.querySelector('.battlefield-scenery'); return image?.getAttribute('src') === `/scenes/${id}.svg` && image.complete && image.naturalWidth > 0; }, scene.id);
    const result = await field.locator('.battlefield-scenery').evaluate(async image => {
        await image.decode();
        const style = getComputedStyle(image), bounds = image.getBoundingClientRect(), parentBounds = image.parentElement.getBoundingClientRect(), parentStyle = getComputedStyle(image.parentElement);
        const overlay = getComputedStyle(image.parentElement, '::after');
        return { src: image.getAttribute('src'), decorative: image.alt === '' && image.getAttribute('aria-hidden') === 'true', width: image.naturalWidth, height: image.naturalHeight, display: style.display, visibility: style.visibility, opacity: Number(style.opacity), zIndex: Number(style.zIndex), overlayOpacity: Number(overlay.opacity), left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, parent: { left: parentBounds.left + Number.parseFloat(parentStyle.borderLeftWidth), right: parentBounds.right - Number.parseFloat(parentStyle.borderRightWidth), top: parentBounds.top + Number.parseFloat(parentStyle.borderTopWidth), bottom: parentBounds.bottom - Number.parseFloat(parentStyle.borderBottomWidth) } };
    });
    assert.equal(result.src, `/scenes/${scene.id}.svg`);
    assert.equal(result.decorative, true);
    assert.ok(result.width > 0 && result.height > 0);
    assert.notEqual(result.display, 'none'); assert.notEqual(result.visibility, 'hidden'); assert.equal(result.opacity, 1);
    assert.ok(result.overlayOpacity <= .5, `${scene.label}: weather must leave the artwork readable`);
    for (const edge of ['left', 'right', 'top', 'bottom']) assert.ok(Math.abs(result[edge] - result.parent[edge]) <= 1, `${scene.label}: artwork fills its own board`);
    return result;
};
const audit = async label => {
    const result = await page.evaluate(async () => {
        const root = document.querySelector('.battlefield-card');
        const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[aria-hidden="true"]') && (!element.closest('details:not([open])') || element.closest('details:not([open])').querySelector(':scope > summary')?.contains(element));
        const controls = [...root.querySelectorAll('button,input,select,textarea,summary')].filter(visible);
        const bounds = root.getBoundingClientRect();
        const escaped = controls.filter(element => { const r = element.getBoundingClientRect(); return r.width && r.height && (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.left < -1 || r.right > innerWidth + 1); }).map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label') || element.innerText, class: element.className }));
        const smallTargets = controls.filter(element => { const r = element.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label') || element.innerText, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
        const phaseButtons = [...document.querySelectorAll('.room-phase-options button')].filter(visible).map(button => {
            const bounds = button.getBoundingClientRect(), label = button.querySelector('strong'), range = document.createRange();
            range.selectNodeContents(label);
            const textRects = [...range.getClientRects()].filter(rect => rect.width > 0);
            return { label: label.textContent, width: bounds.width, height: bounds.height, direction: getComputedStyle(button).flexDirection, lines: textRects.length, outside: textRects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1) };
        });
        const audit = await window.axe.run({ include: [['.battlefield-card'], ['.room-phase-control']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return { escaped, smallTargets, phaseButtons, violations: audit.violations.map(entry => ({ id: entry.id, impact: entry.impact, nodes: entry.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), width: innerWidth, scroll: document.documentElement.scrollWidth };
    });
    assert.equal(result.scroll, result.width, `${label}: page overflow`);
    assert.deepEqual(result.escaped, [], `${label}: escaped controls`);
    assert.deepEqual(result.smallTargets, [], `${label}: touch controls below 44px`);
    assert.deepEqual(result.violations, [], `${label}: accessibility`);
    assert.equal(result.phaseButtons.length, 4, `${label}: every phase remains available`);
    for (const button of result.phaseButtons) {
        assert.ok(button.width >= 43.5 && button.height >= 43.5, `${label}: phase touch target`);
        assert.equal(button.lines, 1, `${label}: ${button.label} stays a whole word`);
        assert.equal(button.outside, false, `${label}: ${button.label} stays inside its button`);
        if (result.width <= 360) { assert.equal(button.direction, 'column'); assert.ok(button.height >= 67.5); }
    }
    return result;
};
const writeGallery = async (theme, width) => {
    const cards = await Promise.all(ROOM_SCENARIOS.map(async scene => `<figure><img src="data:image/png;base64,${(await fs.readFile(`${outputDir}/${theme}-${width}-${scene.id}.png`)).toString('base64')}" alt=""><figcaption>${scene.label}</figcaption></figure>`));
    const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Cenários ${width} ${theme}</title><style>body{margin:0;padding:24px;background:${theme === 'night' ? '#1e303f' : '#f1f5ef'};color:${theme === 'night' ? '#f3faf6' : '#263b42'};font:18px system-ui}h1{margin:0 0 20px;font-size:24px}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}figure{margin:0;border:1px solid #6b8791;background:${theme === 'night' ? '#283d4c' : '#fff'}}img{display:block;width:100%;height:300px;object-fit:contain}figcaption{padding:12px;font-weight:700}</style><h1>Cenários · ${width}px · ${theme === 'night' ? 'Escuro' : 'Claro'}</h1><main class="gallery">${cards.join('')}</main></html>`;
    await fs.writeFile(`${outputDir}/gallery-${theme}-${width}.html`, html);
    const gallery = await context.newPage();
    await gallery.setViewportSize({ width: 1200, height: 1040 });
    await gallery.setContent(html);
    await gallery.screenshot({ path: `${outputDir}/gallery-${theme}-${width}.png`, fullPage: true });
    await gallery.close();
};

try {
    await fs.mkdir(outputDir, { recursive: true });
    assert.equal(ROOM_SCENARIOS.length, 9);
    for (const scene of ROOM_SCENARIOS) {
        const response = await context.request.get(`${baseUrl}/scenes/${scene.id}.svg`);
        assert.equal(response.status(), 200, `${scene.label}: local artwork response`);
        assert.match(response.headers()['content-type'], /image\/svg\+xml/);
        const svg = await response.text();
        assert.match(svg, /<svg\b/); assert.match(svg, /viewBox=/);
        assert.ok(!/<script\b|https?:\/\/[^\s"']+\.(?:png|jpe?g|webp)/i.test(svg), `${scene.label}: static local artwork`);
        assets.push({ id: scene.id, label: scene.label, bytes: Buffer.byteLength(svg) });
    }
    checks.push('All nine backgrounds load as independent local SVG images');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Abrir a Central da Aventura', exact: true }).click();
    await page.locator('.room-app').waitFor(); await pane();
    await environment.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await environment.evaluate(element => element.open), true);
    checks.push('Keyboard opens the field controls');
    await page.addScriptTag({ content: axeSource });
    const baseline = preservedState(await state());
    for (const theme of ['day', 'night']) for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await pane();
        for (const scene of ROOM_SCENARIOS) {
            await select('Cenário', 'scenario', scene.id);
            assert.equal(await field.getByRole('combobox', { name: 'Cenário', exact: true }).inputValue(), scene.id);
            assert.ok(await board.evaluate((element, id) => element.classList.contains(`scene-${id}`), scene.id));
            const image = await verifyImage(scene);
            const metrics = await audit(`${scene.label}, ${theme}, ${width}`);
            assert.deepEqual(preservedState(await state()), baseline, 'Scenery selection never changes Pokémon, PP, rounds or protection');
            await board.screenshot({ path: `${outputDir}/${theme}-${width}-${scene.id}.png` });
            states.push({ scene: scene.id, theme, width, type: 'scenery', image: { width: image.width, height: image.height }, ...metrics });
        }
        await writeGallery(theme, width);
    }
    checks.push('54 scenario/theme/viewport states preserve the battle and pass image, fitting, 44px and axe checks');
    await page.setViewportSize({ width: 390, height: 844 }); await pane();
    for (const theme of ['day', 'night']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        for (const scene of ROOM_SCENARIOS) {
            await select('Cenário', 'scenario', scene.id);
            for (const [weather, terrain] of [['chuva', 'eletrico'], ['nevoa', 'nevoa'], ['areia', 'psiquico']]) {
                await select('Clima', 'weather', weather); await select('Terreno', 'terrain', terrain);
                await verifyImage(scene);
                assert.ok(await board.evaluate((element, { weather, terrain }) => element.classList.contains(`weather-${weather}`) && element.classList.contains(`terrain-${terrain}`), { weather, terrain }));
                assert.deepEqual(preservedState(await state()), baseline);
                const metrics = await audit(`${scene.label}, ${theme}, ${weather}, ${terrain}`);
                states.push({ scene: scene.id, theme, width: 390, type: 'overlay', weather, terrain, ...metrics });
            }
            await board.screenshot({ path: `${outputDir}/overlay-${theme}-${scene.id}.png` });
        }
    }
    checks.push('54 weather/terrain combinations keep every scene visible and preserve battle state');
    for (const weather of ROOM_WEATHERS) await select('Clima', 'weather', weather.id);
    for (const terrain of ROOM_TERRAINS) await select('Terreno', 'terrain', terrain.id);
    await select('Clima', 'weather', 'limpo'); await select('Terreno', 'terrain', 'nenhum');
    checks.push('Every weather and terrain choice is available');
    await select('Cenário', 'scenario', 'rota');
    await field.getByRole('combobox', { name: 'Cenário', exact: true }).focus();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot.scenario === 'floresta');
    assert.deepEqual(preservedState(await state()), baseline);
    checks.push('Native scenario picker works from the keyboard');
    const little = field.locator('.room-token').filter({ has: page.locator('img[src="/sprites/10.png"]') });
    await little.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot.tokens.find(token => token.id === 'little').x === 27);
    await page.keyboard.press('Shift+ArrowLeft');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot.tokens.find(token => token.id === 'little').x === 22);
    const moved = await state();
    assert.equal(moved.tokens.find(token => token.id === 'little').pp[0], 9);
    assert.deepEqual(moved.hitKillProtectionUsed, baseline.hitKillProtectionUsed);
    assert.deepEqual(moved.hitKillProtectionDisabled, baseline.hitKillProtectionDisabled);
    checks.push('Pokémon move with arrow keys and Shift while preserving PP and protection');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await little.locator('img').evaluate(element => getComputedStyle(element).animationName), 'none');
    checks.push('Reduced motion keeps the field still');
    assert.deepEqual(remoteRoomRequests, [], 'The audit never creates or edits remote adventures');
    assert.deepEqual(errors, []);
    checks.push('No runtime errors or remote adventure requests');
    console.log(JSON.stringify({ count: checks.length, states: states.length, checks, assets, errors, outputDir }, null, 2));
} catch (error) {
    await page.screenshot({ path: `${outputDir}/failure.png`, fullPage: true }).catch(() => {});
    await fs.writeFile(`${outputDir}/failure-field.html`, await field.evaluate(element => element.outerHTML).catch(() => 'No battlefield')).catch(() => {});
    throw error;
} finally {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(`${outputDir}/report.json`, JSON.stringify({ checks, states, assets, errors, remoteRoomRequests }, null, 2));
    await browser.close();
}

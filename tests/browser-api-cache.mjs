// Real CacheStorage, isolated guest profile: reload must reuse the same public
// catalogue snapshots even when the catalogue's network becomes unavailable.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
const API = 'https://pokeapi.co/api/v2/';
const speciesUrl = `${API}pokemon-species/1/`, pokemonUrl = `${API}pokemon/1/`;
const listUrl = `${API}pokemon-species?limit=1500`;
const species = { id: 1, name: 'bulbasaur', gender_rate: 1, capture_rate: 45, base_happiness: 70,
    varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: pokemonUrl } }], flavor_text_entries: [], evolution_chain: null };
const pokemon = { id: 1, name: 'bulbasaur', species: { name: 'bulbasaur', url: speciesUrl }, height: 7, weight: 69,
    types: [{ slot: 1, type: { name: 'grass' } }], stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map(name => ({ base_stat: 45, stat: { name } })),
    sprites: { front_default: '' }, abilities: [], moves: [] };
let offline = false;
await context.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.fallback() : route.abort());
await context.route(`${API}**`, async route => {
    requests.push({ url: route.request().url(), offline });
    if (offline) { await route.abort('internetdisconnected'); return; }
    const kind = new URL(route.request().url()).pathname.split('/').filter(Boolean)[2];
    const body = kind === 'pokemon' ? pokemon : route.request().url().includes('?') ? { results: [{ name: 'bulbasaur', url: speciesUrl }] } : species;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
const open = async () => {
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).click();
    await page.locator('.record-shell[aria-busy="false"]').waitFor();
    await page.getByRole('heading', { name: 'Bulbasaur', exact: true }).waitFor();
};
const close = async () => {
    await page.getByRole('button', { name: 'Fechar registro da Pokédex', exact: true }).click();
    await page.locator('.record-shell').waitFor({ state: 'detached' });
};
try {
    await page.goto(process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await open();
    await page.waitForFunction(async urls => {
        const cache = await caches.open('myowndex-api-v5');
        return (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean);
    }, [listUrl, speciesUrl, pokemonUrl]);
    const weights = await page.evaluate(async urls => {
        const cache = await caches.open('myowndex-api-v5');
        return Promise.all(urls.map(async url => {
            const response = await cache.match(url), text = await response.text();
            return { reported: Number(response.headers.get('x-myowndex-bytes')), actual: new TextEncoder().encode(text).byteLength, data: JSON.parse(text) };
        }));
    }, [speciesUrl, pokemonUrl]);
    assert.ok(weights.every(row => row.reported === row.actual && row.data.name === 'bulbasaur'));
    await close();
    const before = requests.length;
    for (let index = 0; index < 3; index++) { await open(); await close(); }
    assert.equal(requests.length, before, 'warm-memory reopening makes no catalogue network requests');
    offline = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await open();
    assert.equal(requests.filter(row => row.offline).length, 0, 'fresh persisted snapshots satisfy the reload before the unavailable network');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ checks: ['native cache persists exact UTF-8 snapshots', 'three warm-memory reopenings', 'fresh-memory reload with unavailable catalogue network'], catalogueRequests: before, errors }, null, 2));
} catch (error) {
    await page.screenshot({ path: '/tmp/myowndex-api-cache-failure.png' });
    throw error;
} finally { await context.close(); await browser.close(); }

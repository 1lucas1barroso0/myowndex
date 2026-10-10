// Visual/performance acceptance for the shared 2D Pokémon world. Run against a
// loopback production build with the external Playwright/axe tools in VALIDACAO.md.
// Every persisted action belongs to this isolated browser context.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createRoomSnapshot, normalizeRoomSnapshot } from '../src/core/room.js';
import { isPokemonSpriteSource2D } from '../src/core/pokemonSpriteSources.js';

const require = createRequire(import.meta.url);
const axeSource = await fs.readFile(process.env.MYOWNDEX_AXE_PATH || require.resolve('axe-core/axe.min.js'), 'utf8');
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3014';
const source2D = source => {
    const url = new URL(source, baseUrl);
    return isPokemonSpriteSource2D(url.origin === new URL(baseUrl).origin ? url.pathname + url.search + url.hash : source);
};
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname), 'The seeded world audit only runs on loopback');
const outputDir = process.env.MYOWNDEX_WORLD_REPORT_DIR || '/tmp/myowndex-2d-world';
const collectFailures = process.env.MYOWNDEX_WORLD_COLLECT_FAILURES === '1';
await fs.mkdir(outputDir, { recursive: true });
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
let page = await context.newPage();
page.setDefaultTimeout(40000);
const errors = [], animationRequests = [], remoteWrites = [], report = [], performanceReport = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
    if (/\.(?:gif|apng)(?:[?#]|$)/i.test(request.url())) animationRequests.push({ url: request.url(), at: Date.now() });
});
await context.route('**/api/**', route => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.fallback();
    remoteWrites.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
    return route.abort('blockedbyclient');
});

const visibleSpriteState = () => page.locator('.pokemon-sized-sprite img').evaluateAll(images => {
    const modal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"],dialog[open]')].filter(element => element.getClientRects().length && !element.closest('[inert]')).at(-1);
    const visible = image => {
        const bounds = image.closest('.pokemon-sized-sprite').getBoundingClientRect(), style = getComputedStyle(image);
        return bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.bottom > 0 && bounds.left < innerWidth && bounds.top < innerHeight && style.visibility !== 'hidden' && style.display !== 'none' && !image.closest('[inert]') && (!modal || modal.contains(image));
    };
    return {
        mounted: images.length,
        visible: images.filter(visible).length,
        animated: images.filter(image => image.dataset.pokemonMotion === 'animated').length,
        offscreenAnimated: images.filter(image => !visible(image) && image.dataset.pokemonMotion === 'animated').length,
        visibleMissing: images.filter(visible).filter(image => !image.complete || !image.naturalWidth || !image.naturalHeight || Number(getComputedStyle(image).opacity) === 0).map(image => ({ alt: image.alt, src: image.getAttribute('src'), motion: image.dataset.pokemonMotion })),
        distorted: images.filter(visible).filter(image => {
            if (!image.naturalWidth || image.closest('.pokemon-sized-sprite').dataset.pokemonCrop !== 'authored-frames') return false;
            const r=image.getBoundingClientRect();
            return r.width>0&&r.height>0&&Math.abs((r.width/r.height)/(image.naturalWidth/image.naturalHeight)-1)>.015;
        }).map(image=>({alt:image.alt,src:image.getAttribute('src'),native:[image.naturalWidth,image.naturalHeight],rendered:[image.getBoundingClientRect().width,image.getBoundingClientRect().height]})),
        sources:images.filter(visible).map(image=>image.currentSrc),
    };
});
const settleSprites = async () => {
    await page.waitForFunction(() => {
        const modal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"],dialog[open]')].filter(element => element.getClientRects().length && !element.closest('[inert]')).at(-1);
        return [...document.querySelectorAll('.pokemon-sized-sprite img')].filter(image => {
            const r = image.closest('.pokemon-sized-sprite').getBoundingClientRect();
            return r.width && r.height && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && !image.closest('[inert]') && (!modal || modal.contains(image));
        }).every(image => image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) > 0);
    });
    await page.waitForTimeout(500); // Finite entrance transitions must finish before contrast checks.
};
const nav = async name => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.locator('.account-opening').waitFor({ state: 'hidden' });
};
const writeReport = () => fs.writeFile(`${outputDir}/report.json`, JSON.stringify({ report, performance: performanceReport, animationRequests: animationRequests.length, uniqueAnimationRequests: new Set(animationRequests.map(request => request.url)).size, errors, remoteWrites }, null, 2));

async function checkpoint(label) {
    await settleSprites();
    await page.addScriptTag({ content: axeSource });
    const metrics = await page.evaluate(async () => {
        const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).clipPath !== 'inset(50%)' && !element.closest('[inert],[aria-hidden="true"]') && (!element.closest('details:not([open])') || element.closest('details:not([open])').querySelector(':scope > summary')?.contains(element));
        const dialog = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(visible).at(-1), root = dialog || document;
        const controls = [...root.querySelectorAll('button,input,select,textarea,summary,a[href],[role="radio"]')].filter(element => visible(element) && !element.disabled && !element.closest('nextjs-portal'));
        const escaped = controls.filter(element => { const r = element.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).map(element => ({ label: element.getAttribute('aria-label') || element.innerText || element.name, class: element.className }));
        const smallTargets = controls.filter(element => {
            if (['checkbox', 'radio'].includes(element.type)) return false;
            const r = element.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5;
        }).map(element => ({ label: element.getAttribute('aria-label') || element.innerText || element.name, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
        const wordBreaks = [...root.querySelectorAll('h1,h2,h3,label,strong,button,summary')].filter(visible).filter(element => getComputedStyle(element).wordBreak === 'break-all').map(element => element.textContent.trim().slice(0,80));
        const audit = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return { width: innerWidth, scroll: document.documentElement.scrollWidth, escaped, smallTargets, wordBreaks, violations: audit.violations.map(entry => ({ id: entry.id, impact: entry.impact, targets: entry.nodes.map(node => node.target) })), dialog: dialog ? { width: dialog.clientWidth, scroll: dialog.scrollWidth } : null };
    });
    const sprites = await visibleSpriteState();
    sprites.non2D=sprites.sources.filter(source=>!source2D(source));
    report.push({ label, ...metrics, sprites });
    await writeReport();
    if (!collectFailures) {
        assert.equal(metrics.scroll, metrics.width, `${label}: page reflows without horizontal scrolling`);
        assert.deepEqual(metrics.escaped, [], `${label}: actions remain inside the viewport`);
        assert.deepEqual(metrics.smallTargets, [], `${label}: every touch control is at least 44px`);
        assert.deepEqual(metrics.wordBreaks, [], `${label}: names and labels do not break arbitrarily`);
        assert.deepEqual(metrics.violations, [], `${label}: WCAG 2/2.1 AA axe audit`);
        assert.deepEqual(sprites.visibleMissing, [], `${label}: visible Pokémon have a decoded, visible portrait`);
        assert.deepEqual(sprites.distorted, [], `${label}: native sprite canvases retain their intrinsic aspect ratio`);
        assert.deepEqual(sprites.non2D,[],`${label}: no rendered 3D model is displayed as a 2D sprite`);
        if (metrics.dialog) assert.ok(metrics.dialog.scroll <= metrics.dialog.width + 1, `${label}: dialog reflows`);
    }
    console.log(JSON.stringify({ label, width: metrics.width, sprites, violations: metrics.violations.length }));
}

async function authoredMotion(name) {
    await page.locator('#pokemon-search').fill(name);
    const card = page.getByRole('button', { name: `Consultar ${name} na Pokédex`, exact: true });
    await card.waitFor(); await card.scrollIntoViewIfNeeded();
    const image = card.locator('.pokemon-sized-sprite img');
    await page.waitForFunction(name => {
        const card = [...document.querySelectorAll('.dex-entry-main')].find(element => element.getAttribute('aria-label') === `Consultar ${name} na Pokédex`), image = card?.querySelector('img');
        return image?.dataset.pokemonMotion === 'animated' && image.complete && image.naturalWidth > 0;
    }, name);
    const original = await image.getAttribute('src'), style = await image.evaluate(element => ({ animation: getComputedStyle(element).animationName, transform: getComputedStyle(element).transform }));
    assert.match(original, /\.(?:gif|apng)(?:[?#]|$)/i, `${name}: authored 2D animation`);
    assert.ok(isPokemonSpriteSource2D(original),`${name}: changing frames come from a 2D sprite, never a rendered 3D model`);
    assert.equal(style.animation, 'none', `${name}: motion is in the sprite's authored frames`);
    assert.equal(style.transform, 'none', `${name}: anatomy stays undistorted`);
    await page.waitForTimeout(600); // Compare authored frames after the finite card entrance has settled.
    const frames = new Set();
    for (let i = 0; i < 12 && frames.size < 2; i++) {
        frames.add(createHash('sha256').update(await image.screenshot()).digest('hex'));
        await page.waitForTimeout(150);
    }
    assert.ok(frames.size >= 2, `${name}: the rendered Pokémon actually changes its frame`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(name => {
        const card = [...document.querySelectorAll('.dex-entry-main')].find(element => element.getAttribute('aria-label') === `Consultar ${name} na Pokédex`), image = card?.querySelector('img');
        return image?.dataset.pokemonMotion === 'static' && image.complete && image.naturalWidth > 0;
    }, name);
    const reducedSource = await image.getAttribute('src');
    assert.match(reducedSource, /\.png(?:[?#]|$)/i);
    assert.ok(isPokemonSpriteSource2D(reducedSource),`${name}: reduced motion keeps a 2D portrait`);
    const still = await image.screenshot(); await page.waitForTimeout(200);
    assert.ok(still.equals(await image.screenshot()), `${name}: reduced motion preserves its identity and stays still`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(name => {
        const card = [...document.querySelectorAll('.dex-entry-main')].find(element => element.getAttribute('aria-label') === `Consultar ${name} na Pokédex`);
        return card?.querySelector('img')?.dataset.pokemonMotion === 'animated';
    }, name);
    assert.equal(await image.getAttribute('src'), original, `${name}: restoring animation preserves the chosen source`);
    report.push({ label: `${name}: visible authored 2D frames and accessible motion preference`, frames: frames.size, original, reducedSource,source2D:true });
}

async function physicalScaleAndPortraits() {
    const token = (id, name, speciesId, side, x, y) => ({ id, name, speciesId, speciesName: speciesId === 669 ? 'flabebe' : 'wailord', sprite: `/sprites/${speciesId}.png`, side, x, y, level:20, currentHp:12, maxHp:20, stats:{ hp:20, attack:5, defense:5, 'special-attack':5, 'special-defense':5, speed:5 }, types:[speciesId === 669 ? 'fairy' : 'water'], moves:['tackle','','',''], pp:[9,null,null,null] });
    const seed = normalizeRoomSnapshot({ ...createRoomSnapshot('Escala e retratos'), phase:'batalha', round:3, tokens:[token('world-tiny','Flabébé',669,'ally',30,75),token('world-giant','Wailord',321,'opponent',70,25)] });
    await page.evaluate(seed => {
        localStorage.setItem('myowndex_live_room_v1', JSON.stringify({ code:'LOCAL',key:'world-scale-audit',role:'narrator',displayName:'Narrador',local:true }));
        localStorage.setItem('myowndex_local_room_v1', JSON.stringify({ code:'LOCAL',title:seed.title,revision:0,updatedAt:new Date().toISOString(),snapshot:seed,players:[],events:[],media:[] }));
    }, seed);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{ name:'Abrir a Central da Aventura',exact:true }).waitFor();
    await nav('Abrir a Central da Aventura');
    const field = page.locator('.battlefield-card');
    await field.waitFor();
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot);
    const baseline = await state();
    for (const width of [320,390,768,1280]) for (const theme of ['day','night']) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; },theme);
        const pane = page.locator('.room-mobile-nav').getByRole('button',{name:'Campo',exact:true});
        if (await pane.isVisible()) await pane.click();
        await field.scrollIntoViewIfNeeded();
        const party = field.getByRole('group',{name:'Pokémon em cena',exact:true});
        await party.waitFor();
        assert.equal(await party.locator('button').count(),2,'Each scene Pokémon has its own readable portrait');
        const scales = await field.locator('.room-token .pokemon-sized-sprite[data-pokemon-framing="scene"]').evaluateAll(sprites => sprites.map(sprite => ({ height:Number(sprite.dataset.pokemonHeightDm),scale:Number(sprite.dataset.pokemonScale),width:sprite.getBoundingClientRect().width,frameHeight:sprite.getBoundingClientRect().height })));
        assert.equal(scales.length,2,'Both battle participants share a documented scene scale');
        const tiny = scales.find(sprite=>sprite.height===1), giant = scales.find(sprite=>sprite.height===145);
        assert.ok(tiny&&giant,'The exact official 1dm and 145dm heights are retained');
        assert.ok(Math.abs(giant.scale/tiny.scale-145)<.001,'Shared scene scale keeps the exact 145:1 physical ratio');
        assert.ok(tiny.frameHeight>0&&giant.frameHeight>0&&Math.abs(tiny.frameHeight-giant.frameHeight/145)<.025,'The rendered scene body frames actually use the documented physical ratio');
        for (const name of ['Flabébé','Wailord']) {
            const button = party.getByRole('button',{name:new RegExp(`^Ver ${name}(?:,|$)`)});
            await button.scrollIntoViewIfNeeded();
            await button.click();
            const image = button.locator('img');
            await image.waitFor();
            await image.evaluate(image => image.complete&&image.naturalWidth>0 || new Promise(resolve=>image.addEventListener('load',resolve,{once:true})));
            const frame = await button.locator('.pokemon-sized-sprite').boundingBox();
            assert.ok(frame&&frame.width>=28&&frame.height>=28,`${name}: its independent portrait remains a protagonist`);
            await field.locator('.battlefield-focus').waitFor();
            assert.match(await field.locator('.battlefield-focus').innerText(),new RegExp(name));
            const focus = field.locator('.battlefield-focus .pokemon-sized-sprite');
            assert.equal(await focus.getAttribute('data-pokemon-framing'),'portrait','A selected Pokémon has a separate framed view');
        }
        await checkpoint(`Physical scene scale and independent portraits, ${width}px, ${theme}`);
        if ([390,768,1280].includes(width)) {
            await field.locator('.battlefield-board').scrollIntoViewIfNeeded();
            await settleSprites();
            await page.screenshot({path:`${outputDir}/battlefield-${width}-${theme}.png`});
            await field.locator('.battlefield-focus').scrollIntoViewIfNeeded();
            await settleSprites();
            await page.screenshot({path:`${outputDir}/battlefield-focus-${width}-${theme}.png`});
        }
        const after = await state();
        assert.deepEqual(after.tokens,baseline.tokens,'Selecting portraits preserves HP, PP, identity and battle positions');
        assert.equal(after.round,baseline.round,'Viewing a Pokémon never advances the round');
    }
    report.push({label:'Flabébé/Wailord physical scene ratio and individual protagonists',physicalRatio:145,viewports:4,themes:2});
}

async function touchDevices() {
    const mainPage=page;
    try {
        for (const device of [
            {name:'Phone',portrait:{width:390,height:844},landscape:{width:844,height:390}},
            {name:'Tablet',portrait:{width:768,height:1024},landscape:{width:1024,height:768}},
        ]) {
            const handheld=await browser.newContext({viewport:device.portrait,deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
            page=await handheld.newPage();page.setDefaultTimeout(40000);
            page.on('pageerror',error=>errors.push(error.message));
            await handheld.route('**/api/**',route=>{
                if (['GET','HEAD','OPTIONS'].includes(route.request().method())) return route.fallback();
                remoteWrites.push({method:route.request().method(),path:new URL(route.request().url()).pathname});return route.abort('blockedbyclient');
            });
            await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
            await page.getByRole('button',{name:'Consultar Bulbasaur na Pokédex',exact:true}).waitFor();
            assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true,`${device.name}: real touch input is emulated`);
            for (const [orientation,viewport] of [['portrait',device.portrait],['landscape',device.landscape]]) {
                await page.setViewportSize(viewport);
                for (const [view,name] of [['dex','Abrir a Pokédex'],['pc','Abrir o PC do Bill'],['guide','Abrir o Guia do Treinador'],['adventure','Abrir a Central da Aventura']]) {
                    await nav(name);await checkpoint(`${device.name}, touch/DPR2, ${orientation}, ${view}`);
                }
            }
            await handheld.close();
        }
    } catch (error) {
        await page.screenshot({path:`${outputDir}/touch-failure.png`}).catch(()=>{});
        await fs.writeFile(`${outputDir}/touch-failure.json`,JSON.stringify(await page.locator('.pokemon-sized-sprite').evaluateAll(frames=>frames.map(frame=>{const image=frame.querySelector('img'),r=frame.getBoundingClientRect();return {alt:image?.alt,src:image?.getAttribute('src'),motion:frame.dataset.pokemonMotion,native:[image?.naturalWidth,image?.naturalHeight],rect:r.toJSON(),inert:Boolean(frame.closest('[inert]')),visibility:getComputedStyle(frame).visibility,opacity:getComputedStyle(image||frame).opacity};})),null,2));
        throw error;
    } finally { page=mainPage; }
}

try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const openingStart = performance.now();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor();
    await settleSprites();
    const openingMs = Math.round(performance.now() - openingStart), initial = await visibleSpriteState();
    assert.ok(initial.mounted >= 60, 'The performance audit mounts a real full catalogue page');
    assert.ok(initial.visible > 0 && initial.visible < initial.mounted, 'The catalogue contains both visible and offscreen Pokémon');
    assert.equal(initial.offscreenAnimated, 0, 'Offscreen sprites do not keep active animated images');
    assert.ok(openingMs < 30000, 'The game remains interactive under a 4× CPU slowdown');
    performanceReport.push({ label: 'Initial catalogue with 4× CPU slowdown', openingMs, cpuRate: 4, ...initial });
    const last = page.locator('.dex-entry-main').last();
    const scrollStart = performance.now(); await last.scrollIntoViewIfNeeded(); await settleSprites();
    const afterScroll = await visibleSpriteState(), scrollReadyMs = Math.round(performance.now() - scrollStart);
    assert.equal(afterScroll.offscreenAnimated, 0, 'Scrolling releases all offscreen animated sources');
    assert.ok(afterScroll.animated > 0, 'Newly visible Pokémon resume their authored motion');
    assert.ok(scrollReadyMs < 15000, 'Newly visible Pokémon appear under 4× CPU slowdown');
    performanceReport.push({ label: 'Catalogue scroll with 4× CPU slowdown', scrollReadyMs, ...afterScroll });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => scrollTo(0,0));

    for (const name of ['Toedscool', 'Scovillain', 'Cinderace']) await authoredMotion(name);
    await page.locator('#pokemon-search').fill('');
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor();
    const views = [['dex','Abrir a Pokédex'],['pc','Abrir o PC do Bill'],['guide','Abrir o Guia do Treinador'],['adventure','Abrir a Central da Aventura']];
    for (const width of [320,390,768,1280]) for (const theme of ['day','night']) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        for (const [view, name] of views) {
            await nav(name); await checkpoint(`${view}, ${width}px, ${theme}`);
            if ([390,768,1280].includes(width)) await page.screenshot({ path: `${outputDir}/${view}-${width}-${theme}.png`, fullPage: true });
        }
    }
    await page.setViewportSize({ width:1280, height:900 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    for (const [view,name] of views) { await nav(name); await checkpoint(`${view}, 200% zoom`); }
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    await page.setViewportSize({ width:320, height:844 });
    await page.getByRole('button', { name:'Gerar Pokémon',exact:true }).first().click();
    const generator = page.locator('.generator-dialog');
    await generator.waitFor(); await checkpoint('Generator, 320px, basic options');
    for (const details of await generator.locator('.generator-customize').all()) if (!await details.evaluate(element => element.open)) await details.locator(':scope > summary').click();
    await checkpoint('Generator, 320px, all options');
    await page.getByRole('button', { name:'Fechar gerador', exact:true }).click();
    await page.getByRole('button', { name:'Abrir Dados',exact:true }).click();
    const dice = page.getByRole('dialog',{ name:'Dados',exact:true });
    await dice.getByRole('button',{ name:'Rolar 2d6',exact:true }).click();
    await dice.locator('.local-dice-result').waitFor();
    await checkpoint('Local dice: actual result at 320px');
    await dice.getByRole('button',{ name:'Fechar dados',exact:true }).click();
    await nav('Abrir o Guia do Treinador');
    assert.equal(await page.locator('.guide-rule-card').count(),40,'The visual reformulation preserves all forty rules');
    await page.emulateMedia({ reducedMotion:'reduce' });
    await checkpoint('Guide with reduced motion at 320px');
    await page.emulateMedia({ reducedMotion:'no-preference' });
    await touchDevices();
    await physicalScaleAndPortraits();
    const failedStates = report.filter(state => state.violations && (state.scroll !== state.width || state.escaped.length || state.smallTargets.length || state.wordBreaks.length || state.violations.length || state.sprites.visibleMissing.length || state.sprites.distorted.length || state.sprites.non2D.length || state.dialog && state.dialog.scroll > state.dialog.width + 1)).map(state => ({label:state.label,violations:state.violations,escaped:state.escaped,smallTargets:state.smallTargets,wordBreaks:state.wordBreaks,visibleMissing:state.sprites.visibleMissing,distorted:state.sprites.distorted,non2D:state.sprites.non2D}));
    assert.deepEqual(failedStates,[],'Every collected device, theme and zoom state meets the acceptance criteria');
    assert.deepEqual(errors,[],'No page runtime errors');
    assert.deepEqual(remoteWrites,[],'The visual audit never writes to remote APIs');
    await writeReport();
    console.log(`Passed ${report.length} 2D world checkpoints and ${performanceReport.length} bounded performance measurements.`);
} catch (error) {
    await page.screenshot({ path:`${outputDir}/failure.png`,fullPage:true }).catch(() => {});
    await writeReport();
    throw error;
} finally {
    await browser.close();
}

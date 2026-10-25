// Stress the real production UI in a disposable guest context, with slower CPU.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const species = JSON.parse(await fs.readFile(new URL("../src/data/species.json", import.meta.url)));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage(), errors = [], timings = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/pokemon-species?limit=*", route => route.fulfill({json: { results: species }}));
await context.route("**/api/**", route => ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.fallback() : route.abort());
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const timed = async (name, action) => {
    const start = Date.now(); await action();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const ms = Date.now() - start; timings.push({ name, ms });
    console.log(JSON.stringify({ name, ms }));
    assert.ok(ms < 5000, `${name} must remain responsive under CPU throttling: ${ms}ms`);
};
try {
    await page.goto(base, {waitUntil: "domcontentloaded"});
    await page.locator(".dex-entry").first().waitFor();
    while (await page.getByRole("button", {name: "Mostrar mais Pokémon", exact: true}).count()) {
        await page.getByRole("button", {name: "Mostrar mais Pokémon", exact: true}).click();
    }
    assert.equal(await page.locator(".dex-entry").count(), 1025, "the entire collection remains available");
    await page.locator("#main-content").evaluate(element => { element.scrollTop = 0; });
    await timed("favorite in full collection", async () => {
        await page.locator(".dex-favorite").first().click();
        await page.waitForFunction(() => document.querySelector(".dex-favorite")?.getAttribute("aria-pressed") === "true");
    });
    const search = page.locator("#pokemon-search");
    await timed("search in full collection", async () => {
        await search.fill("pikachu");
        await page.waitForFunction(() => document.querySelectorAll(".dex-entry").length === 1);
    });
    assert.equal(await search.inputValue(), "pikachu");
    await search.fill("");
    await page.waitForFunction(() => {
        const grid = document.querySelector('.dex-grid'), card = grid?.firstElementChild;
        if (!card || !document.querySelector('.dex-count')?.textContent.startsWith('1025 ')) return false;
        const style = getComputedStyle(grid), columns = style.gridTemplateColumns.split(/\s+/).length;
        const row = card.getBoundingClientRect().height + (parseFloat(style.rowGap) || 0);
        const required = columns * (Math.ceil(document.querySelector('#main-content').clientHeight / row) + 1);
        return grid.children.length >= required && grid.children.length % columns === 0 && grid.children.length < 100;
    });
    for (const [width, height] of [[320,653],[390,844],[768,844],[1440,900],[844,390]]) {
        await page.setViewportSize({width, height});
        if (width <= 700) await page.locator(".app-curtain-grip").press("End");
        for (const [name, view] of [["Abrir a Central da Aventura","room"],["Abrir o PC do Bill","teambuilder"],["Abrir o Guia do Treinador","guide"],["Abrir a Pokédex","pokedex"]]) {
            await timed(`${width}x${height}: ${view}`, async () => {
                await page.getByRole("button", {name, exact:true}).click();
                await page.waitForFunction(view => document.querySelector(".app-root")?.dataset.gameScreen === view && document.querySelector(".app-main-shell")?.textContent.trim().length > 10, view);
            });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        for (const [open, close] of [["Abrir Dados","Fechar dados"],["Gerar Pokémon","Fechar gerador"],["Entrar ou criar conta","Fechar conta"]]) {
            await timed(`${width}: ${open}`, async () => {
                await page.getByRole("button",{name:open,exact:true}).click();
                await page.getByRole("button",{name:close,exact:true}).waitFor();
            });
            await page.getByRole("button",{name:close,exact:true}).click();
        }
        assert.equal(await page.evaluate(() => scrollY),0);
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({cpuSlowdown:4,timings,errors}));
} finally { await context.close(); await browser.close(); }

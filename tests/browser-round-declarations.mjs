// Real round preparation and action guards in isolated guest adventures and practice.
// Catalog responses are deterministic; no account or shared-room writes are made.
import assert from "node:assert/strict";
import { createRoomSnapshot, normalizeRoomSnapshot } from "../src/core/room.js";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3001";
const checks = [], errors = [];
const token = (id, name, speed, extra = {}) => ({ id, name, speciesId: id === "slow" ? 1 : 25,
    speciesName: id === "slow" ? "bulbasaur" : "pikachu", side: id === "slow" ? "opponent" : "ally",
    level: 20, maxHp: 200, currentHp: 200, types: ["normal"], originalTypes: ["normal"],
    stats: { hp: 200, attack: 5, defense: 5, "special-attack": 5, "special-defense": 5, speed },
    originalStats: { hp: 4000, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed },
    moves: ["tackle", "quick-attack", "growl", "protect"], pp: [35, 30, 0, 10], ...extra });
const seed = normalizeRoomSnapshot({ ...createRoomSnapshot("Escolhas da rodada"), phase: "batalha", tokens: [
    token("fast", "Pikachu", 1000), token("slow", "Bulbasaur", 1),
    token("hidden", "Mew", 10, { hidden: true }), token("fainted", "Charmander", 10, { currentHp: 0 }),
    token("captured", "Mewtwo", 10, { captured: true }),
] });
const move = name => ({ name, pp: name === "quick-attack" ? 30 : name === "protect" ? 10 : 35,
    accuracy: 100, power: ["growl", "protect"].includes(name) ? null : 40,
    priority: name === "quick-attack" ? 1 : name === "protect" ? 4 : 0, type: { name: "normal" },
    damage_class: { name: ["growl", "protect"].includes(name) ? "status" : "physical" },
    target: { name: name === "protect" ? "user" : "selected-pokemon" },
    effect_entries: [{ language: { name: "en" }, effect: "Inflicts regular damage." }], stat_changes: [],
    meta: { ailment: { name: "none" }, category: { name: "damage" }, crit_rate: 0 } });
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); };

try {
    for (const mode of ["practice", "adventure"]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(`${mode}: ${error.message}`));
        let releaseFailure;
        const failedRequest = new Promise(resolve => { releaseFailure = resolve; });
        let protectRequests = 0;
        await context.route("https://pokeapi.co/api/v2/**", async route => {
            const path = new URL(route.request().url()).pathname.split("/").filter(Boolean);
            const kind = path[2], name = path[3];
            if (kind === "move" && name === "protect" && ++protectRequests === 1) {
                await failedRequest;
                await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
                return;
            }
            const body = kind === "move" ? move(name) : { id: Number(name) || 1, name, abilities: [], moves: [],
                effect_entries: [], flavor_text_entries: [], types: [{ slot: 1, type: { name: "normal" } }],
                stats: [], sprites: {}, species: { name: "bulbasaur" } };
            await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        });
        await context.addInitScript(({ mode, seed }) => {
            if (localStorage.getItem("round-declarations-seeded")) return;
            localStorage.setItem("round-declarations-seeded", "true");
            if (mode === "practice") localStorage.setItem("myowndex_local_dice_room_v1", JSON.stringify(seed));
            else {
                localStorage.setItem("myowndex_live_room_v1", JSON.stringify({ code: "LOCAL", key: "local-qa", role: "narrator", displayName: "Narrador", local: true }));
                localStorage.setItem("myowndex_local_room_v1", JSON.stringify({ code: "LOCAL", title: seed.title, revision: 0,
                    updatedAt: new Date().toISOString(), snapshot: seed, players: [], events: [], media: [] }));
            }
        }, { mode, seed });
        const state = () => page.evaluate(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return mode === "practice" ? saved : saved?.snapshot;
        }, mode);
        const waitState = async (tokenId, field, value) => page.waitForFunction(({ mode, tokenId, field, value }) => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            const room = mode === "practice" ? saved : saved?.snapshot;
            return (tokenId ? room?.tokens.find(token => token.id === tokenId)?.[field] : room?.[field]) === value;
        }, { mode, tokenId, field, value });
        const pane = async name => {
            const nav = page.locator(".room-mobile-nav");
            if (mode === "adventure" && await nav.isVisible()) await nav.getByRole("button", { name, exact: true }).click();
        };
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.locator(".app-nav").waitFor();
        if (mode === "practice") {
            await page.getByRole("button", { name: "Abrir Dados", exact: true }).filter({ visible: true }).first().click();
            await page.getByRole("dialog", { name: "Dados", exact: true }).getByRole("button", { name: "Campo", exact: true }).click();
        } else {
            await page.getByRole("button", { name: "Abrir a Central da Aventura", exact: true }).click();
            await page.locator(".room-app").waitFor();
            await pane("Campo");
        }
        const order = page.locator(".turn-order");
        await order.waitFor();
        const choice = name => order.getByRole("combobox", { name: `Movimento de ${name} nesta rodada`, exact: true });
        assert.equal(await order.getByRole("combobox").count(), 2);
        for (const name of ["Mew", "Charmander", "Mewtwo"]) assert.equal(await choice(name).count(), 0);
        assert.deepEqual(await choice("Bulbasaur").locator("option").allTextContents(), ["Outra ação", "Tackle", "Quick Attack", "Growl", "Protect"]);
        checks.push(`${mode}: preparation includes only available Pokémon and every learned move plus Outra ação`);

        for (const theme of ["normal", "night"]) for (const width of [320, 390, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
            await pane("Campo");
            const layout = await order.evaluate(element => {
                const bounds = element.getBoundingClientRect(), brokenWords = [];
                const visible = node => node.getClientRects().length && !node.closest("details:not([open])");
                for (const target of element.querySelectorAll(".round-choice-identity strong,.room-select-value,.turn-order-empty")) {
                    if (!visible(target)) continue;
                    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
                    for (let node = walker.nextNode(); node; node = walker.nextNode()) for (const match of node.textContent.matchAll(/[\p{L}\p{N}]+/gu)) {
                        const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
                        const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => Math.round(rect.top)));
                        if (lines.size > 1) brokenWords.push(match[0]);
                    }
                }
                return { outside: bounds.left < -1 || bounds.right > innerWidth + 1, overflow: element.scrollWidth > element.clientWidth + 1,
                    brokenWords, smallTargets: [...element.querySelectorAll("button,select,summary")].filter(visible).filter(node => node.getBoundingClientRect().height < 43.5).map(node => node.textContent.trim()) };
            });
            assert.equal(layout.outside, false, `${mode}/${theme}/${width}: choices fit viewport`);
            assert.equal(layout.overflow, false, `${mode}/${theme}/${width}: no horizontal overflow`);
            assert.deepEqual(layout.brokenWords, [], `${mode}/${theme}/${width}: complete words`);
            assert.deepEqual(layout.smallTargets, [], `${mode}/${theme}/${width}: touch targets`);
        }
        checks.push(`${mode}: preparation fits 320/390/1280 in both themes with full words and 44px controls`);
        await page.setViewportSize({ width: 390, height: 844 });
        await pane("Ações");
        const combat = page.locator(".room-tool").filter({ has: page.getByText(mode === "practice" ? "Usar um movimento" : "Resolver um movimento", { exact: true }) });
        const actionButton = name => mode === "practice"
            ? combat.getByRole("button", { name: `Usar ${name}`, exact: true })
            : combat.locator(".room-primary-button").last();
        await openDetails(combat);
        await combat.getByRole("combobox", { name: "Usuário", exact: true }).selectOption("slow");
        await combat.getByRole("combobox", { name: "Movimento", exact: true }).selectOption("quick-attack");
        assert.equal((await state()).tokens.find(token => token.id === "slow").declaredMove, "");
        assert.equal((await state()).tokens.find(token => token.id === "slow").priority, 0);
        checks.push(`${mode}: browsing a move never silently declares it`);
        await pane("Campo");
        const initialPp = (await state()).tokens.map(token => token.pp);
        await choice("Bulbasaur").selectOption("protect");
        await order.getByRole("status").filter({ hasText: "Confirmando" }).waitFor();
        assert.equal(await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).isDisabled(), true);
        assert.deepEqual((await state()).initiative, []);
        releaseFailure();
        await order.getByRole("alert").filter({ hasText: "Escolha novamente" }).waitFor();
        assert.equal(await choice("Bulbasaur").inputValue(), "");
        assert.equal(await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).isEnabled(), true);
        assert.deepEqual((await state()).tokens.map(token => token.pp), initialPp);
        await choice("Bulbasaur").selectOption("protect");
        await waitState("slow", "declaredMove", "protect");
        assert.equal(protectRequests, 2, "explicit retry requests a fresh reference after failure");
        assert.equal(await order.getByRole("alert").count(), 0);
        await choice("Bulbasaur").selectOption("");
        await waitState("slow", "declaredMove", "");
        checks.push(`${mode}: pending references lock initiative, failure restores the choice, and immediate retry recovers`);
        await choice("Bulbasaur").selectOption("growl");
        await order.getByRole("alert").filter({ hasText: "sem PP" }).waitFor();
        assert.equal(await choice("Bulbasaur").inputValue(), "");
        assert.deepEqual((await state()).tokens.map(token => token.pp), initialPp);
        assert.equal(await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).isEnabled(), true);
        checks.push(`${mode}: zero PP choice is rejected without changing PP or leaving initiative blocked`);
        await choice("Bulbasaur").selectOption("quick-attack");
        await waitState("slow", "declaredMove", "quick-attack");
        await choice("Pikachu").selectOption("tackle");
        await waitState("fast", "declaredMove", "tackle");
        assert.deepEqual((await state()).tokens.map(token => token.pp), initialPp);
        await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).click();
        await waitState("", "turnIndex", 0);
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.initiative[0] === "slow";
        }, mode);
        assert.deepEqual((await state()).initiative, ["slow", "fast"]);
        assert.equal(await order.locator(".round-declarations").count(), 0);
        checks.push(`${mode}: declared Quick Attack precedes much higher Speed and choices close once the round starts`);
        await pane("Ações");
        await openDetails(combat);
        await combat.getByRole("combobox", { name: "Usuário", exact: true }).selectOption("fast");
        await actionButton("Tackle").waitFor();
        await combat.getByRole("status").filter({ hasText: "Aguarde o turno" }).waitFor();
        assert.equal(await actionButton("Tackle").isDisabled(), true);
        await combat.getByRole("combobox", { name: "Usuário", exact: true }).selectOption("slow");
        assert.equal(await combat.getByRole("combobox", { name: "Movimento", exact: true }).isDisabled(), true);
        await actionButton("Quick Attack").waitFor();
        await actionButton("Quick Attack").click();
        await waitState("slow", "lastActionRound", 1);
        await combat.getByRole("status").filter({ hasText: "já agiu" }).waitFor();
        assert.equal(await actionButton("Quick Attack").isDisabled(), true);
        assert.equal((await state()).tokens.find(token => token.id === "slow").pp[1], 29);
        assert.equal((await state()).tokens.find(token => token.id === "fast").pp[0], 35);
        await pane("Campo");
        assert.match(await order.locator("li[aria-current='step']").innerText(), /Bulbasaur.*Ação feita/s);
        assert.equal(await order.locator("li[aria-current='step'] .turn-order-done").innerText(), "✓");
        checks.push(`${mode}: only the chosen move acts on its own turn and a second action cannot spend PP again`);
        await pane("Campo");
        await order.getByRole("button", { name: "Próximo turno", exact: true }).click();
        await waitState("", "turnIndex", 1);
        await pane("Ações");
        await actionButton("Tackle").waitFor();
        await actionButton("Tackle").click();
        await waitState("fast", "lastActionRound", 1);
        assert.equal((await state()).tokens.find(token => token.id === "fast").pp[0], 34);
        await pane("Campo");
        await order.getByRole("button", { name: "Encerrar rodada", exact: true }).click();
        await waitState("", "round", 2);
        assert.deepEqual((await state()).initiative, []);
        assert.ok((await state()).tokens.every(token => token.declaredMove === "" && token.priority === 0));
        for (const name of ["Pikachu", "Bulbasaur"]) assert.equal(await choice(name).inputValue(), "");
        await choice("Pikachu").selectOption("quick-attack");
        await waitState("fast", "declaredMove", "quick-attack");
        await choice("Bulbasaur").selectOption("tackle");
        await waitState("slow", "declaredMove", "tackle");
        await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).click();
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.initiative[0] === "fast";
        }, mode);
        assert.deepEqual((await state()).initiative, ["fast", "slow"]);
        checks.push(`${mode}: ending clears choices and permits a fresh action order in the next round`);
        await context.close();
    }
    assert.deepEqual(errors, []);
    checks.push("no runtime errors");
} catch (error) {
    for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
        await page.screenshot({ path: `/tmp/myowndex-round-declarations-failure-${index}.png` }).catch(() => {});
        console.error(await page.locator(".turn-order").innerText().catch(() => "Turn order unavailable"));
        console.error(await page.locator(".combat-is-compact").innerText().catch(() => "Compact combat unavailable"));
    }
    throw error;
} finally {
    await browser.close();
    console.log(JSON.stringify({ checks, errors }, null, 2));
}

// Real initiative engines, isolated guest storage, no account or shared-room writes.
// Exercises the same visible round flow in the adventure and the practice field.
import assert from "node:assert/strict";
import { createRoomSnapshot, normalizeRoomSnapshot } from "../src/core/room.js";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3001";
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const checks = [], errors = [];
const token = (id, name, speed, extra = {}) => ({ id, name, speciesId: id === "slow" ? 1 : 25,
    speciesName: id === "slow" ? "bulbasaur" : "pikachu", side: id === "slow" ? "opponent" : "ally",
    level: 20, maxHp: 20, currentHp: 20, types: ["normal"], originalTypes: ["normal"],
    stats: { hp: 20, attack: 5, defense: 5, "special-attack": 5, "special-defense": 5, speed },
    originalStats: { hp: 200, attack: 50, defense: 50, "special-attack": 50, "special-defense": 50, speed },
    moves: ["tackle", "quick-attack", "", ""], pp: [35, 30, null, null], ...extra });
const seed = normalizeRoomSnapshot({ ...createRoomSnapshot("Nossa batalha"), phase: "batalha", tokens: [
    token("fast", "Pikachu", 1000),
    token("slow", "Bulbasaur", 1, { declaredMove: "quick-attack", priority: 1, status: "burn" }),
    token("hidden", "Mew", 10, { hidden: true }),
    token("fainted", "Charmander", 10, { currentHp: 0 }),
] });
const move = name => ({ name, pp: name === "quick-attack" ? 30 : 35, accuracy: 100, power: 40,
    priority: name === "quick-attack" ? 1 : 0, type: { name: "normal" }, damage_class: { name: "physical" },
    target: { name: "selected-pokemon" }, effect_entries: [{ language: { name: "en" }, effect: "Inflicts regular damage." }],
    stat_changes: [], meta: { ailment: { name: "none" }, category: { name: "damage" }, crit_rate: 0 } });
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); };

try {
    for (const mode of ["practice", "adventure"]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(`${mode}: ${error.message}`));
        await context.route("https://pokeapi.co/api/v2/**", async route => {
            const path = new URL(route.request().url()).pathname.split("/").filter(Boolean);
            const kind = path[2], name = path[3];
            const body = kind === "move" ? move(name) : { id: Number(name) || 1, name, abilities: [], moves: [],
                effect_entries: [], flavor_text_entries: [], types: [{ slot: 1, type: { name: "normal" } }],
                stats: [], sprites: {}, species: { name: "bulbasaur" } };
            await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        });
        await context.addInitScript(({ mode, seed }) => {
            if (localStorage.getItem("turn-order-seeded")) return;
            localStorage.setItem("turn-order-seeded", "true");
            if (mode === "practice") localStorage.setItem("myowndex_local_dice_room_v1", JSON.stringify(seed));
            else {
                localStorage.setItem("myowndex_live_room_v1", JSON.stringify({ code: "LOCAL", key: "local-qa", role: "narrator", displayName: "Narrador", local: true }));
                localStorage.setItem("myowndex_local_room_v1", JSON.stringify({ code: "LOCAL", title: seed.title, revision: 0,
                    updatedAt: new Date().toISOString(), snapshot: seed, players: [], events: [], media: [] }));
            }
        }, { mode, seed });
        const state = () => page.evaluate(mode => {
            const key = mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1";
            const saved = JSON.parse(localStorage.getItem(key) || "null");
            return mode === "practice" ? saved : saved?.snapshot;
        }, mode);
        const rollCount = () => page.evaluate(mode => mode === "practice"
            ? JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3") || "[]").filter(entry => entry.spec.action === "initiative").length
            : JSON.parse(localStorage.getItem("myowndex_local_room_v1") || "{}").events?.filter(entry => entry.payload?.text?.startsWith("Ordem da rodada:")).length || 0, mode);
        const pane = async name => {
            const nav = page.locator(".room-mobile-nav");
            if (mode === "adventure" && await nav.isVisible()) await nav.getByRole("button", { name, exact: true }).click();
        };
        const enter = async () => {
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
            await page.locator(".turn-order").waitFor();
        };
        await enter();
        let order = page.locator(".turn-order");
        assert.equal(await order.getByRole("button", { name: "Próximo turno", exact: true }).count(), 0);
        assert.equal(await order.getByRole("button", { name: "Encerrar rodada", exact: true }).count(), 0);
        assert.equal(await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).isEnabled(), true);
        assert.equal(await order.locator(".local-field-initiative-help").evaluate(element => element.open), false);
        await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).click();
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.initiative.length === 2;
        }, mode);
        assert.deepEqual((await state()).initiative, ["slow", "fast"], "move priority precedes even a much higher Speed");
        assert.equal(await order.locator("li[aria-current='step']").count(), 1);
        assert.match(await order.locator("li[aria-current='step']").innerText(), /Bulbasaur.*Agora/s);
        assert.equal(await order.getByRole("button", { name: "Refazer ordem", exact: true }).count(), 0);
        assert.equal(await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).count(), 0);
        checks.push(`${mode}: one action per state and priority orders only the two active visible Pokémon`);

        await order.getByRole("button", { name: "Próximo turno", exact: true }).click();
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.turnIndex === 1;
        }, mode);
        assert.equal((await state()).round, 1);
        assert.match(await order.locator("li").first().innerText(), /Já jogou/);
        assert.match(await order.locator("li[aria-current='step']").innerText(), /Pikachu.*Agora/s);
        assert.equal(await order.getByRole("button", { name: "Próximo turno", exact: true }).count(), 0);
        assert.equal(await order.getByRole("button", { name: "Encerrar rodada", exact: true }).count(), 1);
        const firstCount = await rollCount();
        assert.equal(firstCount, 1);
        await enter();
        order = page.locator(".turn-order");
        assert.equal((await state()).turnIndex, 1, "reopening resumes the actual current turn");
        assert.equal(await rollCount(), firstCount, "opening never generates another initiative roll");
        checks.push(`${mode}: advancing and reopening preserve the established order and its one receipt`);

        await order.getByRole("button", { name: "Encerrar rodada", exact: true }).click();
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.round === 2;
        }, mode);
        const nextRound = await state();
        assert.deepEqual(nextRound.initiative, []);
        assert.equal(nextRound.turnIndex, 0);
        assert.equal(nextRound.tokens.find(token => token.id === "slow").currentHp, 19, "burn applies once at the round end");
        assert.ok(nextRound.tokens.every(token => token.declaredMove === "" && token.priority === 0));
        await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).waitFor();
        assert.equal(await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).count(), 1);
        assert.equal(await order.locator(".turn-order-list li").count(), 0);
        checks.push(`${mode}: end round applies effects, clears declarations, and waits for fresh initiative`);

        await pane("Ações");
        const combat = page.locator(".room-tool").filter({ has: page.getByText(mode === "practice" ? "Usar um movimento" : "Resolver um movimento", { exact: true }) });
        await openDetails(combat);
        await combat.getByRole("combobox", { name: "Usuário", exact: true }).selectOption("fast");
        await combat.getByRole("combobox", { name: "Movimento", exact: true }).selectOption("quick-attack");
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.tokens.find(token => token.id === "fast")?.priority === 1;
        }, mode);
        await pane("Campo");
        await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).click();
        await page.waitForFunction(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return (mode === "practice" ? saved : saved?.snapshot)?.initiative[0] === "fast";
        }, mode);
        assert.deepEqual((await state()).initiative, ["fast", "slow"], "a new round applies new move declarations");
        assert.equal(await rollCount(), 2);
        checks.push(`${mode}: new moves and a new initiative produce the next round's order`);

        for (const theme of ["normal", "night"]) for (const width of [320, 390, 768, 980, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
            await pane("Campo");
            const layout = await order.evaluate(element => {
                const bounds = element.getBoundingClientRect();
                const visible = node => node.getClientRects().length && !node.closest("details:not([open])");
                return { outside: bounds.left < -1 || bounds.right > innerWidth + 1, overflow: element.scrollWidth > element.clientWidth + 1,
                    targets: [...element.querySelectorAll("button,summary")].filter(visible).filter(node => node.getBoundingClientRect().height < 43.5).map(node => node.textContent.trim()) };
            });
            assert.equal(layout.outside, false, `${mode}/${theme}/${width}: order stays inside the viewport`);
            assert.equal(layout.overflow, false, `${mode}/${theme}/${width}: turn order has no horizontal overflow`);
            assert.deepEqual(layout.targets, [], `${mode}/${theme}/${width}: touch controls stay comfortable`);
        }
        checks.push(`${mode}: turn order fits 320–1440px with touch targets in both themes`);
        await context.close();
    }
    assert.deepEqual(errors, []);
    checks.push("no runtime errors");
} catch (error) {
    for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
        await page.screenshot({ path: `/tmp/myowndex-turn-order-failure-${index}.png`, fullPage: true }).catch(() => {});
        console.error(await page.locator(".turn-order").innerText().catch(() => "Turn order unavailable"));
    }
    throw error;
} finally {
    await browser.close();
    console.log(JSON.stringify({ checks, errors }, null, 2));
}

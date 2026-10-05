// Isolated guest state and real game engines; no shared room/account writes.
import assert from "node:assert/strict";
import { createRoomSnapshot, normalizeRoomSnapshot } from "../src/core/room.js";
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3001";
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const checks = [], errors = [];
const actor = (id, name, speed, extra = {}) => ({ id, name, speciesId: id === "fast" ? 25 : 1,
    speciesName: id === "fast" ? "pikachu" : "bulbasaur", side: id === "fast" ? "ally" : "opponent",
    level: 20, maxHp: 200, currentHp: 200, types: ["normal"], moves: ["tackle"], pp: [35],
    originalStats: { hp: 2000, attack: 50, defense: 50, "special-attack": 50, "special-defense": 50, speed },
    ...extra });
const move = { name: "tackle", accuracy: 100, power: 40, pp: 35, priority: 0, type: { name: "normal" },
    damage_class: { name: "physical" }, target: { name: "selected-pokemon" },
    effect_entries: [{ language: { name: "en" }, effect: "Inflicts regular damage." }], stat_changes: [],
    meta: { ailment: { name: "none" }, category: { name: "damage" }, crit_rate: 0 } };
const open = async locator => { if (!await locator.evaluate(node => node.open)) await locator.locator(":scope > summary").click(); };
try {
    for (const mode of ["practice", "adventure"]) {
        const seed = normalizeRoomSnapshot({ ...createRoomSnapshot("Uma nova batalha"), phase: "batalha", battleStarted: mode !== "practice",
            tokens: [actor("fast", "Pikachu", 1000, { currentHp: 190, friendship: 95, xp: 2,
                item: "", traitState: { item: { originalId: "focus-sash", consumed: true, consumedRound: 1 } } }),
                actor("slow", "Bulbasaur", 1), actor("fainted", "Charmander", 1, { currentHp: 0, hidden: true })],
            hitKillProtectionUsed: mode === "adventure" ? ["token:fast"] : [],
            hitKillProtectionDisabled: mode === "adventure" ? ["token:slow"] : [] });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(`${mode}: ${error.message}`));
        await context.route("https://pokeapi.co/api/v2/**", async route => {
            const path = new URL(route.request().url()).pathname.split("/").filter(Boolean);
            const kind = path[2], name = path[3];
            await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(kind === "move" ? move : {
                id: Number(name) || 1, name, abilities: [], moves: [], effect_entries: [], flavor_text_entries: [],
                types: [{ slot: 1, type: { name: "normal" } }], stats: [], sprites: {}, species: { name: "bulbasaur" }, capture_rate: 45,
            }) });
        });
        await context.addInitScript(({ mode, seed }) => {
            if (localStorage.getItem("battle-lifecycle-seeded")) return;
            localStorage.setItem("battle-lifecycle-seeded", "true");
            if (mode === "practice") localStorage.setItem("myowndex_local_dice_room_v1", JSON.stringify(seed));
            else {
                localStorage.setItem("myowndex_live_room_v1", JSON.stringify({ code: "LOCAL", key: "qa", role: "narrator", displayName: "Narrador", local: true }));
                localStorage.setItem("myowndex_local_room_v1", JSON.stringify({ code: "LOCAL", title: seed.title, revision: 0,
                    snapshot: seed, players: [], events: [], media: [], updatedAt: new Date().toISOString() }));
            }
        }, { mode, seed });
        const state = () => page.evaluate(mode => {
            const saved = JSON.parse(localStorage.getItem(mode === "practice" ? "myowndex_local_dice_room_v1" : "myowndex_local_room_v1") || "null");
            return mode === "practice" ? saved : saved?.snapshot;
        }, mode);
        const wait = async predicate => { for (let attempt = 0; attempt < 100; attempt++) { const value = await state(); if (predicate(value)) return value; await page.waitForTimeout(100); } throw new Error(`${mode}: state did not reach its expected value`); };
        const pane = async () => {
            const nav = page.locator(".room-mobile-nav");
            if (mode === "adventure" && await nav.isVisible()) await nav.getByRole("button", { name: "Campo", exact: true }).click();
        };
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.locator(".app-nav").waitFor();
        if (mode === "practice") {
            await page.getByRole("button", { name: "Abrir Dados", exact: true }).filter({ visible: true }).first().click();
            await page.getByRole("dialog", { name: "Dados", exact: true }).getByRole("button", { name: "Campo", exact: true }).click();
        } else {
            await page.getByRole("button", { name: "Abrir a Central da Aventura", exact: true }).click();
            await page.locator(".room-app").waitFor();
            await pane();
        }
        const order = page.locator(".turn-order");
        await order.waitFor();
        let before = await wait(value => value?.tokens?.length === 3);
        if (mode === "practice") {
            assert.match(await order.locator(".turn-order-round").innerText(), /Treino livre/);
            const combat = page.locator(".local-pokemon-dice .room-tool").filter({ has: page.getByText("Usar um movimento", { exact: true }) });
            await open(combat);
            await combat.getByRole("combobox", { name: "Usuário", exact: true }).selectOption("fast");
            await combat.getByRole("combobox", { name: "Movimento", exact: true }).selectOption("tackle");
            await combat.getByRole("combobox", { name: "Alvo", exact: true }).selectOption("slow");
            const resolve = combat.getByRole("button", { name: /^Usar Tackle$/ });
            await resolve.click();
            before = await wait(value => value.tokens.find(token => token.id === "fast").pp[0] === 34);
            assert.equal(before.battleStarted, false);
            assert.equal(before.tokens.find(token => token.id === "fast").lastActionRound, 1);
            await resolve.click();
            before = await wait(value => value.tokens.find(token => token.id === "fast").pp[0] === 33);
            assert.equal(before.battleStarted, false);
            checks.push("practice: repeated free training spends PP without creating an ordered battle");
        }
        const resourcesBefore = before.tokens.map(token => ({ id: token.id, hp: token.currentHp, pp: token.pp }));
        await order.getByRole("combobox", { name: "Movimento de Pikachu nesta rodada", exact: true }).selectOption("tackle");
        await wait(value => value.tokens.find(token => token.id === "fast").declaredMove === "tackle");
        await order.getByRole("button", { name: "Rolar iniciativa", exact: true }).click();
        const rolled = await wait(value => value.initiative.length === 2);
        assert.equal(rolled.battleStarted, true);
        assert.equal(rolled.tokens.find(token => token.id === "fast").declaredMove, "tackle");
        assert.equal(rolled.tokens.find(token => token.id === "fast").lastActionRound, 0);
        for (const resource of resourcesBefore) {
            const token = rolled.tokens.find(candidate => candidate.id === resource.id);
            assert.equal(token.currentHp, resource.hp);
            assert.deepEqual(token.pp, resource.pp);
        }
        checks.push(`${mode}: initiative starts a real round, keeps declarations and preserves HP/PP`);
        const help = mode === "practice" ? page.locator(".local-pokemon-dice .room-tool").filter({ has: page.getByText("Sobre o campo", { exact: true }) }) : page.locator(".room-phase-help");
        await open(help);
        assert.equal(await help.getByRole("button", { name: "Nova batalha", exact: true }).isEnabled(), false);
        checks.push(`${mode}: New battle cannot restart an active round`);
        await order.getByRole("button", { name: "Próximo turno", exact: true }).click();
        await wait(value => value.turnIndex === 1);
        await order.getByRole("button", { name: "Encerrar rodada", exact: true }).click();
        const ended = await wait(value => value.round === 2 && !value.initiative.length);
        assert.equal(ended.battleStarted, true);
        if (mode === "practice") {
            const combat = page.locator(".local-pokemon-dice .room-tool").filter({ has: page.getByText("Usar um movimento", { exact: true }) });
            await open(combat);
            assert.equal(await combat.getByRole("button", { name: /^Usar Tackle$/ }).isEnabled(), false);
            assert.match(await combat.innerText(), /role a iniciativa/);
        } else {
            for (const phase of ["Exploração", "Interpretação", "Intervalo", "Batalha"]) {
                await page.locator(".room-phase-options").getByRole("radio", { name: new RegExp(`^${phase}\\.`) }).click();
                await wait(value => value.phase === ({ Exploração: "exploracao", Interpretação: "interpretacao", Intervalo: "intervalo", Batalha: "batalha" })[phase]);
                const current = await state();
                for (const key of ["battleStarted", "round", "hitKillProtectionUsed", "hitKillProtectionDisabled", "trainerInterventions"]) assert.deepEqual(current[key], ended[key]);
            }
        }
        checks.push(`${mode}: round end waits for initiative and phase changes preserve battle resources`);
        await pane();
        await open(help);
        const frozen = await state();
        await help.getByRole("button", { name: "Nova batalha", exact: true }).click();
        let confirmation = page.getByRole("alertdialog", { name: "Começar uma nova batalha?", exact: true });
        await confirmation.waitFor();
        await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click();
        assert.deepEqual(await state(), frozen);
        checks.push(`${mode}: canceling New battle preserves the complete state`);
        await help.getByRole("button", { name: "Nova batalha", exact: true }).click();
        confirmation = page.getByRole("alertdialog", { name: "Começar uma nova batalha?", exact: true });
        await confirmation.getByRole("button", { name: "Começar batalha", exact: true }).click();
        await confirmation.waitFor({ state: "hidden" });
        const fresh = await wait(value => value.round === 1 && value.tokens.every(token => token.lastActionRound === 0));
        for (const key of ["hitKillProtectionUsed", "hitKillProtectionDisabled", "hitKillSurvivalGrace", "trainerInterventions"]) assert.deepEqual(fresh[key], []);
        for (const old of frozen.tokens) {
            const token = fresh.tokens.find(candidate => candidate.id === old.id);
            for (const key of ["currentHp", "pp", "status", "friendship", "xp", "item"]) assert.deepEqual(token[key], old[key]);
            assert.equal(token.declaredMove, "");
            assert.equal(token.activeMoveActions, 0);
        }
        assert.equal(fresh.tokens.find(token => token.id === "fast").traitState.item.consumed, true);
        assert.equal(fresh.tokens.find(token => token.id === "fainted").currentHp, 0);
        checks.push(`${mode}: confirmed New battle refreshes records without healing, PP recovery, revival or item restoration`);
        await context.close();
    }
    assert.deepEqual(errors, []);
    checks.push("no runtime errors");
} catch (error) {
    for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
        await page.screenshot({ path: `/tmp/myowndex-battle-lifecycle-failure-${index}.png`, fullPage: true }).catch(() => {});
        console.error(await page.locator(".turn-order,.room-phase-help,.local-pokemon-dice").innerText().catch(() => "Lifecycle unavailable"));
    }
    throw error;
} finally {
    await browser.close();
    console.log(JSON.stringify({ checks, errors }, null, 2));
}

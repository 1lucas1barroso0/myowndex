// Real UI reward, EV and friendship flow in an isolated guest profile.
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
const errors = [];
const report = [];
page.on("pageerror", error => errors.push(error.message));
const keys = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
const species = { id: 1, name: "bulbasaur", species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" }, height: 7, weight: 69, types: [{ type: { name: "grass" } }], stats: [45,49,49,65,65,45].map((base_stat, index) => ({ base_stat, stat: { name: keys[index] } })), sprites: { front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" }, moves: [], abilities: [{ ability: { name: "overgrow" } }] };
await context.route("https://pokeapi.co/api/v2/**", async route => {
    const [, , kind, name] = new URL(route.request().url()).pathname.split("/").filter(Boolean);
    let body;
    if (kind === "pokemon") body = species;
    else if (kind === "pokemon-species" && name) body = { id: 1, name: "bulbasaur", gender_rate: 1, varieties: [{ is_default: true, pokemon: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" } }] };
    else if (kind === "ability" && name) body = { name, effect_entries: [{ language: { name: "en" }, effect: "Powers up Grass-type moves when HP is low." }] };
    else body = { count: 1, results: [{ name: kind === "ability" ? "overgrow" : kind === "item" ? "leftovers" : "bulbasaur", url: `https://pokeapi.co/api/v2/${kind}/1/` }] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
});
await context.addInitScript(species => {
    if (localStorage.getItem("myowndex_growth_qa")) return;
    localStorage.setItem("myowndex_growth_qa", "seeded");
    localStorage.setItem("myowndex_rotom_v4", JSON.stringify({ schema: 5, savedAt: Date.now(), teams: [{ id: "growth-box", shareId: "growth-box", name: "Box do crescimento", updatedAt: Date.now(), rpgScale: 2, versionGroup: "auto", pokemon: [{ id: "growth-partner", nickname: "Buba", species, level: 10, nature: "hardy", ability: "overgrow", genderRate: 1, friendship: 70, moves: ["", "", "", ""], ivs: {}, evs: {}, rpg: { xp: 0, currentHp: 3, notes: "Preservar a jornada" } }] }] }));
}, species);
const savedPokemon = () => page.evaluate(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.find(team => team.id === "growth-box")?.pokemon?.[0]);
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); };
const passed = label => { report.push(label); console.log(`PASS ${label}`); };

try {
    await page.goto(baseUrl);
    await page.getByRole("button", { name: "Abrir o PC do Bill", exact: true }).click();
    await page.locator(".pc-partner-card").first().click();
    const editor = page.locator(".pokemon-editor");
    await openDetails(editor.locator(".rpg-journey-panel"));
    const reward = editor.locator(".experience-award");
    await openDetails(reward);
    await reward.getByRole("button", { name: "2 XP", exact: true }).click();
    await openDetails(reward.locator(".experience-battle-context"));
    await reward.getByLabel("Usar os dois lados da batalha", { exact: true }).check();
    const winners = reward.getByRole("group", { name: "Vencedor", exact: true });
    const opponents = reward.getByRole("group", { name: "Adversário", exact: true });
    await winners.getByLabel("Maior nível", { exact: true }).fill("10");
    await opponents.getByLabel("Maior nível", { exact: true }).fill("20");
    await winners.getByLabel("Pokémon que lutaram", { exact: true }).fill("1");
    await opponents.getByLabel("Pokémon que lutaram", { exact: true }).fill("2");
    assert.deepEqual(await reward.locator(".experience-reward-preview dd").allTextContents(), ["8", "16"]);
    await reward.getByRole("button", { name: "Receber 8 XP", exact: true }).evaluate(button => { button.click(); button.click(); });
    await reward.getByText("8 XP e 16 EVs registrados.", { exact: true }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.[0]?.pokemon?.[0]?.rpg?.pendingEvs === 16);
    let saved = await savedPokemon();
    assert.equal(saved.level, 11);
    assert.equal(saved.rpg.xp, 0);
    assert.equal(saved.rpg.experienceAwards.length, 1);
    assert.equal(saved.friendship, 70);
    assert.equal(saved.rpg.notes, "Preservar a jornada");
    passed("battle-two-disadvantages-times-four-one-receipt-and-sixteen-evs");

    await reward.getByRole("button", { name: "Novo desafio", exact: true }).click();
    await reward.getByLabel("Usar os dois lados da batalha", { exact: true }).check();
    await reward.getByRole("button", { name: "3 XP", exact: true }).click();
    await winners.getByLabel("Maior nível", { exact: true }).fill("40");
    await opponents.getByLabel("Maior nível", { exact: true }).fill("20");
    await opponents.getByLabel("Pokémon que lutaram", { exact: true }).fill("2");
    assert.deepEqual(await reward.locator(".experience-reward-preview dd").allTextContents(), ["4", "8"]);
    await reward.getByRole("button", { name: "Receber 4 XP", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.[0]?.pokemon?.[0]?.rpg?.pendingEvs === 24);
    saved = await savedPokemon();
    assert.equal(saved.rpg.xp, 4);
    assert.equal(saved.rpg.experienceAwards.length, 2);
    assert.equal(saved.friendship, 70);
    passed("mixed-battle-advantage-and-disadvantage-reduce-base-before-multiplier");

    await reward.getByRole("button", { name: "Novo desafio", exact: true }).click();
    await reward.getByLabel("Usar os dois lados da batalha", { exact: true }).check();
    await opponents.getByLabel("Maior nível", { exact: true }).fill("");
    assert.equal(await reward.getByRole("button", { name: "Complete a batalha", exact: true }).isDisabled(), true);
    assert.deepEqual(await reward.locator(".experience-reward-preview dd").allTextContents(), ["—", "—"]);
    await opponents.getByLabel("Maior nível", { exact: true }).fill("20");
    passed("incomplete-battle-cannot-produce-a-reward");

    await openDetails(editor.locator(".pokemon-training-panel"));
    await editor.getByRole("spinbutton", { name: "EVs de HP", exact: true }).fill("252");
    await editor.getByRole("spinbutton", { name: "EVs de Ataque", exact: true }).fill("252");
    await editor.getByRole("spinbutton", { name: "EVs de Velocidade", exact: true }).fill("4");
    const training = editor.locator(".ev-training");
    await training.getByRole("combobox", { name: "Treinar", exact: true }).selectOption("defense");
    await training.getByRole("spinbutton", { name: "EVs", exact: true }).fill("24");
    assert.equal(await training.getByRole("spinbutton", { name: "EVs", exact: true }).inputValue(), "2");
    await training.getByRole("button", { name: "Treinar", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.[0]?.pokemon?.[0]?.rpg?.pendingEvs === 22);
    saved = await savedPokemon();
    assert.equal(saved.evs.defense, 2);
    assert.equal(Object.values(saved.evs).reduce((sum, value) => sum + value, 0), 510);
    assert.equal(await training.getByRole("button", { name: "Treinar", exact: true }).isDisabled(), true);
    await openDetails(training.locator(".ev-training-options"));
    await training.getByRole("button", { name: "Apagar EVs disponíveis", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Apagar EVs disponíveis?", exact: true });
    await confirm.getByRole("button", { name: "Apagar EVs disponíveis", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.[0]?.pokemon?.[0]?.rpg?.pendingEvs === 0);
    assert.equal((await savedPokemon()).evs.defense, 2);
    passed("ev-allocation-respects-both-official-caps-and-deleting-reserve-preserves-training");

    await openDetails(editor.locator(".editor-characteristics"));
    const friendship = editor.locator(".friendship-control");
    for (const [label, raw, rpg] of [["Aumentar Amizade em 5", 75, 7], ["Aumentar Amizade em 50", 125, 12], ["Diminuir Amizade em 5", 120, 12], ["Diminuir Amizade em 50", 70, 7]]) {
        await friendship.getByRole("button", { name: label, exact: true }).click();
        assert.equal(await friendship.getByRole("spinbutton", { name: "Amizade", exact: true }).inputValue(), String(raw));
        assert.equal(await friendship.locator("output").innerText(), `RPG ${rpg} de 25`);
    }
    await friendship.getByRole("spinbutton", { name: "Amizade", exact: true }).fill("255");
    assert.equal(await friendship.locator("output").innerText(), "RPG 25 de 25");
    await friendship.getByRole("spinbutton", { name: "Amizade", exact: true }).fill("70");
    await openDetails(friendship.locator(".friendship-help"));
    passed("friendship-is-manual-in-five-and-fifty-steps-with-rpg-floor-and-cap");

    const axeSource = process.env.MYOWNDEX_AXE_PATH ? await fs.readFile(process.env.MYOWNDEX_AXE_PATH, "utf8") : null;
    for (const theme of ["day", "night"]) for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await page.waitForTimeout(200);
        const layout = await editor.evaluate(root => {
            const visible = node => node.getClientRects().length && (!node.closest("details:not([open])") || node.closest("details:not([open])").querySelector(":scope > summary")?.contains(node));
            const controls = [...root.querySelectorAll(".experience-award button,.experience-award input,.experience-award summary,.ev-training button,.ev-training input,.ev-training summary,.friendship-control button,.friendship-control input,.friendship-control summary")].filter(visible);
            return { width: innerWidth, pageWidth: document.documentElement.scrollWidth,
                escaped: controls.filter(node => { const r = node.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(node => node.innerText || node.getAttribute("aria-label")),
                small: controls.filter(node => node.type !== "checkbox" && node.getBoundingClientRect().height < 43.5).map(node => node.innerText || node.getAttribute("aria-label")),
            };
        });
        assert.ok(layout.pageWidth <= layout.width + 1, `${theme} ${width}: overflow`);
        assert.deepEqual(layout.escaped, [], `${theme} ${width}: escaped controls`);
        assert.deepEqual(layout.small, [], `${theme} ${width}: touch targets`);
        if (axeSource) {
            await page.addScriptTag({ content: axeSource });
            const violations = await page.evaluate(async () => (await window.axe.run(".pokemon-editor", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
            assert.deepEqual(violations, [], `${theme} ${width}: accessibility`);
        }
        passed(`growth-ui-${theme}-${width}`);
    }
    await page.screenshot({ path: "/tmp/myowndex-growth-mobile.png", fullPage: true });
    await page.reload();
    await page.getByRole("button", { name: "Abrir o PC do Bill", exact: true }).click();
    await page.locator(".pc-partner-card").first().click();
    await openDetails(page.locator(".pokemon-training-panel"));
    assert.equal(await page.locator(".ev-training > header > strong").innerText(), "0");
    saved = await savedPokemon();
    assert.equal(saved.level, 11);
    assert.equal(saved.rpg.xp, 4);
    assert.equal(saved.rpg.experienceAwards.length, 2);
    assert.equal(saved.friendship, 70);
    assert.equal(saved.rpg.notes, "Preservar a jornada");
    passed("growth-reload-preserves-receipts-training-friendship-and-notes");
    assert.deepEqual(errors, []);
    await fs.writeFile("/tmp/myowndex-growth-browser-report.json", JSON.stringify({ report, errors }, null, 2));
    console.log(`Passed ${report.length} growth checkpoints; no page errors.`);
} finally {
    await page.screenshot({ path: "/tmp/myowndex-growth-last.png" }).catch(() => {});
    await browser.close();
}

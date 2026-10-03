// Optional full-flow regression. Uses one disposable guest browser profile.
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxyServer = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ["--no-sandbox"],
    ...(proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1,::1" } } : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
const page = await context.newPage();
const errors = [];
const report = [];
page.on("pageerror", error => errors.push(error.message));
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
const passed = name => { report.push(name); console.log(`PASS ${name}`); };
const navLabels = ["Abrir a Pokédex", "Abrir o PC do Bill", "Abrir o Guia do Treinador", "Abrir a Central da Aventura"];

await context.addInitScript(() => {
    if (localStorage.getItem("myowndex_xp_dice_qa")) return;
    localStorage.setItem("myowndex_xp_dice_qa", "seeded");
    localStorage.setItem("myowndex_rotom_v4", JSON.stringify({ schema: 4, savedAt: Date.now(), teams: [{
        id: "xp-qa-box", shareId: "xp-qa-box", name: "Box da jornada", updatedAt: Date.now(), versionGroup: "scarlet-violet",
        pokemon: [{ id: "xp-qa-partner", level: 10, nickname: "Buba", genderRate: 1, nature: "hardy", ability: "overgrow",
            species: { id: 1, name: "bulbasaur", species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" },
                height: 7, weight: 69, types: [{ type: { name: "grass" } }, { type: { name: "poison" } }],
                stats: [45,49,49,65,65,45].map((base_stat, index) => ({ base_stat, stat: { name: ["hp", "attack", "defense", "special-attack", "special-defense", "speed"][index] } })),
                sprites: { front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" },
                moves: [], abilities: [{ ability: { name: "overgrow" }, is_hidden: false }],
            }, moves: ["tackle", "growl", "", ""], rpg: { xp: 4.99, currentHp: 3, notes: "Conquista anterior", pp: [35, 40, null, null] },
        }],
    }] }));
});

async function navigation(name) { await page.getByRole("button", { name, exact: true }).click(); }
async function details(locator) { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); }
async function dice() {
    const trigger = page.getByRole("button", { name: "Abrir dados locais", exact: true }).filter({ visible: true }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Dados locais", exact: true });
    await dialog.waitFor();
    return dialog;
}
async function boxPokemon() { return page.evaluate(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.find(box => box.id === "xp-qa-box")?.pokemon?.[0]); }

try {
    await page.goto(baseUrl);
    await page.getByRole("button", { name: navLabels[1], exact: true }).waitFor();
    await navigation(navLabels[1]);
    await page.locator(".pc-partner-card").first().click();
    await details(page.locator(".rpg-journey-panel"));
    const xp = page.getByLabel("XP atual", { exact: true });
    assert.equal(await xp.inputValue(), "4", "legacy fractional XP floors at startup");
    assert.equal(await xp.getAttribute("step"), "1");
    assert.match(await page.locator(".editor-progress-goal").innerText(), /Meta: 5 XP · nível 11/);
    await page.getByRole("button", { name: "+1 XP", exact: true }).click();
    assert.equal(await page.getByLabel("Nível", { exact: true }).inputValue(), "11");
    assert.equal(await xp.inputValue(), "0", "XP resets once at the level advance");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.[0]?.pokemon?.[0]?.level === 11);
    assert.equal((await boxPokemon()).rpg.notes, "Conquista anterior");
    passed("legacy-xp-goal-five-level-eleven-reset-and-persistence");

    await page.getByLabel("Nível", { exact: true }).fill("100");
    assert.equal(await page.getByRole("button", { name: "+1 XP", exact: true }).isDisabled(), true);
    assert.match(await page.locator(".editor-progress-goal").innerText(), /Nível máximo · 100/);
    await page.locator('button[role="radio"][data-mode="free"]').click();
    await page.getByLabel("Nível", { exact: true }).fill("199");
    await xp.fill("99");
    await xp.blur();
    await page.getByRole("button", { name: "+1 XP", exact: true }).click();
    assert.equal(await page.getByLabel("Nível", { exact: true }).inputValue(), "200");
    assert.equal(await xp.inputValue(), "0");
    assert.equal(await page.getByRole("button", { name: "+1 XP", exact: true }).isDisabled(), true);
    passed("both-level-caps-and-free-level-two-hundred");

    await page.locator('button[role="radio"][data-mode="rpg"]').click();
    await page.getByLabel("Nível", { exact: true }).fill("10");
    await xp.fill("4.99");
    await xp.blur();
    assert.equal(await xp.inputValue(), "4");
    await navigation(navLabels[3]);
    await page.getByRole("button", { name: "Começar uma aventura local", exact: false }).click();
    await page.getByRole("combobox", { name: "Box", exact: true }).selectOption("xp-qa-box");
    await page.getByRole("button", { name: "Entrar como aliado", exact: true }).click();
    await page.locator(".room-token").first().click();
    assert.equal(await page.locator("#room-token-xp").inputValue(), "4");
    assert.equal(await page.locator("#room-token-xp").getAttribute("step"), "1");
    await page.locator(".token-xp-actions").getByRole("button", { name: "+1 XP", exact: true }).click();
    assert.equal(await page.locator("#room-token-xp").inputValue(), "0");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("myowndex_rotom_v4"))?.teams?.[0]?.pokemon?.[0]?.level === 11);
    passed("local-adventure-xp-floor-level-up-and-box-synchronization");

    let dialog = await dice();
    assert.equal(await dialog.getByText("Vibração", { exact: true }).count(), 0);
    await dialog.getByRole("button", { name: "Rolar 2d6", exact: true }).click();
    const total = await dialog.locator(".local-dice-total").innerText();
    assert.equal(Number.isInteger(Number(total)), true);
    await page.waitForTimeout(400);
    await dialog.locator(".local-dice-history > summary").click();
    assert.match(await dialog.locator(".local-dice-history").innerText(), /Dados locais/);
    await dialog.getByRole("button", { name: "Fechar dados locais", exact: true }).click();
    assert.equal(await page.locator(".room-tools .local-dice-history > summary b").innerText(), "1 rolagem", "same-document room history refreshes immediately");
    passed("global-roll-is-instantly-shared-with-local-room-history");

    dialog = await dice();
    await dialog.locator(".local-dice-history > summary").click();
    await dialog.getByRole("button", { name: "Apagar histórico", exact: true }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Apagar histórico de rolagens?", exact: true });
    await confirmation.waitFor();
    assert.equal(await confirmation.evaluate(element => Boolean(element.closest("dialog[open]"))), true);
    await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    await dialog.getByRole("button", { name: "Apagar histórico", exact: true }).click();
    await confirmation.waitFor();
    await page.keyboard.press("Escape");
    await confirmation.waitFor({ state: "hidden" });
    assert.equal(await dialog.isVisible(), true, "Escape dismisses the nested confirmation without dismissing dice");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    passed("nested-history-confirmation-top-layer-and-escape-return");

    for (const theme of ["Claro", "Escuro"]) {
        await page.getByRole("radio", { name: theme, exact: true }).click();
        for (const width of [320, 390, 768, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            for (const sectionName of navLabels) {
                await navigation(sectionName);
                dialog = await dice();
                await page.keyboard.press("Tab");
                assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, "keyboard focus cannot enter the background");
                const bounds = await dialog.evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    const targets = [...element.querySelectorAll("button,input,select")].filter(control => control.getClientRects().length)
                        .map(control => ({ text: control.textContent?.trim().slice(0, 60), ...control.getBoundingClientRect().toJSON() }));
                    return { rect: rect.toJSON(), width: innerWidth, height: innerHeight, targets, xOverflow: element.scrollWidth > element.clientWidth + 1 };
                });
                assert.ok(bounds.rect.left >= 0 && bounds.rect.right <= bounds.width + 1);
                assert.ok(bounds.rect.top >= 0 && bounds.rect.bottom <= bounds.height + 1);
                assert.equal(bounds.xOverflow, false);
                for (const target of bounds.targets) {
                    if (target.height > 0) assert.ok(target.height >= 43.5, `${target.text}: target too small`);
                    assert.ok(target.left >= bounds.rect.left - 1 && target.right <= bounds.rect.right + 1);
                }
                await dialog.getByRole("button", { name: "Fechar dados locais", exact: true }).click();
                assert.match(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""), /Abrir dados locais/);
                passed(`global-dice-${theme}-${width}-${sectionName}`);
            }
        }
    }
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    dialog = await dice();
    assert.ok(await dialog.evaluate(element => element.getBoundingClientRect().right <= innerWidth + 1));
    await page.screenshot({ path: "/tmp/myowndex-xp-dice-zoom.png" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    passed("global-dice-zoom-200");
    assert.deepEqual(errors, []);
    await fs.writeFile("/tmp/myowndex-xp-dice-browser-report.json", JSON.stringify({ report, errors }, null, 2));
    console.log(`Passed ${report.length} XP and global dice checkpoints; no page errors.`);
} catch (error) {
    await page.screenshot({ path: "/tmp/myowndex-xp-dice-failure.png" }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}

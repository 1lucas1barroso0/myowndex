// Isolated browser data only: deletion must remove the intended preview/receipt
// or practice partner, survive reload, and leave Boxes and game state intact.
import assert from 'node:assert/strict';
import { addTeamToSnapshot, createRoomSnapshot } from '../src/core/room.js';
import { normalizePokemon } from '../src/core/team.js';
import { performLocalRoll } from '../src/core/localRolls.js';

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 320, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const stats = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
const species = { id: 1, name: 'bulbasaur', species: { name: 'bulbasaur' }, types: [{ slot: 1, type: { name: 'grass' } }],
    stats: [45, 49, 49, 65, 65, 45].map((base_stat, index) => ({ base_stat, stat: { name: stats[index] } })),
    sprites: { front_default: '' }, abilities: [], moves: [] };
const partner = (id, nickname) => normalizePokemon({ id, nickname, species, level: 10, nature: 'hardy', ability: 'overgrow', moves: ['tackle'], rpg: { xp: 0, currentHp: 3, pp: [35] } });
const team = { id: 'deletions-box', shareId: 'deletions-box', name: 'Box preservada', updatedAt: Date.now(), versionGroup: 'scarlet-violet', rpgScale: 2,
    pokemon: [partner('first-partner', 'Buba'), partner('second-partner', 'Broto')] };
const draft = { schema: 1, results: team.pokemon.map((pokemon, index) => ({ pokemon, versionGroup: 'scarlet-violet', saved: index === 0, exported: false })) };
const field = addTeamToSnapshot(createRoomSnapshot('Campo de testes'), team, 'ally').room;
field.initiative = field.tokens.map(token => token.id);
field.turnIndex = 1;
const history = [performLocalRoll({ kind: 'percent', label: 'Primeira', chance: 50 }, { id: 'first-roll', createdAt: 10, random: () => .4 }),
    performLocalRoll({ kind: 'percent', label: 'Segunda', chance: 50 }, { id: 'second-roll', createdAt: 20, random: () => .6 })];

await context.route('https://pokeapi.co/api/v2/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').filter(Boolean);
    const kind = path[2], name = path[3];
    const body = kind === 'pokemon' ? species : kind === 'move' ? { name, pp: 35, accuracy: 100, power: 40, priority: 0,
        type: { name: 'normal' }, damage_class: { name: 'physical' }, target: { name: 'selected-pokemon' }, effect_entries: [], meta: {}, stat_changes: [] }
        : { id: 1, name: 'bulbasaur', capture_rate: 45, gender_rate: 1, flavor_text_entries: [], evolution_chain: null };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await context.addInitScript(({ team, draft, field, history }) => {
    if (localStorage.getItem('personal-deletions-seeded')) return;
    localStorage.setItem('personal-deletions-seeded', 'true');
    localStorage.setItem('myowndex_rotom_v4', JSON.stringify({ schema: 5, savedAt: Date.now(), teams: [team] }));
    localStorage.setItem('myowndex_generator_v1', JSON.stringify(draft));
    localStorage.setItem('myowndex_local_dice_room_v1', JSON.stringify(field));
    localStorage.setItem('myowndex_local_roll_history_v3', JSON.stringify(history));
}, { team, draft, field, history });

const pass = name => console.log(`PASS ${name}`);
const openGenerator = async () => {
    await page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await page.locator('.generator-dialog').waitFor();
    await page.waitForFunction(() => !document.querySelector('.generator-dialog')?.textContent.includes('Recuperando sua prévia'));
    return page.locator('.generator-dialog');
};
const openDice = async currentPage => {
    await currentPage.getByRole('button', { name: 'Abrir Dados', exact: true }).filter({ visible: true }).first().click();
    const dialog = currentPage.getByRole('dialog', { name: 'Dados', exact: true });
    await dialog.locator('.local-dice-tabs').waitFor();
    return dialog;
};
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(':scope > summary').click(); };
const confirm = async name => {
    const confirmation = page.getByRole('alertdialog');
    await confirmation.waitFor();
    await confirmation.getByRole('button', { name, exact: true }).click();
    await confirmation.waitFor({ state: 'detached' });
};
const assertFits = async locator => {
    const result = await locator.evaluate(element => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        small: [...element.querySelectorAll('button')].filter(button => button.getClientRects().length && !button.closest('details:not([open])') && button.getBoundingClientRect().height < 43.5).map(button => button.textContent),
    }));
    assert.equal(result.overflow, false);assert.deepEqual(result.small, []);
};

try {
    await page.goto(process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000');
    await page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).waitFor({ timeout: 60000 });
    let generator = await openGenerator();
    await generator.locator('.generator-partner').nth(1).waitFor();
    const originalBoxes = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('myowndex_rotom_v4')).teams));
    await generator.locator('.generator-partner-details summary').nth(1).click();
    await generator.locator('.generator-partner').nth(1).getByRole('button', { name: 'Remover Bulbasaur da prévia', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Voltar à prévia', exact: true }).click();
    assert.equal(await generator.locator('.generator-partner').count(), 2);
    pass('cancelled-preview-removal-preserves-both-partners');
    await generator.locator('.generator-partner').nth(1).getByRole('button', { name: 'Remover Bulbasaur da prévia', exact: true }).click();
    await confirm('Remover da prévia');
    await page.waitForFunction(() => document.querySelectorAll('.generator-partner').length === 1);
    assert.equal(await generator.locator('.generator-partner.is-saved').count(), 1);
    await assertFits(generator);
    pass('individual-preview-removal-preserves-other-preview-and-box-at-320px');
    await generator.getByRole('button', { name: 'Limpar prévia', exact: true }).click();
    await confirm('Limpar prévia');
    await generator.locator('.generator-empty').waitFor();
    await generator.getByRole('button', { name: 'Fechar gerador', exact: true }).click();
    await page.reload();
    generator = await openGenerator();
    await generator.locator('.generator-empty').waitFor();
    assert.equal(await generator.locator('.generator-partner').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('myowndex_rotom_v4')).teams)), originalBoxes);
    pass('cleared-preview-survives-reload-without-erasing-saved-partners');
    await generator.getByRole('button', { name: 'Fechar gerador', exact: true }).click();

    let dice = await openDice(page);
    await openDetails(dice.locator('.local-dice-history'));
    await dice.getByRole('button', { name: 'Apagar rolagem de Primeira', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(await dice.locator('.local-dice-history ol > li').count(), 2);
    const originalField = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('myowndex_local_dice_room_v1'))));
    const tab = await context.newPage();
    await tab.goto(process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000');
    const secondDice = await openDice(tab);
    await openDetails(secondDice.locator('.local-dice-history'));
    await dice.getByRole('button', { name: 'Apagar rolagem de Primeira', exact: true }).click();
    await confirm('Apagar rolagem');
    await page.waitForFunction(() => document.querySelectorAll('.local-dice-dialog .local-dice-history ol > li').length === 1);
    await tab.waitForFunction(() => document.querySelectorAll('.local-dice-dialog .local-dice-history ol > li').length === 1);
    assert.equal(await secondDice.getByRole('button', { name: 'Apagar rolagem de Primeira', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('myowndex_local_dice_room_v1')))), originalField);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_roll_history_v3'))[0].id), 'second-roll');
    await assertFits(dice);
    pass('individual-receipt-removal-updates-both-open-tabs-and-preserves-field-at-320px');
    await tab.close();

    await dice.getByRole('button', { name: 'Campo', exact: true }).click();
    const conditions = dice.locator('.room-tool').filter({ has: page.getByText('Condições do campo', { exact: true }) });
    await openDetails(conditions);
    await dice.locator('.local-pokemon-roster button').filter({ hasText: 'Buba' }).click();
    await conditions.getByRole('button', { name: 'Retirar do campo', exact: true }).click();
    await confirm('Retirar Pokémon');
    await page.waitForFunction(() => document.querySelectorAll('.local-dice-dialog .local-pokemon-roster button').length === 1);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('myowndex_local_dice_room_v1')).tokens.length === 1);
    assert.equal(await dice.locator('.local-pokemon-roster button').innerText(), 'Broto\nHP 3 de 3');
    await dice.getByRole('button', { name: 'Limpar campo', exact: true }).click();
    await confirm('Limpar campo');
    await page.waitForFunction(() => document.querySelectorAll('.local-dice-dialog .local-pokemon-roster button').length === 0);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('myowndex_local_dice_room_v1')).tokens.length === 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_roll_history_v3')).length), 1);
    assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('myowndex_rotom_v4')).teams)), originalBoxes);
    pass('confirmed-practice-partner-and-field-removals-preserve-boxes-and-rolls');
    await dice.getByRole('button', { name: 'Fechar dados', exact: true }).click();
    await page.reload();
    dice = await openDice(page);
    await dice.getByRole('button', { name: 'Campo', exact: true }).click();
    assert.equal(await dice.locator('.local-pokemon-roster button').count(), 0);
    await openDetails(dice.locator('.local-dice-history'));
    assert.equal(await dice.locator('.local-dice-history ol > li').count(), 1);
    pass('practice-and-individual-roll-deletions-survive-reload');
    assert.deepEqual(errors, []);
    pass('no-runtime-errors');
} catch (error) {
    await page.screenshot({ path: '/tmp/myowndex-personal-deletions-failure.png', fullPage: true });
    throw error;
} finally { await context.close();await browser.close(); }

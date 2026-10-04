// Optional account integration regression. Use a local Next server backed by
// tests/helpers/hrana-server.mjs; never run this mutating test against production.
// MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/browser-accounts.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname),
    'Account browser tests create/delete QA accounts and require a loopback server');
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({
    headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}),
});
const contexts = [];
const errors = [];
const consoleErrors = [];
const checks = [];
const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const username = `qa_${suffix}`;
const secondUsername = `other_${suffix}`;
const password = 'MyOwnDex QA! long 2026';
const changedPassword = 'MyOwnDex QA! changed 2026';
const recoveredPassword = 'MyOwnDex QA! recovered 2026';

async function device(name) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push({ device: name, message: error.message }));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push({ device: name, message: message.text() });
    });
    page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.dismiss() : dialog.accept());
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).waitFor();
    return { context, page, name };
}

function passed(label, detail = {}) {
    checks.push({ label, ...detail });
    console.log(JSON.stringify(checks.at(-1)));
}

async function eventually(callback, label, timeout = 45000) {
    const end = Date.now() + timeout;
    let failure;
    do {
        try { const result = await callback(); if (result) return result; }
        catch (error) { failure = error; }
        await new Promise(resolve => setTimeout(resolve, 150));
    } while (Date.now() < end);
    throw failure || new Error(`Timed out: ${label}`);
}

async function request(page, path, { method = 'GET', body, accountId } = {}) {
    return page.evaluate(async ({ path, method, body, accountId }) => {
        const response = await fetch(`/api/account/${path}`, {
            method, credentials: 'same-origin', cache: 'no-store',
            headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }),
                ...(accountId ? { 'x-myowndex-account': accountId } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, data: await response.json() };
    }, { path, method, body, accountId });
}

async function cloud(page) {
    const session = await request(page, 'session');
    assert.equal(session.status, 200);
    assert.ok(session.data.account, 'a real cookie-authenticated session must exist');
    const result = await request(page, 'data', { accountId: session.data.account.id });
    assert.equal(result.status, 200);
    return { account: session.data.account, ...result.data };
}

async function roomRequest(page, path, { method = 'GET', body, key = '', accountId } = {}) {
    return page.evaluate(async ({ path, method, body, key, accountId }) => {
        const response = await fetch(path, {
            method, credentials: 'same-origin', cache: 'no-store',
            headers: { 'x-myowndex-room-protocol': '3', ...(key ? { 'x-myowndex-room-key': key } : {}),
                ...(accountId ? { 'x-myowndex-account': accountId } : {}),
                ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, data: await response.json() };
    }, { path, method, body, key, accountId });
}

async function nav(page, name) { await page.getByRole('button', { name, exact: true }).click(); }

async function openAccount(page) {
    if (await page.locator('.account-dialog').isVisible()) return;
    await page.locator('.account-header-button').click();
    await page.locator('.account-dialog').waitFor();
}

async function closeAccount(page) {
    if (await page.locator('.account-dialog').isVisible())
        await page.getByRole('button', { name: 'Fechar conta', exact: true }).click();
}

async function login(page, user = username, secret = password) {
    await openAccount(page);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByLabel('Nome de usuário', { exact: true }).fill(user);
    await page.getByLabel('Senha', { exact: true }).fill(secret);
    await page.getByRole('button', { name: 'Entrar na conta', exact: true }).click();
    await eventually(async () => (await request(page, 'session')).data.account?.username === user, `login ${user}`);
    await page.getByRole('button', { name: 'Sincronizar agora', exact: true }).waitFor();
}

async function signup(page, user = username) {
    await openAccount(page);
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.getByLabel('Nome de usuário', { exact: true }).fill(user);
    await page.getByLabel('Nome do Treinador', { exact: true }).fill('Treinador QA com uma identificação comprida');
    await page.getByLabel('Senha', { exact: true }).fill(password);
    const importChoice = page.getByRole('checkbox', { name: 'Adicionar meus dados deste dispositivo.', exact: true });
    if (await importChoice.isVisible()) await importChoice.uncheck();
    await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await eventually(async () => (await request(page, 'session')).data.account?.username === user, `signup ${user}`);
    await page.locator('.account-recovery-codes code').nth(7).waitFor();
    const codes = await page.locator('.account-recovery-codes code').allTextContents();
    assert.equal(codes.length, 8, 'signup must show eight usable one-time recovery codes');
    assert.equal(new Set(codes).size, 8);
    return codes;
}

async function sync(page) {
    await openAccount(page);
    const button = page.getByRole('button', { name: 'Sincronizar agora', exact: true });
    await button.waitFor();
    await eventually(async () => !await button.isDisabled(), 'manual sync available');
    await button.click();
    await eventually(async () => await page.locator('.account-sync-label').innerText().then(text => /Conta atualizada/i.test(text)), 'account synchronized');
    await closeAccount(page);
}

async function boxName(page, name) {
    await nav(page, 'Abrir o PC do Bill');
    await page.getByLabel('Nome da Box', { exact: true }).fill(name);
    await page.getByLabel('Nome da Box', { exact: true }).blur();
}

async function layout(page, label) {
    await page.evaluate(() => document.fonts.ready);
    const result = await page.locator('.account-dialog').evaluate(scope => {
        const visible = element => element.getClientRects().length && !element.closest('[inert],.sr-only')
            && getComputedStyle(element).visibility !== 'hidden'
            && (!element.closest('details:not([open])') || element.closest('details:not([open])').querySelector(':scope > summary')?.contains(element));
        const bounds = scope.getBoundingClientRect();
        const controls = [...scope.querySelectorAll('button,input,select,textarea,summary,[role="tab"],h1,h2,h3,label,p,code')].filter(visible);
        const outside = controls.filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.left < Math.max(0, bounds.left) - 1 || rect.right > Math.min(innerWidth, bounds.right) + 1;
        }).map(element => ({ tag: element.tagName, text: (element.innerText || element.getAttribute('aria-label') || '').slice(0, 100) }));
        const clipped = controls.filter(element => {
            const style = getComputedStyle(element);
            return !['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)
                && ((element.scrollWidth > element.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX))
                    || (element.scrollHeight > element.clientHeight + 2 && ['hidden', 'clip'].includes(style.overflowY)));
        }).map(element => element.innerText.slice(0, 100));
        const smallTargets = controls.filter(element => element.tagName === 'BUTTON').filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width < 43.5 || rect.height < 43.5;
        }).map(element => ({ text: element.innerText || element.getAttribute('aria-label'), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
        return { width: innerWidth, pageWidth: document.documentElement.scrollWidth, outside, clipped, smallTargets };
    });
    assert.ok(result.pageWidth <= result.width + 1, `${label}: horizontal overflow`);
    assert.deepEqual(result.outside, [], `${label}: account content outside its surface`);
    assert.deepEqual(result.clipped, [], `${label}: account prose/controls clipped`);
    assert.deepEqual(result.smallTargets, [], `${label}: account action below 44px touch target`);
    passed(label, result);
}

async function layouts(page, prefix) {
    for (const theme of ['Claro', 'Escuro']) {
        // Keep the dialog mounted: closing intentionally forgets passwords and
        // one-time codes. Exercise the real theme handler while inspecting its
        // portal, rather than accidentally testing the default login each time.
        await page.locator(`.appearance-options [data-appearance="${theme === 'Claro' ? 'normal' : 'night'}"]`).evaluate(button => button.click());
        await eventually(async () => await page.evaluate(() => document.documentElement.dataset.theme) === (theme === 'Claro' ? 'normal' : 'night'), `theme ${theme}`);
        if (prefix === 'signup') await page.getByLabel('Nome do Treinador', { exact: true }).waitFor();
        if (prefix === 'recover') await page.getByLabel('Código de recuperação', { exact: true }).waitFor();
        if (prefix === 'recovery-codes') assert.equal(await page.locator('.account-recovery-codes code').count(), 8);
        for (const width of [320, 390, 768, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await layout(page, `${prefix}-${theme}-${width}`);
        }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
}

let first;
let second;
let sharedRoom;
try {
    first = await device('device-a');
    second = await device('device-b');
    await openAccount(first.page);
    await layouts(first.page, 'login');
    await first.page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await layouts(first.page, 'signup');
    await closeAccount(first.page);

    // Existing guest data is created through the normal UI and imported only by
    // an explicit action, avoiding automatic account/guest cross-contamination.
    await nav(first.page, 'Abrir a Pokédex');
    await first.page.getByRole('button', { name: 'Consultar Bulbasaur na Pokédex', exact: true }).click();
    await first.page.getByRole('button', { name: 'Adicionar à equipe', exact: false }).click();
    await first.page.locator('.pc-partner-card').first().click();
    await first.page.getByLabel('Apelido', { exact: true }).fill('Parceiro da conta');
    const training = first.page.locator('.pokemon-training-panel');
    if (!await training.evaluate(element => element.open)) await training.locator(':scope > summary').click();
    const stats = await first.page.locator('.pokemon-stat-row h4').allTextContents();
    for (let index = 0; index < stats.length; index++) {
        await first.page.getByRole('spinbutton', { name: `IVs de ${stats[index]}`, exact: true }).fill(String(20 + index));
        await first.page.getByRole('spinbutton', { name: `EVs de ${stats[index]}`, exact: true }).fill(String(24 + 4 * index));
    }
    await boxName(first.page, 'Box convidada');
    const originalCodes = await signup(first.page);
    await layouts(first.page, 'recovery-codes');
    const initial = await cloud(first.page);
    assert.equal(initial.document?.boxes?.length || 0, 0, 'signup must not silently move guest data');
    await first.page.locator('.account-disclosure > summary').filter({ hasText: /^Adicionar dados deste dispositivo$/ }).click();
    await first.page.getByRole('button', { name: 'Adicionar à conta', exact: true }).click();
    await closeAccount(first.page);
    await eventually(async () => (await cloud(first.page)).document?.boxes?.[0]?.name === 'Box convidada', 'guest data imported to persistent SQL');
    passed('signup-explicit-guest-import-real-sqlite');
    await login(second.page);
    await closeAccount(second.page);
    await nav(second.page, 'Abrir o PC do Bill');
    await eventually(async () => await second.page.getByLabel('Nome da Box', { exact: true }).inputValue() === 'Box convidada', 'second device received guest Box');
    await second.page.locator('.pc-partner-card').first().click();
    const secondTraining = second.page.locator('.pokemon-training-panel');
    if (!await secondTraining.evaluate(element => element.open)) await secondTraining.locator(':scope > summary').click();
    assert.equal(await second.page.getByLabel('Apelido', { exact: true }).inputValue(), 'Parceiro da conta');
    for (let index = 0; index < stats.length; index++) {
        assert.equal(await second.page.getByRole('spinbutton', { name: `IVs de ${stats[index]}`, exact: true }).inputValue(), String(20 + index));
        assert.equal(await second.page.getByRole('spinbutton', { name: `EVs de ${stats[index]}`, exact: true }).inputValue(), String(24 + 4 * index));
    }
    const cookies = await first.context.cookies(baseUrl);
    const sessionCookie = cookies.find(cookie => cookie.name === 'myowndex_account');
    assert.ok(sessionCookie?.httpOnly, 'session must use an HttpOnly cookie');
    assert.equal(sessionCookie.sameSite, 'Strict');
    assert.equal(await first.page.evaluate(() => document.cookie.includes('myowndex_account=')), false);
    passed('independent-device-boxes-twelve-training-values-cookie-security');

    const created = await roomRequest(first.page, '/api/rooms', {
        method: 'POST', body: { title: 'Sala QA da conta', snapshot: { gmNotes: 'Notas privadas de QA' } },
    });
    assert.equal(created.status, 201);
    sharedRoom = created.data;
    const linked = await request(first.page, 'rooms', {
        method: 'POST', accountId: initial.account.id,
        body: { code: sharedRoom.code, key: sharedRoom.narratorKey, displayName: 'Narrador QA' },
    });
    assert.equal(linked.status, 201);
    const memberships = await request(second.page, 'rooms', { accountId: initial.account.id });
    assert.equal(memberships.status, 200);
    const resumed = memberships.data.rooms.find(room => room.code === sharedRoom.code);
    assert.ok(resumed);
    assert.equal(resumed.role, 'narrator');
    assert.ok(!JSON.stringify(memberships.data).includes(sharedRoom.narratorKey), 'membership must not send the original room bearer secret');
    const narrator = await roomRequest(second.page, `/api/rooms/${sharedRoom.code}`, {
        key: resumed.key, accountId: initial.account.id,
    });
    assert.equal(narrator.status, 200);
    assert.equal(narrator.data.snapshot.gmNotes, 'Notas privadas de QA');
    const unauthenticated = await roomRequest(second.page, `/api/rooms/${sharedRoom.code}`, { key: resumed.key });
    assert.equal(unauthenticated.status, 409, 'account bridge must reject a missing bound account scope');
    passed('shared-room-membership-resumes-on-independent-device-without-bearer-copy');
    await nav(second.page, 'Abrir a Central da Aventura');
    const resumeButton = second.page.locator('.room-account-adventures .room-resume').filter({ hasText: 'Sala QA da conta' });
    await resumeButton.waitFor();
    await resumeButton.click();
    await eventually(async () => await second.page.locator('.room-title h2').innerText() === 'Sala QA da conta',
        'account adventure resumed by its normal UI on another device');
    const savedRoomSession = await second.page.evaluate(accountId =>
        JSON.parse(localStorage.getItem(`myowndex_account:${encodeURIComponent(accountId)}:myowndex_live_room_v1`) || 'null'), initial.account.id);
    assert.equal(savedRoomSession.key, `account_${initial.account.id}`);
    assert.equal(savedRoomSession.role, 'narrator');
    assert.equal(await second.page.locator('.room-header-actions').getByRole('button', { name: 'Gerar convite', exact: true }).count(), 1);
    passed('shared-adventure-resumes-through-ui-with-scoped-account-session');
    await second.page.locator('.room-header-actions').getByRole('button', { name: 'Gerar convite', exact: true }).click();
    await second.page.getByRole('alertdialog').getByRole('button', { name: 'Gerar convite', exact: true }).click();
    await second.page.locator('.room-header-actions').getByRole('button', { name: 'Convidar', exact: true }).waitFor();
    const renewedSession = await second.page.evaluate(accountId =>
        JSON.parse(localStorage.getItem(`myowndex_account:${encodeURIComponent(accountId)}:myowndex_live_room_v1`) || 'null'), initial.account.id);
    assert.ok(renewedSession.inviteCode && renewedSession.inviteCode !== sharedRoom.inviteCode);
    const obsoleteInvite = await roomRequest(first.page, `/api/rooms/${sharedRoom.code}/join`, {
        method: 'POST', body: { inviteCode: sharedRoom.inviteCode, displayName: 'Convite antigo' },
    });
    assert.equal(obsoleteInvite.status, 401, 'invite rotation must reject the old invitation');
    sharedRoom.inviteCode = renewedSession.inviteCode;
    passed('account-room-invitation-rotates-through-ui-without-removing-existing-membership');

    await nav(first.page, 'Abrir a Pokédex');
    await first.page.getByRole('button', { name: 'Adicionar Charmander aos favoritos', exact: true }).click();
    await first.page.getByRole('radio', { name: /^Como nos jogos(?:\.|$)/ }).click();
    await first.page.getByRole('radio', { name: 'Escuro', exact: true }).click();
    await eventually(async () => {
        const state = (await cloud(first.page)).document;
        return state?.dex?.favorites?.includes('4') && state?.preferences?.experienceMode === 'game' && state?.preferences?.appearance === 'night';
    }, 'favorite and preferences stored');
    await sync(second.page);
    await nav(second.page, 'Abrir a Pokédex');
    assert.equal(await second.page.getByRole('button', { name: 'Remover Charmander dos favoritos', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await second.page.getByRole('radio', { name: /^Como nos jogos(?:\.|$)/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await second.page.getByRole('radio', { name: 'Escuro', exact: true }).getAttribute('aria-checked'), 'true');
    passed('favorites-modes-and-appearance-cross-device');

    await first.page.getByRole('button', { name: 'Abrir Dados', exact: true }).click();
    const firstDice = first.page.locator('.local-dice-dialog');
    await firstDice.getByRole('button', { name: 'dX Livre', exact: true }).click();
    await firstDice.getByLabel('Quantidade', { exact: true }).fill('3');
    await firstDice.getByRole('combobox', { name: 'Dado', exact: true }).selectOption('12');
    await firstDice.getByLabel('Modificador', { exact: true }).fill('4');
    const firstOptions = firstDice.locator('.local-dice-options');
    if (!await firstOptions.evaluate(element => element.open)) await firstOptions.locator(':scope > summary').click();
    await firstDice.getByLabel('Nome da ação', { exact: true }).fill('Rolagem que acompanha a conta');
    await firstDice.getByRole('button', { name: 'Rolar 3d12', exact: true }).click();
    await firstDice.locator('.local-dice-result h4').filter({ hasText: 'Rolagem que acompanha a conta' }).waitFor();
    await firstDice.getByRole('button', { name: 'Fechar dados', exact: true }).click();
    const diceCloud = await eventually(async () => {
        const data = (await cloud(first.page)).document;
        return data?.localTools?.rollHistory?.some(entry => entry.spec.label === 'Rolagem que acompanha a conta') ? data : false;
    }, 'local receipt and preferences synchronized');
    const originalReceipt = diceCloud.localTools.rollHistory.find(entry => entry.spec.label === 'Rolagem que acompanha a conta');
    await sync(second.page);
    await second.page.getByRole('button', { name: 'Abrir Dados', exact: true }).click();
    const secondDice = second.page.locator('.local-dice-dialog');
    assert.equal(await secondDice.getByLabel('Quantidade', { exact: true }).inputValue(), '3');
    assert.equal(await secondDice.getByRole('combobox', { name: 'Dado', exact: true }).inputValue(), '12');
    assert.equal(await secondDice.getByLabel('Modificador', { exact: true }).inputValue(), '4');
    assert.equal(await secondDice.locator('.local-dice-total').innerText(), String(originalReceipt.total));
    assert.deepEqual(await secondDice.locator('.local-dice-faces li b').allTextContents(), originalReceipt.values.map(String));
    passed('local-dice-preferences-and-identical-receipt-cross-device-without-reroll');
    await secondDice.locator('.local-dice-history > summary').click();
    await secondDice.getByRole('button', { name: 'Apagar histórico', exact: true }).click();
    await second.page.getByRole('alertdialog').getByRole('button', { name: 'Apagar histórico', exact: true }).click();
    await eventually(async () => await secondDice.locator('.local-dice-history > summary').innerText().then(text => text.includes('0 rolagens')),
        'local history cleared');
    await secondDice.getByRole('button', { name: 'Fechar dados', exact: true }).click();
    await eventually(async () => (await cloud(second.page)).document?.localTools?.rollHistory?.length === 0, 'cleared history synchronized');
    await sync(first.page);
    assert.equal((await cloud(first.page)).document.localTools.rollHistory.length, 0);
    passed('cleared-local-history-does-not-return-from-another-device');

    // The Pokémon workbench is account data too. Its field remains separate
    // from the PC until the user explicitly registers the progress there.
    const boxBeforePractice = (await cloud(first.page)).document.boxes[0].pokemon[0];
    await first.page.getByRole('button', { name: 'Abrir Dados', exact: true }).click();
    const practice = first.page.locator('.local-dice-dialog');
    await practice.getByRole('button', { name: 'Campo', exact: true }).click();
    await practice.getByRole('combobox', { name: 'Pokémon da Box', exact: true })
        .selectOption({ label: 'Parceiro da conta' });
    await practice.getByRole('button', { name: 'Trazer para o campo', exact: true }).click();
    await practice.locator('.local-pokemon-roster button').first().waitFor();
    const conditions = practice.locator('.room-tool').filter({ has: first.page.getByText('Condições do campo', { exact: true }) });
    await conditions.locator(':scope > summary').click();
    await conditions.getByRole('combobox', { name: 'Clima', exact: true }).selectOption('chuva');
    await conditions.getByRole('combobox', { name: 'Condição', exact: true }).selectOption('paralysis');
    await conditions.getByRole('combobox', { name: 'Ataque', exact: true }).selectOption('2');
    const initiative = practice.locator('.local-pokemon-initiative');
    await initiative.getByRole('button', { name: 'Rolar iniciativa', exact: true }).click();
    await initiative.locator('li').first().waitFor();
    await practice.getByRole('button', { name: 'Fechar dados', exact: true }).click();
    const practiceCloud = await eventually(async () => {
        const data = (await cloud(first.page)).document;
        const token = data?.localTools?.diceRoom?.tokens?.[0];
        return token?.status === 'paralysis' && token?.stages?.attack === 2
            && data.localTools.diceRoom.initiative.length === 1
            && data.localTools.rollHistory.some(entry => entry.spec.action === 'initiative') ? data : false;
    }, 'Pokémon field, conditions and initiative stored in the account');
    assert.deepEqual(practiceCloud.boxes[0].pokemon[0].rpg, boxBeforePractice.rpg,
        'testing a local field must not apply its status or progress to the Box');
    const initiativeReceipt = practiceCloud.localTools.rollHistory.find(entry => entry.spec.action === 'initiative');
    await sync(second.page);
    await second.page.getByRole('button', { name: 'Abrir Dados', exact: true }).click();
    const resumedPractice = second.page.locator('.local-dice-dialog');
    await resumedPractice.getByRole('button', { name: 'Campo', exact: true }).click();
    await resumedPractice.locator('.local-pokemon-roster button').first().waitFor();
    const restoredPractice = (await cloud(second.page)).document;
    assert.deepEqual(restoredPractice.localTools.diceRoom, practiceCloud.localTools.diceRoom);
    assert.deepEqual(restoredPractice.localTools.rollHistory.find(entry => entry.id === initiativeReceipt.id), initiativeReceipt,
        'another device restores the exact initiative receipt without drawing new dice');
    assert.deepEqual(restoredPractice.boxes[0].pokemon[0].rpg, boxBeforePractice.rpg);
    const secondConditions = resumedPractice.locator('.room-tool').filter({ has: second.page.getByText('Condições do campo', { exact: true }) });
    await secondConditions.locator(':scope > summary').click();
    await second.context.setOffline(true);
    await first.page.getByRole('button', { name: 'Abrir Dados', exact: true }).click();
    const updatingPractice = first.page.locator('.local-dice-dialog');
    await updatingPractice.getByRole('button', { name: 'Campo', exact: true }).click();
    const updatingConditions = updatingPractice.locator('.room-tool').filter({ has: first.page.getByText('Condições do campo', { exact: true }) });
    await updatingConditions.locator(':scope > summary').click();
    await updatingConditions.getByRole('combobox', { name: 'Clima', exact: true }).selectOption('sol');
    await updatingPractice.getByRole('button', { name: 'Fechar dados', exact: true }).click();
    await eventually(async () => (await cloud(first.page)).document.localTools.diceRoom.weather === 'sol', 'new field change uploaded');
    await second.context.setOffline(false);
    await eventually(async () => await resumedPractice.isVisible()
        && await secondConditions.getByRole('combobox', { name: 'Clima', exact: true }).inputValue() === 'sol',
    'remote field update applied without closing or resetting the open Pokémon workbench');
    await eventually(async () => !await resumedPractice.locator('.local-pokemon-workbench').evaluate(element => element.disabled),
        'local Pokémon controls enabled again after the complete account application');
    assert.equal(await resumedPractice.getByRole('button', { name: 'Campo', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual((await cloud(second.page)).document.localTools.rollHistory.find(entry => entry.id === initiativeReceipt.id), initiativeReceipt);
    await resumedPractice.getByRole('button', { name: 'Fechar dados', exact: true }).click();
    passed('pokemon-local-field-conditions-and-initiative-cross-device-preserve-boxes-and-dice');
    passed('remote-account-merge-keeps-open-pokemon-workbench-and-selected-mode');

    await first.page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    const generator = first.page.locator('.generator-dialog');
    await generator.getByText('Personalizar o encontro', { exact: true }).click();
    await generator.getByRole('combobox', { name: 'Espécie a gerar', exact: true }).selectOption('1');
    await generator.getByRole('combobox', { name: 'Quantidade de Pokémon', exact: true }).selectOption('1');
    await generator.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    await generator.locator('.generator-partner').waitFor({ timeout: 60000 });
    await generator.locator('.generator-partner-details > summary').click();
    await generator.getByLabel('Apelido', { exact: true }).fill('Prévia em outro dispositivo');
    await generator.getByRole('button', { name: 'Fechar gerador', exact: true }).click();
    const generatorCloud = await eventually(async () => {
        const data = (await cloud(first.page)).document;
        return data?.localTools?.generatorDraft?.results?.[0]?.pokemon?.nickname === 'Prévia em outro dispositivo' ? data : false;
    }, 'unsaved generated partner synchronized');
    assert.equal(generatorCloud.boxes.length, 1, 'preview synchronization must not create or alter Boxes');
    await sync(second.page);
    await second.page.getByRole('button', { name: 'Gerar Pokémon', exact: true }).click();
    const secondGenerator = second.page.locator('.generator-dialog');
    await secondGenerator.locator('.generator-partner').waitFor();
    await secondGenerator.locator('.generator-partner-details > summary').click();
    assert.equal(await secondGenerator.getByLabel('Apelido', { exact: true }).inputValue(), 'Prévia em outro dispositivo');
    assert.equal(await secondGenerator.locator('.generator-partner.is-saved').count(), 0);
    await secondGenerator.getByRole('button', { name: 'Fechar gerador', exact: true }).click();
    passed('unsaved-generated-partner-cross-device-without-automatic-box-insertion');

    // The same baseline is edited independently. Reconnection must keep both
    // versions, rather than silently choosing one and discarding the other.
    await sync(first.page);
    await sync(second.page);
    await first.context.setOffline(true);
    await boxName(first.page, 'Box editada offline');
    await boxName(second.page, 'Box editada no segundo dispositivo');
    await eventually(async () => (await cloud(second.page)).document?.boxes?.some(box => box.name === 'Box editada no segundo dispositivo'), 'online competing edit persisted');
    await first.context.setOffline(false);
    await eventually(async () => {
        const boxes = (await cloud(first.page)).document?.boxes || [];
        return boxes.some(box => box.name.startsWith('Box editada offline')) && boxes.some(box => box.name.startsWith('Box editada no segundo dispositivo'));
    }, 'offline reconnect preserved competing Box edits');
    await sync(second.page);
    assert.ok((await cloud(second.page)).document.boxes.length >= 2);
    passed('offline-reconnection-and-competing-box-edits-preserved');

    await openAccount(first.page);
    await layouts(first.page, 'signed-in');
    const download = first.page.waitForEvent('download');
    await first.page.getByRole('button', { name: 'Baixar cópia', exact: true }).click();
    const exported = await download;
    const exportPath = await exported.path();
    const exportedData = JSON.parse(await fs.readFile(exportPath, 'utf8'));
    assert.equal(exportedData.account, username);
    assert.ok(exportedData.document.boxes.some(box => box.name.startsWith('Box editada offline')));
    assert.ok(exportedData.document.boxes.some(box => box.name.startsWith('Box editada no segundo dispositivo')));
    assert.equal(exportedData.document.roomSession, null, 'shared-room bearer credentials must not be exported through account synchronization');
    assert.ok(!JSON.stringify(exportedData).includes(password));
    assert.ok(!JSON.stringify(exportedData).includes(sessionCookie.value));
    passed('downloaded-account-export-is-complete-and-has-no-session-secret');

    const accountReads = [];
    const observe = request => { if (new URL(request.url()).pathname === '/api/account/data') accountReads.push(Date.now()); };
    first.page.on('request', observe);
    await first.page.waitForTimeout(3600);
    first.page.off('request', observe);
    assert.ok(accountReads.length <= 2, `idle account should not keep polling after every state render (${accountReads.length} reads)`);
    passed('idle-sync-is-bounded', { requests: accountReads.length });

    await first.page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await eventually(async () => (await request(first.page, 'session')).data.account === null, 'logout cookie invalidated');
    await closeAccount(first.page);
    await nav(first.page, 'Abrir o PC do Bill');
    assert.equal(await first.page.getByLabel('Nome da Box', { exact: true }).inputValue(), 'Box convidada', 'logout must restore the untouched guest workspace');
    await first.page.evaluate(() => localStorage.setItem('myowndex_account_signout_v1', JSON.stringify('expired-account')));
    await first.page.reload();
    await first.page.locator('.account-header-button').waitFor();
    assert.equal(await first.page.evaluate(() => JSON.parse(localStorage.getItem('myowndex_account_signout_v1') || 'null')), null,
        'an expired cookie must finish a pending offline sign-out without endless retries');
    passed('pending-offline-signout-finishes-after-cookie-expiry');
    const secondCodes = await signup(first.page, secondUsername);
    assert.equal(secondCodes.length, 8);
    assert.equal((await cloud(first.page)).document?.boxes?.length || 0, 0, 'another account must not inherit private Boxes from a prior account');
    passed('logout-restores-guest-and-next-account-is-isolated');
    const otherAccount = (await cloud(first.page)).account;
    const joined = await roomRequest(first.page, `/api/rooms/${sharedRoom.code}/join`, {
        method: 'POST', body: { inviteCode: sharedRoom.inviteCode, displayName: 'Jogador QA' },
    });
    assert.equal(joined.status, 201);
    const playerLinked = await request(first.page, 'rooms', {
        method: 'POST', accountId: otherAccount.id,
        body: { code: sharedRoom.code, key: joined.data.playerKey, displayName: 'Jogador QA' },
    });
    assert.equal(playerLinked.status, 201);
    const playerRef = playerLinked.data.room;
    assert.equal(playerRef.role, 'player');
    const playerView = await roomRequest(first.page, `/api/rooms/${sharedRoom.code}`, { key: playerRef.key, accountId: otherAccount.id });
    assert.equal(playerView.status, 200);
    assert.equal(playerView.data.snapshot.gmNotes, undefined);
    const prohibited = await roomRequest(first.page, `/api/rooms/${sharedRoom.code}`, {
        method: 'PATCH', key: playerRef.key, accountId: otherAccount.id,
        body: { expectedRevision: playerView.data.revision, snapshot: { ...playerView.data.snapshot, sceneNotes: 'Player cannot control the narrator' } },
    });
    assert.equal(prohibited.status, 403);
    passed('account-room-player-resume-preserves-hidden-notes-and-narrator-permissions');
    const sameCookieTab = await first.context.newPage();
    sameCookieTab.on('pageerror', error => errors.push({ device: 'same-cookie-tab', message: error.message }));
    await sameCookieTab.goto(baseUrl);
    await sameCookieTab.locator('.account-header-button').waitFor();
    await openAccount(sameCookieTab);
    await sameCookieTab.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await eventually(async () => (await request(sameCookieTab, 'session')).data.account === null, 'same-cookie tab signs out');
    await login(sameCookieTab);
    await eventually(async () => await first.page.locator('.account-trainer-card p').innerText() === `@${username}`,
        'shared-cookie tab switches to the authenticated identity');
    assert.equal(await first.page.locator('.account-recovery-codes').count(), 0,
        'recovery codes from the previous account must not be rendered for the next identity');
    await sameCookieTab.close();
    passed('shared-cookie-tabs-switch-identity-and-hide-foreign-recovery-codes');
    assert.ok((await cloud(first.page)).document.boxes.some(box => box.name.startsWith('Box editada offline')));
    const foreign = await request(first.page, 'data', { accountId: 'another-account-id' });
    assert.equal(foreign.status, 409);
    assert.equal(foreign.data.code, 'ACCOUNT_SCOPE_CHANGED');
    passed('return-to-account-restores-data-and-rejects-foreign-scope');

    // UI lifecycle actions are tested below when available. These assertions
    // verify real server persistence/session rotation rather than mocked calls.
    await first.page.locator('.account-disclosure > summary').filter({ hasText: /^Alterar senha$/ }).click();
    await first.page.getByLabel('Senha atual', { exact: true }).fill(password);
    await first.page.getByLabel('Nova senha', { exact: true }).fill(changedPassword);
    await first.page.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
    await eventually(async () => (await request(second.page, 'session')).data.account === null, 'password rotation invalidated the other device');
    const rotatedCodes = await first.page.locator('.account-recovery-codes code').allTextContents();
    assert.equal(rotatedCodes.length, 8);
    assert.ok(!rotatedCodes.includes(originalCodes[0]), 'changing password must rotate recovery codes');
    await first.page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await openAccount(first.page);
    await first.page.getByRole('button', { name: 'Recuperar acesso', exact: true }).click();
    await layouts(first.page, 'recover');
    await first.page.getByLabel('Nome de usuário', { exact: true }).fill(username);
    await first.page.getByLabel('Código de recuperação', { exact: true }).fill(rotatedCodes[0]);
    await first.page.getByLabel('Nova senha', { exact: true }).fill(recoveredPassword);
    await first.page.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
    await eventually(async () => (await request(first.page, 'session')).data.account?.username === username, 'recovery creates authenticated session');
    assert.ok((await cloud(first.page)).document.boxes.some(box => box.name.startsWith('Box editada offline')));
    passed('password-rotation-and-one-time-recovery-preserve-account-data');

    await first.page.locator('.account-disclosure > summary').filter({ hasText: /^Remover conta$/ }).click();
    await first.page.getByLabel('Confirme sua senha', { exact: true }).fill(recoveredPassword);
    await first.page.getByRole('checkbox', { name: 'Quero remover esta conta da nuvem.', exact: true }).check();
    await first.page.getByRole('button', { name: 'Remover minha conta', exact: true }).click();
    await eventually(async () => (await request(first.page, 'session')).data.account === null, 'account deletion invalidated the session');
    const denied = await request(first.page, 'data', { accountId: initial.account.id });
    assert.equal(denied.status, 401);
    await closeAccount(first.page);
    await nav(first.page, 'Abrir o PC do Bill');
    assert.equal(await first.page.getByLabel('Nome da Box', { exact: true }).inputValue(), 'Box convidada');
    passed('deletion-revokes-cloud-account-and-preserves-guest-data');
    const retainedRoom = await roomRequest(first.page, `/api/rooms/${sharedRoom.code}`, { key: sharedRoom.narratorKey });
    assert.equal(retainedRoom.status, 200, 'deleting an account must not delete its shared adventure');
    assert.equal(retainedRoom.data.snapshot.gmNotes, 'Notas privadas de QA');
    const deletedRoom = await roomRequest(first.page, `/api/rooms/${sharedRoom.code}`, { method: 'DELETE', key: sharedRoom.narratorKey });
    assert.equal(deletedRoom.status, 200);
    sharedRoom = null;
    passed('account-deletion-leaves-shared-adventure-intact');

    assert.deepEqual(errors, [], 'uncaught browser errors');
    const unexpected = consoleErrors.filter(error => !/Failed to load resource:.*(?:401|403|409|ERR_INTERNET_DISCONNECTED)|net::ERR_INTERNET_DISCONNECTED|TURBOPACK/.test(error.message));
    assert.deepEqual(unexpected, [], 'unexpected browser console errors');
    await fs.writeFile(process.env.MYOWNDEX_ACCOUNTS_REPORT || '/tmp/myowndex-accounts-browser-report.json', JSON.stringify({ checks, errors, consoleErrors }, null, 2));
    console.log(`Passed ${checks.length} account checkpoints against real local SQL; no uncaught page errors.`);
} catch (error) {
    if (first) await first.page.screenshot({ path: '/tmp/myowndex-accounts-failure.png' }).catch(() => {});
    await fs.writeFile('/tmp/myowndex-accounts-browser-failure.json', JSON.stringify({ checks, errors, consoleErrors, message: error.message }, null, 2));
    throw error;
} finally {
    for (const context of contexts) await context.setOffline(false).catch(() => {});
    await browser.close();
}

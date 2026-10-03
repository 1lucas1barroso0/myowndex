// Destructive paths use brand-new QA accounts on the loopback Hrana fixture.
import assert from "node:assert/strict";
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3001";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname));
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,
    args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
const pages = [];
const errors = [];
const checks = [];
const username = `erase_${Date.now().toString(36)}`;
const password = "MyOwnDex! QA erase copy 2026";
let identity;
const passed = label => { checks.push(label); console.log(JSON.stringify({ passed: label })); };
async function page() {
    const value = await context.newPage(); pages.push(value);
    value.setDefaultTimeout(30000);
    value.on("pageerror", error => errors.push(error.message));
    value.on("dialog", dialog => dialog.type() === "beforeunload" ? dialog.dismiss() : dialog.accept());
    await value.goto(baseUrl);
    await value.locator(".app-nav").waitFor();
    return value;
}
async function api(value, path, { method = "GET", body, id = identity?.id } = {}) {
    return value.evaluate(async ({ path, method, body, id }) => {
        const response = await fetch(`/api/account/${path}`, { method, credentials: "same-origin", cache: "no-store",
            headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}),
                ...(id ? { "x-myowndex-account": id } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, data: await response.json() };
    }, { path, method, body, id });
}
async function account(value) {
    if (!await value.locator(".account-dialog").isVisible()) await value.locator(".account-header-button").click();
    await value.locator(".account-dialog").waitFor();
}
async function close(value) {
    if (await value.locator(".account-dialog").isVisible()) await value.getByRole("button", { name: "Fechar conta", exact: true }).click();
}
async function sync(value) {
    await account(value);
    const button = value.getByRole("button", { name: "Sincronizar agora", exact: true });
    await button.waitFor();
    await button.click();
    await value.locator(".account-sync-label").filter({ hasText: "Conta atualizada" }).waitFor();
}
async function login(value) {
    await account(value);
    await value.getByLabel("Nome de usuário", { exact: true }).fill(username);
    await value.getByLabel("Senha", { exact: true }).fill(password);
    await value.getByRole("button", { name: "Entrar na conta", exact: true }).click();
    await value.getByRole("button", { name: "Sincronizar agora", exact: true }).waitFor();
    await sync(value);
}
async function createBox(value) {
    await close(value);
    await value.getByRole("button", { name: "Abrir a Pokédex", exact: true }).click();
    await value.getByRole("button", { name: "Consultar Bulbasaur na Pokédex", exact: true }).click();
    await value.getByRole("button", { name: "Adicionar à equipe", exact: false }).click();
    await value.locator(".pc-partner-card").first().waitFor();
}
async function keys(value, scope) {
    return value.evaluate(async scope => {
        const prefix = `myowndex_account:${encodeURIComponent(scope)}:`;
        const local = Object.keys(localStorage).filter(key => key.startsWith(prefix));
        const database = await new Promise((resolve, reject) => {
            const request = indexedDB.open("myowndex-player-data-v1", 1);
            request.onsuccess = () => resolve(request.result); request.onerror = reject;
        });
        const durable = await new Promise((resolve, reject) => {
            const transaction = database.transaction("snapshots", "readonly");
            const request = transaction.objectStore("snapshots").getAllKeys();
            transaction.oncomplete = () => resolve(request.result.filter(key => key.startsWith(prefix)));
            transaction.onerror = reject;
        }); database.close(); return { local, durable };
    }, scope);
}
async function erase(value, label) {
    const section = value.locator(".account-copy-management");
    if (!await section.evaluate(element => element.open)) await section.locator("summary").click();
    await value.getByRole("button", { name: label, exact: true }).click();
    const confirm = section.locator("form");
    await confirm.getByRole("checkbox").check();
    await confirm.getByRole("button", { name: "Apagar", exact: true }).click();
    await confirm.waitFor({ state: "hidden" });
}
try {
    const first = await page();
    await createBox(first);
    await account(first);
    await first.getByRole("button", { name: "Criar conta", exact: true }).click();
    await first.getByLabel("Nome de usuário", { exact: true }).fill(username);
    await first.getByLabel("Senha", { exact: true }).fill(password);
    await first.getByRole("checkbox", { name: "Adicionar meus dados deste dispositivo.", exact: true }).uncheck();
    await first.getByRole("button", { name: "Criar minha conta", exact: true }).click();
    await first.locator(".account-trainer-card").waitFor();
    identity = (await api(first, "session", { id: null })).data.account;
    await first.getByRole("button", { name: "Já guardei os códigos", exact: true }).click();
    await createBox(first);
    await sync(first);
    assert.equal((await api(first, "data")).data.document.boxes[0].pokemon.length, 1);
    const otherTab = await page();
    await account(otherTab);
    await otherTab.locator(".account-trainer-card").waitFor();
    await first.getByRole("checkbox", { name: "Apagar também a cópia desta conta neste dispositivo.", exact: true }).check();
    await first.getByRole("button", { name: "Sair da conta", exact: true }).click();
    await first.getByRole("button", { name: "Entrar na conta", exact: true }).waitFor();
    await otherTab.getByRole("button", { name: "Entrar na conta", exact: true }).waitFor();
    assert.deepEqual(await keys(first, identity.id), { local: [], durable: [] });
    await close(otherTab); await otherTab.close();
    assert.deepEqual(await keys(first, identity.id), { local: [], durable: [] });
    passed("Sign-out can erase both account-copy stores; another open tab and its pagehide cannot recreate it");
    await close(first);
    await first.getByRole("button", { name: "Abrir o PC do Bill", exact: true }).click();
    assert.equal(await first.locator(".pc-partner-card").count(), 1);
    passed("Erasing an account device copy keeps the separate guest Box");
    await login(first);
    assert.equal((await api(first, "data")).data.document.boxes[0].pokemon.length, 1);
    assert.ok((await keys(first, identity.id)).durable.length > 0);
    passed("A deliberate fresh login restores the cloud PC and accepts new durable saves");
    await erase(first, "Apagar cópias anteriores");
    assert.equal((await api(first, "data?previous=1")).data.document, null);
    assert.equal((await api(first, "data")).data.document.boxes[0].pokemon.length, 1);
    passed("Confirmed previous-copy erase keeps the current cloud document intact");
    await erase(first, "Apagar dados usados sem conta");
    assert.equal((await api(first, "data")).data.document.boxes[0].pokemon.length, 1);
    passed("The separate guest backup can be erased while the signed-in account remains intact");
    await close(first);
    await first.evaluate(async () => {
        const key = "myowndex_account:disconnected-qa:myowndex_rotom_v4";
        localStorage.setItem(key, JSON.stringify({ schema: 4, teams: [] }));
        const request = indexedDB.open("myowndex-player-data-v1", 1);
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = reject; });
        await new Promise((resolve, reject) => {
            const transaction = database.transaction("snapshots", "readwrite");
            transaction.objectStore("snapshots").put({ key, value: { schema: 4, teams: [] }, writtenAt: Date.now() });
            transaction.oncomplete = resolve; transaction.onerror = reject;
        }); database.close();
    });
    await account(first);
    await erase(first, "Apagar cópias de contas desconectadas");
    assert.deepEqual(await keys(first, "disconnected-qa"), { local: [], durable: [] });
    assert.ok((await keys(first, identity.id)).durable.length > 0);
    passed("Inactive device copies can be erased without touching the active account");
    for (const width of [320, 390, 768, 1280]) {
        await first.setViewportSize({ width, height: 900 });
        const layout = await first.locator(".account-dialog").evaluate(element => {
            const buttons = [...element.querySelectorAll("button")].filter(button => button.getClientRects().length);
            return { width: innerWidth, documentWidth: document.documentElement.scrollWidth,
                smallButtons: buttons.filter(button => button.getBoundingClientRect().height < 43.5 || button.getBoundingClientRect().width < 43.5).map(button => button.textContent) };
        });
        assert.ok(layout.documentWidth <= width + 1); assert.deepEqual(layout.smallButtons, []);
    }
    passed("Account deletion controls fit 320–1280px and retain 44px touch targets");
    const remove = first.locator(".account-disclosure").filter({ has: first.locator("summary").getByText("Remover conta", { exact: true }) });
    await remove.locator("summary").click();
    await remove.getByLabel("Confirme sua senha", { exact: true }).fill(password);
    await remove.getByRole("checkbox", { name: "Apagar também a cópia desta conta neste dispositivo.", exact: true }).check();
    await remove.getByRole("checkbox", { name: "Quero remover esta conta da nuvem.", exact: true }).check();
    await remove.getByRole("button", { name: "Remover minha conta", exact: true }).click();
    await first.getByRole("button", { name: "Entrar na conta", exact: true }).waitFor();
    assert.equal((await api(first, "session", { id: null })).data.account, null);
    assert.deepEqual(await keys(first, identity.id), { local: [], durable: [] });
    passed("Account removal can also erase its isolated local copy in one confirmed flow");
    assert.deepEqual(errors, []); passed("No browser runtime errors");
} finally {
    const available = pages.find(value => !value.isClosed());
    if (available && identity) {
        const session = await api(available, "session", { id: null }).catch(() => null);
        if (session?.data?.account?.id === identity.id) await api(available, "delete", { method: "POST", body: { password } }).catch(() => {});
    }
    await context.close(); await browser.close();
}
console.log(JSON.stringify({ total: checks.length, checks }));

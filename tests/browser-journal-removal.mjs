// Mutating QA requires a local server and an isolated real SQLite fixture.
import assert from 'node:assert/strict';
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3001';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname));
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
const contexts = [], errors = [], checks = [];
let remote = null, owner;
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  contexts.push(context);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl); await page.locator('.app-nav').waitFor(); return page;
};
const api = async (page, path, method, key, data) => {
  const response = await page.request.fetch(`${baseUrl}${path}`, { method, headers: { 'x-myowndex-room-protocol': '3', ...(key ? { 'x-myowndex-room-key': key } : {}) }, ...(data ? { data } : {}) });
  assert.ok(response.ok(), `${method} ${path} returned ${response.status()}`); return response.json();
};
const enter = async (page, session) => {
  await page.evaluate(session => localStorage.setItem('myowndex_live_room_v1', JSON.stringify(session)), session);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir a Central da Aventura', exact: true }).click();
  await page.locator('.room-app').waitFor();
  if (await page.locator('.room-mobile-nav').isVisible()) await page.getByRole('button', { name: 'Dados e ações', exact: true }).click();
  const diary = page.locator('.room-tool').filter({ has: page.getByText('Diário da aventura', { exact: true }) });
  if (!await diary.evaluate(element => element.open)) await diary.locator(':scope > summary').click();
  return diary;
};
const confirm = async (page, name) => {
  const dialog = page.getByRole('alertdialog'); await dialog.waitFor();
  await dialog.getByRole('button', { name, exact: true }).click(); await dialog.waitFor({ state: 'detached' });
};
try {
  owner = await newPage();
  remote = await api(owner, '/api/rooms', 'POST', '', { title: 'Diário QA', narratorName: 'Narrador QA', snapshot: { gmNotes: 'Nota privada', sceneNotes: 'Cena preservada', round: 3 } });
  const joined = await api(owner, `/api/rooms/${remote.code}/join`, 'POST', '', { inviteCode: remote.inviteCode, displayName: 'Jogador QA' });
  await api(owner, `/api/rooms/${remote.code}/events`, 'POST', remote.narratorKey, { type: 'message', payload: { text: 'Mensagem do Narrador' } });
  await api(owner, `/api/rooms/${remote.code}/events`, 'POST', joined.playerKey, { type: 'message', payload: { text: 'Mensagem do Jogador' } });
  let diary = await enter(owner, { code: remote.code, key: remote.narratorKey, role: 'narrator', displayName: 'Narrador QA' });
  const message = diary.locator('article').filter({ hasText: 'Mensagem do Narrador' });
  await message.locator('.journal-entry-options > summary').click();
  await message.getByRole('button', { name: 'Apagar registro', exact: true }).click();
  await owner.getByRole('alertdialog').getByRole('button', { name: 'Manter registros', exact: true }).click();
  assert.equal(await message.count(), 1);
  await message.getByRole('button', { name: 'Apagar registro', exact: true }).click();
  await confirm(owner, 'Apagar registro');
  assert.equal(await diary.locator('article').filter({ hasText: 'Mensagem do Narrador' }).count(), 0);
  checks.push('narrator individual deletion is confirmed and removable without changing scene');
  const player = await newPage();
  const playerDiary = await enter(player, { code: remote.code, key: joined.playerKey, role: 'player', playerId: joined.playerId, displayName: 'Jogador QA' });
  assert.equal((await player.locator('.room-role-badge').innerText()).toLocaleLowerCase('pt-BR'), 'jogador');
  assert.equal(await playerDiary.locator('article').filter({ hasText: 'A aventura “' }).locator('.journal-entry-options').count(), 0);
  const own = playerDiary.locator('article').filter({ hasText: 'Mensagem do Jogador' });
  await own.locator('.journal-entry-options > summary').click();
  await own.getByRole('button', { name: 'Apagar registro', exact: true }).click(); await confirm(player, 'Apagar registro');
  await owner.waitForFunction(() => ![...document.querySelectorAll('.event-log p')].some(p => p.textContent.includes('Mensagem do Jogador')));
  checks.push('player can delete own entry and all connected participants receive deletion');
  const before = await api(owner, `/api/rooms/${remote.code}`, 'GET', remote.narratorKey);
  await diary.locator('.journal-options > summary').click();
  await diary.getByRole('button', { name: 'Limpar Diário', exact: true }).click(); await confirm(owner, 'Limpar Diário');
  const after = await api(owner, `/api/rooms/${remote.code}`, 'GET', remote.narratorKey);
  assert.deepEqual(after.snapshot, before.snapshot); assert.equal(after.revision, before.revision); assert.equal(after.events.length, 0);
  await owner.reload(); await owner.getByRole('button', { name: 'Abrir a Central da Aventura', exact: true }).click(); await owner.locator('.room-app').waitFor();
  checks.push('remote clear survives reload and preserves private notes, round and revision');

  const local = await newPage();
  await local.evaluate(() => {
    localStorage.clear();
  });
  await local.reload();
  await local.getByRole('button', { name: 'Abrir a Central da Aventura', exact: true }).click();
  await local.getByRole('button', { name: /Começar uma aventura local/ }).click();
  if (await local.locator('.room-mobile-nav').isVisible()) await local.getByRole('button', { name: 'Dados e ações', exact: true }).click();
  const localDiary = local.locator('.room-tool').filter({ has: local.getByText('Diário da aventura', { exact: true }) });
  await localDiary.locator(':scope > summary').click();
  await localDiary.getByLabel('Mensagem', { exact: true }).fill('Minha mensagem'); await localDiary.getByRole('button', { name: 'Enviar', exact: true }).click();
  await localDiary.locator('article').filter({ hasText: 'Minha mensagem' }).waitFor();
  for (const theme of ['Claro', 'Escuro']) for (const width of [320, 390, 768, 1280]) {
    await local.setViewportSize({ width, height: 844 });
    await local.evaluate(theme => { document.documentElement.dataset.theme = theme === 'Claro' ? 'normal' : 'night'; }, theme);
    const fit = await localDiary.evaluate(element => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, small: [...element.querySelectorAll('button,summary')].filter(node => node.getClientRects().length && !node.closest('details:not([open])') && node.getBoundingClientRect().height < 43.5).map(node => node.textContent) }));
    assert.equal(fit.overflow, false, `${theme}/${width} overflow`); assert.deepEqual(fit.small, [], `${theme}/${width} touch targets`);
  }
  checks.push('journal actions are legible and fit 320/390/768/1280 in both appearances');
  const preserved = await local.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot);
  await localDiary.locator('.journal-options > summary').click(); await localDiary.getByRole('button', { name: 'Limpar Diário', exact: true }).click(); await confirm(local, 'Limpar Diário');
  assert.deepEqual(await local.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).snapshot), preserved);
  assert.equal(await local.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).events.length), 0);
  await local.reload(); await local.getByRole('button', { name: 'Abrir a Central da Aventura', exact: true }).click(); await local.locator('.room-app').waitFor();
  assert.equal(await local.evaluate(() => JSON.parse(localStorage.getItem('myowndex_local_room_v1')).events.length), 0);
  checks.push('local clear is durable and preserves the adventure snapshot');
  assert.deepEqual(errors, []); checks.push('no browser runtime errors');
} finally {
  if (remote && owner) await api(owner, `/api/rooms/${remote.code}`, 'DELETE', remote.narratorKey, {});
  for (const context of contexts) await context.close(); await browser.close();
  console.log(JSON.stringify({ checks, errors }, null, 2));
}

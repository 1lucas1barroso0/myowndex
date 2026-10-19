// Isolated regression: edit movement without dropping mobile focus and retain
// game-specific PP in each mode. Independent of older form-navigation tests.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.MYOWNDEX_SMOKE_URL || 'http://127.0.0.1:3000');
  await page.locator('#pokemon-search').fill('Bulbasaur');
  await page.getByRole('button',{name:'Consultar Bulbasaur na Pokédex',exact:true}).click();
  await page.getByRole('button',{name:/Adicionar à equipe/}).click();
  await page.getByLabel('Jogo de referência',{exact:true}).selectOption('red-blue');
  await page.locator('.pc-partner-card').first().click();
  const editor=page.locator('.pokemon-editor');
  const field=editor.getByLabel('Movimento 1',{exact:true});
  await field.focus();
  for (const key of ['t','a','c']) {
    await field.press(key);
    assert.equal(await field.evaluate(el=>document.activeElement===el),true,'Movement input retains focus on narrow screens');
  }
  await field.fill('tackle');
  const card=editor.locator('.editor-move-field').first();
  await card.locator('.editor-move-description > summary').waitFor({timeout:30000});
  await card.locator('.editor-move-description > summary').click();
  const stat=name=>card.locator('.editor-move-facts > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+name+'$')})}).locator('dd').innerText();
  for (const mode of ['rpg','game','free']) {
    await page.locator('.game-style-options [data-mode="'+mode+'"]').click();
    assert.equal(await stat('Precisão'),'95%',mode+' uses selected historic accuracy');
    assert.equal(await card.getByLabel('PP atual',{exact:true}).inputValue(),await stat('PP máximo'),mode+' uses selected historic PP');
  }
  assert.equal(await stat('Poder'),'35','Livre uses selected game power');
  assert.deepEqual(errors,[],'No browser JavaScript failures');
  console.log('Mobile typing, descriptions and game-specific PP passed in RPG/Jogos/Livre.');
} finally { await browser.close(); }

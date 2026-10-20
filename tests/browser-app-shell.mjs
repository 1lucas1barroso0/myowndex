// App navigation, density and tool sheets in an isolated guest profile.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
const errors = [];
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
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); };

try {
 await page.goto(baseUrl);

 await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();
 await page.locator('.pc-partner-card').first().click();
 const editor=page.locator('.pokemon-editor');
 assert.equal(await editor.getByText('Características',{exact:true}).count(),0);
 assert.equal(await editor.locator('.editor-summary-caption').count(),0,'No redundant summary title');
 assert.equal(await editor.locator('.editor-summary-facts dt').count(),5,'Summary holds main Pokémon facts');
 assert.equal(await editor.locator('.editor-summary-customize').evaluate(e=>e.open),false);
 await openDetails(editor.locator('.editor-summary-customize'));
 assert.ok(await editor.locator('.friendship-scale-values').isVisible(),'Friendship scales are readable while editing');
 await openDetails(editor.locator('.editor-battle-mechanics'));
 const teraToggle=editor.getByRole('checkbox',{name:'Permitir Terastalização'});
 const teraSelect=editor.getByRole('combobox',{name:'Tipo Tera'});
 assert.equal(await teraToggle.isChecked(),true);
 const priorType=await teraSelect.inputValue();
 await teraToggle.uncheck();
 assert.equal(await teraSelect.isDisabled(),true,'A ficha não permite escolher Tipo Tera desabilitado');
 await teraToggle.check();
 assert.equal(await teraSelect.isEnabled(),true,'O Tipo Tera pode ser usado novamente');
 assert.equal(await teraSelect.inputValue(),priorType,'Habilitar preserva o Tipo Tera');
 await openDetails(editor.locator('.editor-trait-reference'));
 const reference=editor.locator('.reference-text').first();
 await reference.waitFor();
 assert.equal(await reference.evaluate(e=>getComputedStyle(e).display),'grid');
 const toggle=reference.locator('.reference-language-toggle');
 const before=await reference.locator('p').innerText();
 await toggle.click();assert.notEqual(await reference.locator('p').innerText(),before);await toggle.click();
 for(const width of [320,390,768,1280,1440])for(const theme of ['normal','night']) {
  await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const metrics=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,placeholders:document.querySelectorAll('[placeholder]').length,header:document.querySelector('.app-header').getBoundingClientRect().height,escaped:[...document.querySelectorAll('.app-header button')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth}).map(e=>e.textContent)}));
  assert.equal(metrics.w,metrics.scroll);assert.equal(metrics.placeholders,0);assert.deepEqual(metrics.escaped,[]);
  const brand=await page.locator('.app-brand h1').evaluate(element=>{const r=element.getBoundingClientRect(),parent=element.closest('.app-brand-cluster').getBoundingClientRect();return {name:element.textContent,x:r.x,right:r.right,containerRight:parent.right};});
  assert.equal(brand.name,'MyOwnDex');assert.ok(brand.x>=0&&brand.right<=width+1&&brand.right<=brand.containerRight+1,'Brand name stays fully readable');
  const clippedNavigation=await page.locator('.nav-capsule').evaluateAll(buttons=>buttons.flatMap(button=>{
   const b=button.getBoundingClientRect();return [...button.querySelectorAll(':scope > span')].filter(child=>{
    const r=child.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1;
   }).map(child=>child.textContent);
  }));
  assert.deepEqual(clippedNavigation,[],'Navigation labels and icons stay inside their targets');
  if(width===390)assert.ok(metrics.header<=260,'The full curtain leaves room for the game');
  console.log(width,theme,metrics.header);

 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.scrollTo(0,0));
 const grip=page.locator('.app-curtain-grip'),header=page.locator('.app-header');
 assert.equal(await header.getAttribute('data-curtain-level'),'3');
 const fullHeight=await header.evaluate(e=>e.getBoundingClientRect().height);
 await grip.click();await page.waitForTimeout(300);
 assert.equal(await header.getAttribute('data-curtain-level'),'0');
 assert.equal(await page.locator('.app-nav').getAttribute('aria-hidden'),'true','Hidden navigation is absent from accessibility tree');
 assert.equal(await page.locator('.app-nav').evaluate(e=>e.hasAttribute('inert')),true,'Hidden navigation stays unfocusable');
 const compactHeight=await header.evaluate(e=>e.getBoundingClientRect().height);
 assert.ok(compactHeight<fullHeight-50,'Curtain opens usable play space');
 for(const expected of ['1','2','3']) {await grip.click();assert.equal(await header.getAttribute('data-curtain-level'),expected);}
 assert.equal(await page.locator('.app-preferences').evaluate(e=>e.hasAttribute('inert')),false);
 await grip.focus();await page.keyboard.press('ArrowUp');
 assert.equal(await header.getAttribute('data-curtain-level'),'2');
 await page.keyboard.press('ArrowDown');
 assert.equal(await header.getAttribute('data-curtain-level'),'3');
 await page.waitForTimeout(300);
 let box=await grip.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,Math.max(8,box.y-130),{steps:8});
 await page.mouse.up();
 assert.ok(Number(await header.getAttribute('data-curtain-level'))<3,'Upward swipe finds another stop');
 box=await grip.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,Math.min(800,box.y+260),{steps:8});
 await page.mouse.up();
 assert.equal(await header.getAttribute('data-curtain-level'),'3','Downward swipe restores all menu groups');
 for(const [openName,closeName] of [['Abrir Dados','Fechar dados'],['Gerar Pokémon','Fechar gerador'],['Entrar ou criar conta','Fechar cartão de Treinador']]) {
  const button=page.getByRole('button',{name:openName,exact:true}).first();await button.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  const frame=await dialog.evaluate(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,overflow:e.scrollWidth-e.clientWidth}));
  assert.equal(frame.x,0);assert.equal(frame.w,390);assert.equal(frame.overflow,0);
  assert.ok(frame.h<=844*.92+1,'Tools fit the viewport without a forced blank height');
  const layout=await dialog.evaluate(e=>{
   const header=e.querySelector('header'),r=header.getBoundingClientRect(),p=header.querySelector('.pokemon-companion').getBoundingClientRect(),close=header.querySelector('button').getBoundingClientRect();
   const body=e.querySelector('.generator-content,.account-dialog-content,.local-dice-dialog-content');
   const title=header.querySelector('h2').getBoundingClientRect();
   return {
    headerHeight:r.height,partnerCenter:p.y+p.height/2,closeCenter:close.y+close.height/2,
    blank:body.clientHeight-body.scrollHeight,
    titleVisible:title.width>0&&title.left>=r.left-1&&title.right<=r.right+1,
    titleClear:title.right<=p.left+1,partnerClear:p.right<=close.left+1,
    artFits:p.top>=r.top-1&&p.bottom<=r.bottom+1,
   };
  });
  assert.ok(layout.headerHeight>=90&&layout.headerHeight<=104,'Tool title and Pokémon deserve a visible, measured header');
  assert.ok(layout.titleVisible&&layout.titleClear&&layout.partnerClear&&layout.artFits,'Title, Pokémon and close never obstruct or crop each other');
  assert.ok(Math.abs(layout.partnerCenter-layout.closeCenter)<1,'Partner and close share a row');
  assert.ok(layout.blank<=1,'Content does not reserve empty scroll space');
  console.log(openName,frame);

  const close=dialog.getByRole('button',{name:closeName,exact:true});
  if(await close.count())await close.click();else await dialog.locator('button').filter({hasText:'×'}).first().click();
  assert.equal(await button.evaluate(e=>document.activeElement===e),true);
 }
 const area=page.locator('#main-content');await area.evaluate(e=>e.scrollTop=300);const original=await area.evaluate(e=>e.scrollTop);
 await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();assert.equal(await area.evaluate(e=>e.scrollTop),original);
 await page.getByRole('button',{name:'Abrir o Guia do Treinador',exact:true}).click();await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();await page.waitForTimeout(150);assert.equal(await area.evaluate(e=>e.scrollTop),original);
 await page.goBack();await page.waitForTimeout(150);assert.equal(await area.evaluate(e=>e.scrollTop),0);
 await page.goForward();await page.waitForTimeout(150);assert.equal(await area.evaluate(e=>e.scrollTop),original);
 console.log('PASS app controls, separate descriptions, language toggle, sheets, focus, 5 widths / 2 themes, no placeholders, stable navigation');assert.deepEqual(errors,[]);
} finally {await browser.close();}

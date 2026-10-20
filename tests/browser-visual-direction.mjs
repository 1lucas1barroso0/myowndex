// Product direction: coherent grouped controls, readable Pokémon and play before setup.
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


const palette = async selector => {
 await page.locator(selector).first().waitFor({state:"visible"});
 const values=await page.locator(selector).evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length&&!e.disabled).map(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,color:s.color,border:s.borderTopColor};}));
 assert.ok(values.length>=2,`${selector}: a real group is visible`);
 assert.equal(new Set(values.map(v=>JSON.stringify(v))).size,1,`${selector}: grouped buttons share colors`);
};
const shot = async name => {if(process.env.MYOWNDEX_QA_SCREENSHOTS)await page.screenshot({path:`${process.env.MYOWNDEX_QA_SCREENSHOTS}/${name}.png`});};
try {
 await page.goto(baseUrl);
 await page.getByRole('button',{name:'Abrir a Central da Aventura',exact:true}).click();
 const lobby=page.locator('.room-lobby');
 assert.equal(await lobby.evaluate(e=>getComputedStyle(e).animationName),'none','Navigation leaves the content fully visible');
 assert.equal(await lobby.locator('form:visible').count(),0,'Start with play choices, not forms');
 await lobby.getByRole('button',{name:'Começar uma aventura local',exact:false}).waitFor();
 for(const width of [320,390,768,1280])for(const theme of ['normal','night']) {
  await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.waitForFunction(()=>{
   const root=document.querySelector('.app-header'),bounds=root.getBoundingClientRect();
   if(innerWidth>700)return !root.style.height;
   const group=root.querySelector('.app-preferences').getBoundingClientRect(),grip=root.querySelector('.app-curtain-grip').getBoundingClientRect();
   return Math.abs(bounds.height-(group.bottom-bounds.top+grip.height+4))<1;
  });
  for(const selector of ['.app-nav > button','.app-tool-actions > button','.game-style-options > button','.appearance-options > button','.room-entry-choices > button'])await palette(selector);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const companions=await page.locator('.app-tool-actions .pokemon-companion').evaluateAll(nodes=>nodes.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  assert.ok(companions.every(r=>r.w>=40&&r.h>=40),'Header Pokémon remain recognizable');
  const cropped=await page.locator('.app-header button').evaluateAll(nodes=>nodes.flatMap(button=>{const b=button.getBoundingClientRect();return [...button.querySelectorAll(':scope > span')].filter(e=>{const r=e.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1;}).map(e=>e.textContent);}));
  assert.deepEqual(cropped,[],`Labels and art stay inside their buttons at ${width} ${theme}`);
  if(width===390){assert.ok(await page.locator('.app-header').evaluate(e=>e.getBoundingClientRect().height)<=260);await shot(`direction-lobby-${theme}`);}
 }
 await page.setViewportSize({width:390,height:844});
 const create=page.getByRole('button',{name:'Criar uma aventura em grupo',exact:true});
 const join=page.getByRole('button',{name:'Entrar via convite',exact:true});
 await create.click();
 const narrator=lobby.getByRole('form',{name:'Criar aventura',exact:true});
 await narrator.getByLabel('Nome da aventura',{exact:true}).fill('Bosque dos Pokémon');
 await narrator.getByLabel('Seu nome na aventura',{exact:true}).fill('Narrador');
 await join.click();
 const player=lobby.getByRole('form',{name:'Entrar na aventura',exact:true});
 await player.getByLabel('Seu nome na aventura',{exact:true}).fill('Treinador');
 await player.getByLabel('Link ou convite da aventura',{exact:true}).fill('meu convite');
 await create.click();assert.equal(await narrator.getByLabel('Nome da aventura',{exact:true}).inputValue(),'Bosque dos Pokémon');
 await join.click();assert.equal(await player.getByLabel('Seu nome na aventura',{exact:true}).inputValue(),'Treinador');
 await join.click();assert.equal(await lobby.locator('form:visible').count(),0);
 await page.getByRole('button',{name:'Abrir a Pokédex',exact:true}).click();await palette('.dex-generations > button');
 await page.getByRole('button',{name:'Geração I',exact:true}).click();await palette('.dex-generations > button');
 await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();await palette('.pc-toolbar-actions > button');
 await page.locator('.pc-partner-card').first().click();await palette('.pc-editor-actions > button');
 await page.getByRole('button',{name:'Remover da Box',exact:true}).click();await palette('.confirm-dialog-actions > button');
 await page.keyboard.press('Escape');
 let primaryColor;
 for(const [open,close,selector] of [['Abrir Dados','Fechar dados','.local-dice-pages > button'],['Entrar ou criar conta','Fechar conta','.account-pages > button']]) {
  await page.getByRole('button',{name:open,exact:true}).first().click();await palette(selector);
  if(open==='Abrir Dados'){await palette('.local-dice-tabs > button');await page.getByRole('button',{name:'d100 Chance',exact:false}).click();await palette('.local-dice-tabs > button');}
  const companion=await page.getByRole('dialog').locator('header > .pokemon-companion').boundingBox();assert.ok(companion.width>=56&&companion.height>=56);
  const actionColor=await page.getByRole('dialog').locator(open==='Abrir Dados'?'.local-dice-submit > button':'.account-primary').evaluate(e=>getComputedStyle(e).backgroundColor);
  if(primaryColor)assert.equal(actionColor,primaryColor,'Main actions share the same emphasis');else primaryColor=actionColor;
  await shot(open==='Abrir Dados'?'direction-dice':'direction-account');
  await page.getByRole('button',{name:close,exact:true}).click();
 }
 await page.getByRole('button',{name:'Gerar Pokémon',exact:true}).first().click();
 const generator=page.getByRole('dialog',{name:'Gerar Pokémon',exact:true});
 assert.equal(await generator.locator('.generator-options .generator-primary').evaluate(e=>getComputedStyle(e).backgroundColor),primaryColor);
 await shot('direction-generator');await page.getByRole('button',{name:'Fechar gerador',exact:true}).click();
 await page.getByRole('button',{name:'Abrir a Central da Aventura',exact:true}).click();
 await lobby.getByRole('button',{name:'Começar uma aventura local',exact:false}).click();
 await page.locator('.room-app').waitFor();await palette('.room-phase-options > button');
 assert.deepEqual(errors,[]);
 console.log('PASS coherent colors in grouped controls, visible Pokémon, play-first Adventure, preserved role drafts and local play');
} catch(error) {await shot('direction-failure');throw error;} finally {await browser.close();}

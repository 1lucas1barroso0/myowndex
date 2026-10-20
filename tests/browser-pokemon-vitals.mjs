// Real Shiny and HP editing in a disposable, current-schema local Box.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless: true, executablePath: process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args: ["--no-sandbox"], ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1,::1" } } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion:"reduce" });
const page = await context.newPage();
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
const errors = [];
const checks = [];
page.on("pageerror", error => errors.push(error.message));
const keys = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
const species = { id: 1, name: "bulbasaur", species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" }, height: 7, weight: 69, types: [{ type: { name: "grass" } }, { type: { name: "poison" } }], stats: [45,49,49,65,65,45].map((base_stat, index) => ({ base_stat, stat: { name: keys[index] } })), sprites: { front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" }, moves: [], abilities: [{ ability: { name: "overgrow" } }] };
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
    localStorage.setItem("myowndex_rotom_v4", JSON.stringify({ schema: 5, savedAt: Date.now(), teams: [{ id: "growth-box", shareId: "growth-box", name: "Box do crescimento", updatedAt: Date.now(), rpgScale: 2, versionGroup: "auto", pokemon: [{ id: "growth-partner", nickname: "Bulbasaur", species, level: 100, nature: "hardy", ability: "overgrow", item: "leftovers", genderRate: 1, friendship: 70, moves: ["", "", "", ""], ivs: { hp:0 }, evs: {}, rpg: { scaleVersion: 2, consumedItem: "leftovers", xp: 0, currentHp: 3, notes: "Preservar a jornada" } }] }] }));
}, species);
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); };

try {
 const fs=await import('node:fs/promises'); const directory=process.env.MYOWNDEX_QA_SCREENSHOTS||'/tmp/myowndex48-review';await fs.mkdir(directory,{recursive:true});
 await page.goto(baseUrl);await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();await page.locator('.pc-partner-card').first().click();
 const editor=page.locator('.pokemon-editor'), card=editor.locator('.editor-header'), meter=card.getByRole('meter',{name:'HP',exact:true});
 await page.waitForFunction(()=>{const i=document.querySelector('.editor-header img');return i&&i.complete&&i.naturalWidth>0;});
 for(const width of [320,390,768,1280]) for(const theme of ['normal','night']) {
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await card.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
  const box=await card.boundingBox();assert.ok(box.height<=420,`compact card ${width} ${theme}: ${box.height}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await meter.getAttribute('aria-valuenow'),'3');assert.equal(await meter.getAttribute('aria-valuemax'),'20');
  const track=await meter.locator('.pokemon-hp-track').boundingBox();assert.ok(track.width>=95&&track.height>=8,'HP is legible beside the portrait');
  await page.waitForFunction(()=>{const f=document.querySelector('.editor-portrait-stage .pokemon-sized-sprite'),i=f?.querySelector('img');return f&&getComputedStyle(f).opacity==='1'&&i?.complete&&i.naturalWidth>0;});
  await page.screenshot({path:`${directory}/hp-${width}-${theme}.png`});checks.push(`card ${width} ${theme}`);
 }
 await page.setViewportSize({width:390,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='normal');
 await openDetails(editor.locator('.editor-summary-customize'));
 const shiny=editor.getByLabel('Shiny',{exact:true}); await shiny.focus();await page.keyboard.press('Space'); assert.equal(await shiny.isChecked(),true);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('myowndex_rotom_v4')).teams[0].pokemon[0].shiny===true);
 await page.waitForFunction(()=>{const i=document.querySelector('.editor-portrait-stage img');return i?.alt==='Bulbasaur shiny'&&i.currentSrc.includes('shiny')&&i.complete&&i.naturalWidth>0;});
 assert.equal(await card.locator('.editor-shiny-badge').innerText(),'Shiny');
 const control=editor.locator('.editor-shiny');await control.scrollIntoViewIfNeeded(); const rect=await control.boundingBox();assert.ok(rect.height>=44&&rect.width>=140);
 await page.screenshot({path:`${directory}/shiny-edit.png`});
 await control.click();assert.equal(await shiny.isChecked(),false);assert.equal(await card.locator('.editor-shiny-badge').count(),0);
 await openDetails(editor.locator('.rpg-journey-panel')); const input=editor.getByLabel('HP atual',{exact:true});const colours=[];
 for(const [value,tone,percent] of [['20','healthy',100],['10','warning',50],['4','danger',20],['0','danger',0]]) {
  await input.fill(value);assert.equal(await meter.getAttribute('aria-valuenow'),value);assert.equal(await meter.getAttribute('data-health'),tone);
  const width=await meter.locator('.pokemon-hp-track > span').evaluate(e=>e.style.width);assert.equal(width,`${percent}%`);
  colours.push(await meter.locator('.pokemon-hp-track > span').evaluate(e=>getComputedStyle(e).backgroundColor));
 }
 assert.equal(new Set(colours).size,3);assert.match(await meter.getAttribute('aria-valuetext'),/fora de combate/);
 await editor.getByRole('button',{name:'Recuperar HP ao máximo',exact:true}).click();assert.equal(await meter.getAttribute('aria-valuenow'),'20');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('myowndex_rotom_v4')).teams[0].pokemon[0].rpg.currentHp===20);
 checks.push('Shiny keyboard, touch, sprite identity, persistence; HP full, half, low, zero and recovery');
 await page.reload();await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();await page.locator('.pc-partner-card').first().click();await page.locator('.pokemon-editor').waitFor();assert.equal(await page.locator('.editor-summary-health [role=meter]').getAttribute('aria-valuenow'),'20');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}

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
    localStorage.setItem("myowndex_rotom_v4", JSON.stringify({ schema: 5, savedAt: Date.now(), teams: [{ id: "growth-box", shareId: "growth-box", name: "Box do crescimento", updatedAt: Date.now(), rpgScale: 2, versionGroup: "auto", pokemon: [{ id: "growth-partner", nickname: "Buba", species, level: 10, nature: "hardy", ability: "overgrow", item: "leftovers", genderRate: 1, friendship: 70, moves: ["", "", "", ""], ivs: {}, evs: {}, rpg: { consumedItem: "leftovers", xp: 0, currentHp: 3, notes: "Preservar a jornada" } }] }] }));
}, species);
const openDetails = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(":scope > summary").click(); };

try {
 await context.addInitScript(() => {
  if (!localStorage.getItem('myowndex_curtain_migration_qa')) {
   localStorage.setItem('myowndex_curtain_migration_qa','1');
   localStorage.setItem('myowndex_header_curtain_v1','3');
  }
 });
 await page.goto(baseUrl);

 await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();
 await page.locator('.pc-partner-card').first().click();
 const editor=page.locator('.pokemon-editor');
 assert.equal(await editor.getByText('Características',{exact:true}).count(),0);
 assert.equal(await editor.locator('.editor-summary-caption').count(),0,'No redundant summary title');
 assert.equal(await editor.locator('.editor-summary-facts dt').count(),5,'Summary holds main Pokémon facts');
 assert.equal(await editor.locator('.editor-summary-customize').evaluate(e=>e.open),false);
 assert.equal(await editor.locator('.editor-summary-facts > div').filter({has:page.locator('dt',{hasText:/^Item$/})}).locator('dd').innerText(),'Sem item','Consumed equipment is not shown as active');
 await openDetails(editor.locator('.editor-summary-customize'));
 assert.equal(await editor.getByLabel('Item segurado',{exact:true}).inputValue(),'leftovers','The original equipment remains available to restore');
 assert.equal(await editor.locator('.friendship-scale-values').count(),0,'Editing does not duplicate the summary value');
 assert.equal(await editor.locator('.friendship-control input').getAttribute('max'),'255','Editing preserves the raw scale');
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
  await page.evaluate(()=>document.fonts.ready.then(()=>true));
  await page.waitForFunction(()=>{
   const root=document.querySelector('.app-header'),bounds=root.getBoundingClientRect();
   if(innerWidth>700)return !root.style.height;
   const group=root.querySelector('.app-preferences').getBoundingClientRect(),grip=root.querySelector('.app-curtain-grip').getBoundingClientRect();
   const target=Number.parseFloat(root.style.height);
   return Math.abs(bounds.height-target)<.02 && target===Math.ceil(group.bottom-bounds.top+grip.height+4) && root.getAnimations().every(animation=>animation.playState==='finished');
  });
  const metrics=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,placeholders:document.querySelectorAll('[placeholder]').length,header:document.querySelector('.app-header').getBoundingClientRect().height,escaped:[...document.querySelectorAll('.app-header button')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth}).map(e=>e.textContent)}));
  assert.equal(metrics.w,metrics.scroll);assert.equal(metrics.placeholders,0);assert.deepEqual(metrics.escaped,[]);
  const brand=await page.locator('.app-brand h1').evaluate(element=>{const r=element.getBoundingClientRect(),parent=element.closest('.app-brand-cluster').getBoundingClientRect();return {name:element.textContent,x:r.x,right:r.right,containerRight:parent.right};});
  assert.equal(brand.name,'MyOwnDex');assert.ok(brand.x>=0&&brand.right<=width+1&&brand.right<=brand.containerRight+1,'Brand name stays fully readable');
  const separation=await page.evaluate(()=>{
   const brand=document.querySelector('.app-brand-cluster'),title=brand.querySelector('h1'),nav=document.querySelector('.app-nav');
   const b=brand.getBoundingClientRect(),t=title.getBoundingClientRect(),n=nav.getBoundingClientRect();
   const label=document.querySelector('.editor-summary-friendship dt').getBoundingClientRect(),value=document.querySelector('.editor-summary-friendship dd').getBoundingClientRect();
   return {overlap:Math.min(b.right,n.right)>Math.max(b.left,n.left)&&Math.min(b.bottom,n.bottom)>Math.max(b.top,n.top),titleOwned:brand.contains(document.elementFromPoint(t.right-2,t.top+t.height/2)),gap:value.top-label.bottom,alignment:Math.abs(value.left-label.left),friendship:document.querySelector('.editor-summary-friendship').innerText};
  });
  assert.equal(separation.overlap,false,'Navigation never paints over the brand');
  assert.equal(separation.titleOwned,true,'The end of MyOwnDex remains unobstructed');
  assert.ok(separation.gap>=0&&separation.gap<=6&&separation.alignment<1,'Friendship label and value stay together like the other facts');
  assert.doesNotMatch(separation.friendship,/RPG/,'Friendship has no redundant mode caption');

  const clippedNavigation=await page.locator('.nav-capsule').evaluateAll(buttons=>buttons.flatMap(button=>{
   const b=button.getBoundingClientRect();return [...button.querySelectorAll(':scope > span')].filter(child=>{
    const r=child.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1;
   }).map(child=>child.textContent);
  }));
  assert.deepEqual(clippedNavigation,[],'Navigation labels and icons stay inside their targets');
  if(width===390)assert.ok(metrics.header<=260,'The full curtain leaves room for the game');
  console.log(width,theme,metrics.header);

 }
 for(const width of [701,820,1024,1280,1920]) for(const size of [16,20,24]) {
  await page.setViewportSize({width,height:1000});
  await page.evaluate(size=>document.documentElement.style.fontSize=`${size}px`,size);
  const brandFits=await page.evaluate(()=>{
   const brand=document.querySelector('.app-brand-cluster'),title=brand.querySelector('h1'),nav=document.querySelector('.app-nav');
   const b=brand.getBoundingClientRect(),t=title.getBoundingClientRect(),n=nav.getBoundingClientRect();
   return {overlap:Math.min(b.right,n.right)>Math.max(b.left,n.left)&&Math.min(b.bottom,n.bottom)>Math.max(b.top,n.top),inside:t.left>=b.left&&t.right<=b.right+.5,owned:brand.contains(document.elementFromPoint(t.right-2,t.top+t.height/2))};
  });
  assert.equal(brandFits.overlap,false,`Brand avoids navigation at ${width}px / ${size}px text`);
  assert.ok(brandFits.inside&&brandFits.owned,`The whole brand is readable at ${width}px / ${size}px text`);
 }
 await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.scrollTo(0,0));
 const grip=page.locator('.app-curtain-grip'),header=page.locator('.app-header');
 assert.equal(await header.getAttribute('data-curtain-level'),'4');
 assert.equal(await page.evaluate(()=>localStorage.getItem('myowndex_header_curtain_v2')),'4','Legacy preference keeps the same visible rows');
 const fullHeight=await header.evaluate(e=>e.getBoundingClientRect().height);
 assert.ok(await header.evaluate(e=>Boolean(e.style.height)),'Curtain is measured after the game is ready');
 await grip.click();await page.waitForTimeout(300);
 assert.equal(await header.getAttribute('data-curtain-level'),'0');
 assert.equal(await page.locator('.app-nav').getAttribute('aria-hidden'),'true','Hidden navigation is absent from accessibility tree');
 assert.equal(await page.locator('.app-nav').evaluate(e=>e.hasAttribute('inert')),true,'Hidden navigation stays unfocusable');
 assert.equal(await page.locator('.app-brand-cluster').getAttribute('aria-hidden'),'true','Brand is hidden in the new lowest stop');
 const compactHeight=await header.evaluate(e=>e.getBoundingClientRect().height);
 assert.ok(compactHeight<=48,'Only the grip and bottom border occupy the collapsed header');
 assert.ok(compactHeight<fullHeight-50,'Curtain opens usable play space');
 for(const expected of ['1','2','3','4']) {await grip.click();assert.equal(await header.getAttribute('data-curtain-level'),expected);}
 assert.equal(await page.locator('.app-preferences').evaluate(e=>e.hasAttribute('inert')),false);
 await grip.focus();await page.keyboard.press('ArrowUp');
 assert.equal(await header.getAttribute('data-curtain-level'),'3');
 await page.keyboard.press('ArrowDown');
 assert.equal(await header.getAttribute('data-curtain-level'),'4');
 await page.waitForTimeout(300);
 let box=await grip.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,Math.max(8,box.y-130),{steps:8});
 await page.mouse.up();
 assert.ok(Number(await header.getAttribute('data-curtain-level'))<4,'Upward swipe finds another stop');
 box=await grip.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,Math.min(800,box.y+260),{steps:8});
 await page.mouse.up();
 assert.equal(await header.getAttribute('data-curtain-level'),'4','Downward swipe restores all menu groups');
 // Every stop shows complete rows and an opaque, touch-sized handle, including after resize.
 for(const width of [320,390,540,700]) {
  await page.setViewportSize({width,height:844});
  for(let level=0;level<5;level++) {
   await grip.focus();await page.keyboard.press('Home');
   for(let step=0;step<level;step++)await page.keyboard.press('ArrowDown');
   await page.waitForTimeout(300);
   const fit=await header.evaluate(root=>{
    const handle=root.querySelector('.app-curtain-grip').getBoundingClientRect(),hem=getComputedStyle(root,'::before');
    return {scroll:root.scrollTop,top:root.getBoundingClientRect().top,handle:handle.height,opacity:hem.opacity,background:hem.backgroundColor,headerBackground:getComputedStyle(root).backgroundColor,
     rows:['.app-brand-cluster','.app-nav','.app-tool-actions','.app-preferences'].map(selector=>{const e=root.querySelector(selector),r=e.getBoundingClientRect();return {visible:getComputedStyle(e).visibility!=='hidden',top:r.top,bottom:r.bottom,handleTop:handle.top};})};
   });
   assert.equal(fit.scroll,0,'Focusing the grip never scrolls the clipped header');
   assert.ok(fit.handle>=44,'The grip is a full touch target');
   assert.equal(fit.opacity,'1');assert.equal(fit.background,fit.headerBackground,'The hem is opaque and matches the curtain');
   fit.rows.forEach((row,index)=>{assert.equal(row.visible,index<level,'Only selected curtain rows are visible');if(row.visible){assert.ok(row.top>=fit.top,'Visible rows never scroll out of the header');assert.ok(row.bottom<=row.handleTop+1,'Visible controls end before the grip');}});
  }
 }
 // Cancellation, lost capture and rotation must never leave a stretched curtain.
 await grip.focus();await page.keyboard.press('End');await page.waitForTimeout(300);
 for(const reason of ['pointercancel','lostpointercapture','blur','resize','Escape','cancel-tap']) {
  const before=await header.getAttribute('data-curtain-level');
  const bounds=await grip.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+22);await page.mouse.down();
  if(reason!=='cancel-tap')await page.mouse.move(bounds.x+bounds.width/2,bounds.y-50,{steps:4});
  if(reason==='Escape')await page.keyboard.press('Escape');
  else if(reason==='cancel-tap')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  else await page.evaluate(reason=>{
   if(reason==='blur'||reason==='resize')window.dispatchEvent(new Event(reason));
   else document.querySelector('.app-curtain-grip').dispatchEvent(new PointerEvent(reason,{bubbles:true,pointerId:1}));
  },reason);
  await page.mouse.up();await page.waitForTimeout(300);
  assert.equal(await header.getAttribute('data-curtain-level'),before,`${reason} rolls back the preview`);
  assert.equal(await header.evaluate(e=>e.classList.contains('is-dragging')),false);
 }
 await page.keyboard.press('Home');await page.waitForTimeout(300);
 await page.reload();await page.locator('.app-curtain-grip').waitFor();
 await page.waitForFunction(()=>document.querySelector('.app-header').dataset.curtainLevel==='0');
 assert.equal(await page.locator('.app-brand-cluster').getAttribute('aria-hidden'),'true','Grip-only preference survives reload');
 await grip.focus();await page.keyboard.press('End');await page.waitForTimeout(300);
 assert.deepEqual(await page.locator('img').evaluateAll(images=>images.filter(image=>image.draggable).map(image=>image.src)),[],'Interface artwork has no browser-native drag');
 const nativeDrag=await page.locator('.app-brand-icon').evaluate(element=>{
  const event=new DragEvent('dragstart',{bubbles:true,cancelable:true});element.dispatchEvent(event);return event.defaultPrevented;
 });
 assert.equal(nativeDrag,true,'Native image, link and selected-text drags cannot interfere with the app');
 const touch=await context.newCDPSession(page);
 await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true});
 let touchBounds=await grip.boundingBox();
 let point={x:Math.round(touchBounds.x+touchBounds.width/2),y:Math.round(touchBounds.y+22)};
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,y:20}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await header.getAttribute('data-curtain-level'),'0','A real touch swipe reaches grip-only');
 await page.waitForTimeout(300);
 touchBounds=await grip.boundingBox();point={x:Math.round(touchBounds.x+touchBounds.width/2),y:Math.round(touchBounds.y+22)};
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,y:180}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal(await header.getAttribute('data-curtain-level'),'0','Touch cancellation restores grip-only');
 await touch.send('Emulation.setTouchEmulationEnabled',{enabled:false});await touch.detach();
 await grip.focus();await page.keyboard.press('End');await page.waitForTimeout(300);

 await page.setViewportSize({width:390,height:844});
 await grip.focus();await page.keyboard.press('End');await page.waitForTimeout(300);
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

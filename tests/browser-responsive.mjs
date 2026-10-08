// Optional browser check: see docs/VALIDACAO.md for the Playwright setup.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const proxyServer = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,args:['--no-sandbox'],...(proxyServer ? {proxy:{server:proxyServer,bypass:'localhost,127.0.0.1,::1'}} : {})});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report=[];const baseUrl=process.env.MYOWNDEX_SMOKE_URL || 'http://localhost:3000';
async function check(label){
 const metrics=await page.evaluate(()=>{
  const width=innerWidth;
  const outside=[...document.querySelectorAll('input,select,textarea,button,summary,h1,h2,h3')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&e.getClientRects().length&&!e.closest('[inert]')&&(r.left<-.5||r.right>width+.5)}).map(e=>({tag:e.tagName,cls:e.className,text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,90),rect:e.getBoundingClientRect().toJSON()}));
  const dialog=document.querySelector('[role="dialog"]');
  return {width,scroll:document.documentElement.scrollWidth,outside,placeholder:document.querySelectorAll('[placeholder]').length,dialog:dialog?{scroll:dialog.scrollWidth,width:dialog.clientWidth,height:dialog.clientHeight,overflow:getComputedStyle(dialog).overflowY}:null};
 });report.push({label,...metrics});assert.equal(metrics.scroll,metrics.width,`${label}: horizontal page overflow`);assert.deepEqual(metrics.outside,[],`${label}: controls outside screen`);assert.equal(metrics.placeholder,0,`${label}: placeholder remains`);if(metrics.dialog)assert.ok(metrics.dialog.scroll<=metrics.dialog.width+1,`${label}: dialog overflow`);console.log(JSON.stringify(report.at(-1)));
}
async function nav(label){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(100)}
async function waitForVisibleSprites(){
 await page.waitForFunction(()=>{
  const visible=element=>{const r=element.getBoundingClientRect();return element.getClientRects().length&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&!element.closest('[inert]');};
  return [...document.querySelectorAll('.pokemon-companion img,.pokemon-card-sprite-frame .pokemon-sized-sprite')].filter(visible).every(element=>element.complete&&element.naturalWidth>0&&element.naturalHeight>0);
 },null,{timeout:30000});
}
async function auditRotomIdentity(){
 const metadata=await page.evaluate(()=>({
  brand:document.querySelector('img.app-brand-icon')?.getAttribute('src'),
  icons:[...document.querySelectorAll('link[rel="icon"]')].map(icon=>({url:icon.getAttribute('href'),size:Number(icon.getAttribute('sizes')?.split('x')[0])})),
  apple:document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
  shortcut:document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href'),
  manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  og:document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
  twitter:document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'),
 }));
 assert.match(metadata.brand,/myowndex-rotomdex-v103-96\.png(?:\?|$)/,'Header uses the new RotomDex identity');
 assert.match(metadata.apple,/myowndex-rotomdex-v103-180\.png$/,'Apple installation uses its actual PNG, not an unrelated SVG');
 assert.match(metadata.shortcut,/myowndex-rotomdex-v103-96\.png$/,'Shortcut uses the same RotomDex');
 assert.ok(metadata.icons.some(icon=>icon.size===32),'The browser has a legible dedicated favicon');
 for(const icon of metadata.icons)assert.match(icon.url,/myowndex-rotomdex-v103-(?:32|96)\.png$/,'Every browser icon uses the new identity');
 assert.equal(metadata.og,metadata.twitter,'Shared links use one RotomDex image');
 assert.ok(metadata.og,'Shared-link image is present');
 const localPath=url=>{const parsed=new URL(url,baseUrl);return parsed.pathname+parsed.search;};
 const manifestResponse=await context.request.get(new URL(localPath(metadata.manifest),baseUrl).href);
 assert.equal(manifestResponse.status(),200);
 const manifest=await manifestResponse.json();
 assert.deepEqual(manifest.categories,['games']);
 for(const icon of manifest.icons) assert.match(icon.src,/myowndex-rotomdex-v103-(?:app-|maskable-)?\d+\.png$/,'PWA icons share the same master');
 assert.equal(manifest.shortcuts.length,4,'Every main game area keeps its installed shortcut');
 for(const shortcut of manifest.shortcuts)for(const icon of shortcut.icons)assert.match(icon.src,/myowndex-rotomdex-v103-96\.png$/,'Installed shortcuts use the same new RotomDex');
 const images=[{url:metadata.brand,size:96,transparent:true},...metadata.icons.map(icon=>({...icon,transparent:true})),{url:metadata.apple,size:180,opaque:true},{url:metadata.shortcut,size:96,transparent:true},...manifest.icons.filter(icon=>icon.type==='image/png').map(icon=>({url:icon.src,size:Number(icon.sizes.split('x')[0]),opaque:true})),{url:localPath(metadata.og),size:512,opaque:true}];
 for(const image of images){
  const result=await page.evaluate(async ({url,size})=>{
   const response=await fetch(url);if(!response.ok) return {status:response.status};
   const bitmap=await createImageBitmap(await response.blob());
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let transparent=0,visible=0;const colors=new Set();
   for(let index=0;index<pixels.length;index+=4){const [r,g,b,a]=pixels.subarray(index,index+4);if(a<255)transparent++;if(a<220)continue;visible++;colors.add(`${r>>4},${g>>4},${b>>4}`);}
   bitmap.close();return {status:response.status,type:response.headers.get('content-type'),width:canvas.width,height:canvas.height,transparent,visible,colors:colors.size,minimum:size*size*.05};
  },{url:localPath(image.url),size:image.size});
  assert.equal(result.status,200,`Identity asset loads: ${image.url}`);
  assert.match(result.type,/image\/png/,'Icons are actual portable PNG images');
  assert.equal(result.width,image.size);assert.equal(result.height,image.size);
  assert.ok(result.visible>result.minimum&&result.colors>12,`RotomDex artwork remains visible in ${image.url}`);
  if(image.opaque) assert.equal(result.transparent,0,'Installed and shared-link RotomDex fills its entire frame');
  if(image.transparent)assert.ok(result.transparent>0,'Header and browser icons have no unwanted square background');
 }
 report.push({label:'RotomDex header, Apple, shortcuts, PWA and shared-link identity',images:images.length});
}
async function auditCompactLoading(){
 const loadingContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const loadingPage=await loadingContext.newPage();const loadingErrors=[];
 loadingPage.on('pageerror',error=>loadingErrors.push(error.message));
 let release;const gate=new Promise(resolve=>{release=resolve;});let heldChunks=0;
 try{
  await loadingPage.goto(baseUrl);await loadingPage.getByRole('button',{name:'Consultar Venusaur na Pokédex',exact:true}).waitFor();
  // Hold only the newly requested view code. The real shell remains usable,
  // and the delay is controlled by this test rather than by the network.
  await loadingContext.route('**/_next/static/chunks/*.js',async route=>{heldChunks++;await gate;await route.continue();});
  await loadingPage.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();
  const opening=loadingPage.locator('.account-opening');await opening.waitFor();
  assert.ok(heldChunks>0,'The loading state is tested while an actual view chunk is pending');
  assert.equal(await opening.getAttribute('role'),'status');
  assert.equal(await opening.getAttribute('aria-label'),'Carregando MyOwnDex','The compact loading indicator remains announced to assistive technology');
  assert.equal(await opening.locator('img').count(),1,'Loading shows one identity instead of competing characters');
  assert.equal((await opening.innerText()).trim(),'','Loading has no visible instructions, title or version');
  assert.equal(await opening.locator('.pokemon-companion').count(),0);
  await opening.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0||new Promise(resolve=>image.addEventListener('load',resolve,{once:true})));
  for(const width of [280,390,1280]){
   await loadingPage.setViewportSize({width,height:844});
   const metrics=await opening.evaluate(element=>{const r=element.getBoundingClientRect(),image=element.querySelector('img'),i=image.getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,height:r.height,imageWidth:i.width,left:i.left,right:i.right,src:image.currentSrc};});
   assert.equal(metrics.scroll,metrics.width,'Loading does not overflow the screen');
   assert.ok(metrics.height<=200,'A pending view uses a compact loading area');
   assert.ok(metrics.imageWidth>=48&&metrics.imageWidth<=120,'The sole loading identity remains readable without dominating the screen');
   assert.ok(metrics.left>=0&&metrics.right<=width);
   assert.match(metrics.src,/myowndex-rotomdex-v103-96\.png(?:\?|$)/);
   report.push({label:`Compact loading ${width}`, ...metrics});
  }
  await loadingPage.emulateMedia({reducedMotion:'reduce'});
  const animated=await opening.locator('*').evaluateAll(elements=>elements.filter(element=>{const style=getComputedStyle(element);return style.animationName!=='none'&&style.animationDuration!=='0s';}).map(element=>element.className));
  assert.deepEqual(animated,[],'Loading respects a request to reduce motion');
  release();await loadingPage.locator('.pc-sidebar').waitFor();
  assert.equal(await opening.count(),0,'The pending indicator leaves when the real view becomes available');
  assert.deepEqual(loadingErrors,[]);
 }finally{release();await loadingContext.close();}
}
async function auditVisibleModernAnimations(){
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
 for(const name of ['Toedscool','Scovillain']){
  await page.locator('#pokemon-search').fill(name);
  const card=page.getByRole('button',{name:`Consultar ${name} na Pokédex`,exact:true});await card.waitFor();await card.scrollIntoViewIfNeeded();
  const image=card.locator('.pokemon-sized-sprite');
  await page.waitForFunction(name=>{const card=[...document.querySelectorAll('.dex-entry-main')].find(element=>element.getAttribute('aria-label')===`Consultar ${name} na Pokédex`),image=card?.querySelector('img');return image?.dataset.pokemonMotion==='animated'&&image.complete&&image.naturalWidth>0;},name);
  const animation=await image.evaluate(element=>({src:element.currentSrc,animation:getComputedStyle(element).animationName,transform:getComputedStyle(element).transform}));
  assert.match(animation.src,/\.gif(?:\?|$)/,`${name} loads an authored animation rather than a static recovery image`);
  assert.equal(animation.animation,'none');assert.equal(animation.transform,'none','Sprite motion comes from its artwork rather than moving the whole card');
  const frames=new Set();
  for(let frame=0;frame<10&&frames.size<2;frame++){
   frames.add(createHash('sha256').update(await image.screenshot()).digest('hex'));
   await page.waitForTimeout(150);
  }
  assert.ok(frames.size>1,`${name} changes its visible frame after loading`);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(name=>{const card=[...document.querySelectorAll('.dex-entry-main')].find(element=>element.getAttribute('aria-label')===`Consultar ${name} na Pokédex`),image=card?.querySelector('img');return image?.dataset.pokemonMotion==='static'&&image.complete&&image.naturalWidth>0;},name);
  const staticSource=await image.getAttribute('src');assert.match(staticSource,/\.png(?:\?|$)/,'The reduced-motion recovery keeps the same Pokémon identity');
  const stillFrame=await image.screenshot();await page.waitForTimeout(150);assert.ok(stillFrame.equals(await image.screenshot()),`${name} respects reduced motion`);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(name=>{const card=[...document.querySelectorAll('.dex-entry-main')].find(element=>element.getAttribute('aria-label')===`Consultar ${name} na Pokédex`),image=card?.querySelector('img');return image?.dataset.pokemonMotion==='animated'&&image.complete&&image.naturalWidth>0;},name);
  assert.equal(await image.getAttribute('src'),animation.src,'Animation returns without replacing the Pokémon');
  report.push({label:`${name} visibly animates and respects reduced motion`,frames:frames.size,src:animation.src,staticSource});
 }
 await page.locator('#pokemon-search').fill('');await page.getByRole('button',{name:'Consultar Venusaur na Pokédex',exact:true}).waitFor();
}
async function auditConsultableAppearances(){
 const cases=[
  {name:'Unown',count:28,id:'10001',sprite:/\/(?:201-b|unown-b)\.gif(?:\?|$)/},
  {name:'Burmy',count:3,id:'10034',sprite:/\/(?:412-sandy|burmy-sandy)\.gif(?:\?|$)/},
  {name:'Vivillon',count:20,id:'10100',sprite:/\/(?:666-sun|vivillon-sun)\.gif(?:\?|$)/},
  {name:'Alcremie',count:63,id:'10475',sprite:/\/(?:869|alcremie)-rainbow-swirl-star-sweet(?:-front)?\.(?:gif|apng)(?:\?|$)/},
  {name:'Arceus',type:'Fire',sprite:/\/(?:493-fire|arceus-fire)\.gif(?:\?|$)/},
  {name:'Silvally',type:'Water',sprite:/\/(?:773-water|silvally-water)\.gif(?:\?|$)/},
 ];
 for(const entry of cases){
  await page.locator('#pokemon-search').fill(entry.name);
  const card=page.getByRole('button',{name:new RegExp(`^Consultar ${entry.name}(?: · | na Pokédex)`)}).first();await card.waitFor();await card.click();
  const record=page.locator('.record-shell');await record.getByRole('button',{name:/Adicionar à equipe/}).waitFor();
  const appearance=record.getByLabel('Aparência',{exact:true});await appearance.waitFor();const count=await appearance.locator('option').count();
  if(entry.count)assert.equal(count,entry.count,`${entry.name}: all appearances stay available in one entry`);
  else assert.ok(count>=18,`${entry.name}: the complete type selection remains available`);
  if(entry.id)await appearance.selectOption(entry.id);else await appearance.selectOption({label:entry.type});
  const image=record.locator('.record-sprite-stage .pokemon-sized-sprite');
  await page.waitForFunction(()=>{const image=document.querySelector('.record-sprite-stage .pokemon-sized-sprite');return image?.dataset.pokemonMotion==='animated'&&image.complete&&image.naturalWidth>0;});
  // The form request can resolve after the base portrait has already loaded.
  // Wait for the chosen identity, rather than auditing that stale base image.
  await page.waitForFunction(pattern=>{const image=document.querySelector('.record-sprite-stage .pokemon-sized-sprite');return image?.complete&&image.naturalWidth>0&&new RegExp(pattern).test(image.currentSrc);},entry.sprite.source);
  const src=await image.getAttribute('src');assert.match(src,entry.sprite,`${entry.name}: the selected appearance never falls back to an unrelated base portrait`);
  if(entry.id)assert.equal(await appearance.inputValue(),entry.id);
  if(entry.type)assert.deepEqual(await record.locator('.record-type-chip').allTextContents(),[entry.type],`${entry.name}: the chosen type accompanies its portrait`);
  const first=await image.screenshot();let changed=false;for(let frame=0;frame<10&&!changed;frame++){await page.waitForTimeout(150);changed=!first.equals(await image.screenshot());}
  assert.ok(changed,`${entry.name}: its chosen appearance has visible authored motion`);
  await check(`Consultable ${entry.name} appearance`);
  report.at(-1).appearance={choices:count,selected:await appearance.inputValue(),src,changed,type:entry.type};
  await page.getByRole('button',{name:'Fechar registro da Pokédex',exact:true}).click();
 }
 await page.locator('#pokemon-search').fill('');await page.getByRole('button',{name:'Consultar Venusaur na Pokédex',exact:true}).waitFor();
}
async function auditRepeatedMotionPreferences(){
 await page.setViewportSize({width:1920,height:1080});
 await page.emulateMedia({reducedMotion:'no-preference'});
 const sprites=page.locator('.dex-entry-main .pokemon-sized-sprite');
 const count=await sprites.count();
 assert.ok(count>=60,'Repeated motion changes are tested with at least sixty mounted Pokémon');
 for(let index=0;index<count;index+=8){
  await sprites.nth(index).scrollIntoViewIfNeeded();
  await waitForVisibleSprites();
 }
 await sprites.last().scrollIntoViewIfNeeded();await waitForVisibleSprites();
 const loaded=await sprites.evaluateAll(images=>images.filter(image=>image.complete&&image.naturalWidth>0&&image.naturalHeight>0).length);
 assert.ok(loaded>=60,'Sixty actual sprite images load before switching motion preferences');
 await sprites.first().scrollIntoViewIfNeeded();
 const errorsBefore=errors.length;
 for(let cycle=0;cycle<10;cycle+=1){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>[...document.querySelectorAll('.dex-entry-main .pokemon-sized-sprite')].every(image=>image.dataset.pokemonMotion==='static'));
  await waitForVisibleSprites();
  assert.deepEqual(errors.slice(errorsBefore),[],`Motion reduction cycle ${cycle+1} has no React or browser errors`);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('.dex-entry-main .pokemon-sized-sprite')?.dataset.pokemonMotion==='animated');
  await waitForVisibleSprites();
  assert.deepEqual(errors.slice(errorsBefore),[],`Animation restoration cycle ${cycle+1} has no React or browser errors`);
 }
 report.push({label:'Ten motion preference cycles across sixty loaded Pokémon',mounted:count,loaded,cycles:10,errors:errors.slice(errorsBefore)});
}
await page.goto(baseUrl);await page.getByRole('button',{name:'Consultar Venusaur na Pokédex',exact:true}).waitFor();
await auditRotomIdentity();
await auditCompactLoading();
await auditVisibleModernAnimations();
await auditConsultableAppearances();
await auditRepeatedMotionPreferences();
for(const width of [320,390,768,1280,1440]){
 await page.setViewportSize({width,height:900});
 for(const theme of ['Claro','Escuro']){
  await page.getByRole('radio',{name:theme,exact:true}).click();
  for(const [view,label] of [['dex','Abrir a Pokédex'],['pc','Abrir o PC do Bill'],['guide','Abrir o Guia do Treinador'],['lobby','Abrir a Central da Aventura']]){await nav(label);await check(`${width}-${theme}-${view}`)}
 }
}
const deviceMatrix=[
 {width:280,height:653},{width:320,height:568},{width:360,height:640},{width:375,height:667},
 {width:360,height:800},{width:390,height:844},{width:412,height:915},{width:540,height:720},
 {width:640,height:360},{width:740,height:360},{width:768,height:1024},{width:820,height:1180},
 {width:915,height:412},{width:1024,height:768},{width:1366,height:768},{width:1920,height:1080}
];
for(const viewport of deviceMatrix){
 await page.setViewportSize(viewport);
 for(const [view,label] of [['dex','Abrir a Pokédex'],['pc','Abrir o PC do Bill'],['guide','Abrir o Guia do Treinador'],['lobby','Abrir a Central da Aventura']]){
  await nav(label);await check(`device-${viewport.width}x${viewport.height}-${view}`);
  // Scroll an actual card into view before checking lazy sprites; off-screen
  // placeholders must never be mistaken for a fully loaded visual audit.
  if(view==='dex')await page.locator('.dex-entry-main').first().scrollIntoViewIfNeeded();
  await waitForVisibleSprites();
  const spriteAudit=await page.evaluate(()=>{
   const visible=element=>{const r=element.getBoundingClientRect();return element.getClientRects().length&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&!element.closest('[inert]');};
   const clippingAncestor=element=>{
    const r=element.getBoundingClientRect();
    for(let parent=element.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
     const style=getComputedStyle(parent),p=parent.getBoundingClientRect();
     if((/(hidden|clip)/.test(style.overflowX)&&(r.left<p.left-.5||r.right>p.right+.5))||(/(hidden|clip)/.test(style.overflowY)&&(r.top<p.top-.5||r.bottom>p.bottom+.5)))return {tag:parent.tagName,cls:parent.className,overflowX:style.overflowX,overflowY:style.overflowY};
    }
    return null;
   };
   return {
   companions:[...document.querySelectorAll('.pokemon-companion img')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {src:e.currentSrc,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,background:getComputedStyle(e).backgroundColor,clippedBy:clippingAncestor(e)};}),
   dexStages:[...document.querySelectorAll('.pokemon-card-sprite-frame')].slice(0,8).map(e=>{const s=getComputedStyle(e);return {backgroundImage:s.backgroundImage,backgroundColor:s.backgroundColor};}),
   dexSprites:[...document.querySelectorAll('.pokemon-card-sprite-frame .pokemon-sized-sprite')].filter(visible).map(e=>{const r=e.getBoundingClientRect(),f=e.closest('.pokemon-card-sprite-frame')?.getBoundingClientRect();return {transform:getComputedStyle(e).transform,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,background:getComputedStyle(e).backgroundColor,clippedBy:clippingAncestor(e),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},frame:f?{left:f.left,right:f.right,top:f.top,bottom:f.bottom}:null};}),
   identity:[...document.querySelectorAll('img.app-brand-icon')].map(e=>e.getAttribute('src'))
  };});
  report.at(-1).spriteAudit=spriteAudit;
  if(view==='guide'){
   const guideColumns=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
    return {
     columns:[...document.querySelectorAll('.guide-rule-content')].map(e=>({rect:rect(e),parent:rect(e.parentElement),client:e.clientWidth,scroll:e.scrollWidth})),
     cards:[...document.querySelectorAll('.guide-rule-card')].map(e=>({rect:rect(e),list:rect(e.closest('.guide-rule-list'))})),
    };
   });
   report.at(-1).guideColumns=guideColumns;
   fs.writeFileSync(process.env.MYOWNDEX_BROWSER_REPORT || '/tmp/myowndex-browser-report.json',JSON.stringify({report,errors},null,2));
   assert.equal(guideColumns.cards.length,40,'The complete Guide retains all forty rules');
   for(const column of guideColumns.columns){
    assert.ok(column.scroll<=column.client+1,'Rule titles fit their own Guide column, including narrow-font fallbacks');
    assert.ok(column.rect.left>=column.parent.left-.5&&column.rect.right<=column.parent.right+.5,'Guide columns remain inside their topic');
   }
   for(const card of guideColumns.cards)assert.ok(card.rect.left>=card.list.left-.5&&card.rect.right<=card.list.right+.5,'Every rule card stays within its Guide list');
  }
  fs.writeFileSync(process.env.MYOWNDEX_BROWSER_REPORT || '/tmp/myowndex-browser-report.json',JSON.stringify({report,errors},null,2));
  for(const sprite of spriteAudit.companions){
   assert.ok(sprite.naturalWidth>0&&sprite.naturalHeight>0,`companion must load at ${viewport.width}x${viewport.height}`);
   assert.match(sprite.src,/\.gif(?:$|\?)/,`decorative companion must use authored animated GIF: ${sprite.src}`);
   assert.ok(sprite.left>=-1&&sprite.right<=viewport.width+1,`companion must stay horizontally reachable at ${viewport.width}x${viewport.height}`);
   assert.equal(sprite.clippedBy,null,`companion must not be clipped by an ancestor at ${viewport.width}x${viewport.height}`);
  }
  if(view==='dex'){
   assert.ok(spriteAudit.dexStages.length>0);
   assert.ok(spriteAudit.dexSprites.length>0,'At least one real, visible Dex sprite is audited');
   for(const stage of spriteAudit.dexStages){assert.equal(stage.backgroundImage,'none');assert.ok(stage.backgroundColor==='rgba(0, 0, 0, 0)'||stage.backgroundColor==='transparent');}
   for(const sprite of spriteAudit.dexSprites){
    assert.ok(sprite.naturalWidth>0&&sprite.naturalHeight>0);
    assert.equal(sprite.transform,'none');
    assert.equal(sprite.clippedBy,null,'Dex sprite must not be clipped by an ancestor');
    assert.ok(sprite.background==='rgba(0, 0, 0, 0)'||sprite.background==='transparent');
    if(sprite.frame){assert.ok(sprite.rect.left>=sprite.frame.left-1&&sprite.rect.right<=sprite.frame.right+1,'Dex sprite must stay inside its stage horizontally');assert.ok(sprite.rect.top>=sprite.frame.top-1&&sprite.rect.bottom<=sprite.frame.bottom+1,'Dex sprite must stay inside its stage vertically');}
   }
  }
  for(const src of spriteAudit.identity) assert.match(src,/myowndex-rotomdex-v103-96\.png(?:\?|$)/);
 }
}
await page.getByRole('button',{name:'Entrar ou criar conta',exact:true}).click();
const accountDialog=page.locator('.account-dialog');
for(const label of ['Entrar','Criar conta','Recuperar acesso']){
 await accountDialog.getByRole('button',{name:label,exact:true}).click();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});await check(`${width}-account-${label}`)}
}
await page.getByRole('button',{name:'Fechar conta',exact:true}).click();
await page.getByRole('button',{name:'Gerar Pokémon',exact:true}).first().click();
const generatorDialog=page.locator('.generator-dialog');
for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});await check(`${width}-generator-basic`)}
for(const details of await generatorDialog.locator('.generator-customize').all())if(!await details.evaluate(element=>element.open))await details.locator(':scope > summary').click();
for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});await check(`${width}-generator-options`)}
await page.getByRole('button',{name:'Fechar gerador',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.getByRole('radio',{name:'Claro',exact:true}).click();
await nav('Abrir a Pokédex');await page.getByRole('button',{name:'Consultar Venusaur na Pokédex',exact:true}).click();
await page.getByRole('button',{name:'Adicionar à equipe',exact:false}).waitFor({timeout:30000});
for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});for(const tab of ['Perfil','Tipos','Movimentos']){await page.getByRole('tab',{name:tab,exact:false}).click();await page.waitForTimeout(180);await check(`${width}-record-${tab}`)} }
await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Perfil',exact:false}).click();await page.locator('.record-shell').evaluate(e=>e.scrollTop=0);await page.waitForTimeout(250);await page.screenshot({path:'/tmp/myowndex-clean-record-390.png'});
await page.getByRole('button',{name:'Adicionar à equipe',exact:false}).click();
await page.locator('.pc-partner-card').first().waitFor();await page.locator('.pc-partner-card').first().click();
await page.getByLabel('Apelido',{exact:true}).fill('Venusaur parceiro com nome comprido para verificar o espaço');
for(const width of [320,390,768,1280]){
 await page.setViewportSize({width,height:900});
 await page.locator('.editor-header').scrollIntoViewIfNeeded();await check(`${width}-editor`);
 for(const summary of ['Progresso da jornada','Características e transformações','Treinamento']){const s=page.locator('.pokemon-editor summary').filter({hasText:summary});if(!await s.evaluate(e=>e.parentElement.open))await s.click();await s.scrollIntoViewIfNeeded();await check(`${width}-editor-${summary}`)}
}
await page.setViewportSize({width:1280,height:900});await page.locator('.editor-header').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/myowndex-clean-editor.png'});
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Compartilhar',exact:true}).click();await check('390-link-share');await page.getByRole('radio',{name:'Box inteira',exact:false}).click();
await page.getByRole('button',{name:'Gerar código',exact:false}).click();try {await page.getByLabel('Código de compartilhamento',{exact:true}).waitFor({timeout:5000});}catch(e){console.log('FAILBODY',await page.locator('body').innerText());console.log('ERRORS',JSON.stringify(errors));await page.screenshot({path:'/tmp/myowndex-flow-fail.png'});throw e;}await check('link-code');
const code=await page.getByLabel('Código de compartilhamento',{exact:true}).inputValue();console.log('SHARE',code.length);
await page.getByRole('button',{name:'Fechar compartilhamento',exact:true}).click();await page.waitForTimeout(1000);await page.reload();await page.locator('.pc-partner-card').first().waitFor();assert.match(await page.locator('.pc-partner-name').first().textContent(),/parceiro com nome comprido/);
await page.getByRole('button',{name:'Importar Pokémon ou Box',exact:false}).click();await page.locator('#link-cable-code').fill(code);await page.getByRole('button',{name:'Conferir conteúdo',exact:true}).click();await page.getByRole('radio',{name:'Adicionar a uma Box',exact:false}).click();await page.getByLabel('Box de destino',{exact:false}).selectOption('__new__');await check('390-import-preview');await page.getByRole('button',{name:'Adicionar à Box escolhida',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.pc-box-count').textContent(),'2');await check('390-imported');
await nav('Abrir o Guia do Treinador');await page.getByLabel('Pesquisar regras').fill('dano');await page.locator('.guide-rule-body').first().scrollIntoViewIfNeeded();await check('guide-open-rules');await page.screenshot({path:'/tmp/myowndex-clean-guide.png'});
await page.getByLabel('Pesquisar regras').fill('');await page.locator('.guide-rule-card summary').first().click();await check('guide-one-open-rule');
await page.getByRole('button',{name:'Abrir Dados',exact:true}).click();const diceDialog=page.getByRole('dialog',{name:'Dados',exact:true});await diceDialog.getByRole('button',{name:'Rolar 2d6',exact:true}).click();await diceDialog.locator('.local-dice-result').waitFor();await diceDialog.locator('.local-dice-history > summary').filter({hasText:'1 rolagem'}).waitFor();assert.match(await diceDialog.locator('.local-dice-history > summary').innerText(),/1 rolagem/);
for(let index=0;index<40;index+=1) await diceDialog.getByRole('button',{name:'Rolar 2d6',exact:true}).click();
await page.waitForFunction(()=>/41 rolagens/.test(document.querySelector('.local-dice-history > summary')?.textContent||''));
assert.match(await diceDialog.locator('.local-dice-history > summary').innerText(),/41 rolagens/);
await diceDialog.getByRole('button',{name:'Rolar 2d6',exact:true}).evaluate(button=>{for(let index=0;index<140;index+=1)button.click();});
await page.waitForFunction(()=>/100 rolagens/.test(document.querySelector('.local-dice-history > summary')?.textContent||''));
assert.match(await diceDialog.locator('.local-dice-history > summary').innerText(),/100 rolagens/);
await check('global-dice-from-guide');
for(const viewport of [{width:280,height:653},{width:320,height:480},{width:653,height:280},{width:844,height:390}]){
 await page.setViewportSize(viewport);await check(`dice-${viewport.width}x${viewport.height}`);
 const box=await diceDialog.boundingBox();assert.ok(box&&box.width<=viewport.width+1&&box.height<=viewport.height+1,`dice dialog must fit ${viewport.width}x${viewport.height}`);
}
await page.setViewportSize({width:390,height:844});await diceDialog.getByRole('button',{name:'Fechar dados',exact:true}).click();
await nav('Abrir a Central da Aventura');await page.getByRole('button',{name:'Começar uma aventura local',exact:false}).click();await page.locator('.room-app').waitFor();
for(const width of [320,390,768,1280,1440]){await page.setViewportSize({width,height:900});for(const pane of ['Campo','Equipe','Ações']){const b=page.locator('.room-mobile-nav button').filter({hasText:pane});if(await b.isVisible()){await b.click();const paneClass={Campo:'field',Equipe:'roster','Ações':'tools'}[pane];assert.equal(await page.locator(`.room-${paneClass}`).isVisible(),true);for(const other of ['field','roster','tools'].filter(v=>v!==paneClass))assert.equal(await page.locator(`.room-${other}`).isVisible(),false);}await check(`${width}-room-${pane}`)}}
await page.setViewportSize({width:1280,height:1000});await page.screenshot({path:'/tmp/myowndex-clean-room.png',fullPage:true});
await page.setViewportSize({width:1280,height:900});
await page.evaluate(()=>document.documentElement.style.zoom='2');for(const view of ['Abrir a Pokédex','Abrir o PC do Bill','Abrir o Guia do Treinador','Abrir a Central da Aventura']){await nav(view);await check(`zoom-200-${view}`)}await page.evaluate(()=>document.documentElement.style.zoom='1');
await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});await page.getByRole('radio',{name:'Escuro',exact:true}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'night');assert.equal(await page.locator('.appearance-options [role=radio]').count(),2);await nav('Abrir o Guia do Treinador');const companion=page.locator('[data-companion-place="guide"] img');assert.equal(await companion.evaluate(e=>getComputedStyle(e).animationName),'none');await page.waitForFunction(()=>{const image=document.querySelector('[data-companion-place="guide"] img');return image?.currentSrc.endsWith('/164.png')&&image.complete&&image.naturalWidth>0;});assert.match(await companion.evaluate(element=>element.currentSrc),/\/164\.png$/,'Reduced motion renders the static master');await check('dark-reduced-motion');
await nav('Abrir o PC do Bill');
await page.waitForTimeout(1000);
await page.evaluate(()=>{
 const value=JSON.parse(localStorage.getItem('myowndex_rotom_v4'));
 const seed=value.teams[0];
 value.savedAt=Date.now();
 value.teams=Array.from({length:80},(_,index)=>({...seed,id:`qa-box-${index}`,shareId:`qa-share-${index}`,name:`Box ${index+1} com um nome longo para testar armazenamento contínuo`,pokemon:Array.from({length:6},(_,position)=>({...seed.pokemon[0],id:`qa-partner-${index}-${position}`}))}));
 localStorage.setItem('myowndex_rotom_v4',JSON.stringify(value));
});
await page.reload();
await page.locator('.pc-box-count').filter({hasText:'80'}).waitFor();
await page.locator('.pc-partner-card').nth(5).waitFor();
assert.equal(await page.locator('.pc-partner-card').count(),6);
assert.equal(await page.locator('.pc-box-list > button').count(),80);
for(const width of [320,390,768,1280]){
 await page.setViewportSize({width,height:900});
 await check(`${width}-80-boxes-480-partners`);
 const list=await page.locator('.pc-box-list').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY}));
 // A bounded list and a page-flow list are both valid. Every Box must remain
 // reachable and complete; no assertion dictates a particular scroll layout.
 if(list.scroll>list.height+1) assert.equal(list.overflow,'auto');
 await page.locator('.pc-box-list > button').last().click();
 assert.equal(await page.getByLabel('Nome da Box',{exact:true}).inputValue(),'Box 80 com um nome longo para testar armazenamento contínuo');
 assert.equal(await page.locator('.pc-partner-card').count(),6);
 await page.locator('.pc-box-list > button').first().click();
 assert.equal(await page.getByLabel('Nome da Box',{exact:true}).inputValue(),'Box 1 com um nome longo para testar armazenamento contínuo');
}
await page.reload();
await page.locator('.pc-box-count').filter({hasText:'80'}).waitFor();
assert.equal(await page.locator('.pc-box-list > button').count(),80);
await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('myowndex_rotom_v4')).teams.length),80);
assert.deepEqual(errors,[]);console.log(`Passed ${report.length} responsive checkpoints; no page errors.`);fs.writeFileSync(process.env.MYOWNDEX_BROWSER_REPORT || '/tmp/myowndex-browser-report.json',JSON.stringify({report,errors},null,2));await browser.close();

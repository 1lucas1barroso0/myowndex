// Optional browser check: see docs/VALIDACAO.md for the Playwright setup.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
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
await page.goto(baseUrl);await page.getByRole('button',{name:'Consultar Venusaur na Pokédex',exact:true}).waitFor();
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
  const spriteAudit=await page.evaluate(()=>({
   companions:[...document.querySelectorAll('.pokemon-companion img')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {src:e.currentSrc,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,background:getComputedStyle(e).backgroundColor};}),
   dexStages:[...document.querySelectorAll('.pokemon-card-sprite-frame')].slice(0,8).map(e=>{const s=getComputedStyle(e);return {backgroundImage:s.backgroundImage,backgroundColor:s.backgroundColor};}),
   dexSprites:[...document.querySelectorAll('.pokemon-card-sprite-frame .pokemon-sized-sprite')].map(e=>{const r=e.getBoundingClientRect(),f=e.closest('.pokemon-card-sprite-frame')?.getBoundingClientRect();return {transform:getComputedStyle(e).transform,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,background:getComputedStyle(e).backgroundColor,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},frame:f?{left:f.left,right:f.right,top:f.top,bottom:f.bottom}:null};}),
   identity:[...document.querySelectorAll('img.app-brand-icon')].map(e=>e.getAttribute('src'))
  }));
  for(const sprite of spriteAudit.companions){
   assert.ok(sprite.naturalWidth>0&&sprite.naturalHeight>0,`companion must load at ${viewport.width}x${viewport.height}`);
   assert.match(sprite.src,/\.png(?:$|\?)/,`decorative companion must use transparent PNG master: ${sprite.src}`);
   assert.ok(sprite.left>=-1&&sprite.right<=viewport.width+1,`companion must stay horizontally reachable at ${viewport.width}x${viewport.height}`);
  }
  if(view==='dex'){
   assert.ok(spriteAudit.dexStages.length>0);
   for(const stage of spriteAudit.dexStages){assert.equal(stage.backgroundImage,'none');assert.ok(stage.backgroundColor==='rgba(0, 0, 0, 0)'||stage.backgroundColor==='transparent');}
   for(const sprite of spriteAudit.dexSprites){
    assert.ok(sprite.naturalWidth>0&&sprite.naturalHeight>0);
    assert.equal(sprite.transform,'none');
    assert.ok(sprite.background==='rgba(0, 0, 0, 0)'||sprite.background==='transparent');
    if(sprite.frame){assert.ok(sprite.rect.left>=sprite.frame.left-1&&sprite.rect.right<=sprite.frame.right+1,'Dex sprite must stay inside its stage horizontally');assert.ok(sprite.rect.top>=sprite.frame.top-1&&sprite.rect.bottom<=sprite.frame.bottom+1,'Dex sprite must stay inside its stage vertically');}
   }
  }
  for(const src of spriteAudit.identity) assert.match(src,/myowndex-rotomdex-v101\.svg$/);
 }
}
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
await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});await page.getByRole('radio',{name:'Escuro',exact:true}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'night');assert.equal(await page.locator('.appearance-options [role=radio]').count(),2);await nav('Abrir o Guia do Treinador');const companion=page.locator('[data-companion-place="guide"] img');assert.equal(await companion.evaluate(e=>getComputedStyle(e).animationName),'none');await page.waitForFunction(()=>document.querySelector('[data-companion-place="guide"] img')?.currentSrc.endsWith('/164.png'));await check('dark-reduced-motion');
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

// Read-only smoke check for the public game after a release. Browser actions
// may update this disposable context's local state, never a remote account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import packageJson from '../package.json' with {type:'json'};
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || 'playwright');
const baseUrl=process.env.MYOWNDEX_SMOKE_URL || 'https://myowndex.vercel.app';
const expectedVersion=packageJson.version;
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(40000);
const report=[],errors=[],blockedWrites=[],releaseWait=[];
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',route=>{
 const request=route.request();
 if(['GET','HEAD','OPTIONS'].includes(request.method()))return route.fallback();
 blockedWrites.push({method:request.method(),path:new URL(request.url()).pathname});
 return route.abort('blockedbyclient');
});
async function check(label){
 const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('[role="dialog"]')].filter(element=>element.getClientRects().length).map(element=>({width:element.clientWidth,scroll:element.scrollWidth})),brand:document.querySelector('img.app-brand-icon')?.currentSrc}));
 assert.equal(result.scroll,result.width,`${label}: no horizontal page overflow`);
 for(const dialog of result.dialogs)assert.ok(dialog.scroll<=dialog.width+1,`${label}: no horizontal dialog overflow`);
 assert.match(result.brand,/myowndex-dex-v104-96\.png(?:\?|$)/,`${label}: the new Pokédex do MyOwnDex is visible`);
 report.push({label,...result});
}
async function waitForRelease(){
 const deadline=Date.now()+180000;let lastVersion='unavailable';
 while(Date.now()<deadline){
  try{
   await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('img.app-brand-icon').waitFor({timeout:10000});
   const footer=await page.locator('footer').last().innerText();
   lastVersion=footer.match(/\b\d+\.\d+\.\d+\b/)?.[0] || 'unavailable';
   releaseWait.push({attempt:releaseWait.length+1,version:lastVersion});
   if(lastVersion===expectedVersion)return;
  }catch(error){releaseWait.push({attempt:releaseWait.length+1,error:error.name});}
  await page.waitForTimeout(10000);
 }
 assert.fail(`Public production did not reach ${expectedVersion}; last observed version: ${lastVersion}`);
}
async function auditIdentity(){
 const metadata=await page.evaluate(()=>({brand:document.querySelector('img.app-brand-icon')?.getAttribute('src'),icons:[...document.querySelectorAll('link[rel="icon"]')].map(element=>({url:element.getAttribute('href'),size:Number(element.getAttribute('sizes')?.split('x')[0])})),apple:document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),shortcut:document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href'),manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href'),og:document.querySelector('meta[property="og:image"]')?.getAttribute('content'),twitter:document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')}));
 assert.match(metadata.brand,/myowndex-dex-v104-96\.png(?:\?|$)/);
 assert.match(metadata.apple,/myowndex-dex-v104-180\.png$/);
 assert.match(metadata.shortcut,/myowndex-dex-v104-96\.png$/);
 assert.ok(metadata.icons.some(icon=>icon.size===32),'The browser has a dedicated readable favicon');
 for(const icon of metadata.icons)assert.match(icon.url,/myowndex-dex-v104-(?:32|96)\.png$/);
 assert.ok(metadata.og);assert.equal(metadata.og,metadata.twitter,'Shared links use the same Pokédex do MyOwnDex');
 const response=await context.request.get(new URL(metadata.manifest,baseUrl).href);assert.equal(response.status(),200);const manifest=await response.json();
 assert.deepEqual(manifest.categories,['games']);assert.equal(manifest.shortcuts.length,4);
 for(const shortcut of manifest.shortcuts)for(const icon of shortcut.icons)assert.match(icon.src,/myowndex-dex-v104-96\.png$/);
 for(const icon of manifest.icons)assert.match(icon.src,/myowndex-dex-v104-(?:app-|maskable-)?\d+\.png$/);
 const assets=[...metadata.icons,{url:metadata.apple,size:180},{url:metadata.shortcut,size:96},...manifest.icons.map(icon=>({url:icon.src,size:Number(icon.sizes.split('x')[0])})),{url:metadata.og,size:512}];
 const origin=new URL(baseUrl).origin;
 for(const asset of assets){
  const url=new URL(asset.url,baseUrl);assert.equal(url.origin,origin,'Identity images remain on the public game origin');
  const result=await page.evaluate(async path=>{const response=await fetch(path);if(!response.ok)return {status:response.status};const image=await createImageBitmap(await response.blob());const result={status:response.status,type:response.headers.get('content-type'),width:image.width,height:image.height};image.close();return result;},url.pathname+url.search);
  assert.equal(result.status,200);assert.match(result.type,/image\/png/);assert.equal(result.width,asset.size);assert.equal(result.height,asset.size);
 }
 report.push({label:'Pokédex do MyOwnDex favicon, header, installed icons and shared links',images:assets.length});
}
async function auditAnimatedCard(name){
 await page.locator('#pokemon-search').fill(name);const card=page.getByRole('button',{name:`Consultar ${name} na Pokédex`,exact:true});await card.waitFor();await card.scrollIntoViewIfNeeded();
 const image=card.locator('.pokemon-sized-sprite');
 await page.waitForFunction(name=>{const card=[...document.querySelectorAll('.dex-entry-main')].find(element=>element.getAttribute('aria-label')===`Consultar ${name} na Pokédex`),image=card?.querySelector('img');return image?.dataset.pokemonMotion==='animated'&&image.complete&&image.naturalWidth>0;},name);
 const src=await image.getAttribute('src');assert.match(src,/\.gif(?:\?|$)/);
 const first=await image.screenshot();let changed=false;
 for(let frame=0;frame<10&&!changed;frame++){await page.waitForTimeout(150);changed=!first.equals(await image.screenshot());}
 assert.ok(changed,`${name}: a visible authored frame changes after loading`);
 report.push({label:`${name} visibly animates`,src,changed});
}
async function auditReversibleForm(){
 await page.locator('#pokemon-search').fill('Deoxys');
 await page.getByRole('button',{name:/^Consultar Deoxys(?: · | na Pokédex)/}).first().click();
 const record=page.locator('.record-shell');
 await record.getByRole('button',{name:/Adicionar à equipe/}).waitFor();
 const selector=record.getByLabel('Forma',{exact:true});
 await selector.selectOption('deoxys-attack');
 await page.waitForFunction(()=>{const image=document.querySelector('.record-sprite-stage .pokemon-sized-sprite');return image?.alt==='Deoxys Attack'&&image.dataset.pokemonMotion==='animated'&&image.complete&&image.naturalWidth>0;});
 const src=await record.locator('.record-sprite-stage .pokemon-sized-sprite').getAttribute('src');
 assert.match(src,/\/(?:10001|deoxys-attack)\.gif(?:\?|$)/,'Consulting a reversible form retains its own animation');
 assert.equal(await selector.inputValue(),'deoxys-attack');
 report.push({label:'Deoxys Attack remains accessible in its shared Dex entry',src});
 await page.getByRole('button',{name:'Fechar registro da Pokédex',exact:true}).click();
}
async function auditCosmeticForm(){
 await page.locator('#pokemon-search').fill('Unown');await page.getByRole('button',{name:/^Consultar Unown(?: · | na Pokédex)/}).first().click();
 const record=page.locator('.record-shell');await record.getByRole('button',{name:/Adicionar à equipe/}).waitFor();
 const appearance=record.getByLabel('Aparência',{exact:true});
 await appearance.waitFor();
 assert.equal(await appearance.locator('option').count(),28,'All twenty-eight Unown appearances remain inside one entry');
 await appearance.selectOption('10001');
 await page.waitForFunction(()=>{const image=document.querySelector('.record-sprite-stage .pokemon-sized-sprite');return image?.dataset.pokemonMotion==='animated'&&/\/201-b\.gif(?:\?|$)/.test(image.currentSrc)&&image.complete&&image.naturalWidth>0;});
 assert.equal(await appearance.inputValue(),'10001');
 report.push({label:'Unown appearances are consultable without duplicating Dex entries',appearances:28,selected:'B'});
 await page.getByRole('button',{name:'Fechar registro da Pokédex',exact:true}).click();
}
try{
 await waitForRelease();
 await auditIdentity();
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:width===390?844:900});
  for(const [name,label,selector]of [['dex','Abrir a Pokédex','.dex-entry-main'],['pc','Abrir o PC do Bill','.pc-sidebar'],['guide','Abrir o Guia do Treinador','.guide-rule-card'],['adventure','Abrir a Central da Aventura','.room-lobby']]){
   await page.getByRole('button',{name:label,exact:true}).click();await page.locator(selector).first().waitFor();await check(`${name}-${width}`);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Abrir a Pokédex',exact:true}).click();
 for(const name of ['Toedscool','Scovillain'])await auditAnimatedCard(name);
 await auditReversibleForm();
 await auditCosmeticForm();
 await page.locator('#pokemon-search').fill('');
 await page.getByRole('button',{name:'Abrir o Guia do Treinador',exact:true}).click();await page.locator('.guide-rule-card').first().waitFor();assert.equal(await page.locator('.guide-rule-card').count(),40);report.push({label:'All forty rules are present',rules:40});
 await page.getByRole('button',{name:'Abrir Dados',exact:true}).click();const dice=page.getByRole('dialog',{name:'Dados',exact:true});await dice.getByRole('button',{name:'Rolar 2d6',exact:true}).click();await dice.locator('.local-dice-result').waitFor();await check('Guest local roll');await page.getByRole('button',{name:'Fechar dados',exact:true}).click();
 await page.getByRole('button',{name:'Gerar Pokémon',exact:true}).first().click();await page.locator('.generator-options').waitFor();await check('Generator');await page.getByRole('button',{name:'Fechar gerador',exact:true}).click();
 await page.getByRole('button',{name:'Entrar ou criar conta',exact:true}).click();const account=page.locator('.account-dialog');
 for(const label of ['Entrar','Criar conta','Recuperar acesso']){await account.getByRole('button',{name:label,exact:true}).click();await check(`Account ${label}`);}await page.getByRole('button',{name:'Fechar conta',exact:true}).click();
 const session=await page.evaluate(async()=>{const response=await fetch('/api/account/session'),body=await response.json();return {status:response.status,anonymous:body.account===null,limitBytes:body.limitBytes};});
 assert.equal(session.status,200);assert.equal(session.anonymous,true);assert.ok(Number.isSafeInteger(session.limitBytes)&&session.limitBytes>0);report.push({label:'Anonymous account session GET',...session});
 assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);
 console.log(JSON.stringify({version:expectedVersion,origin:new URL(baseUrl).origin,checkpoints:report.length,errors,blockedWrites}));
}finally{
 fs.writeFileSync(process.env.MYOWNDEX_BROWSER_REPORT || '/tmp/myowndex-production-report.json',JSON.stringify({version:expectedVersion,origin:new URL(baseUrl).origin,releaseWait,report,errors,blockedWrites},null,2));
 await browser.close();
}

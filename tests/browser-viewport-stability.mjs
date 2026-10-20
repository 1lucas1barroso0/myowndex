// A full Box, a short keyboard viewport, visual panning and focus must never
// scroll the outer game frame. Controlled visual-viewport events cover host
// changes that a headless browser cannot produce with a native OS keyboard.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE||'playwright');
const proxy=process.env.MYOWNDEX_BROWSER_PROXY||process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox'],...(proxy?{proxy:{server:proxy,bypass:'localhost,127.0.0.1,::1'}}:{})});
const context=await browser.newContext({viewport:{width:393,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const names=[[130,'gyarados'],[208,'steelix'],[112,'rhydon'],[103,'exeggutor'],[221,'piloswine'],[59,'arcanine']];
const keys=['hp','attack','defense','special-attack','special-defense','speed'];
const pokemon=names.map(([id,name])=>({id:`partner-${id}`,species:{id,name,species:{name},height:10,weight:100,types:[{type:{name:'normal'}}],stats:keys.map(name=>({base_stat:80,stat:{name}})),sprites:{front_default:`/sprites/${id}.png`},moves:[],abilities:[]},level:68,nature:'jolly',ability:'',friendship:70,moves:['','','',''],ivs:{},evs:{},rpg:{xp:0,notes:'Preservar notas'}}));
await context.route('https://pokeapi.co/api/v2/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[],varieties:[],abilities:[],moves:[],stats:[]})}));
await context.addInitScript(pokemon=>{
 if(!localStorage.getItem('viewport-qa')){
  localStorage.setItem('viewport-qa','1');localStorage.setItem('myowndex_rotom_v4',JSON.stringify({schema:5,savedAt:Date.now(),teams:[{id:'box-qa',shareId:'box-qa',name:'Box de seis Pokémon',versionGroup:'auto',updatedAt:Date.now(),rpgScale:2,pokemon}]}));
 }
 const real=window.visualViewport,emulated=new EventTarget();let override={};
 for(const key of ['height','width','offsetTop','offsetLeft','pageTop','pageLeft','scale'])Object.defineProperty(emulated,key,{get:()=>override[key]??real[key]});
 real.addEventListener('resize',()=>emulated.dispatchEvent(new Event('resize')));real.addEventListener('scroll',()=>emulated.dispatchEvent(new Event('scroll')));
 Object.defineProperty(window,'visualViewport',{value:emulated});
 window.__setViewportQA=values=>{override=values;emulated.dispatchEvent(new Event('resize'));emulated.dispatchEvent(new Event('scroll'));};
},pokemon);
let checkpoints=0;
async function stable(label,{top=0,height}={}){
 await page.waitForTimeout(120);
 const s=await page.evaluate(()=>{
  const root=document.querySelector('.app-root'),header=root.querySelector('.app-header'),main=root.querySelector('#main-content'),footer=root.querySelector('.device-footer');
  const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
  return {y:scrollY,frame:rect(root),header:rect(header),main:rect(main),footer:rect(footer),rootScroll:root.scrollTop,headerScroll:header.scrollTop,docHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight};
 });
 assert.equal(s.y,0,label+': document never pans');assert.equal(s.rootScroll,0,label+': frame cannot scroll');assert.equal(s.headerScroll,0,label+': header cannot scroll');
 assert.ok(Math.abs(s.frame.top-top)<1,label+': frame top');assert.ok(Math.abs(s.frame.height-(height||await page.evaluate(()=>innerHeight)))<1,label+': frame height');
 assert.ok(Math.abs(s.header.top-s.frame.top)<1,label+': header stays attached');assert.ok(Math.abs(s.footer.bottom-s.frame.bottom)<1,label+': no bottom gap');
 assert.ok(s.main.height>=60,label+': room remains for content');assert.ok(s.docHeight<=s.clientHeight+1,label+': no second page scrollbar');checkpoints++;
}
try{
 await page.goto(process.env.MYOWNDEX_SMOKE_URL||'http://localhost:3000');await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();await page.locator('.pc-partner-card').first().waitFor();
 for(const index of [0,1,5,0,1]){
  await page.locator('.pc-partner-card').nth(index).click();await stable('open-'+index);
  const main=await page.locator('#main-content').boundingBox(),heading=await page.locator('.pc-editor-heading').boundingBox();assert.ok(heading.y>=main.y-1&&heading.y+heading.height<=main.y+main.height+1,'The whole editor heading and actions are revealed');
  await page.getByRole('button',{name:'Fechar ficha',exact:true}).click();await stable('close-'+index);
  assert.equal(await page.locator('.pc-partner-card').nth(index).evaluate(e=>e===document.activeElement),true);
 }
 await page.locator('.pc-partner-card').nth(1).click();await page.locator('.editor-summary-customize > summary').click();
 const nickname=page.getByLabel('Apelido',{exact:true});await nickname.fill('Steelix parceiro');
 const saved=await page.evaluate(()=>localStorage.getItem('myowndex_header_curtain_v2'));
 for(const height of [480,320,240,844]){
  await page.setViewportSize({width:393,height});await nickname.focus();await page.evaluate(()=>{document.querySelector('.app-root').scrollTop=200;window.scrollTo(0,200);});await stable('real resize '+height);
  assert.equal(await nickname.inputValue(),'Steelix parceiro');
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('myowndex_header_curtain_v2')),saved,'Temporary fitting never overwrites the preference');
 for(const values of [{height:480,offsetTop:100},{height:300,offsetTop:200},{}]){
  await page.evaluate(v=>window.__setViewportQA(v),values);await stable('visual change',{top:values.offsetTop||0,height:values.height||844});assert.equal(await nickname.inputValue(),'Steelix parceiro');
 }
 await page.locator('.app-curtain-grip').focus();await page.keyboard.press('End');await page.getByRole('button',{name:'Abrir Dados',exact:true}).click();
 await page.evaluate(()=>window.__setViewportQA({height:360,offsetTop:100}));await page.waitForTimeout(150);
 const dialog=await page.getByRole('dialog').boundingBox();assert.ok(dialog.y>=100&&dialog.y+dialog.height<=461,'Tools stay inside the visible rectangle');
 await page.keyboard.press('Escape');await page.evaluate(()=>window.__setViewportQA({}));await stable('tools closed');
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>visualViewport.scale)>1.5,'Pinch zoom remains available');
 assert.ok(await page.locator('.app-root').evaluate(e=>e.getBoundingClientRect().height)>=840,'Zoom does not collapse the game');
 await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await cdp.detach();await stable('zoom restored');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await stable('window restored');
 assert.deepEqual(errors,[]);console.log(`PASS ${checkpoints} frame stability checks, full Box, focus, keyboard-size changes, visual viewport, tools and zoom`);
}finally{await browser.close();}

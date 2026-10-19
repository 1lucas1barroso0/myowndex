// Disposable local Boxes only: verify compact feedback without weakening undo or touch targets.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE||'playwright');
const proxy=process.env.MYOWNDEX_BROWSER_PROXY||process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(proxy?{proxy:{server:proxy,bypass:'localhost,127.0.0.1,::1'}}:{})});
const base=process.env.MYOWNDEX_SMOKE_URL||'http://127.0.0.1:3000';
try {
 for(const width of [320,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>{
   const matchMedia=window.matchMedia.bind(window);
   window.matchMedia=query=>query==='(display-mode: standalone)'?Object.defineProperty(matchMedia(query),'matches',{value:true}):matchMedia(query);
   if(localStorage.getItem('compact-feedback-qa'))return;
   localStorage.setItem('compact-feedback-qa','1');
   localStorage.setItem('myowndex_rotom_v4',JSON.stringify({schema:5,savedAt:Date.now(),teams:[{id:'qa-box',shareId:'qa-box',name:'Box de teste',updatedAt:Date.now(),versionGroup:'scarlet-violet',pokemon:[{id:'qa-partner',nickname:'Bulbasaur',level:5,nature:'hardy',moves:[],rpg:{xp:0},species:{id:1,name:'bulbasaur',height:7,weight:69,types:[{type:{name:'grass'}}],stats:['hp','attack','defense','special-attack','special-defense','speed'].map(name=>({stat:{name},base_stat:50})),abilities:[],moves:[],sprites:{front_default:'/sprites/1.png'}}}]}]}));
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Abrir o PC do Bill',exact:true}).click();
  const heading=page.locator('.pc-sidebar-heading');await heading.waitFor();
  const header=await heading.boundingBox();assert.ok(header.height<=115,`Boxes heading remains compact at ${width}px: ${header.height}`);
  const mascot=await page.locator('.pc-mascot-stage .pokemon-companion').boundingBox();assert.ok(mascot.width>=79&&mascot.height>=79,'The animated mascot stays visible');
  await page.getByRole('button',{name:'Abrir ficha de Bulbasaur, nível 5',exact:true}).click();
  await page.getByRole('button',{name:'Remover da Box',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Remover parceiro',exact:true}).click();
  const notice=page.locator('.status-notice').filter({hasText:'Bulbasaur saiu da Box.'});await notice.waitFor();
  const box=await notice.boundingBox();assert.ok(box.height<=96,`Undo notice must be compact at ${width}px: ${box.height}`);
  for(const label of ['Desfazer','Dispensar aviso']){
   const rect=await notice.getByRole('button',{name:label,exact:true}).boundingBox();assert.ok(rect.width>=44&&rect.height>=44,`${label} retains its touch target`);
  }
  await notice.getByRole('button',{name:'Desfazer',exact:true}).click();
  await page.getByRole('button',{name:'Abrir ficha de Bulbasaur, nível 5',exact:true}).waitFor();
  await page.getByRole('button',{name:'Dispensar aviso',exact:true}).click();assert.equal(await page.locator('.status-notice').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log(`PASS compact feedback ${width}px standalone: header ${Math.round(header.height)}px, notice ${Math.round(box.height)}px, undo, dismissal and touch targets`);
  await context.close();
 }
}finally{await browser.close();}

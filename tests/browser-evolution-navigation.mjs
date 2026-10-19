// Real record interactions with isolated public-data fixtures; no player data is changed.
import assert from 'node:assert/strict';
import {formatName} from '../src/core/mechanics.js';
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE||'playwright');
const proxy=process.env.MYOWNDEX_BROWSER_PROXY||process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox'],...(proxy?{proxy:{server:proxy,bypass:'localhost,127.0.0.1,::1'}}:{})});
const base=process.env.MYOWNDEX_SMOKE_URL||'http://127.0.0.1:3000';
const url=(kind,id)=>`https://pokeapi.co/api/v2/${kind}/${id}/`;
const ids={bulbasaur:1,ivysaur:2,venusaur:3,rattata:19,raticate:20,'rattata-alola':10091,'raticate-alola':10092};
const names=Object.fromEntries(Object.entries(ids).map(([n,id])=>[id,n]));
const speciesId=name=>name.startsWith('rattata')?19:name.startsWith('raticate')?20:ids[name];
const chain=(name,next=[])=>({species:{name,url:url('pokemon-species',ids[name])},evolves_to:next});
const chains={1:{chain:chain('bulbasaur',[chain('ivysaur',[chain('venusaur')])])},7:{chain:chain('rattata',[chain('raticate')])}};
const pokemon=name=>({id:ids[name],name,species:{name:names[speciesId(name)],url:url('pokemon-species',speciesId(name))},height:7,weight:69,stats:['hp','attack','defense','special-attack','special-defense','speed'].map(stat=>({stat:{name:stat},base_stat:40+ids[name]%30})),types:[{type:{name:name.includes('ratt')?'normal':'grass'}}],moves:[],abilities:[],forms:[],sprites:{front_default:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${ids[name]}.png`}});
const species=id=>({id,name:names[id],gender_rate:4,varieties:[names[id],...([19,20].includes(id)?[`${names[id]}-alola`]:[])].map((name,i)=>({is_default:i===0,pokemon:{name,url:url('pokemon',ids[name])}})),evolution_chain:{url:url('evolution-chain',[19,20].includes(id)?7:1)}});
try {
 for(const width of [320,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let failIvysaur=false;
  await context.route('https://pokeapi.co/api/v2/**',async route=>{
   const [,kind,key]=new URL(route.request().url()).pathname.match(/\/api\/v2\/([^/]+)\/([^/]+)/)||[];
   if(failIvysaur&&kind==='pokemon-species'&&key==='2')return route.fulfill({status:503,json:{error:'isolated retry fixture'}});
   let body;
   if(kind==='pokemon-species')body=species(Number(key));
   if(kind==='pokemon')body=pokemon(names[key]||key);
   if(kind==='evolution-chain')body=chains[key];
   if(kind==='pokemon-form'){
    const name=Number(key)===10193?'rattata-alola':Number(key)===10194?'raticate-alola':names[key];
    body={id:Number(key),name,pokemon:{name,url:url('pokemon',ids[name])},sprites:{front_default:pokemon(name).sprites.front_default}};
   }
   return route.fulfill({status:body?200:404,json:body||{}});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#pokemon-search').fill('bulbasaur');
  await page.getByRole('button',{name:'Consultar Bulbasaur na Pokédex',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:'Bulbasaur',exact:true}).waitFor();
  await dialog.evaluate(e=>e.dataset.navigationTest='same-record');
  const background=await page.evaluate(()=>({y:scrollY,search:document.querySelector('#pokemon-search').value}));
  const member=name=>dialog.getByRole('button',{name:`Ver ${name} na ficha`,exact:true}).first();
  if(width===320){
   failIvysaur=true;
   await member('Ivysaur').click();
   await dialog.getByRole('alert').filter({hasText:'Este Pokémon não abriu'}).waitFor();
   assert.equal(await dialog.getByRole('heading',{name:'Bulbasaur',exact:true}).count(),1,'Failed navigation keeps the current record');
   failIvysaur=false;
  }
  await member('Ivysaur').click();
  await dialog.getByRole('heading',{name:'Ivysaur',exact:true}).waitFor();
  assert.match(await dialog.locator('.record-cartridge-label').innerText(),/0002/);
  await member('Venusaur').focus();await page.keyboard.press('Enter');
  await dialog.getByRole('heading',{name:'Venusaur',exact:true}).waitFor();
  await member('Bulbasaur').focus();await page.keyboard.press('Space');
  await dialog.getByRole('heading',{name:'Bulbasaur',exact:true}).waitFor();
  assert.equal(await dialog.getAttribute('data-navigation-test'),'same-record','Dialog must not be remounted');
  assert.deepEqual(await page.evaluate(()=>({y:scrollY,search:document.querySelector('#pokemon-search').value})),background,'The Pokédex remains in place');
  await dialog.getByRole('button',{name:'Fechar registro da Pokédex',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.locator('#pokemon-search').fill('rattata');
  await page.getByRole('button',{name:'Consultar Rattata na Pokédex',exact:true}).click();
  await dialog.getByLabel('Forma',{exact:true}).selectOption('rattata-alola');
  await member(formatName('raticate-alola')).waitFor();
  await member(formatName('raticate-alola')).click();
  await dialog.getByRole('heading',{name:'Raticate',exact:true}).waitFor();
  assert.equal(await dialog.getByLabel('Forma',{exact:true}).inputValue(),'raticate-alola','Regional navigation retains the exact variant');
  assert.match(await dialog.locator('.record-cartridge-label').innerText(),/0020/,'Form IDs are never used as National Dex numbers');
  const controls=await dialog.locator('.record-evolution-member').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
  assert.ok(controls.every(r=>r.w>=44&&r.h>=44),'Family members remain usable by touch');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  assert.equal(overflow,false);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(errors,[]);
  console.log(`PASS evolution navigation ${width}px: click, Enter, Space, regional identity, same dialog and background`);
  await context.close();
 }
} finally {await browser.close();}

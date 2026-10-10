import assert from "node:assert/strict";
import { createRoomSnapshot, normalizeRoomSnapshot } from "../src/core/room.js";
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy=process.env.MYOWNDEX_BROWSER_PROXY||process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"],...(proxy?{proxy:{server:proxy,bypass:"localhost,127.0.0.1,::1"}}:{})});
const base=process.env.MYOWNDEX_SMOKE_URL||"http://localhost:3000";
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
const page=await context.newPage();
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const creature=(id,name,side,item,teraType)=>({id,pokemonId:id,teamId:"local-team",name,speciesName:name.toLowerCase(),speciesId:id==="c"?6:10,side,
    x:id==="c"?30:70,y:id==="c"?65:32,sprite:"/sprites/6.png",level:50,maxHp:40,currentHp:id==="c"?26:40,
    item,teraType,dynamaxLevel:0,canGMax:false,types:["fire","flying"],originalTypes:["fire","flying"],
    stats:{hp:40,attack:9,defense:9,"special-attack":9,"special-defense":9,speed:9},
    originalStats:{hp:200,attack:80,defense:80,"special-attack":80,"special-defense":80,speed:80},
    moves:["flamethrower","","",""],pp:[10,null,null,null],status:id==="c"?"poison":""});
const seed=normalizeRoomSnapshot({...createRoomSnapshot("QA de fases"),phase:"batalha",battleStarted:true,
    tokens:[creature("c","Charizard","ally","charizardite-x","fire"),creature("x","Caterpie","opponent","","")]});
const form={id:10034,name:"charizard-mega-x",height:17,weight:1105,
    sprites:{front_default:"/sprites/6.png"},abilities:[{ability:{name:"tough-claws"}}],
    types:[{type:{name:"fire"}},{type:{name:"dragon"}}],
    stats:[["hp",78],["attack",130],["defense",111],["special-attack",130],["special-defense",85],["speed",100]]
      .map(([name,base_stat])=>({stat:{name},base_stat}))};
await context.route("**/api/rooms/**",route=>route.abort());
await context.route("https://pokeapi.co/api/v2/pokemon/charizard-mega-x",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(form)}));
await context.addInitScript(seed=>{
    if(localStorage.getItem("gimmick-qa-boot"))return;
    localStorage.setItem("gimmick-qa-boot","1");
    const sp=(id,name)=>({id,name,species:{name},height:10,weight:80,stats:[60,70,65,75,70,70].map((base_stat,i)=>({base_stat,stat:{name:["hp","attack","defense","special-attack","special-defense","speed"][i]}})),types:[{type:{name:"normal"}}],sprites:{front_default:"/sprites/"+id+".png"},moves:[],abilities:[]});
    localStorage.setItem("myowndex_rotom_v4",JSON.stringify({schema:5,savedAt:Date.now(),teams:[{id:"local-team",shareId:"local-team",name:"Box livre",updatedAt:Date.now(),versionGroup:"scarlet-violet",pokemon:[
       {id:"c",nickname:"Charizard",species:sp(6,"charizard"),level:50,item:"charizardite-x",teraType:"fire",moves:["flamethrower","","",""],nature:"hardy",rpg:{xp:0}},
       {id:"pikachu-id",nickname:"Pikachu",species:sp(25,"pikachu"),level:20,moves:["thunderbolt","","",""],nature:"hardy",rpg:{xp:2}}
    ]}]}));
    localStorage.setItem("myowndex_live_room_v1",JSON.stringify({code:"LOCAL",key:"gimmick-qa",role:"narrator",displayName:"Narrador",local:true}));
    localStorage.setItem("myowndex_local_room_v1",JSON.stringify({code:"LOCAL",title:seed.title,revision:0,updatedAt:new Date().toISOString(),snapshot:seed,players:[],events:[],media:[]}));
},seed);
const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot);
const setPhase=async id=>{
    await page.locator(`.room-phase-options [data-phase="${id}"]`).click();
    await page.waitForFunction(id=>JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot.phase===id,id);
};
try{
    await page.goto(base,{waitUntil:"domcontentloaded"});
    const colors=await page.evaluate(async()=>{
        const image=new Image();
        image.src="/scenes/arena.svg?v=worlds3";
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
        const canvas=document.createElement("canvas");canvas.width=480;canvas.height=320;
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        ctx.drawImage(image,0,0);
        const rgb=(x,y)=>[...ctx.getImageData(x,y,1,1).data].slice(0,3);
        return {upper:rgb(240,146),lower:rgb(240,174),button:rgb(240,160)};
    });
    assert.ok(colors.upper[0]>colors.upper[1]*1.35 && colors.upper[0]>colors.upper[2]*1.2,"upper half of Poké Ball must be red");
    assert.ok(colors.lower.every(c=>c>225),"lower half of Poké Ball must be white");
    assert.ok(colors.button.every(c=>c>180),"button must remain visible");
    await page.getByRole("button",{name:"Abrir a Central da Aventura",exact:true}).click();
    await page.locator(".room-app").waitFor();
    const mobile=page.locator(".room-mobile-nav");
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Campo",exact:true}).click();
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Equipe",exact:true}).click();
    const entry=page.getByRole("combobox",{name:"Quem entra em campo"});
    assert.equal(await entry.inputValue(),"","No Pokémon preselected from the Box");
    const action=page.getByRole("button",{name:/Adicionar.*como aliado/});
    assert.equal(await action.isDisabled(),true);
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Campo",exact:true}).click();
    await page.locator(".room-token").first().click();
    await page.locator(".token-inspector").waitFor();
    assert.equal(await page.locator("#room-token-xp").count(),0,"Stored XP is read-only in adventure");
    assert.equal(await page.locator(".token-xp-readout").count(),1);
    assert.match(await page.locator(".token-experience-heading").innerText(),/Nível 50/);
    const reward=page.locator(".token-inspector .experience-award");
    await reward.locator(":scope > summary").click();
    assert.equal(await reward.getByRole("spinbutton",{name:"Maior nível"}).count(),0);
    await reward.locator(".experience-manual-choice > summary").click();
    await reward.getByLabel("Substituir o resultado automático").check();
    await reward.getByLabel("XP a conceder").fill("1.5");
    assert.equal(await reward.getByRole("alert").innerText(),"Informe um valor inteiro.");
    const align=await reward.locator(".experience-manual-toggle").evaluate(el=>{
       const a=el.getBoundingClientRect(),b=el.querySelector("input").getBoundingClientRect();
       return b.left-a.left;
    });
    assert.ok(align<60,"Manual XP toggle aligned beside text");
    await reward.getByLabel("Substituir o resultado automático").uncheck();
    await reward.locator(":scope > summary").click();
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Equipe",exact:true}).click();
    await page.locator(".room-team-multiple > summary").click();
    const row=await page.locator(".room-team-multiple-choice").first().evaluate(el=>{
       const a=el.querySelector(".room-roster-name").getBoundingClientRect(),b=el.querySelector(".room-roster-status").getBoundingClientRect();
       return {right:a.right,bottom:a.bottom,left:b.left,top:b.top};
    });
    assert.ok(row.left>=row.right-1||row.top>=row.bottom-1,"Em campo cannot overlap a Pokémon name");
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Campo",exact:true}).click();
    for(const phase of ["exploracao","interpretacao","intervalo","batalha"]){
        await setPhase(phase);
        assert.equal(await page.locator(".token-inspector").count(),1,`${phase} retains selected Pokémon controls`);
        assert.equal(await page.getByRole("button",{name:"Retirar da cena"}).count(),1,`${phase} permits removal`);
        const selector=page.getByLabel("Lado",{exact:true});
        await selector.selectOption("neutral");
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot.tokens[0].side==="neutral");
        await selector.selectOption("ally");
        assert.equal(await page.locator(".room-phase-context").count(),1);
        assert.equal(await page.locator(".battle-gimmick-panel").count(),phase==="batalha"?1:0);
        assert.equal(await page.locator(".phase-rest-actions").count(),phase==="intervalo"?1:0);
        if(phase==="intervalo"){
            await page.getByRole("button",{name:/Descansar/}).click();
            await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot.tokens[0].currentHp>26);
        }
        console.log("Phase passes",phase);
    }
    const mega=page.locator(".gimmick-action.gimmick-mega");
    assert.equal(await mega.count(),1);
    assert.equal(await page.locator(".gimmick-action.gimmick-dyna").count(),0);
    await mega.click();
    await page.waitForFunction(()=>{
        const s=JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot;
        return s.tokens[0].gimmickState?.active==="mega";
    },null,{timeout:20000});
    assert.equal((await snapshot()).tokens[0].speciesName,"charizard-mega-x");
    assert.equal(await page.locator(".room-token.gimmick-mega").count(),1);
    assert.equal(await page.locator(".gimmick-action").count(),0,"One-time transformations cannot be stacked");
    await page.getByRole("button",{name:"Retirar da cena"}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot.tokens.length===1);
    assert.equal((await snapshot()).tokens[0].name,"Caterpie");
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Equipe",exact:true}).click();
    await entry.selectOption("pikachu-id");
    assert.equal(await action.isDisabled(),false);
    await action.click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_room_v1")).snapshot.tokens.some(t=>t.pokemonId==="pikachu-id"));
    const added=await snapshot();
    assert.equal(added.tokens.some(t=>t.pokemonId==="pikachu-id"&&t.name==="Pikachu"),true);
    assert.equal(added.tokens.some(t=>t.pokemonId==="c"),false,"First Box Pokémon must not enter");
    if(await mobile.isVisible())await mobile.getByRole("button",{name:"Campo",exact:true}).click();
    await page.locator(".room-token").first().click();
    assert.equal(await page.locator(".battle-gimmick-panel").count(),0,"No unlocked ability means no false buttons");
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      if(await mobile.isVisible())await mobile.getByRole("button",{name:"Equipe",exact:true}).click();
      const metrics=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(metrics.scroll<=metrics.w+1,"Page overflow at "+width+"px");
    }
    assert.deepEqual(errors,[]);
    console.log("Passed 4 real phase controls, correct Mega form, neutral side and scene removal.");
}finally{await browser.close();}

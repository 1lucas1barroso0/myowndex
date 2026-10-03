// Optional UI regression: the actual shared rules run locally against a small,
// deterministic catalog fixture. No production account or room is changed.
import assert from "node:assert/strict";
const { chromium }=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
const page=await context.newPage();
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const stats=["hp","attack","defense","special-attack","special-defense","speed"];
const pokemon=(id,name,bases,type)=>({id,name,species:{name,url:`https://pokeapi.co/api/v2/pokemon-species/${id}/`},types:[{slot:1,type:{name:type}}],stats:bases.map((base_stat,i)=>({base_stat,stat:{name:stats[i]}})),height:7,weight:69,sprites:{front_default:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`},abilities:[],moves:[]});
const bulba=pokemon(1,"bulbasaur",[45,49,49,65,65,45],"grass");
const pika=pokemon(25,"pikachu",[35,55,40,50,50,90],"electric");
const move=(name,power=40,category="physical")=>({id:name==="tackle"?33:45,name,accuracy:100,power,pp:name==="growl"?40:35,priority:0,type:{name:"normal"},damage_class:{name:category},target:{name:"selected-pokemon"},effect_entries:[{language:{name:"en"},effect:power?"Inflicts regular damage.":"Lowers the target's Attack by one stage."}],meta:{ailment:{name:"none"},category:{name:category==="status"?"net-good-stats":"damage"},min_hits:null,max_hits:null,crit_rate:0},stat_changes:name==="growl"?[{stat:{name:"attack"},change:-1}]:[]});
await context.route("https://pokeapi.co/api/v2/**",async route=>{
    const path=new URL(route.request().url()).pathname.split("/").filter(Boolean);
    const kind=path[2],name=path[3];
    let body;
    if(kind==="pokemon")body=name==="bulbasaur" || name==="1"?bulba:pika;
    else if(kind==="pokemon-species")body={id:name==="1"?1:25,name:name==="1"?"bulbasaur":"pikachu",capture_rate:45,gender_rate:1,flavor_text_entries:[],evolution_chain:null};
    else if(kind==="move")body=move(name,name==="growl"?null:40,name==="growl"?"status":"physical");
    else body={name,effect_entries:[]};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});
await context.addInitScript(({bulba,pika})=>{
    if(localStorage.getItem("myowndex_local_dice_qa_seeded"))return;
    localStorage.setItem("myowndex_local_dice_qa_seeded","true");
    const stored={schema:5,savedAt:Date.now(),teams:[{id:"dice-box",shareId:"dice-box",name:"Equipe de teste",updatedAt:Date.now(),versionGroup:"scarlet-violet",rpgScale:2,pokemon:[
        {id:"dice-bulba",nickname:"Buba",species:bulba,level:20,nature:"hardy",ability:"overgrow",moves:["tackle","growl","",""],ivs:{},evs:{},rpg:{currentHp:5,pp:[35,40,null,null],xp:0,notes:"Preservar"}},
        {id:"dice-pika",nickname:"Pika",species:pika,level:20,nature:"hardy",ability:"static",moves:["quick-attack","","",""],ivs:{},evs:{},rpg:{currentHp:4,pp:[30,null,null,null],xp:0}},
    ]}]};
    localStorage.setItem("myowndex_rotom_v4",JSON.stringify(stored));
},{bulba,pika});
const pass=name=>console.log(`PASS ${name}`);
const openDetails=async locator=>{if(!await locator.evaluate(element=>element.open))await locator.locator(":scope > summary").click();};
try {
    await page.goto(process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000");
    await page.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
    let dialog=page.getByRole("dialog",{name:"Dados",exact:true});
    await dialog.getByRole("button",{name:"Campo",exact:true}).click();
    await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).selectOption("dice-box:dice-bulba");
    await dialog.getByRole("button",{name:"Trazer para o campo",exact:true}).click();
    await dialog.locator(".local-pokemon-roster button").first().waitFor();
    await openDetails(dialog.locator(".local-pokemon-setup"));
    await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).selectOption("dice-box:dice-pika");
    await dialog.getByRole("combobox",{name:"Posição no campo",exact:true}).selectOption("opponent");
    await dialog.getByRole("button",{name:"Trazer para o campo",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".local-dice-dialog .local-pokemon-roster button").length===2);
    pass("local-pokemon-from-boxes-with-real-stats-and-mobile-pickers");

    const initiative=dialog.locator(".local-pokemon-initiative");await openDetails(initiative);
    await initiative.getByRole("button",{name:"Rolar iniciativa",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".local-pokemon-initiative li").length===2);
    await initiative.getByRole("button",{name:"Próximo turno",exact:true}).click();
    await initiative.getByRole("button",{name:"Encerrar rodada",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector(".local-pokemon-initiative summary").textContent.includes("R2"));
    pass("local-initiative-both-pokemon-next-turn-and-round-effects");

    const dispute=dialog.locator(".room-tool").filter({has:page.getByText("Disputa entre Pokémon",{exact:true})});await openDetails(dispute);
    await dispute.getByRole("combobox",{name:"Usuário da disputa",exact:true}).selectOption({label:"Buba"});
    await dispute.getByRole("combobox",{name:"Oposição da disputa",exact:true}).selectOption({label:"Pika"});
    await dispute.getByRole("button",{name:"Resolver disputa",exact:true}).click();
    await dialog.locator(".local-pokemon-receipt").filter({hasText:"venceu a disputa"}).waitFor();
    assert.doesNotMatch(await dialog.locator(".local-pokemon-receipt").innerText(),/produto|ponderad|atributo.*\d.*[×*]/i);
    pass("automatic-local-opposition-rolls-both-sides-without-manual-products");

    const combat=dialog.locator(".room-tool").filter({has:page.getByText("Resolver um movimento",{exact:true})});await openDetails(combat);
    await combat.getByRole("combobox",{name:"Usuário",exact:true}).selectOption({label:"Buba"});
    await combat.getByRole("combobox",{name:"Movimento",exact:true}).selectOption("tackle");
    await combat.getByRole("combobox",{name:"Alvo",exact:true}).selectOption({label:"Pika"});
    await combat.getByRole("button",{name:/^Resolver:/}).click();
    await combat.locator(".combat-result").waitFor();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1"))?.tokens.find(token=>token.name==="Buba")?.pp[0]===34);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_rotom_v4")).teams[0].pokemon[0].rpg.pp[0]),35,"practice leaves Box PP untouched");
    pass("shared-combat-accuracy-damage-pp-and-box-isolation");

    const conditions=dialog.locator(".room-tool").filter({has:page.getByText("Condições do campo",{exact:true})});await openDetails(conditions);
    await dialog.locator(".local-pokemon-roster button").filter({hasText:"Pika"}).click();
    await conditions.getByLabel("HP atual",{exact:true}).fill("4");
    const capture=dialog.locator(".room-tool").filter({has:page.getByText("Captura",{exact:true})});await openDetails(capture);
    await capture.getByRole("combobox",{name:"Equipe em campo",exact:true}).selectOption({label:"Buba"});
    await capture.getByRole("combobox",{name:"Alvo selvagem",exact:true}).selectOption({label:"Pika"});
    await capture.getByRole("combobox",{name:"Poké Ball",exact:true}).selectOption("master-ball");
    await capture.getByRole("checkbox").check();
    await capture.getByRole("button",{name:"Lançar Poké Ball",exact:true}).click();
    await capture.getByRole("status").filter({hasText:"captura confirmada"}).waitFor();
    pass("local-capture-wild-target-master-ball-and-shared-permissions");

    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3"))?.some(record=>record.spec.action==="capture"));
    const count=await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).length);
    await dialog.getByRole("button",{name:"Fechar dados",exact:true}).click();
    await page.reload();
    await page.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
    dialog=page.getByRole("dialog",{name:"Dados",exact:true});
    await dialog.getByRole("button",{name:"Campo",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".local-dice-dialog .local-pokemon-roster button").length===2);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).length),count,"opening and rendering never create new rolls");
    pass("reload-preserves-field-and-history-without-rerolling");

    for(const width of [320,390,768,1280]){
        await page.setViewportSize({width,height:844});
        const dimensions=await dialog.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right}));
        assert.ok(dimensions.scroll<=dimensions.width+1,`dialog overflow at ${width}`);
        assert.ok(dimensions.left>=0 && dimensions.right<=width+1,`dialog outside viewport at ${width}`);
    }
    pass("pokemon-local-dice-320-to-desktop-no-horizontal-overflow");

    const tab2=await context.newPage();
    await tab2.goto(process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000");
    await tab2.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
    const secondDialog=tab2.getByRole("dialog",{name:"Dados",exact:true});
    await dialog.getByRole("button",{name:"Rolagens",exact:true}).click();
    const beforeConcurrent=await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).length);
    await Promise.all([dialog.getByRole("button",{name:"Rolar 2d6",exact:true}).click(),secondDialog.getByRole("button",{name:"Rolar 2d6",exact:true}).click()]);
    await page.waitForFunction(count=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3"))?.length===count+2,beforeConcurrent);
    const expected=`${beforeConcurrent+2} rolagens`;
    await page.waitForFunction(text=>document.querySelector(".local-dice-dialog .local-dice-history summary b")?.textContent===text,expected);
    await tab2.waitForFunction(text=>document.querySelector(".local-dice-dialog .local-dice-history summary b")?.textContent===text,expected);
    pass("two-simultaneous-tabs-retain-both-rolls-and-refresh-history");
    const history=dialog.locator(".local-dice-history");await openDetails(history);
    await history.getByRole("button",{name:"Apagar histórico",exact:true}).click();
    await page.getByRole("alertdialog").getByRole("button",{name:"Apagar histórico",exact:true}).click();
    await tab2.waitForFunction(()=>document.querySelector(".local-dice-dialog .local-dice-history summary b")?.textContent==="0 rolagens");
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).length),0);
    pass("cross-tab-history-clear-does-not-resurrect-old-receipts");
    await dialog.getByRole("button",{name:"Campo",exact:true}).click();
    await dialog.locator(".local-pokemon-roster button").filter({hasText:"Buba"}).click();
    const sharedConditions=dialog.locator(".room-tool").filter({has:page.getByText("Condições do campo",{exact:true})});
    await openDetails(sharedConditions);
    await sharedConditions.getByLabel("HP atual",{exact:true}).fill("4");
    await secondDialog.getByRole("button",{name:"Campo",exact:true}).click();
    await secondDialog.locator(".local-pokemon-roster button").filter({hasText:"Buba"}).click();
    const tab2Conditions=secondDialog.locator(".room-tool").filter({has:tab2.getByText("Condições do campo",{exact:true})});
    await openDetails(tab2Conditions);
    await tab2.waitForFunction(()=>document.querySelector(".local-pokemon-status input")?.value==="4");
    assert.equal(await tab2.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_rotom_v4")).teams[0].pokemon[0].rpg.currentHp),5,"cross-tab practice changes preserve the original Box");
    pass("practice-field-refreshes-in-another-open-panel-without-changing-boxes");
    await tab2.close();

    await dialog.getByRole("button",{name:"Fechar dados",exact:true}).click();
    await page.getByRole("button",{name:"Abrir a Central da Aventura",exact:true}).click();
    await page.getByRole("button",{name:"Começar uma aventura local",exact:false}).click();
    await page.getByRole("combobox",{name:"Box",exact:true}).selectOption("dice-box");
    await page.getByRole("button",{name:"Entrar como aliado",exact:true}).click();
    await page.getByRole("combobox",{name:"Quem entra em campo",exact:true}).selectOption("dice-pika");
    await page.getByRole("button",{name:"Entrar como aliado",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".room-token").length===2);
    const practiceBefore=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1")).tokens));
    const historyBeforeAdventure=await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3"))?.length || 0);
    await page.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
    dialog=page.getByRole("dialog",{name:"Dados",exact:true});
    assert.equal(await dialog.getByRole("button",{name:"Campo",exact:true}).count(),0,"Adventure hides the standalone practice field");
    assert.equal(await dialog.locator(".local-pokemon-roster").count(),0,"Adventure does not duplicate its Pokémon tools inside Dados");
    assert.equal(await dialog.locator(".local-dice-history").count(),0,"Adventure uses its own Diary instead of a second roll history");
    await dialog.getByRole("button",{name:"Rolar 2d6",exact:true}).click();
    await dialog.locator(".local-dice-result").waitFor();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_room_v1"))?.events?.some(event=>event.type==="roll"));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3"))?.length || 0),historyBeforeAdventure,"adventure rolls do not duplicate receipts in standalone history");
    assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1")).tokens)),practiceBefore,"adventure rolls preserve the independent practice field");
    await dialog.getByRole("button",{name:"Fechar dados",exact:true}).click();
    assert.equal(await page.locator(".room-tools .local-dice-panel").count(),0,"Adventure tools no longer embed another Dados panel");
    pass("adventure-dice-is-contextual-without-duplicating-field-or-history");
    assert.deepEqual(errors,[]);
    console.log("PASS no-runtime-errors");
} finally {await browser.close();}

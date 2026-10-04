// Optional UI regression: the actual shared rules run locally against a small,
// deterministic catalog fixture. No production account or room is changed.
import assert from "node:assert/strict";
const { chromium }=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxyServer=process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,args:["--no-sandbox"],...(proxyServer ? {proxy:{server:proxyServer,bypass:"localhost,127.0.0.1,::1"}} : {})});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
const page=await context.newPage();
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const stats=["hp","attack","defense","special-attack","special-defense","speed"];
const pokemon=(id,name,bases,type)=>({id,name,species:{name,url:`https://pokeapi.co/api/v2/pokemon-species/${id}/`},types:[{slot:1,type:{name:type}}],stats:bases.map((base_stat,i)=>({base_stat,stat:{name:stats[i]}})),height:7,weight:69,sprites:{front_default:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`},abilities:[],moves:[]});
const bulba=pokemon(1,"bulbasaur",[45,49,49,65,65,45],"grass");
const pika=pokemon(25,"pikachu",[35,55,40,50,50,90],"electric");
const cinderace=pokemon(815,"cinderace",[80,116,75,65,75,119],"fire");
const secondBoxName="Companheiros da jornada para encontros e batalhas";
const move=(name,power=40,category="physical")=>({id:({tackle:33,growl:45,"quick-attack":98,"fake-out":252})[name] || 33,name,accuracy:100,power,pp:name==="growl"?40:name==="fake-out"?10:35,priority:name==="fake-out"?3:name==="quick-attack"?1:0,type:{name:"normal"},damage_class:{name:category},target:{name:"selected-pokemon"},effect_entries:[{language:{name:"en"},effect:name==="fake-out"?"Inflicts regular damage and makes the target flinch. Only works on the user's first turn after entering the field.":power?"Inflicts regular damage.":"Lowers the target's Attack by one stage."}],meta:{ailment:{name:"none"},category:{name:category==="status"?"net-good-stats":"damage"},min_hits:null,max_hits:null,crit_rate:0,flinch_chance:name==="fake-out"?100:0},stat_changes:name==="growl"?[{stat:{name:"attack"},change:-1}]:[]});
await context.route("https://pokeapi.co/api/v2/**",async route=>{
    const path=new URL(route.request().url()).pathname.split("/").filter(Boolean);
    const kind=path[2],name=path[3];
    let body;
    if(kind==="pokemon")body=name==="bulbasaur" || name==="1"?bulba:name==="cinderace" || name==="815"?cinderace:pika;
    else if(kind==="pokemon-species")body={id:name==="1"?1:25,name:name==="1"?"bulbasaur":"pikachu",capture_rate:45,gender_rate:1,flavor_text_entries:[],evolution_chain:null};
    else if(kind==="move")body=move(name,name==="growl"?null:40,name==="growl"?"status":"physical");
    else body={name,effect_entries:[]};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});
await context.addInitScript(({bulba,pika,cinderace,secondBoxName})=>{
    if(localStorage.getItem("myowndex_local_dice_qa_seeded"))return;
    localStorage.setItem("myowndex_local_dice_qa_seeded","true");
    const stored={schema:5,savedAt:Date.now(),teams:[{id:"dice-box",shareId:"dice-box",name:"Equipe de teste",updatedAt:Date.now(),versionGroup:"scarlet-violet",rpgScale:2,pokemon:[
        {id:"dice-bulba",nickname:"Buba",species:bulba,level:20,nature:"hardy",ability:"overgrow",moves:["tackle","growl","fake-out",""],ivs:{},evs:{},rpg:{currentHp:5,pp:[35,40,10,null],xp:0,notes:"Preservar"}},
        {id:"dice-pika",nickname:"Pika",species:pika,level:20,nature:"hardy",ability:"static",moves:["quick-attack","","",""],ivs:{},evs:{},rpg:{currentHp:4,pp:[30,null,null,null],xp:0}},
    ]},{id:"dice-second-box",shareId:"dice-second-box",name:secondBoxName,updatedAt:Date.now(),versionGroup:"scarlet-violet",rpgScale:2,pokemon:[
        {id:"dice-cinderace",species:cinderace,level:20,nature:"hardy",moves:["tackle","","",""],ivs:{},evs:{},rpg:{currentHp:8,pp:[35,null,null,null],xp:0}},
    ]}]};
    localStorage.setItem("myowndex_rotom_v4",JSON.stringify(stored));
},{bulba,pika,cinderace,secondBoxName});
const pass=name=>console.log(`PASS ${name}`);
const openDetails=async locator=>{if(!await locator.evaluate(element=>element.open))await locator.locator(":scope > summary").click();};
const fieldState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1")));
const assertFits=async(width,label)=>{
    await page.setViewportSize({width,height:844});
    const dialog=page.getByRole("dialog",{name:"Dados",exact:true});
    const layout=await dialog.evaluate(element=>{
        const visible=node=>Boolean(node.getClientRects().length) && getComputedStyle(node).visibility!=="hidden";
        const bounds=element.getBoundingClientRect();
        const brokenWords=[];
        for(const target of element.querySelectorAll(".local-field-preview strong,.local-field-partner strong,.local-field-turn-list strong,.room-select-value,h4,.local-field-round,.combat-result-summary")){
            if(!visible(target))continue;
            const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);
            for(let node=walker.nextNode();node;node=walker.nextNode()){
                for(const match of node.textContent.matchAll(/[\p{L}\p{N}]+/gu)){
                    const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
                    const rows=new Set([...range.getClientRects()].filter(rect=>rect.width>0 && rect.height>0).map(rect=>Math.round(rect.top)));
                    if(rows.size>1)brokenWords.push(match[0]);
                }
            }
        }
        const smallTargets=[...element.querySelectorAll(".local-pokemon-dice button,.local-pokemon-dice select,.local-pokemon-dice summary,.local-dice-pages button")].filter(node=>visible(node) && !node.disabled).map(node=>({text:node.textContent.trim() || node.getAttribute("aria-label"),height:node.getBoundingClientRect().height})).filter(node=>node.height<43.5);
        return {width:element.clientWidth,scroll:element.scrollWidth,left:bounds.left,right:bounds.right,brokenWords,smallTargets};
    });
    assert.ok(layout.scroll<=layout.width+1,`${label}: dialog overflow at ${width}`);
    assert.ok(layout.left>=0 && layout.right<=width+1,`${label}: dialog outside viewport at ${width}`);
    assert.deepEqual(layout.brokenWords,[],`${label}: broken words at ${width}`);
    assert.deepEqual(layout.smallTargets,[],`${label}: controls smaller than 44px at ${width}`);
};
try {
    await page.goto(process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000");
    await page.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
    let dialog=page.getByRole("dialog",{name:"Dados",exact:true});
    await dialog.getByRole("button",{name:"Campo",exact:true}).click();
    const source=dialog.locator(".local-pokemon-setup");
    await dialog.getByRole("combobox",{name:"Box de origem",exact:true}).selectOption("dice-second-box");
    assert.deepEqual(await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).locator("option").allTextContents(),["Escolha um Pokémon","Cinderace"]);
    await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).selectOption("dice-second-box:dice-cinderace");
    assert.match(await source.locator(".local-field-preview").innerText(),/Cinderace/);
    await assertFits(320,"long source Box and Cinderace preview");
    await page.setViewportSize({width:390,height:844});
    await dialog.getByRole("combobox",{name:"Box de origem",exact:true}).selectOption("dice-box");
    assert.deepEqual(await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).locator("option").allTextContents(),["Escolha um Pokémon","Buba","Pika"]);
    await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).selectOption("dice-box:dice-bulba");
    await dialog.getByRole("button",{name:"Trazer para o campo",exact:true}).click();
    await dialog.locator(".local-pokemon-roster button").first().waitFor();
    await openDetails(dialog.locator(".local-pokemon-setup"));
    await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).selectOption("dice-box:dice-pika");
    await dialog.getByRole("button",{name:"Oponente",exact:true}).click();
    assert.equal(await dialog.getByRole("button",{name:"Oponente",exact:true}).getAttribute("aria-pressed"),"true");
    await dialog.getByRole("button",{name:"Trazer para o campo",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".local-dice-dialog .local-pokemon-roster button").length===2);
    assert.match(await dialog.locator(".local-field-roster-heading").innerText(),/Em campo\s+2\s+Pokémon/);
    assert.match(await dialog.locator(".local-pokemon-roster button").filter({hasText:"Pika"}).innerText(),/Oponente/);
    pass("local-pokemon-from-boxes-with-real-stats-and-mobile-pickers");
    pass("source-box-and-pokemon-are-independent-with-readable-field-count");

    const combat=dialog.locator(".room-tool").filter({has:page.getByText("Usar um movimento",{exact:true})});await openDetails(combat);
    await dialog.locator(".local-pokemon-roster button").filter({hasText:"Buba"}).click();
    assert.equal(await combat.getByRole("combobox",{name:"Usuário",exact:true}).locator("option:checked").innerText(),"Buba");
    await combat.getByRole("combobox",{name:"Usuário",exact:true}).selectOption({label:"Pika"});
    assert.equal(await dialog.locator(".local-pokemon-roster button").filter({hasText:"Pika"}).getAttribute("aria-pressed"),"true");
    pass("roster-and-move-user-stay-synchronized");

    const conditions=dialog.locator(".room-tool").filter({has:page.getByText("Condições do campo",{exact:true})});await openDetails(conditions);
    await dialog.locator(".local-pokemon-roster button").filter({hasText:"Buba"}).click();
    await conditions.getByRole("combobox",{name:/^Condição\b/}).selectOption("burn");
    const initiative=dialog.getByRole("region",{name:"Iniciativa",exact:true});
    assert.equal(await initiative.getByText("Como funciona",{exact:true}).count(),1);
    assert.equal(await initiative.locator(".local-field-initiative-help").evaluate(element=>element.open),false);
    await initiative.getByRole("button",{name:"Rolar iniciativa",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".local-field-turn-list li").length===2);
    const firstTurn=await initiative.locator("li[aria-current='step'] strong").innerText();
    assert.equal(await initiative.locator("li[aria-current='step']").count(),1);
    assert.match(await initiative.locator("li").first().innerText(),/Agora/);
    assert.equal(await initiative.getByRole("button",{name:"Refazer ordem",exact:true}).count(),0,"an active round never offers to replay its turn order");
    assert.equal(await initiative.getByRole("button",{name:"Rolar iniciativa",exact:true}).count(),0,"initiative can only be rolled between rounds");
    assert.equal(await combat.getByRole("combobox",{name:"Usuário",exact:true}).locator("option:checked").innerText(),firstTurn);
    await initiative.locator("li").last().getByRole("button").click();
    assert.equal(await initiative.locator("li[aria-current='step'] strong").innerText(),firstTurn,"selecting another partner does not consume a turn");
    await initiative.getByRole("button",{name:"Próximo turno",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector(".local-field-turn-list li:last-child")?.getAttribute("aria-current")==="step");
    assert.match(await initiative.locator("li").first().innerText(),/Já jogou/);
    assert.equal(await combat.getByRole("combobox",{name:"Usuário",exact:true}).locator("option:checked").innerText(),await initiative.locator("li[aria-current='step'] strong").innerText());
    assert.equal(await initiative.getByRole("button",{name:"Próximo turno",exact:true}).count(),0,"the last turn leads only to closing the round");
    await initiative.getByRole("button",{name:"Encerrar rodada",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector(".local-field-round")?.textContent.includes("Rodada 2"));
    assert.equal(await initiative.locator(".local-field-turn-list li").count(),0,"a new round waits for a fresh move order");
    await initiative.getByRole("button",{name:"Rolar iniciativa",exact:true}).waitFor();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1"))?.tokens.find(token=>token.name==="Buba")?.currentHp<5);
    const roundEffects=dialog.locator(".local-field-round-effects");
    assert.equal(await roundEffects.evaluate(element=>element.open),false);
    await openDetails(roundEffects);
    assert.match(await roundEffects.innerText(),/Buba/);
    await roundEffects.locator(":scope > summary").click();
    await dialog.locator(".local-pokemon-roster button").filter({hasText:"Buba"}).click();
    await conditions.getByRole("combobox",{name:/^Condição\b/}).selectOption("");
    await conditions.getByLabel("HP atual",{exact:true}).fill("5");
    pass("local-initiative-both-pokemon-next-turn-and-round-effects");

    const dispute=dialog.locator(".room-tool").filter({has:page.getByText("Disputa entre Pokémon",{exact:true})});await openDetails(dispute);
    await dispute.getByRole("combobox",{name:"Pokémon da disputa",exact:true}).selectOption({label:"Buba"});
    await dispute.getByRole("combobox",{name:"Rival da disputa",exact:true}).selectOption({label:"Pika"});
    await dispute.getByRole("button",{name:"Resolver disputa",exact:true}).click();
    const disputeResult=dispute.locator(".local-field-dispute-result");
    await disputeResult.filter({hasText:"venceu a disputa"}).waitFor();
    assert.doesNotMatch(await disputeResult.innerText(),/produto|ponderad|atributo.*\d.*[×*]/i);
    assert.equal(await disputeResult.locator("details").evaluate(element=>element.open),false);
    await disputeResult.getByText("Ver dados",{exact:true}).click();
    assert.equal(await disputeResult.locator(".local-field-dice-group").count(),2);
    await disputeResult.getByText("Ver dados",{exact:true}).click();
    assert.equal(await dialog.locator(".local-pokemon-receipt:visible").count(),0,"field results have no duplicated receipt below the tools");
    pass("automatic-local-opposition-rolls-both-sides-without-manual-products");

    await combat.getByRole("combobox",{name:"Usuário",exact:true}).selectOption({label:"Buba"});
    await combat.getByRole("combobox",{name:"Movimento",exact:true}).selectOption("tackle");
    await combat.getByRole("combobox",{name:"Alvo",exact:true}).selectOption({label:"Pika"});
    await combat.getByRole("button",{name:"Usar Tackle",exact:true}).click();
    await combat.locator(".combat-result").waitFor();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1"))?.tokens.find(token=>token.name==="Buba")?.pp[0]===34);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_rotom_v4")).teams[0].pokemon[0].rpg.pp[0]),35,"practice leaves Box PP untouched");
    assert.equal(await combat.locator(".combat-result-summary").count(),1);
    assert.equal(await combat.locator(".combat-result-details").evaluate(element=>element.open),false);
    assert.equal(await combat.locator(".combat-result-metric:visible").count(),0,"the damage audit is available without crowding the result");
    const afterCombat=await fieldState();
    const pikaAfter=afterCombat.tokens.find(token=>token.name==="Pika");
    assert.match(await combat.locator(".combat-result-summary").innerText(),new RegExp(`HP ${pikaAfter.currentHp} de ${pikaAfter.maxHp}`));
    const frozenResult=await combat.locator(".combat-result-summary").innerText();
    const healthTab=await context.newPage();
    healthTab.on("pageerror",error=>errors.push(error.message));
    try {
        await healthTab.goto(process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000");
        await healthTab.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
        const healthDialog=healthTab.getByRole("dialog",{name:"Dados",exact:true});
        await healthDialog.getByRole("button",{name:"Campo",exact:true}).click();
        await healthDialog.locator(".local-pokemon-roster button").filter({hasText:"Pika"}).click();
        const healthConditions=healthDialog.locator(".room-tool").filter({has:healthTab.getByText("Condições do campo",{exact:true})});
        await openDetails(healthConditions);
        const changedHp=pikaAfter.currentHp===0?1:0;
        await healthConditions.getByLabel("HP atual",{exact:true}).fill(String(changedHp));
        await page.waitForFunction(({hp,id})=>{
            const partner=[...document.querySelectorAll(".local-pokemon-roster button")].find(button=>button.textContent.includes("Pika"));
            return JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1"))?.tokens.find(token=>token.id===id)?.currentHp===hp && partner?.textContent.includes(`HP ${hp} de`);
        },{hp:changedHp,id:pikaAfter.id});
        assert.equal(await combat.getByRole("combobox",{name:"Usuário",exact:true}).locator("option:checked").innerText(),"Buba");
        assert.equal(await combat.locator(".combat-result-summary").innerText(),frozenResult,"a previous move keeps its resolved HP when another tab edits the live field");
        await healthConditions.getByLabel("HP atual",{exact:true}).fill(String(pikaAfter.currentHp));
        await page.waitForFunction(({hp,id})=>JSON.parse(localStorage.getItem("myowndex_local_dice_room_v1"))?.tokens.find(token=>token.id===id)?.currentHp===hp,{hp:pikaAfter.currentHp,id:pikaAfter.id});
    } finally {await healthTab.close();}
    pass("move-result-keeps-resolved-hp-after-another-tab-edits-live-field");
    await combat.getByText("Detalhes da jogada",{exact:true}).click();
    assert.equal(await combat.locator(".combat-result-metric:visible").count(),4);
    await assertFits(320,"expanded move audit");
    await combat.getByText("Detalhes da jogada",{exact:true}).click();
    const recordedMoves=await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).filter(record=>record.spec.action==="combat").length);
    assert.equal(recordedMoves,1,"using a move produces one historical receipt");
    await page.setViewportSize({width:390,height:844});
    await combat.locator(".combat-result-summary").scrollIntoViewIfNeeded();
    await dialog.screenshot({path:"/tmp/myowndex-field-compact-result-390.png"});
    await combat.getByRole("combobox",{name:"Movimento",exact:true}).selectOption("fake-out");
    const fakeOut= combat.getByRole("button",{name:"Usar Fake Out",exact:true});
    await fakeOut.waitFor();
    await page.waitForFunction(()=>document.querySelector(".combat-is-compact .combat-special-block")?.textContent.length>0);
    assert.equal(await fakeOut.isDisabled(),true);
    assert.match(await combat.locator(".combat-special-block").innerText(),/primeir[ao].*(movimento|rodada)/i);
    for(const special of await combat.locator(".combat-field-special-details").all())assert.equal(await special.evaluate(element=>element.open),false,"special mechanics can stay folded while a blocking reason remains visible");
    assert.equal(await combat.locator(".combat-special-block").isVisible(),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).filter(record=>record.spec.action==="combat").length),1,"an unavailable move never creates a second roll");
    assert.equal((await fieldState()).tokens.find(token=>token.name==="Buba").pp[2],10,"an unavailable move never consumes PP");
    await fakeOut.scrollIntoViewIfNeeded();
    await dialog.screenshot({path:"/tmp/myowndex-field-fake-out-blocked-390.png"});
    await combat.getByRole("combobox",{name:"Movimento",exact:true}).selectOption("tackle");
    await combat.getByRole("button",{name:"Usar Tackle",exact:true}).waitFor();
    pass("fake-out-blocks-after-entering-turn-with-readable-reason-and-no-pp-or-history-loss");
    const actionHistory=dialog.locator(".local-dice-history");await openDetails(actionHistory);
    await actionHistory.getByRole("button").filter({hasText:/^Movimento\s/}).click();
    await dialog.locator(".local-pokemon-receipt:visible").waitFor();
    assert.equal(await dialog.locator(".combat-result:visible").count(),0,"opening history shows only the chosen receipt");
    await dialog.getByRole("button",{name:"Campo",exact:true}).click();
    assert.equal(await dialog.locator(".local-pokemon-receipt:visible").count(),0);
    await actionHistory.locator(":scope > summary").click();
    pass("shared-combat-accuracy-damage-pp-and-box-isolation");
    pass("move-result-is-readable-with-optional-full-audit-and-one-history-receipt");
    for(const tool of [source,dispute,conditions])if(await tool.evaluate(element=>element.open))await tool.locator(":scope > summary").click();
    await initiative.getByRole("button",{name:"Rolar iniciativa",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".local-field-turn-list li").length>0);
    await page.setViewportSize({width:390,height:844});
    await initiative.scrollIntoViewIfNeeded();
    await dialog.screenshot({path:"/tmp/myowndex-field-move-result-390.png"});

    await openDetails(conditions);
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
    const restoredField=await fieldState();
    const restoredTurn=restoredField.tokens.find(token=>token.id===restoredField.initiative[restoredField.turnIndex]);
    if(restoredTurn){
        assert.equal(await dialog.locator(".local-pokemon-roster button[aria-pressed='true'] strong").innerText(),restoredTurn.name,"reopening the field selects the Pokémon whose turn is active");
        const restoredCombat=dialog.locator(".room-tool").filter({has:page.getByText("Usar um movimento",{exact:true})});
        await openDetails(restoredCombat);
        assert.equal(await restoredCombat.getByRole("combobox",{name:"Usuário",exact:true}).locator("option:checked").innerText(),restoredTurn.name,"the move picker resumes the current turn without preventing manual selection");
    }
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3")).length),count,"opening and rendering never create new rolls");
    pass("reload-preserves-field-and-history-without-rerolling");

    for(const theme of ["Claro","Escuro"]){
        await dialog.getByRole("button",{name:"Fechar dados",exact:true}).click();
        await page.getByRole("radio",{name:theme,exact:true}).click();
        await page.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
        dialog=page.getByRole("dialog",{name:"Dados",exact:true});
        await dialog.getByRole("button",{name:"Campo",exact:true}).click();
        await page.waitForFunction(()=>document.querySelectorAll(".local-dice-dialog .local-pokemon-roster button").length===2);
        await openDetails(dialog.locator(".local-pokemon-setup"));
        await dialog.getByRole("combobox",{name:"Box de origem",exact:true}).selectOption("dice-second-box");
        await dialog.getByRole("combobox",{name:"Pokémon da Box",exact:true}).selectOption("dice-second-box:dice-cinderace");
        for(const width of [320,390,768,1280])await assertFits(width,theme);
        await page.setViewportSize({width:390,height:844});
        await dialog.locator(".local-pokemon-setup > summary").click();
        await openDetails(dialog.locator(".room-tool").filter({has:page.getByText("Usar um movimento",{exact:true})}));
        await dialog.screenshot({path:`/tmp/myowndex-field-${theme.toLowerCase()}-390.png`});
    }
    pass("pokemon-local-dice-both-themes-320-to-desktop-readable-words-and-touch-targets");

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
    await page.getByRole("navigation",{name:"Painéis da aventura",exact:true}).getByRole("button",{name:"Equipe",exact:true}).click();
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

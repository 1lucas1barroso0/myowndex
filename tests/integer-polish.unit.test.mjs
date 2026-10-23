import assert from "node:assert/strict";
import test from "node:test";
import { rollIntegerRatio, rollDamageVariation, formatGameFactor, formatIntegerGameText } from "../src/core/integerRules.js";
import { applyPokemonExperienceAward, createExperienceAwardId } from "../src/core/experience.js";
import { applyGimmick, endGimmick, getGimmickChoices } from "../src/core/battleGimmicks.js";
import { calculateCaptureChance } from "../src/core/capture.js";
import { applyMoveConsequences, resolveDamageSequence } from "../src/core/automation.js";
import { applyEndOfRoundEffects, calculateMoveResolution, createRoomSnapshot, declareRoomMove, getRoundMoveBlockReason, normalizeRoomSnapshot, normalizeRoomToken, startNewRoomBattle } from "../src/core/room.js";
import { checkActionConditions } from "../src/core/battleConditions.js";
import { restPokemon, resolveGroupOutcome, advanceChase } from "../src/core/adventureRules.js";
import { resolveCaptureAction, resolveCombatAction } from "../server/authoritativeActions.js";
import { markPokemonEdited, normalizePokemon } from "../src/core/team.js";
import { normalizeTeam } from "../src/core/team.js";
import { createTokenFromPokemon, syncTeamsWithRoomProgress, hasNewerBoxEdit, refreshRoomPokemonFromBox } from "../src/core/room.js";
import { applyMaxMoveSecondary } from "../src/core/battleMoveEffects.js";
import { encodeTeam, decodeTeam } from "../src/core/teamShare.js";
import { normalizeAccountXpDocument } from "../src/core/accountXp.js";
import { awardRoomPokemonExperience } from "../src/core/roomExperience.js";

const token = (patch={}) => normalizeRoomToken({ id:"a", name:"Parceiro", speciesName:"pikachu", speciesId:25, side:"ally", level:20,
    maxHp:10, currentHp:10, moves:["tackle"], pp:[35], canDynamax:true, dynamaxLevel:10,
    types:["normal"], originalStats:{hp:80,attack:40,defense:40,speed:40}, ...patch });
const move={name:"tackle",power:40,accuracy:null,pp:35,type:{name:"normal"},damage_class:{name:"physical"},target:{name:"selected-pokemon"},meta:{},stat_changes:[]};

test("integer remainder sampling has the exact requested mean with no minimum inflation",()=>{
    for(let denominator=1;denominator<=160;denominator++)for(let numerator=0;numerator<=denominator*3;numerator++){
        let sum=0;
        for(let roll=0;roll<denominator;roll++){
            const value=rollIntegerRatio(numerator,denominator,()=> (roll+.5)/denominator);
            assert.ok(Number.isInteger(value)); sum+=value;
        }
        assert.equal(sum,numerator);
    }
    assert.throws(()=>rollIntegerRatio(1.5,16),/inteiros/);
});

test("the small d6 varies both ways, preserves its mean and never invents a second miss",()=>{
    for(let base=0;base<=500;base++){
        const results=Array.from({length:6},(_,i)=>rollDamageVariation(base,()=> (i+.5)/6));
        assert.equal(results.reduce((sum,entry)=>sum+entry.damage,0),base*6);
        assert.ok(results.every(entry=>Number.isInteger(entry.damage)&&entry.damage>=0));
        if(base>1){assert.ok(results[0].damage<base);assert.ok(results[5].damage>base);}
    }
});

test("per-hit variation is rolled once and execution uses the recorded hit list",()=>{
    const draws=[.8,.8,0,0,0,.5,.999];let i=0;
    const result=calculateMoveResolution({attacker:token(),defender:token({id:"b"}),move:{...move,meta:{min_hits:3,max_hits:3}},random:()=>draws[i++]});
    assert.deepEqual(result.hitDamages,[5,6,7]);
    assert.equal(result.damage,18); assert.equal(i,7);
    const applied=applyMoveConsequences({tokens:[token(),token({id:"b",maxHp:30,currentHp:30})],attackerId:"a",targetId:"b",move,resolution:result});
    assert.equal(applied.tokens.find(t=>t.id==="b").currentHp,12);
});

test("unsupported inter-hit sequences stop before entropy, PP or state mutation",()=>{
    const attacker=token({moves:["double-slap"]}), defender=token({id:"b",item:"rocky-helmet"});
    const sequence={...move,name:"double-slap",meta:{min_hits:2,max_hits:5}};
    const snapshot={...createRoomSnapshot(),tokens:[attacker,defender]};
    const before=JSON.stringify(snapshot);
    const random=()=>{throw new Error("No entropy before guided resolution");};
    assert.throws(()=>calculateMoveResolution({attacker,defender,move:sequence,random}),/reações entre impactos/);
    assert.throws(()=>resolveCombatAction({snapshot,role:"narrator",request:{attackerId:"a",defenderId:"b",moveName:"double-slap",mode:"normal"},move:sequence,random}),/reações entre impactos/);
    assert.equal(JSON.stringify(snapshot),before);
    assert.equal(attacker.pp[0],35);
});

test("general protection covers a multi-hit action while items remain separate reserves",()=>{
    const partner=token({item:"focus-sash"});
    const protectedAction=resolveDamageSequence({token:partner,hitDamages:[6,6,6]});
    assert.equal(protectedAction.remainingHp,1);assert.equal(protectedAction.itemConsumed,"");
    assert.equal(protectedAction.plannedHitCount,3);assert.equal(protectedAction.resolvedHitCount,3);
    const next=resolveDamageSequence({token:protectedAction.token,damage:6,protectionUsed:true,survivalGrace:protectedAction.survivalGraceRemaining});
    assert.equal(next.remainingHp,1);assert.equal(next.itemConsumed,"focus-sash");
    assert.equal(resolveDamageSequence({token:partner,hitDamages:[10,10,10]}).remainingHp,0,"threshold is the whole action");
});

test("Max cycles conserve unchanged integer HP; damage never turns into healing",()=>{
    for(let maxHp=1;maxHp<=80;maxHp++)for(let currentHp=1;currentHp<=maxHp;currentHp++)for(let level=0;level<=10;level++){
        const source=token({maxHp,currentHp,dynamaxLevel:level});
        const active=applyGimmick(source,"dyna").token;
        assert.ok(Number.isInteger(active.maxHp)&&Number.isInteger(active.currentHp));
        assert.equal(endGimmick(normalizeRoomToken(active)).currentHp,currentHp);
        const hurt=endGimmick({...active,currentHp:Math.max(0,active.currentHp-1)});
        assert.ok(hurt.currentHp<=currentHp);
        assert.equal(endGimmick({...active,currentHp:0}).currentHp,0);
    }
    for(const maxHp of [1000,49999,50000,99999]) {
        const active=applyGimmick(token({maxHp,currentHp:maxHp-1}),"dyna").token;
        assert.equal(endGimmick(normalizeRoomToken(active)).currentHp,maxHp-1);
    }
});

test("Max progress saves base HP in the Box and G-Max uses the audited integer RNG",()=>{
    const box=normalizeTeam({id:"box",pokemon:[{id:"p",level:10,species:{id:25,name:"pikachu",stats:[{stat:{name:"hp"},base_stat:35}]},canDynamax:true,dynamaxLevel:10,rpg:{scaleVersion:3,currentHp:2}}]});
    const base=createTokenFromPokemon(box.pokemon[0],box);
    const active=applyGimmick(base,"dyna").token;
    const saved=syncTeamsWithRoomProgress([box],{...createRoomSnapshot(),tokens:[active]})[0];
    assert.equal(saved.pokemon[0].rpg.currentHp,2);
    const result=applyMaxMoveSecondary({tokens:[token(),token({id:"foe",side:"opponent"})],attackerId:"a",presentation:{kind:"gmax-move",label:"G-Max Befuddle"},connected:true,random:{nextUint32:()=>0}});
    assert.equal(result.tokens[1].status,"poison");
});

test("Max eligibility, Shedinja, flinch and blocked moves agree across shared core",()=>{
    assert.ok(getGimmickChoices(token({dynamaxLevel:0})).some(c=>c.id==="dyna"));
    const started={...createRoomSnapshot(),tokens:[token()],initiative:["a"]};
    assert.equal(applyGimmick(token(),"dyna",{snapshot:started}).applied,false);
    for(const speciesName of ["zacian","zacian-crowned","zamazenta","eternatus"])
        assert.ok(!getGimmickChoices(token({speciesName})).some(c=>c.id==="dyna"));
    const shedinja=applyGimmick(token({speciesName:"shedinja",maxHp:1,currentHp:1}),"dyna").token;
    assert.equal(shedinja.maxHp,1);
    const max=applyGimmick(token(),"dyna").token;
    assert.equal(checkActionConditions({token:{...max,volatileEffects:[{id:"flinch"}]},move}).canAct,true);
    for(const name of ["fissure","low-kick","grass-knot","heavy-slam","heat-crash","roar","whirlwind"]){
        const resolution=calculateMoveResolution({attacker:token(),defender:max,move:{...move,name},random:()=>.5});
        assert.equal(resolution.damage,0,name);assert.ok(resolution.specialBlockReason,name);
    }
    const end=applyEndOfRoundEffects({...createRoomSnapshot(),tokens:[applyGimmick(token({maxHp:16,currentHp:8,item:"leftovers"}),"dyna").token]},()=>.5);
    assert.equal(end.room.tokens[0].currentHp,17,"Leftovers uses base 16, not Max 32");
});

test("Magic Guard distinguishes item residuals from delayed direct damage",()=>{
    const subject=token({maxHp:8,currentHp:4,ability:"magic-guard",item:"sticky-barb"});
    const end=applyEndOfRoundEffects({...createRoomSnapshot(),tokens:[subject]},()=>.5);
    assert.equal(end.room.tokens[0].currentHp,4);
    assert.deepEqual(end.room.hitKillProtectionDisabled,[]);
    const delayed={...subject,volatileEffects:[{id:"future-sight",sourceMove:"future-sight",turns:1,amount:2}]};
    const hit=applyEndOfRoundEffects({...createRoomSnapshot(),tokens:[delayed]},()=>.5);
    assert.equal(hit.room.tokens[0].currentHp,2);
});

test("capture integer ratios reproduce exact boundaries without float-floor loss",()=>{
    for(const maxHp of [1,2,3,5,10,16,100,99999])for(let currentHp=1;currentHp<=Math.min(maxHp,100);currentHp++)for(let captureRate=0;captureRate<=255;captureRate++){
        const c=calculateCaptureChance({target:{maxHp,currentHp},captureRate,ball:"great-ball"});
        const exact=Number(BigInt(100*captureRate*(3*maxHp-2*currentHp)*3)/BigInt(255*3*maxHp*2));
        assert.equal(c.chance,captureRate===0?0:Math.max(1,Math.min(100,exact)));
    }
    assert.equal(calculateCaptureChance({target:{currentHp:3,maxHp:3},captureRate:255,ball:"great-ball"}).chance,50);
});

test("capture inventory and intervention commit together, including a failed attempt",()=>{
    const a=token(),b=token({id:"wild",side:"opponent",speciesName:"eevee",speciesId:133});
    const room={...createRoomSnapshot(),phase:"batalha",battleStarted:true,tokens:[a,b],initiative:[a.id,b.id],trainerBags:{a:{"poke-ball":2}}};
    const request={trainerTokenId:"a",targetId:"wild",ball:"poke-ball",wildConfirmed:true};
    const result=resolveCaptureAction({snapshot:room,request,role:"narrator",species:{capture_rate:1},random:()=>.99});
    assert.equal(result.result.success,false);assert.equal(result.nextSnapshot.trainerBags.a["poke-ball"],1);
    assert.throws(()=>resolveCaptureAction({snapshot:result.nextSnapshot,request,role:"narrator",species:{capture_rate:255}}),/intervenção/);
    assert.equal(room.trainerBags.a["poke-ball"],2,"transaction is immutable");
});

test("XP partitions conserve all XP and EVs, including multiple levels and cap balances",()=>{
    for(let level=1;level<=200;level++){
        const source=normalizePokemon({id:"p",level,rpg:{scaleVersion:3,xp:0,currentHp:0}});
        const whole=applyPokemonExperienceAward(source,{xp:24,awardId:createExperienceAwardId(1),levelCap:200});
        let split=source;
        for(let part=1;part<=6;part++)split=applyPokemonExperienceAward(split,{xp:4,awardId:createExperienceAwardId(part),levelCap:200});
        assert.deepEqual([split.level,split.rpg.xp,split.rpg.pendingEvs,split.rpg.currentHp],[whole.level,whole.rpg.xp,whole.rpg.pendingEvs,0]);
    }
    const capped=applyPokemonExperienceAward({level:100,rpg:{xp:999999}},{xp:12,awardId:createExperienceAwardId(100)});
    assert.equal(capped.rpg.xp,1000011);
    assert.equal(normalizeAccountXpDocument({boxes:[{pokemon:[capped]}]}).boxes[0].pokemon[0].rpg.xp,1000011);
});

test("exports preserve level-zero Max permission and spent short rest",async()=>{
    const source=normalizeTeam({id:"b",pokemon:[{id:"p",dynamaxLevel:0,canDynamax:true,rpg:{scaleVersion:3,currentHp:1,shortRestUsed:true}}]});
    const decoded=await decodeTeam(await encodeTeam(source));
    assert.equal(decoded.pokemon[0].canDynamax,true);
    assert.equal(decoded.pokemon[0].dynamaxLevel,0);
    assert.equal(decoded.pokemon[0].rpg.shortRestUsed,true);
});

test("old active snapshots preserve HP until a new battle migrates once",()=>{
    const old={...createRoomSnapshot(),schema:8,battleStarted:true,tokens:[token({hpScaleVersion:2,maxHp:8,currentHp:4})]};
    const normalized=normalizeRoomSnapshot(old);
    assert.equal(normalized.tokens[0].currentHp,4);
    const fresh=startNewRoomBattle(normalized);
    assert.deepEqual([fresh.tokens[0].maxHp,fresh.tokens[0].currentHp],[10,5]);
    assert.deepEqual(normalizeRoomSnapshot(fresh),fresh);
});

test("other actions cannot become late attacks and rest cannot be farmed by phase changes",()=>{
    const room=declareRoomMove({...createRoomSnapshot(),tokens:[token()]},"a",{actionKind:"flee"});
    assert.match(getRoundMoveBlockReason({snapshot:{...room,battleStarted:true,initiative:["a"]},token:room.tokens[0],move}),/não permite/);
    const source=token({currentHp:1,status:"burn",pp:[2]});
    const rested=restPokemon(source); assert.equal(rested.currentHp,3);assert.equal(rested.status,"burn");
    assert.equal(restPokemon(rested),rested);assert.equal(restPokemon({...rested,currentHp:0}).currentHp,0);
    const full=restPokemon(rested,"full");assert.equal(full.currentHp,10);assert.equal(full.shortRestUsed,false);assert.equal(full.status,"");
});

test("collective risk is bounded and chase progress never resets through repeated attempts",()=>{
    assert.deepEqual(resolveGroupOutcome([{success:true},{success:false},{success:false}]),{success:true,failures:2,riskSteps:2});
    assert.equal(resolveGroupOutcome([{success:true},{success:false,essential:true}]).success,false);
    let chase={};for(const result of [true,false,true,false,true])chase=advanceChase(chase,result);
    assert.deepEqual(chase,{escape:3,danger:2});assert.deepEqual(advanceChase(chase,false),chase);
});


test("large XP synchronization is stable and Max progress never leaks temporary HP",()=>{
    const box=normalizeTeam({id:"xp-box",pokemon:[{id:"p",level:100,species:{id:25,name:"pikachu",stats:[{stat:{name:"hp"},base_stat:35}]},canDynamax:true,dynamaxLevel:10,rpg:{scaleVersion:3,currentHp:10,xp:2000000}}]});
    const base=createTokenFromPokemon(box.pokemon[0],box);
    const active=applyGimmick(base,"dyna").token;
    const snapshot={...createRoomSnapshot(),tokens:[{...active,currentHp:active.currentHp-2}]};
    const saved=syncTeamsWithRoomProgress([box],snapshot);
    assert.equal(saved[0].pokemon[0].rpg.xp,2000000);
    assert.equal(saved[0].pokemon[0].rpg.currentHp,9);
    assert.strictEqual(syncTeamsWithRoomProgress(saved,snapshot),saved,"no endless Box writes at balances above the individual award cap");
});


test("newer PC edits survive a stale adventure and refresh safely without resetting battle resources",async()=>{
    const box=normalizeTeam({id:"edit-box",pokemon:[{id:"p",level:10,nickname:"Faísca",species:{id:25,name:"pikachu",stats:[{stat:{name:"hp"},base_stat:35}]},rpg:{scaleVersion:3,currentHp:2,xp:4}}]});
    const fighter=createTokenFromPokemon(box.pokemon[0],box);
    const snapshot=normalizeRoomSnapshot({...createRoomSnapshot(),phase:"intervalo",tokens:[fighter],hitKillProtectionUsed:[fighter.id],trainerInterventions:{narrator:1}});
    const edited={...box,pokemon:[markPokemonEdited(box.pokemon[0],{...box.pokemon[0],nickname:"Aurora",level:11,friendship:80,rpg:{...box.pokemon[0].rpg,currentHp:1,xp:2}})]};
    const teams=[edited];
    assert.equal(hasNewerBoxEdit(teams,fighter),true);
    assert.strictEqual(syncTeamsWithRoomProgress(teams,snapshot),teams,"stale progress must not erase the newer sheet");
    assert.throws(()=>refreshRoomPokemonFromBox({...snapshot,phase:"batalha"},teams),/intervalo/);
    assert.throws(()=>refreshRoomPokemonFromBox({...snapshot,initiative:[fighter.id]},teams),/rodada/);
    const refreshed=refreshRoomPokemonFromBox(snapshot,teams);
    assert.equal(refreshed.tokens[0].name,"Aurora");assert.equal(refreshed.tokens[0].level,11);
    assert.equal(refreshed.tokens[0].currentHp,1);assert.equal(refreshed.tokens[0].xp,2);
    assert.equal(refreshed.tokens[0].friendship,80);assert.equal(hasNewerBoxEdit(teams,refreshed.tokens[0]),false);
    assert.deepEqual(refreshed.hitKillProtectionUsed,snapshot.hitKillProtectionUsed);
    assert.deepEqual(refreshed.trainerInterventions,snapshot.trainerInterventions);
    assert.equal(refreshed.tokens[0].id,fighter.id);
    const exported=await decodeTeam(await encodeTeam(edited));
    assert.equal(exported.pokemon[0].editRevision,edited.pokemon[0].editRevision);
});


test("game readings keep exact integer ratios and physical units without decimals",async()=>{
    const {formatPokemonHeight,formatPokemonWeight}=await import("../src/core/measurements.js");
    assert.equal(formatPokemonHeight(7),"70 cm");assert.equal(formatPokemonHeight(20),"2 m");
    assert.equal(formatPokemonWeight(69),"6900 g");assert.equal(formatPokemonWeight(1000),"100 kg");
    assert.equal(formatIntegerGameText("6,25% do HP e 1,5× de dano"),"1/16 do HP e 3/2× de dano");
    assert.equal(formatGameFactor(1/4),"1/4");
    assert.equal(formatIntegerGameText("1,000%",{decimalComma:false}),"1,000%");
});

test("pending source edits merge with later damage, PP, conditions and consumed items",async()=>{
    const box=normalizeTeam({id:"merge-box",pokemon:[{id:"p",level:20,item:"oran-berry",moves:["tackle"],species:{id:25,name:"pikachu",stats:[{stat:{name:"hp"},base_stat:35}]},rpg:{scaleVersion:3,currentHp:5,pp:[35],xp:0}}]});
    const original=box.pokemon[0];
    const fighter=createTokenFromPokemon(original,box);
    const edited=normalizeTeam({...box,pokemon:[markPokemonEdited(original,{...original,nickname:"Aurora"})]});
    const portable=await decodeTeam(await encodeTeam(edited));
    assert.deepEqual(portable.pokemon[0].sceneEditBase,edited.pokemon[0].sceneEditBase);
    const spent=normalizeRoomToken({...fighter,currentHp:1,pp:[31],status:"burn",shortRestUsed:true,item:"",traitState:{...fighter.traitState,item:{...fighter.traitState.item,consumed:true}}});
    const scene=normalizeRoomSnapshot({...createRoomSnapshot(),phase:"intervalo",tokens:[spent]});
    assert.throws(()=>awardRoomPokemonExperience(scene,spent.id,{xp:1,awardId:createExperienceAwardId()},[edited]),/Atualize a ficha/);
    const merged=refreshRoomPokemonFromBox(scene,[edited]);
    const partner=merged.tokens[0];
    assert.equal(partner.name,"Aurora");assert.equal(partner.currentHp,1);
    assert.equal(partner.pp[0],31);assert.equal(partner.status,"burn");
    assert.equal(partner.shortRestUsed,true);assert.equal(partner.item,"");
    assert.equal(partner.traitState.item.consumed,true);
    const saved=syncTeamsWithRoomProgress([edited],merged);
    assert.equal(saved[0].pokemon[0].rpg.consumedItem,"oran-berry");
    assert.equal(saved[0].pokemon[0].sceneEditBase,undefined);
    assert.strictEqual(syncTeamsWithRoomProgress(saved,merged),saved,"acknowledged merge must settle without repeated writes");
    const explicit=normalizeTeam({...edited,pokemon:[markPokemonEdited(edited.pokemon[0],{...edited.pokemon[0],rpg:{...edited.pokemon[0].rpg,currentHp:3,pp:[33],status:"poison"}})]});
    const overridden=refreshRoomPokemonFromBox(scene,[explicit]).tokens[0];
    assert.equal(overridden.currentHp,3);assert.equal(overridden.pp[0],33);assert.equal(overridden.status,"poison");
    assert.equal(overridden.item,"","an explicit HP change must not reset an untouched item");
});

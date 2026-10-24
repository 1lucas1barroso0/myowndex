import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDITION_HELP, MAIN_CONDITION_IDS, RPG_STATUS_LABELS, getGuideConditionText } from '../src/core/conditionHelp.js';
import { STATUS_LABELS, applyEndOfRoundEffects, createRoomSnapshot, normalizeRoomSnapshot, swapTeamPokemonInSnapshot } from '../src/core/room.js';
import { createTokenFromPokemon } from '../src/core/room.js';
import { guidePokemon, reproduceGuideCases } from '../src/core/guideAuditFixtures.js';
import { GUIDE_PLAY_STEPS } from '../src/core/guidePlaySteps.js';
import { GUIDE_PAPER_STEPS } from '../src/core/guidePaperSteps.js';
import { RPG_RULE_SECTIONS } from '../src/core/rpgRules.js';
import { createGuideSearchIndex, getGuideRuleSearchState, searchGuideSections } from '../src/core/guideSearch.js';
import { setAbilitySuppressed } from '../src/core/traitMechanics.js';
import { resolveCombatAction } from '../server/authoritativeActions.js';

const token = (name='pikachu', extra={}) => ({...createTokenFromPokemon(guidePokemon(name,100),{id:'conditions',versionGroup:'scarlet-violet'}),id:name,...extra});
const end = pokemon => applyEndOfRoundEffects(normalizeRoomSnapshot({...createRoomSnapshot('Condições'),phase:'batalha',tokens:[pokemon]}),()=>.999999);

test('official condition names are shared by sheets, adventure, dice and descriptions',()=>{
    assert.equal(STATUS_LABELS,RPG_STATUS_LABELS);
    assert.deepEqual(MAIN_CONDITION_IDS.map(id=>RPG_STATUS_LABELS[id]),['Burn','Paralysis','Sleep','Freeze','Poison','Badly Poisoned']);
    for(const condition of Object.values(CONDITION_HELP))for(const key of ['label','what','when','ends'])assert.ok(condition[key].length>3);
    assert.equal(CONDITION_HELP.confusion.label,'Confusion');
    assert.equal(CONDITION_HELP.flinch.label,'Flinch');
    assert.doesNotMatch(JSON.stringify(CONDITION_HELP),/Veneno crescente|Veneno comum/);
});

test('all 50 rules have concise first-reading instructions while retaining complete paper procedures',()=>{
    const rules=RPG_RULE_SECTIONS.flatMap(section=>section.rules);
    assert.equal(rules.length,50);
    assert.deepEqual(Object.keys(GUIDE_PLAY_STEPS).sort(),rules.map(rule=>rule.id).sort());
    for(const rule of rules){
        assert.equal(GUIDE_PLAY_STEPS[rule.id].length,2);
        assert.ok(GUIDE_PAPER_STEPS[rule.id].length>=2);
        for(const step of GUIDE_PLAY_STEPS[rule.id])assert.ok(step.length<220,rule.id);
    }
});

test('search finds the official names, shared Portuguese help and the exact reproduced poison comparison',()=>{
    const rules=RPG_RULE_SECTIONS.flatMap(section=>section.rules);
    const index=createGuideSearchIndex(RPG_RULE_SECTIONS);
    const ids=query=>searchGuideSections(index,query).flatMap(section=>section.rules.map(rule=>rule.id));
    assert.ok(ids('Badly Poisoned').includes('6.1'));
    assert.ok(ids('a força aumenta mesmo').includes('6.2'));
    assert.ok(ids('Umbreon').includes('6.2'));
    assert.ok(ids('Natural Cure').includes('6.2'));
    assert.ok(ids('23 de 26 HP').includes('6.2'));
    assert.equal(getGuideRuleSearchState(rules.find(rule=>rule.id==='6.2'),'23 de 26 HP').details,true);
    assert.match(getGuideConditionText('6.5'),/Flinch.*Só impede a vez/);
});

test('Poison keeps its strength; Badly Poisoned advances after zero loss and stops at its limit',()=>{
    const tiny=token('pikachu',{maxHp:3,currentHp:3,status:'bad-poison',toxicCounter:1});
    const zero=end(tiny);
    assert.equal(zero.room.tokens[0].currentHp,3);
    assert.equal(zero.room.tokens[0].status,'bad-poison');
    assert.equal(zero.room.tokens[0].toxicCounter,2);
    assert.equal(end(token('pikachu',{status:'bad-poison',toxicCounter:15})).room.tokens[0].toxicCounter,15);
    const regular=end(token('pikachu',{status:'poison',toxicCounter:8})).room.tokens[0];
    assert.equal(regular.toxicCounter,0);
    const cases=reproduceGuideCases();
    assert.deepEqual(cases['poison-comparison'].rows.map(row=>row[1]),['23 de 26 HP','20 de 26 HP','17 de 26 HP','25 de 26 HP','22 de 26 HP','18 de 26 HP']);
});

test('Magic Guard and Poison Heal prevent poison loss without stopping its strength; losing the ability uses the advanced strength',()=>{
    for(const [name,speciesId,ability,types] of [['Clefable',36,'magic-guard',['fairy']],['Gliscor',472,'poison-heal',['ground','flying']]]){
        const guarded=token('pikachu',{name,speciesId,speciesName:name.toLowerCase(),types,originalTypes:types,maxHp:80,currentHp:80,status:'bad-poison',toxicCounter:1,ability});
        const first=end(guarded).room.tokens[0];
        assert.equal(first.currentHp,80,ability);
        assert.equal(first.status,'bad-poison');
        assert.equal(first.toxicCounter,2,ability);
        const second=end(setAbilitySuppressed(first,true)).room.tokens[0];
        assert.equal(second.currentHp,70,ability);
        assert.equal(second.toxicCounter,3);
    }
});

test('switching resets toxic strength, preserves poison, and does not tick a benched Pokémon; a Pecha Berry cures both',()=>{
    const outgoing=token('pikachu',{teamId:'conditions',status:'bad-poison',toxicCounter:7});
    const incoming=token('eevee',{teamId:'conditions'});
    const room=normalizeRoomSnapshot({...createRoomSnapshot('Troca'),phase:'batalha',tokens:[outgoing],benchTokens:[incoming]});
    const switched=swapTeamPokemonInSnapshot(room,'pikachu','eevee');
    assert.equal(switched.swapped,true);
    const benched=switched.room.benchTokens.find(p=>p.id==='pikachu');
    assert.equal(benched.status,'bad-poison');
    assert.equal(benched.toxicCounter,1);
    const after=applyEndOfRoundEffects(switched.room,()=>.999999).room.benchTokens.find(p=>p.id==='pikachu');
    assert.equal(after.currentHp,benched.currentHp);
    assert.equal(after.toxicCounter,1);
    for(const status of ['poison','bad-poison']){
        const cured=end(token('pikachu',{status,toxicCounter:7,item:'pecha-berry'})).room.tokens[0];
        assert.equal(cured.status,'');
        assert.equal(cured.toxicCounter,0);
        assert.equal(cured.currentHp,cured.maxHp);
    }
});

test('Lum Berry cures a condition and Confusion together; Persim Berry only cures Confusion, and inactive berries do nothing',()=>{
    for(const item of ['lum-berry','persim-berry']){
        const affected=token('pikachu',{status:'poison',item,volatileEffects:[{id:'confusion',turns:4},{id:'aqua-ring'}]});
        const result=end(affected).room.tokens[0];
        assert.equal(result.status,item==='lum-berry'?'':'poison');
        assert.equal(result.volatileEffects.some(effect=>effect.id==='confusion'),false);
        assert.equal(result.volatileEffects.some(effect=>effect.id==='aqua-ring'),true);
        assert.equal(result.item,'');
    }
    const blocked=end(token('pikachu',{status:'poison',item:'lum-berry',ability:'klutz',volatileEffects:[{id:'confusion',turns:4}]})).room.tokens[0];
    assert.equal(blocked.status,'poison');
    assert.equal(blocked.volatileEffects.some(effect=>effect.id==='confusion'),true);
    assert.equal(blocked.item,'lum-berry');
});

test('a newly inflicted Confusion triggers its held Berry inside the same movement, without curing poison with Persim',()=>{
    const move={name:'supersonic',power:null,accuracy:55,pp:20,priority:0,type:{name:'normal'},damage_class:{name:'status'},target:{name:'selected-pokemon'},stat_changes:[],meta:{ailment:{name:'confusion'},ailment_chance:0,category:{name:'ailment'}}};
    for(const item of ['lum-berry','persim-berry']){
        const golbat=token('pikachu',{id:'golbat',speciesName:'golbat',speciesId:42,name:'Golbat',moves:['supersonic'],pp:[20],types:['poison','flying']});
        const target=token('eevee',{status:'poison',item});
        const snapshot=normalizeRoomSnapshot({...createRoomSnapshot('Supersonic'),phase:'batalha',tokens:[golbat,target]});
        const result=resolveCombatAction({snapshot,role:'narrator',request:{attackerId:'golbat',defenderId:'eevee',moveName:'supersonic',mode:'normal'},move,random:()=>0}).nextSnapshot.tokens.find(p=>p.id==='eevee');
        assert.equal(result.status,item==='lum-berry'?'':'poison');
        assert.equal(result.volatileEffects.some(effect=>effect.id==='confusion'),false);
        assert.equal(result.item,'');
    }
});

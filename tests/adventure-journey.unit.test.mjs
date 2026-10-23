import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeneratedPokemon } from '../src/core/pokemonGenerator.js';
import { normalizeTeam, compactTeam, STAT_KEYS } from '../src/core/team.js';
import { normalizeAccountDocument } from '../src/core/accountDocument.js';
import { createTokenFromPokemon, createRoomSnapshot, normalizeRoomSnapshot, applyEndOfRoundEffects, syncTeamsWithRoomProgress } from '../src/core/room.js';
import { applyGimmick, endGimmick } from '../src/core/battleGimmicks.js';
import { resolveCombatAction, resolveCaptureAction } from '../server/authoritativeActions.js';
import { captureTrainerKey } from '../src/core/capture.js';
import { restPokemon, advanceChase, resolveGroupOutcome } from '../src/core/adventureRules.js';
import { awardRoomPokemonExperience } from '../src/core/roomExperience.js';
import { createExperienceAwardId } from '../src/core/experience.js';
import { encodeTeam, decodeTeam } from '../src/core/teamShare.js';

const move={name:'tackle',power:40,accuracy:100,pp:35,type:{name:'normal'},damage_class:{name:'physical'},target:{name:'selected-pokemon'},meta:{},stat_changes:[]};
const profiles=[['pikachu',25,[35,55,40,50,50,90]],['onix',95,[35,45,160,30,45,70]],['chansey',113,[250,5,5,35,105,50]]];
const sourceFor=([name,id,values])=>({name,id,species:{name},types:[{type:{name:'normal'}}],stats:STAT_KEYS.map((name,index)=>({stat:{name},base_stat:values[index]})),abilities:[{ability:{name:'run-away'}}]});
const seeded = seed => {let state=seed;return {nextUint32:()=>state=(Math.imul(state,1664525)+1013904223)>>>0};};

// Mechanical rehearsals, never a measurement of human enjoyment or spotlight.
test('48 mixed journeys connect generation, Box, Max, combat, residual, rest, capture, XP, account and export',async()=>{
  let journeys=0;
  for(const profile of profiles)for(const level of [5,10,50,100])for(let seed=1;seed<=4;seed++){
    const random=seeded(seed+level);
    const generated=buildGeneratedPokemon({pokemon:sourceFor(profile),species:{name:profile[0],gender_rate:4,base_happiness:70},learnset:{versionGroup:'scarlet-violet',moves:[{name:'tackle'}]},moveData:[move],options:{level,nature:'hardy',experienceMode:'rpg'},random});
    let teams=[normalizeTeam({id:`journey-${++journeys}`,versionGroup:'scarlet-violet',pokemon:[{...generated,canDynamax:true,dynamaxLevel:10}]})];
    let hero=createTokenFromPokemon(teams[0].pokemon[0],teams[0]);
    assert.equal(hero.currentHp,hero.maxHp);
    const foe={...createTokenFromPokemon(teams[0].pokemon[0],{...teams[0],id:'foe',shareId:'foe'}),id:'foe',pokemonId:'foe',side:'opponent'};
    hero=applyGimmick(hero,'dyna').token;
    assert.equal(hero.maxHp,2*teams[0].pokemon[0].rpg.currentHp);
    let room=normalizeRoomSnapshot({...createRoomSnapshot(),phase:'batalha',tokens:[hero,foe]});
    const attack=resolveCombatAction({snapshot:room,role:'narrator',request:{attackerId:hero.id,defenderId:foe.id,moveName:'tackle',mode:'normal'},move,random});
    room=attack.nextSnapshot;
    hero=room.tokens.find(token=>token.id===hero.id);
    assert.equal(hero.pp[0],34);
    hero=endGimmick(hero);
    // Persistent condition after the action; integer remainder is resolved by
    // the same round engine used by local and authoritative combat.
    room=applyEndOfRoundEffects({...room,tokens:room.tokens.map(token=>token.id===hero.id?{...hero,status:'burn'}:token)},random).room;
    hero=room.tokens.find(token=>token.id===hero.id);
    const short=restPokemon(hero,'short');assert.equal(short.pp[0],34);assert.equal(short.status,'burn');assert.strictEqual(restPokemon(short,'short'),short);
    hero=restPokemon(short,'full');assert.equal(hero.status,'');assert.equal(hero.currentHp,hero.maxHp);
    // A separate conscious encounter avoids trying to capture a KO opponent.
    const wild={...foe,id:'wild',currentHp:foe.maxHp,hidden:false,captured:false};
    room=normalizeRoomSnapshot({...room,phase:'intervalo',initiative:[],tokens:[hero,wild],trainerBags:{[captureTrainerKey(hero)]:{'master-ball':2}}});
    const captured=resolveCaptureAction({snapshot:room,role:'narrator',request:{trainerTokenId:hero.id,targetId:'wild',ball:'master-ball',wildConfirmed:true},species:{capture_rate:190},random});
    room=captured.nextSnapshot;
    assert.equal(room.trainerBags[captureTrainerKey(hero)]['master-ball'],1);assert.equal(room.tokens.find(token=>token.id==='wild').captured,true);
    const awardId=createExperienceAwardId(journeys);
    room=awardRoomPokemonExperience(room,hero.id,{xp:24,awardId},teams);
    const repeated=awardRoomPokemonExperience(room,hero.id,{xp:24,awardId},teams);
    assert.deepEqual(repeated,room,'same challenge cannot grant a second award');
    teams=syncTeamsWithRoomProgress(teams,room);
    const document=normalizeAccountDocument({boxes:teams,localAdventure:{snapshot:room},dex:{favorites:['25']}});
    const restored=normalizeAccountDocument(JSON.parse(JSON.stringify(document)));
    assert.deepEqual(restored,document);
    const partner=restored.boxes[0].pokemon[0];
    assert.equal(partner.rpg.pendingEvs,48);assert.equal(partner.rpg.status,'');assert.ok(partner.level>=level);assert.ok(Number.isSafeInteger(partner.rpg.xp));
    const exported=await decodeTeam(await encodeTeam(restored.boxes[0]));
    assert.deepEqual([exported.pokemon[0].level,exported.pokemon[0].rpg.currentHp,exported.pokemon[0].rpg.xp,exported.pokemon[0].rpg.pp],[partner.level,partner.rpg.currentHp,partner.rpg.xp,partner.rpg.pp]);
    assert.deepEqual(compactTeam(restored.boxes[0]),restored.boxes[0]);
    assert.deepEqual(normalizeRoomSnapshot(restored.localAdventure.snapshot),room);
    const group=resolveGroupOutcome([{success:true,essential:true},{success:false},{success:true}]);assert.equal(group.riskSteps,1);
    let chase={};for(const success of [false,true,true,false,true])chase=advanceChase(chase,success);
    assert.deepEqual(chase,{escape:3,danger:2});
  }
  assert.equal(journeys,48);
});

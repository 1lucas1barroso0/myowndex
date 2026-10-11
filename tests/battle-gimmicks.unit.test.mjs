import assert from "node:assert/strict";
import test from "node:test";
import {applyGimmick,advanceGimmickRound,canUseZMove,endGimmick,getGimmickChoices,getZMovePower,megaFormFor,normalizeGimmickState,trainerHasUsedGimmick} from "../src/core/battleGimmicks.js";
import {applyEndOfRoundEffects,changeRoomPhase,createRoomSnapshot,normalizeRoomToken,startNewRoomBattle} from "../src/core/room.js";

const base=()=>normalizeRoomToken({
 id:"charizard",name:"Charizard",pokemonId:"chari",teamId:"box-one",
 speciesName:"charizard",speciesId:6,item:"charizardite-x",
 types:["fire","flying"],originalTypes:["fire","flying"],teraType:"dragon",level:52,
 dynamaxLevel:0,canGMax:false,currentHp:35,maxHp:35,
 stats:{hp:35,attack:17,defense:12,"special-attack":16,"special-defense":13,speed:17},
 originalStats:{hp:175,attack:87,defense:60,"special-attack":80,"special-defense":65,speed:85},
 moves:["flamethrower","protect","",""],pp:[15,10,null,null],
 evs:{},ivs:{},nature:"hardy",stages:{},
});
test("mega stone requires the matching species, item and surviving Pokémon",()=>{
 const c=base();
 assert.equal(megaFormFor(c),"charizard-mega-x");
 assert.deepEqual(getGimmickChoices(c).map(x=>x.id),["mega","tera"]);
 assert.equal(megaFormFor({...c,speciesName:"pikachu"}),"");
 assert.ok(!getGimmickChoices({...c,item:"venusaurite"}).some(x=>x.id==="mega"));
 assert.equal(getGimmickChoices({...c,currentHp:0}).length,0);
});
test("Dynamax and Gigantamax follow ficha level/factor and expire after three rounds",()=>{
 const c={...base(),item:"",teraType:"",dynamaxLevel:10,canGMax:true};
 assert.deepEqual(getGimmickChoices(c).map(x=>x.id),["dyna","gmax"]);
 const d=applyGimmick(c,"dyna");assert.equal(d.applied,true);
 assert.equal(d.token.maxHp,70);
 assert.equal(d.token.gimmickState.rounds,3);
 const a=advanceGimmickRound(d.token),b=advanceGimmickRound(a);
 assert.equal(b.gimmickState.rounds,1);
 const ended=advanceGimmickRound(b);
 assert.equal(ended.maxHp,35);
 assert.equal(ended.gimmickState.active,"");
 assert.equal(getGimmickChoices(ended).length,0);
 assert.equal(applyGimmick({...c,dynamaxLevel:0},"dyna").applied,false);
 assert.equal(applyGimmick({...c,canGMax:false},"gmax").applied,false);
});
test("tera is not a reversible free toggle, cannot stack and resets in new battle",()=>{
 const c={...base(),item:"",teraType:"water"};
 const next=applyGimmick(c,"tera");
 assert.equal(next.applied,true);
 assert.equal(next.token.teraActive,true);
 assert.deepEqual(getGimmickChoices(next.token),[]);
 const snap={...createRoomSnapshot(),battleStarted:true,phase:"batalha",tokens:[next.token]};
 const fresh=startNewRoomBattle(snap);
 assert.equal(fresh.tokens[0].teraActive,false);
 assert.equal(fresh.tokens[0].gimmickState.active,"");
});
test("Z-Crystals require a compatible learned damaging move and can only be spent once",()=>{
 const c={...base(),item:"firium-z",teraType:"",moves:["flamethrower","protect","",""]};
 const move={name:"flamethrower",type:{name:"fire"},damage_class:{name:"special"},power:90};
 assert.equal(canUseZMove(c,move),true);
 assert.equal(getZMovePower(90),175);
 assert.equal(canUseZMove(c,{...move,type:{name:"water"}}),false);
 assert.equal(canUseZMove(c,{...move,name:"ember"}),false);
 assert.equal(canUseZMove(c,{...move,damage_class:{name:"status"}}),false);
 assert.equal(canUseZMove({...c,item:"normalium-z"},move),false);
 assert.equal(canUseZMove({...c,gimmickState:{used:["z"]}},move),false);
});
test("one trainer cannot stack gimmicks across Pokémon; another Box can",()=>{
 const c={...base(),item:"",teraType:"fire"};
 const used=applyGimmick(c,"tera").token;
 const teammate={...c,id:"second",pokemonId:"second",item:"charizardite-y",gimmickState:normalizeGimmickState()};
 const other={...teammate,id:"third",teamId:"box-two"};
 const room={tokens:[used,teammate,other],benchTokens:[]};
 assert.equal(trainerHasUsedGimmick(teammate,room),true);
 assert.ok(getGimmickChoices(teammate,{snapshot:room}).some(x=>x.id==="mega"));
 assert.equal(getGimmickChoices(teammate,{snapshot:room}).some(x=>x.id==="tera"),false);
 assert.ok(getGimmickChoices(other,{snapshot:room}).length>0);
 assert.equal(canUseZMove({...teammate,item:"firium-z"},{
     name:"flamethrower",type:{name:"fire"},damage_class:{name:"special"},power:90,
 },room),true);
});
test("story phases preserve team and make battle transitions explicit",()=>{
 const room=createRoomSnapshot();
 assert.equal(changeRoomPhase(room,"interpretacao").phase,"interpretacao");
 assert.equal(changeRoomPhase(room,"intervalo").phase,"intervalo");
 assert.equal(changeRoomPhase(room,"batalha").battleStarted,true);
 assert.equal(endGimmick(base(),{reset:true}).gimmickState.active,"");
});

test("a marked G-Max factor never grants Gigantamax to a species without that form",()=>{
 const c={...base(),item:"",teraType:"",dynamaxLevel:7,canGMax:true};
 assert.ok(getGimmickChoices(c).some(x=>x.id==="gmax"));
 const invalid={...c,speciesName:"bulbasaur",item:""};
 assert.ok(getGimmickChoices(invalid).some(x=>x.id==="dyna"));
 assert.equal(getGimmickChoices(invalid).some(x=>x.id==="gmax"),false);
});

test("official Mega form receives a distinct visible sprite, real typing and changed battle stats",()=>{
 const c=base();
 const form={
  name:"charizard-mega-x",id:10034,
  sprites:{front_default:"/sprites/6.png"},
  types:[{type:{name:"fire"}},{type:{name:"dragon"}}],
  stats:[["hp",78],["attack",130],["defense",111],["special-attack",130],["special-defense",85],["speed",100]].map(([name,base_stat])=>({stat:{name},base_stat})),
  abilities:[{ability:{name:"tough-claws"}}]
 };
 const result=applyGimmick(c,"mega",{formData:form});
 assert.equal(result.applied,true);
 assert.equal(result.token.speciesName,"charizard-mega-x");
 assert.equal(result.token.speciesId,10034);
 assert.notEqual(result.token.sprite,c.sprite);
 assert.deepEqual(result.token.types,["fire","dragon"]);
 assert.equal(result.token.ability,"tough-claws");
 const restored=endGimmick(result.token);
 assert.equal(restored.speciesName,"charizard");
 assert.equal(restored.sprite,c.sprite);
});

test("G-Max field effect remains for four rounds, damages eligible foes and resets on new battle",()=>{
 const ally={...base(),id:"ally",teamId:"t1",side:"ally",item:"",teraType:"",currentHp:35};
 const foe={...base(),id:"foe",teamId:"t2",side:"opponent",item:"",teraType:"",currentHp:35,types:["normal"],originalTypes:["normal"]};
 let room={...createRoomSnapshot(),phase:"batalha",battleStarted:true,tokens:[ally,foe],
  gmaxHazards:[{id:"g-max-wildfire",label:"G-Max Wildfire",side:"opponent",type:"fire",turns:4}]};
 for(let round=3;round>=0;round--){
  room=applyEndOfRoundEffects(room,()=>0.5).room;
  assert.equal(room.gmaxHazards[0]?.turns??0,round);
 }
 assert.ok(room.tokens.find(token=>token.id==="foe").currentHp<35);
 assert.equal(room.tokens.find(token=>token.id==="ally").currentHp,35);
 const fresh=startNewRoomBattle(room);
 assert.deepEqual(fresh.gmaxHazards,[]);
});

test("Eternamax is an Eternatus boss form, not an ordinary Dynamax",()=>{
 const e={...base(),id:"eternatus",speciesId:890,speciesName:"eternatus",
   formName:"eternatus",item:"",teraType:"poison",dynamaxLevel:10,canGMax:false,
   maxHp:20,currentHp:20,types:["poison","dragon"],originalTypes:["poison","dragon"]};
 const options=getGimmickChoices(e);
 assert.ok(options.some(x=>x.id==="eternamax" && x.form==="eternatus-eternamax"));
 assert.ok(!options.some(x=>["dyna","gmax"].includes(x.id)));
 const next=applyGimmick(e,"eternamax");
 assert.equal(next.applied,true);
 assert.equal(next.token.speciesId,10190);
 assert.equal(next.token.gimmickState.active,"eternamax");
 assert.equal(next.token.gimmickState.rounds,0);
 assert.match(next.token.sprite,/sprites\\/native\\//);
 assert.ok(next.token.maxHp>e.maxHp);
 assert.equal(advanceGimmickRound(next.token).gimmickState.active,"eternamax");
 assert.equal(normalizeRoomToken(next.token).gimmickState.active,"eternamax");
 const restored=endGimmick(next.token);
 assert.equal(restored.speciesId,890);
 assert.equal(restored.maxHp,e.maxHp);
 assert.equal(restored.currentHp,e.currentHp);
 assert.equal(restored.sprite,e.sprite);
 assert.equal(applyGimmick({...e,speciesId:6},"eternamax").applied,false);
 assert.equal(applyGimmick(e,"eternamax",{formData:{id:123,name:"eternatus-eternamax",stats:[]}}).applied,false);
});

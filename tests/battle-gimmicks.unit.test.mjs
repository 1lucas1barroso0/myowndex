import assert from "node:assert/strict";
import test from "node:test";
import {applyGimmick,advanceGimmickRound,canUseZMove,endGimmick,getGimmickChoices,getZMovePower,megaFormFor,normalizeGimmickState,trainerHasUsedGimmick} from "../src/core/battleGimmicks.js";
import {changeRoomPhase,createRoomSnapshot,normalizeRoomToken,startNewRoomBattle} from "../src/core/room.js";

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
 assert.equal(getGimmickChoices(teammate,{snapshot:room}).length,0);
 assert.ok(getGimmickChoices(other,{snapshot:room}).length>0);
 assert.equal(canUseZMove({...teammate,item:"firium-z"},{
     name:"flamethrower",type:{name:"fire"},damage_class:{name:"special"},power:90,
 },room),false);
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

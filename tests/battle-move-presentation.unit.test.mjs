import assert from "node:assert/strict";
import test from "node:test";
import { battleMovePresentation, getBattleMoveLabels, moveVariantForResolution } from "../src/core/battleMovePresentation.js";
import { applyMaxMoveSecondary } from "../src/core/battleMoveEffects.js";

const move=(name,type,power=90,category="special")=>({name,type:{name:type},power,damage_class:{name:category},
  target:{name:"selected-pokemon"},accuracy:100,pp:10,
  stat_changes:[{stat:{name:"defense"},change:-1}],
  meta:{ailment:{name:"paralysis"},ailment_chance:25,stat_chance:30,flinch_chance:20,drain:-10}});
const pokemon=(active="",speciesName="charizard")=>({id:"a",speciesName,teraType:"water",item:"firium-z",
    name:"Hero",side:"ally",level:40,maxHp:30,currentHp:22,types:["fire"],originalTypes:["fire"],
    moves:["flamethrower","protect"],gimmickState:{active,base:{speciesName:speciesName.replace("-gmax","")},used:[]},
    stats:{attack:10,defense:10,"special-attack":11,"special-defense":11,speed:10},
    originalStats:{attack:60,defense:60,"special-attack":60,"special-defense":60,speed:60},stages:{}});
test("Z attack converts type and name, suppresses old move effects and preserves source for PP",()=>{
 const base=move("flamethrower","fire",90);
 const selection=battleMovePresentation(pokemon(),base,{useZMove:true});
 assert.equal(selection.label,"Inferno Overdrive");
 assert.equal(selection.power,175);
 assert.equal(selection.kind,"z");
 const variant=moveVariantForResolution(base,selection);
 assert.equal(variant.name,"inferno-overdrive");
 assert.equal(variant.power,175);
 assert.equal(variant.stat_changes.length,0);
 assert.equal(variant.meta.flinch_chance,0);
 assert.equal(variant.meta.ailment.name,"none");
 assert.equal(base.name,"flamethrower");
});
test("all 18 types expose a real Max Move, not the original move name",()=>{
 const types=["normal","fighting","flying","poison","ground","rock","bug","ghost","steel",
 "fire","water","grass","electric","psychic","ice","dragon","dark","fairy"];
 for(const type of types){
   const p=battleMovePresentation(pokemon("dyna"),move("sample",type));
   assert.equal(p.kind,"max",type);
   assert.match(p.label,/^Max /,type);
   assert.notEqual(moveVariantForResolution(move("sample",type),p).name,"sample");
 }
 const guard=battleMovePresentation(pokemon("dyna"),move("protect","normal",0,"status"));
 assert.equal(guard.label,"Max Guard");
 const converted=moveVariantForResolution(move("protect","normal",0,"status"),guard);
 assert.equal(converted.name,"max-guard");
 assert.equal(converted.target.name,"user");
 assert.equal(converted.accuracy,null);
});
test("Gigantamax has its signature move only for its actual type",()=>{
 const charizard=pokemon("gmax","charizard-gmax");
 assert.equal(battleMovePresentation(charizard,move("flamethrower","fire")).label,"G-Max Wildfire");
 assert.equal(battleMovePresentation(charizard,move("air-slash","flying")).label,"Max Airstream");
 const drummers=pokemon("gmax","rillaboom-gmax");
 const solo=battleMovePresentation(drummers,move("razor-leaf","grass",60,"physical"));
 assert.equal(solo.label,"G-Max Drum Solo");
 assert.equal(solo.power,160);
 const king=pokemon("gmax","kingler-gmax");
 assert.equal(battleMovePresentation(king,move("surf","water")).label,"G-Max Foam Burst");
});
test("Tera Blast changes damaging type to the recorded Tera type",()=>{
 const base=move("tera-blast","normal",80);
 const tera=pokemon("tera");
 const presented=battleMovePresentation(tera,base);
 assert.equal(presented.type,"water");
 assert.equal(presented.kind,"tera-move");
 assert.equal(moveVariantForResolution(base,presented).type.name,"water");
 assert.equal(base.type.name,"normal");
});
test("Max side effects update battle stats and the weather only on connection",()=>{
 const attacker=pokemon("dyna");
 const defender={...pokemon(),id:"b",side:"opponent",currentHp:30};
 const fire=battleMovePresentation(attacker,move("flamethrower","fire"));
 const missed=applyMaxMoveSecondary({tokens:[attacker,defender],attackerId:"a",presentation:fire,connected:false});
 assert.deepEqual(missed.field,{});
 assert.equal(applyMaxMoveSecondary({tokens:[attacker,defender],attackerId:"a",presentation:fire,connected:true}).field.weather,"sol");
 const air=battleMovePresentation(attacker,move("air-slash","flying"));
 const speed=applyMaxMoveSecondary({tokens:[attacker,defender],attackerId:"a",presentation:air,connected:true});
 assert.equal(speed.tokens[0].stages.speed,1);
 assert.equal(speed.tokens[1].stages.speed,undefined);
 const gmax=applyMaxMoveSecondary({tokens:[attacker,defender],attackerId:"a",
   presentation:{kind:"gmax-move",label:"G-Max Wildfire"},connected:true});
 assert.equal(gmax.field.weather,undefined,"signature moves cannot accidentally apply Max Flare's weather");
 assert.equal(gmax.hazards[0].turns,4);
 assert.equal(gmax.hazards[0].type,"fire");
 assert.match(gmax.notes.join(" "),/4 rodadas/);
});
test("battle move dropdown descriptions use the transformed move identities",()=>{
 const token=pokemon("gmax","charizard-gmax");
 const details={flamethrower:move("flamethrower","fire"),protect:move("protect","normal",0,"status")};
 const items=getBattleMoveLabels({token,moves:["flamethrower","protect"],details});
 assert.equal(items[0].label,"G-Max Wildfire");
 assert.equal(items[1].label,"Max Guard");
});

test("real forms and converted attacks have distinct identities while their original move and PP remain stable",()=>{
 const species=["charizard-gmax","kingler-gmax","rillaboom-gmax"];
 const attacks=[move("flamethrower","fire"),move("surf","water"),move("razor-leaf","grass",60,"physical")];
 for(let i=0;i<species.length;i++){
  const token=pokemon("gmax",species[i]),source=attacks[i],shown=battleMovePresentation(token,source);
  assert.match(shown.label,/^G-Max /);
  const converted=moveVariantForResolution(source,shown);
  assert.notEqual(converted.name,source.name);
  assert.equal(source.pp,10);
  assert.equal(converted.power,shown.power);
 }
 const tera=move("tera-blast","normal",80);
 const converted=moveVariantForResolution(tera,battleMovePresentation(pokemon("tera"),tera));
 assert.equal(converted.type.name,"water");
 assert.equal(tera.type.name,"normal");
});

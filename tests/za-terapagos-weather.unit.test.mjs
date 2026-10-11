import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {getZAMegaForms,applyGimmick,megaFormFor,getGimmickChoices,activateTeraShift,restoreTeraShift} from "../src/core/battleGimmicks.js";
import {getPokemonSpriteSources} from "../src/core/pokemonSpriteSources.js";
import {normalizeRoomToken,normalizeRoomSnapshot,createRoomSnapshot} from "../src/core/room.js";
import {getDamageTraitModifiers} from "../src/core/traitMechanics.js";
import {getDefensiveTypes,getMoveStab} from "../src/core/automation.js";
import {resolveExceptionalWeather,ordinaryWeather,specialWeatherMoveBlocked} from "../src/core/exceptionalWeather.js";

const token=(id,name,item="",ability="")=>normalizeRoomToken({
 id:"token-"+id,name,speciesName:name,formName:name,speciesId:id,item,ability,
 level:75,nature:"hardy",teraType:"",maxHp:45,currentHp:45,
 types:["normal"],originalTypes:["normal"],
 stats:{hp:45,attack:35,defense:32,"special-attack":35,"special-defense":32,speed:30},
 originalStats:{hp:900,attack:700,defense:640,"special-attack":700,"special-defense":640,speed:600},
});

test("49 official new Mega forms use exact stones, base forms, stats, and 2D art",()=>{
 const forms=getZAMegaForms();
 assert.equal(forms.length,49);
 assert.equal(new Set(forms.map(x=>x.id)).size,49);
 for(const entry of forms){
   const normal=token(entry.baseId,entry.name.split("-")[0],entry.item);
   assert.equal(megaFormFor(normal),entry.name,entry.name);
   const next=applyGimmick(normal,"mega");
   assert.equal(next.applied,true,entry.name+" "+next.reason);
   assert.equal(next.token.speciesId,entry.id);
   assert.deepEqual(next.token.types,entry.types);
   assert.equal(next.token.ability,entry.ability||"");
   const sprites=getPokemonSpriteSources({pokemonId:entry.id});
   assert.ok(sprites.static.length||sprites.animated.length,entry.name);
   assert.ok(next.token.sprite.startsWith("/sprites/native/")||next.token.sprite.includes("PokeAPI"),entry.name);
   if(next.token.sprite.startsWith("/sprites/native/"))assert.ok(existsSync("public"+next.token.sprite),entry.name);
   assert.notEqual(megaFormFor({...normal,speciesId:999}),entry.name);
 }
 for(const special of forms.filter(x=>x.baseId!==x.speciesId)){
   assert.notEqual(megaFormFor(token(special.speciesId,special.name,special.item)),special.name);
 }
 assert.equal(megaFormFor(token(26,"raichu","raichunite-x")),"raichu-mega-x");
 assert.equal(megaFormFor(token(26,"raichu","raichunite-y")),"raichu-mega-y");
});

test("Terapagos enters Terastal with Tera Shift, goes Stellar with Terastalization and restores without healing",()=>{
 const original=token(1024,"terapagos","","tera-shift");
 const shifted=activateTeraShift(original);
 assert.equal(shifted.speciesId,10276);
 assert.equal(shifted.ability,"tera-shell");
 assert.equal(shifted.teraShiftBase.speciesId,1024);
 assert.ok(getGimmickChoices(shifted).some(x=>x.id==="tera"));
 const resisted=getDamageTraitModifiers({attacker:original,defender:shifted,
   effectiveness:2,move:{type:{name:"fighting"},damage_class:{name:"physical"},power:90}});
 assert.ok(resisted.entries.some(x=>x.sourceId==="tera-shell"));
 const result=applyGimmick(shifted,"tera");
 assert.equal(result.applied,true);
 assert.equal(result.token.speciesId,10277);
 assert.equal(result.token.ability,"teraform-zero");
 assert.equal(result.token.teraType,"stellar");
 assert.deepEqual(getDefensiveTypes(result.token),["normal"]);
 assert.equal(getMoveStab(result.token,"normal"),2);
 const half={...result.token,currentHp:Math.floor(result.token.maxHp/2)};
 const restored=restoreTeraShift(half);
 assert.equal(restored.speciesId,1024);
 assert.equal(restored.ability,"tera-shift");
 assert.ok(restored.currentHp<original.maxHp);
 assert.equal(activateTeraShift(restored).speciesId,10276);
});

test("Primal weather effects, Delta Stream, Teraform Zero weather clearing and no phantom weather",()=>{
 const kyogre=token(10077,"kyogre-primal","","primordial-sea");
 const groudon=token(10078,"groudon-primal","","desolate-land");
 const ray=token(10079,"rayquaza-mega","","delta-stream");
 assert.equal(resolveExceptionalWeather("sol",[kyogre]),"chuva-intensa");
 assert.equal(resolveExceptionalWeather("chuva",[groudon]),"sol-extremo");
 assert.equal(resolveExceptionalWeather("limpo",[ray]),"ventos-fortes");
 assert.equal(resolveExceptionalWeather("sol-extremo",[]),"limpo");
 assert.equal(ordinaryWeather("chuva-intensa"),"chuva");
 assert.ok(specialWeatherMoveBlocked({weather:"chuva-intensa",moveType:"fire"}));
 assert.ok(specialWeatherMoveBlocked({weather:"sol-extremo",moveType:"water"}));
 assert.ok(!specialWeatherMoveBlocked({weather:"chuva-intensa",moveType:"fire",weatherSuppressed:true}));
 const blocked=getDamageTraitModifiers({attacker:groudon,defender:kyogre,weather:"chuva-intensa",move:{
  type:{name:"fire"},damage_class:{name:"special"},power:90}});
 assert.equal(blocked.multiplier,0);
 const wind=getDamageTraitModifiers({attacker:kyogre,defender:{...ray,types:["dragon","flying"]},weather:"ventos-fortes",effectiveness:4,move:{
  type:{name:"ice"},damage_class:{name:"special"},power:90}});
 assert.ok(wind.entries.some(x=>x.sourceId==="delta-stream"&&x.multiplier===0.5));
 const snap=normalizeRoomSnapshot({...createRoomSnapshot(),tokens:[groudon],weather:"limpo"});
 assert.equal(snap.weather,"sol-extremo");
 assert.equal(normalizeRoomSnapshot({...snap,tokens:[]}).weather,"limpo");
 assert.equal(normalizeRoomSnapshot({...snap,weatherClearedByTeraformZero:true}).weather,"limpo");
});


import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {getZAMegaForms,megaFormFor,applyGimmick,getGimmickChoices,activateTeraShift,restoreTeraShift,TERAPAGOS_FORMS} from "../src/core/battleGimmicks.js";
import {getPokemonSpriteSources} from "../src/core/pokemonSpriteSources.js";
import {createRoomSnapshot,normalizeRoomSnapshot,normalizeRoomToken} from "../src/core/room.js";
import {getDamageTraitModifiers} from "../src/core/traitMechanics.js";
import {getDefensiveTypes,getMoveStab} from "../src/core/automation.js";
import {resolveExceptionalWeather,specialWeatherMoveBlocked,ordinaryWeather} from "../src/core/exceptionalWeather.js";

const mon=(id,name,item="",ability="")=>normalizeRoomToken({id:"unit-"+id,name,speciesId:id,speciesName:name,formName:name,item,ability,
 level:70,nature:"hardy",maxHp:40,currentHp:40,types:["normal"],originalTypes:["normal"],evs:{},ivs:{},
 stats:{hp:40,attack:20,defense:20,"special-attack":20,"special-defense":20,speed:20},
 originalStats:{hp:200,attack:100,defense:100,"special-attack":100,"special-defense":100,speed:100},
});

test("all 49 verified Legends Z-A and Mega Dimension forms have correct species, stone, statistics, sprite",()=>{
 const forms=getZAMegaForms();
 assert.equal(forms.length,49);
 assert.equal(new Set(forms.map(f=>f.id)).size,49);
 for(const form of forms){
  const token=mon(form.baseId,form.name.split("-")[0],form.item);
  assert.equal(megaFormFor(token),form.name,form.name);
  assert.ok(getGimmickChoices(token).some(choice=>choice.form===form.name));
  const result=applyGimmick(token,"mega");
  assert.equal(result.applied,true,form.name+": "+result.reason);
  assert.equal(result.token.speciesId,form.id,form.name);
  assert.deepEqual(result.token.types,form.types,form.name);
  if(form.ability)assert.equal(result.token.ability,form.ability);
  const sources=getPokemonSpriteSources({pokemonId:form.id});
  assert.ok(sources.static.length||sources.animated.length,form.name+" missing art");
  if(result.token.sprite.startsWith("/sprites/native/"))
   assert.ok(existsSync("public"+result.token.sprite),form.name+" missing 2D asset");
  assert.notEqual(megaFormFor({...token,speciesId:25}),form.name,form.name+" species protection");
 }
});
test("new Mega Stone variants do not exchange Floette, Zygarde, Magearna, Meowstic and Tatsugiri identities",()=>{
 const forms=getZAMegaForms();
 for(const x of forms.filter(f=>f.baseId!==f.speciesId))
  assert.notEqual(megaFormFor(mon(x.speciesId,x.name,x.item)),x.name);
 for(const [id,item,name] of [[26,"raichunite-x","raichu-mega-x"],[26,"raichunite-y","raichu-mega-y"],
  [445,"garchompite-z","garchomp-mega-z"],[448,"lucarionite-z","lucario-mega-z"]])
  assert.equal(megaFormFor(mon(id,name,item)),name);
});
test("Tera Shift and Stellar preserve type identity and HP when leaving the battlefield",()=>{
 const original=mon(1024,"terapagos","","tera-shift");
 const shifted=activateTeraShift(original);
 assert.equal(shifted.speciesId,10276);
 assert.equal(shifted.ability,"tera-shell");
 assert.equal(shifted.teraShiftBase.speciesId,1024);
 assert.ok(getGimmickChoices(shifted).some(x=>x.id==="tera"));
 const before=getDamageTraitModifiers({attacker:mon(25,"pikachu"),defender:shifted,effectiveness:2,
  move:{type:{name:"fighting"},damage_class:{name:"physical"},power:80}});
 assert.ok(before.entries.some(entry=>entry.sourceId==="tera-shell"));
 const stellar=applyGimmick(shifted,"tera");
 assert.equal(stellar.applied,true);
 assert.equal(stellar.token.speciesId,10277);
 assert.equal(stellar.token.ability,"teraform-zero");
 assert.deepEqual(getDefensiveTypes(stellar.token),["normal"]);
 assert.ok(getMoveStab(stellar.token,"normal")>=2);
 const reverted=restoreTeraShift({...stellar.token,currentHp:Math.max(1,Math.floor(stellar.token.maxHp/2))});
 assert.equal(reverted.speciesId,1024);
 assert.equal(reverted.ability,"tera-shift");
 assert.ok(reverted.currentHp<original.maxHp);
 assert.equal(activateTeraShift(reverted).speciesId,10276);
 assert.equal(TERAPAGOS_FORMS.stellar.height,17);
});
test("Primordial Sea, Desolate Land and Delta Stream obey ability sources and suppress forbidden types",()=>{
 const whale=mon(10077,"kyogre-primal","","primordial-sea");
 const land=mon(10078,"groudon-primal","","desolate-land");
 const flying=mon(10079,"rayquaza-mega","","delta-stream");
 assert.equal(resolveExceptionalWeather("sol",[whale]),"chuva-intensa");
 assert.equal(resolveExceptionalWeather("chuva",[land]),"sol-extremo");
 assert.equal(resolveExceptionalWeather("limpo",[flying]),"ventos-fortes");
 assert.equal(resolveExceptionalWeather("chuva-intensa",[]),"limpo");
 assert.equal(ordinaryWeather("chuva-intensa"),"chuva");
 assert.ok(specialWeatherMoveBlocked({weather:"chuva-intensa",moveType:"fire"}));
 assert.ok(specialWeatherMoveBlocked({weather:"sol-extremo",moveType:"water"}));
 assert.ok(!specialWeatherMoveBlocked({weather:"sol-extremo",moveType:"fire"}));
 const damage=getDamageTraitModifiers({attacker:land,defender:whale,weather:"chuva-intensa",
 move:{power:80,type:{name:"fire"},damage_class:{name:"special"}}});
 assert.equal(damage.multiplier,0);
 const wind=getDamageTraitModifiers({attacker:land,defender:{...flying,types:["dragon","flying"]},
 weather:"ventos-fortes",effectiveness:4,
 move:{power:80,type:{name:"ice"},damage_class:{name:"special"}}});
 assert.ok(wind.entries.some(entry=>entry.sourceId==="delta-stream"&&entry.multiplier===0.5));
 const room=normalizeRoomSnapshot({...createRoomSnapshot(),tokens:[whale]});
 assert.equal(room.weather,"chuva-intensa");
 assert.equal(normalizeRoomSnapshot({...room,tokens:[]}).weather,"limpo");
 const clearing=normalizeRoomSnapshot({...room,weatherClearedByTeraformZero:true});
 assert.equal(clearing.weather,"limpo");
});
test("PWA declares one stable application identity and an immersive browser-free installed display",()=>{
 const manifest=readFileSync("app/manifest.ts","utf8");
 assert.match(manifest,/id: "\/"/);
 assert.match(manifest,/scope: "\/"/);
 assert.match(manifest,/display: "standalone"/);
 assert.match(manifest,/display_override: \["fullscreen", "standalone"\]/);
 assert.match(manifest,/myowndex-dex-v105-r2-maskable-512/);
 const metadata=readFileSync("app/layout.tsx","utf8");
 assert.match(metadata,/appleWebApp/);
 assert.match(metadata,/viewportFit: "cover"/);
 const ui=readFileSync("src/components/Shared/AppInstallControl.jsx","utf8");
 assert.match(ui,/display-mode: standalone/);
 assert.match(ui,/display-mode: fullscreen/);
 assert.match(ui,/navigator.standalone === true/);
 assert.match(ui,/if \(inAppWindow\) return null/);
 const sw=readFileSync("public/sw.js","utf8");
 const {version}=JSON.parse(readFileSync("package.json","utf8"));
 assert.ok(sw.includes('"/manifest.webmanifest"'),"SW precaches canonical manifest without changing its URL");
 assert.ok(sw.includes(`myowndex-shell-v${version}-app`),"SW cache must track the release version");
});

import zaForms from "../data/mega-za-forms.json" with { type: "json" };
import { calculateStat, convertToTTRPG, NATURES } from "./mechanics.js";
import { getPokemonSpriteSources } from "./pokemonSpriteSources.js";
import { calculateStagedStats } from "./automation.js";
import { integerInRange } from "./math.js";

const slug = value => typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : "";
const stones = [
["abomasnow","abomasite"],["absol","absolite"],["aerodactyl","aerodactylite"],["aggron","aggronite"],
["alakazam","alakazite"],["altaria","altarianite"],["ampharos","ampharosite"],["audino","audinite"],
["banette","banettite"],["beedrill","beedrillite"],["blastoise","blastoisinite"],["blaziken","blazikenite"],
["camerupt","cameruptite"],["charizard","charizardite-x"],["charizard","charizardite-y"],
["diancie","diancite"],["gallade","galladite"],["garchomp","garchompite"],
["gardevoir","gardevoirite"],["gengar","gengarite"],["glalie","glalitite"],
["gyarados","gyaradosite"],["heracross","heracronite"],["houndoom","houndoominite"],
["kangaskhan","kangaskhanite"],["latias","latiasite"],["latios","latiosite"],
["lopunny","lopunnite"],["lucario","lucarionite"],["manectric","manectite"],
["mawile","mawilite"],["medicham","medichamite"],["metagross","metagrossite"],
["mewtwo","mewtwonite-x"],["mewtwo","mewtwonite-y"],["pidgeot","pidgeotite"],
["pinsir","pinsirite"],["sableye","sablenite"],["salamence","salamencite"],
["sceptile","sceptilite"],["scizor","scizorite"],["sharpedo","sharpedonite"],
["slowbro","slowbronite"],["steelix","steelixite"],["swampert","swampertite"],
["tyranitar","tyranitarite"],["venusaur","venusaurite"]
];
const STONE_TO_SPECIES = new Map(stones.map(([species,item])=>[item,species]));
const ZA_MEGA_FORMS = new Map(zaForms.entries.map(entry => [entry.name,entry]));
export const getZAMegaForms = () => zaForms.entries;
const ZA_MEGA_FORM_DATA = new Map(zaForms.entries.map(entry=>[entry.name,{
 id:entry.id,name:entry.name,height:entry.height,
 types:entry.types.map(type=>({type:{name:type}})),
 abilities:entry.ability?[{ability:{name:entry.ability}}]:[],
 stats:Object.entries(entry.stats).map(([name,base_stat])=>({stat:{name},base_stat})),
}]));
export const getZAMegaFormData = key => ZA_MEGA_FORM_DATA.get(slug(key))||null;
const GMAX_SPECIES = new Set([
  "venusaur","charizard","blastoise","butterfree","pikachu","meowth",
  "machamp","gengar","kingler","lapras","eevee","snorlax",
  "garbodor","melmetal","rillaboom","cinderace","inteleon",
  "corviknight","orbeetle","drednaw","coalossal","flapple","appletun",
  "sandaconda","toxtricity","centiskorch","hatterene","grimmsnarl",
  "alcremie","copperajah","duraludon","urshifu"
]);
export const gmaxEligible = token => GMAX_SPECIES.has(baseSpecies(token).split("-")[0])
 && !/-(?:alola|galar|hisui|paldea)(?:-|$)/.test(baseSpecies(token));
const formIdentity = token => slug(token?.gimmickState?.base?.formName || token?.formName || token?.speciesName);
const gmaxFormFor = token => {
 const species=baseSpecies(token).split("-")[0], form=formIdentity(token);
 if(species==="toxtricity")return `toxtricity-${form.includes("low-key")?"low-key":"amped"}-gmax`;
 if(species==="urshifu")return `urshifu-${form.includes("rapid-strike")?"rapid-strike":"single-strike"}-gmax`;
 return `${species}-gmax`;
};
const NORMAL_CRYSTALS = new Map(Object.entries({
normal:"normalium-z",fighting:"fightinium-z",flying:"flyinium-z",poison:"poisonium-z",
ground:"groundium-z",rock:"rockium-z",bug:"buginium-z",ghost:"ghostium-z",
steel:"steelium-z",fire:"firium-z",water:"waterium-z",grass:"grassium-z",
electric:"electrium-z",psychic:"psychium-z",ice:"icium-z",dragon:"draconium-z",
dark:"darkinium-z",fairy:"fairium-z",
}).map(([type,item])=>[item,type]));
// Specific Z-Crystals require both the correct species and their actual signature move.
const SPECIFIC_Z = Object.freeze({
"aloraichium-z":["raichu","thunderbolt"],"decidium-z":["decidueye","spirit-shackle"],
"eevium-z":["eevee","last-resort"],"incinium-z":["incineroar","darkest-lariat"],
"kommonium-z":["kommo-o","clanging-scales"],"lunalium-z":["lunala","moongeist-beam"],
"lycanium-z":["lycanroc","stone-edge"],"marshadium-z":["marshadow","spectral-thief"],
"mewnium-z":["mew","psychic"],"mimikium-z":["mimikyu","play-rough"],
"pikanium-z":["pikachu","volt-tackle"],"pikashunium-z":["pikachu","thunderbolt"],
"primarium-z":["primarina","sparkling-aria"],"snorlium-z":["snorlax","giga-impact"],
"solganium-z":["solgaleo","sunsteel-strike"],"tapunium-z":["tapu","natures-madness"],
"ultranecrozium-z":["necrozma","photon-geyser"],
});
// Official, boss-only Eternamax data stored locally for offline play.
const ETERNAMAX_STATS=Object.freeze({hp:255,attack:115,defense:250,"special-attack":125,"special-defense":250,speed:130});
export const ETERNAMAX_FORM_DATA=Object.freeze({
 id:10190,name:"eternatus-eternamax",height:1000,
 types:[{type:{name:"poison"}},{type:{name:"dragon"}}],
 stats:Object.entries(ETERNAMAX_STATS).map(([name,base_stat])=>({stat:{name},base_stat})),
 abilities:[{ability:{name:"pressure"}}],
});
const baseline = token => ({
speciesName:slug(token.speciesName),speciesId:token.speciesId,sprite:token.sprite,shiny:Boolean(token.shiny),formName:slug(token.formName),
types:[...(token.types||[])],originalTypes:[...(token.originalTypes||[])],
ability:token.ability,stats:{...token.stats},originalStats:{...token.originalStats},
maxHp:token.maxHp,currentHp:token.currentHp,
});
const baseState = () => ({active:"",used:[],rounds:0,base:null,form:""});
// Official form identifiers remain verified via the PokeAPI species record.
const EXCEPTIONAL_FORMS = Object.freeze({
 "kyogre-primal": 10077,"groudon-primal": 10078,"rayquaza-mega":10079,"necrozma-ultra":10157,
});
// Immutable main-series form data, independent of API availability.
const asForm = (name,id,height,types,ability,stats)=>Object.freeze({
 name,id,height,
 types:types.map(type=>({type:{name:type}})),
 abilities:[{ability:{name:ability}}],
 stats:Object.entries(stats).map(([name,base_stat])=>({stat:{name},base_stat})),
});
export const EXCEPTIONAL_FORM_DATA = Object.freeze({
 "kyogre-primal":asForm("kyogre-primal",10077,98,["water"],"primordial-sea",
   {hp:100,attack:150,defense:90,"special-attack":180,"special-defense":160,speed:90}),
 "groudon-primal":asForm("groudon-primal",10078,50,["ground","fire"],"desolate-land",
   {hp:100,attack:180,defense:160,"special-attack":150,"special-defense":90,speed:90}),
 "rayquaza-mega":asForm("rayquaza-mega",10079,108,["dragon","flying"],"delta-stream",
   {hp:105,attack:180,defense:100,"special-attack":180,"special-defense":100,speed:115}),
 "necrozma-ultra":asForm("necrozma-ultra",10157,75,["psychic","dragon"],"neuroforce",
   {hp:97,attack:167,defense:97,"special-attack":167,"special-defense":97,speed:129}),
});
export const TERAPAGOS_FORMS=Object.freeze({
 terastal:asForm("terapagos-terastal",10276,3,["normal"],"tera-shell",
   {hp:95,attack:95,defense:110,"special-attack":105,"special-defense":110,speed:85}),
 stellar:asForm("terapagos-stellar",10277,17,["normal"],"teraform-zero",
   {hp:160,attack:105,defense:110,"special-attack":130,"special-defense":110,speed:85}),
});
const rebuildWithForm=(token,data)=>{
 const nature=NATURES[token.nature]||NATURES.hardy;
 const stats={...token.stats},originalStats={...token.originalStats};
 for(const entry of data.stats){
   const key=entry.stat.name,factor=nature.up===key?1.1:nature.down===key?0.9:1;
   const raw=calculateStat(entry.base_stat,token.evs?.[key],token.ivs?.[key],token.level,factor,key==="hp",data.name);
   originalStats[key]=raw;stats[key]=Math.max(1,convertToTTRPG(raw,key==="hp"));
 }
 const maxHp=Math.max(1,stats.hp),currentHp=token.currentHp<=0?0:
   Math.max(1,Math.min(maxHp,Math.ceil(token.currentHp/Math.max(1,token.maxHp)*maxHp)));
 const art=getPokemonSpriteSources({pokemonId:data.id,shiny:Boolean(token.shiny)});
 return {...token,stats,originalStats,maxHp,currentHp,speciesId:data.id,speciesName:data.name,formName:data.name,
   ability:data.abilities?.[0]?.ability?.name||token.ability,sprite:art.animated[0]||art.static[0]||token.sprite,
   types:data.types.map(x=>x.type.name),originalTypes:data.types.map(x=>x.type.name)};
};
export const activateTeraShift=token=>{
 if(Number(token?.speciesId)!==1024||slug(token.ability)!=="tera-shift"||token.currentHp<=0)return token;
 const base={speciesId:token.speciesId,speciesName:token.speciesName,formName:token.formName,
   sprite:token.sprite,ability:token.ability,types:token.types,originalTypes:token.originalTypes,
   maxHp:token.maxHp,stats:token.stats,originalStats:token.originalStats};
 return {...rebuildWithForm(token,TERAPAGOS_FORMS.terastal),teraShiftBase:base};
};
export const restoreTeraShift=token=>{
 if(!token?.teraShiftBase)return token;
 const former=token.gimmickState?.active?endGimmick(token):token,base=token.teraShiftBase;
 const currentHp=former.currentHp<=0?0:Math.max(1,Math.min(base.maxHp,Math.ceil(former.currentHp/Math.max(1,former.maxHp)*base.maxHp)));
 return {...former,...base,currentHp,teraShiftBase:null,teraActive:false};
};
const primalFormFor = token => {
 const species=baseSpecies(token),item=slug(token?.item);
 if(species==="kyogre" && item==="blue-orb" && Number(token.speciesId)===382)return "kyogre-primal";
 if(species==="groudon" && item==="red-orb" && Number(token.speciesId)===383)return "groudon-primal";
 return "";
};
const ultraFormFor = token => {
 const form=formIdentity(token);
 return slug(token?.item)==="ultranecrozium-z"
   && ["necrozma-dusk","necrozma-dawn"].includes(form)
   && [10155,10156].includes(Number(token.speciesId))
   ? "necrozma-ultra" : "";
};
export const normalizeGimmickState = value=>{
 const used=[...new Set((Array.isArray(value?.used)?value.used:[]).filter(id=>["mega","tera","dyna","gmax","eternamax","primal","ultra","z"].includes(id)))].slice(0,8);
 const active=["mega","tera","dyna","gmax","eternamax","primal","ultra"].includes(value?.active)?value.active:"";
 return {...baseState(),active,used,rounds:integerInRange(value?.rounds,0,3,0),
   base:value?.base&&typeof value.base==="object"?baseline(value.base):null,
   form:slug(value?.form).slice(0,80)};
};
const baseSpecies=token=>slug(token?.gimmickState?.base?.speciesName||token?.speciesName).replace(/-(?:mega(?:-[xy])?|gmax)$/,"");
export const megaFormFor = token =>{
 const item=slug(token?.item),species=baseSpecies(token);
 if(species==="rayquaza" && Number(token.speciesId)===384)
   return (token.moves||[]).includes("dragon-ascent") && !item.endsWith("-z")?"rayquaza-mega":"";
 const fromZA=zaForms.entries.find(form=>form.item===item && Number(token.speciesId)===form.baseId);
 if(fromZA)return fromZA.name;
 if(STONE_TO_SPECIES.get(item)!==species || /-(?:alola|galar|hisui|paldea)(?:-|$)/.test(formIdentity(token)))return "";
 const suffix=item.endsWith("-x")?"-x":item.endsWith("-y")?"-y":"";
 return `${species}-mega${suffix}`;
};
const trainerGroupKey = token => token?.ownerPlayerId ? `player:${token.ownerPlayerId}`
    : token?.teamShareId ? `box:${token.teamShareId}`
    : token?.teamId ? `box:${token.teamId}` : "";
export const trainerHasUsedGimmick = (token,snapshot,kind="") => {
    const key=trainerGroupKey(token);
    if(!key || !snapshot)return false;
    const family=kind==="gmax"||kind==="dyna"?["dyna","gmax"]:kind?[kind]:["mega","tera","dyna","gmax","eternamax","primal","ultra","z"];
    return [...(snapshot.tokens||[]),...(snapshot.benchTokens||[])].some(other=>
      other.id!==token.id && trainerGroupKey(other)===key
      && normalizeGimmickState(other.gimmickState,other).used.some(id=>family.includes(id)));
};
export const getGimmickChoices = (token, {phase="batalha",snapshot=null}={})=>{
 if(!token || token.currentHp<=0 || phase!=="batalha")return [];
 const state=normalizeGimmickState(token.gimmickState,token);
 if(state.active)return [];
 const used=new Set(state.used);
 const locked=["mega","tera","dyna","gmax","eternamax","ultra","z"].some(id=>used.has(id));
 if(locked)return [];
 const options=[];
 const primal=primalFormFor(token),ultra=ultraFormFor(token);
 // Primal Reversion is per Pokémon, without the once-per-trainer Mega limit.
 if(primal)options.push({id:"primal",label:"Reversão Primitiva",form:primal,
     hint:"Orb correspondente equipada • ativa enquanto estiver no campo"});
 // Ultra Burst needs fused Necrozma plus Ultranecrozium Z, once per battle.
 if(ultra)options.push({id:"ultra",label:"Ultra Burst",form:ultra,
     hint:"Necrozma fundido + Ultranecrozium Z • uma vez por batalha"});
 // Eternamax is a Narrator-directed Eternatus boss form, not normal Dynamax.
 if((baseSpecies(token)==="eternatus" || token.speciesId===890) && !used.has("eternamax"))
   options.push({id:"eternamax",label:"Eternamax (Narrador)",form:"eternatus-eternamax",hint:"Forma especial de chefe • 100 m • duração controlada pelo Narrador"});
 if(megaFormFor(token)&&!used.has("mega")&&!trainerHasUsedGimmick(token,snapshot,"mega"))options.push({id:"mega",label:"Mega Evolução",form:megaFormFor(token),hint:megaFormFor(token)==="rayquaza-mega"?"Dragon Ascent conhecido • sem Z-Crystal":"Mega Stone correspondente equipada"});
 if((slug(token.teraType)||Number(token.speciesId)===10276) && !used.has("tera")&&!trainerHasUsedGimmick(token,snapshot,"tera"))options.push({id:"tera",label:"Terastalização",hint:Number(token.speciesId)===10276?"Terapagos assume a forma Stellar":`Tipo Tera: ${token.teraType}`});
 const level=integerInRange(token.dynamaxLevel,0,10,0);
 if(baseSpecies(token)!=="eternatus" && token.speciesId!==890 && level>0&&!used.has("dyna")&&!used.has("gmax")&&!trainerHasUsedGimmick(token,snapshot,"dyna")){
   options.push({id:"dyna",label:"Dynamax",hint:`Nível Dynamax ${level} • 3 rodadas`});
   if(Boolean(token.canGMax) && gmaxEligible(token))options.push({id:"gmax",label:"Gigantamax",form:gmaxFormFor(token),hint:"Fator Gigantamax na ficha • 3 rodadas"});
 }
 return options;
};
export const canUseZMove = (token,move,snapshot=null) => {
 if(!token || !move || !Array.isArray(token.moves) || !token.moves.includes(slug(move.name)) || token.currentHp<=0)return false;
 const state=normalizeGimmickState(token.gimmickState,token);
 const crystal=slug(token.item);
 const moveId=slug(move.name);
 if(state.active==="ultra" && state.form==="necrozma-ultra"
    && state.rounds===0 && crystal==="ultranecrozium-z"
    && moveId==="photon-geyser" && !state.used.includes("z")
    && !trainerHasUsedGimmick(token,snapshot,"z")
    && slug(move.damage_class?.name)!=="status")return true;
 if(trainerHasUsedGimmick(token,snapshot,"z")||state.active||state.used.some(id=>["z","mega","tera","dyna","gmax","eternamax","primal","ultra"].includes(id))||!slug(token.item).endsWith("-z")||slug(move.damage_class?.name)==="status")return false;
 const specific=SPECIFIC_Z[crystal];
 if(specific) {
   const form=formIdentity(token), species=baseSpecies(token).replace(/-alola$/, "");
   if(crystal==="pikashunium-z" && !/-cap$/.test(form))return false;
   if(crystal==="ultranecrozium-z" && form!=="necrozma-ultra")return false;
   if(crystal!=="aloraichium-z" && /-(?:alola|galar|hisui|paldea)(?:-|$)/.test(form))return false;
   return (specific[0]==="tapu"?species.startsWith("tapu-"):species===specific[0])
     && (crystal!=="aloraichium-z" || slug(token.formName||token.formKey||"").includes("alola"))
     && slug(move.name)===specific[1];
 }
 return NORMAL_CRYSTALS.get(crystal)===slug(move.type?.name);
};
export const getZMovePower = power =>{
 const b=Number(power)||0;
 return b>=140?200:b>=130?195:b>=120?190:b>=110?185:b>=100?180:b>=90?175:b>=80?160:b>=70?140:b>=60?120:100;
};
export const maxMovePower = (power,type="") =>{
 const b=Number(power)||0;
 if(!b)return 100;
 if(["fighting","poison"].includes(type))return b>=150?100:b>=110?95:b>=75?90:b>=65?85:b>=55?80:b>=45?75:70;
 return b>=150?150:b>=110?140:b>=75?130:b>=65?120:b>=55?110:b>=45?100:90;
};
export const applyGimmick = (token,id,{formData=null}={})=>{
 if(id==="eternamax" && !formData)formData=ETERNAMAX_FORM_DATA;
 if(!formData && id!=="eternamax"){
   const selection=getGimmickChoices(token).find(choice=>choice.id===id);
   if(selection && ZA_MEGA_FORM_DATA.has(selection.form))formData=ZA_MEGA_FORM_DATA.get(selection.form);
   else if(selection && EXCEPTIONAL_FORM_DATA[selection.form])formData=EXCEPTIONAL_FORM_DATA[selection.form];
 }
 const stellarTerapagos=id==="tera" && Number(token?.speciesId)===10276;
 const option=getGimmickChoices(token).find(g=>g.id===id);
 if(!option)return {applied:false,token,reason:"Esta transformação não está disponível para este Pokémon."};
 if(id==="eternamax" && (token.speciesId!==890 || Number(formData?.id)!==10190)) return {applied:false,token,reason:"Eternamax só pode ser aplicada ao Eternatus na sua forma normal."};
 if(ZA_MEGA_FORMS.has(option.form) && Number(formData?.id)!==ZA_MEGA_FORMS.get(option.form).id)
   return {applied:false,token,reason:"Dados de outra forma não podem ser aplicados nesta Megaevolução."};
 if(EXCEPTIONAL_FORMS[option.form] && Number(formData?.id)!==EXCEPTIONAL_FORMS[option.form])
   return {applied:false,token,reason:"A identidade desta forma oficial não corresponde ao Pokémon."};
 if(option.form && (!formData || slug(formData.name)!==option.form || !Array.isArray(formData.stats)))return {applied:false,token,reason:"Não foi possível confirmar a forma oficial."};
 const state=normalizeGimmickState(token.gimmickState,token);
 const nextState={...state,active:id,used:[...new Set([...state.used,id])],rounds:id==="dyna"||id==="gmax"?3:id==="ultra"?1:0,base:baseline(token),form:option.form||""};
 let changed={...token,gimmickState:nextState,teraActive:id==="tera"};
 if(stellarTerapagos)changed={...rebuildWithForm(changed,TERAPAGOS_FORMS.stellar),teraType:"stellar",teraActive:true};
 if(id==="dyna"||id==="gmax"){
   const ratio=1.5+integerInRange(token.dynamaxLevel,1,10,1)*.05;
   const maxHp=Math.max(1,Math.ceil(token.maxHp*ratio));
   changed={...changed,maxHp,currentHp:Math.max(1,Math.ceil(token.currentHp*ratio))};
 }
 if(formData){
   const typeNames=(formData.types||[]).map(entry=>slug(entry?.type?.name)).filter(Boolean);
   const nature=NATURES[token.nature]||NATURES.hardy;
   const computed=Object.fromEntries((formData.stats||[]).filter(entry=>entry?.stat?.name&&entry.stat.name!=="hp").map(entry=>{
     const key=entry.stat.name;
     const multiplier=nature.up===key?1.1:nature.down===key?0.9:1;
     const raw=calculateStat(entry.base_stat,token.evs?.[key],token.ivs?.[key],token.level,multiplier,false,formData.name);
     return [key,{raw,stat:convertToTTRPG(raw,false)}];
   }));
   const originalStats={...changed.originalStats},stats={...changed.stats};
   for(const [key,v] of Object.entries(computed)){originalStats[key]=v.raw;stats[key]=v.stat;}
   const exactArtwork=getPokemonSpriteSources({pokemonId:formData.id,shiny:Boolean(token.shiny)});
   const spriteSources=exactArtwork.animated.length||exactArtwork.static.length?exactArtwork:
     getPokemonSpriteSources({src:token.shiny ? formData.sprites?.front_shiny||formData.sprites?.front_default : formData.sprites?.front_default,pokemonId:formData.id,shiny:Boolean(token.shiny)});
   if(!spriteSources.animated.length&&!spriteSources.static.length)return {applied:false,token,reason:"Esta forma ainda não possui um sprite 2D confirmado."};
   changed={...changed,speciesName:formData.name,speciesId:formData.id,formName:formData.name,
      sprite:spriteSources.animated[0]||spriteSources.static[0]||formData.sprites?.front_default||token.sprite,
      types:typeNames.length?typeNames:changed.types,originalTypes:typeNames.length?typeNames:changed.originalTypes,
      ability:["gmax","eternamax"].includes(id)?changed.ability:formData.abilities?.[0]?.ability?.name||changed.ability,stats,originalStats};
   if(id==="eternamax"){
     const hpBase=formData.stats.find(entry=>entry?.stat?.name==="hp")?.base_stat;
     if(!Number.isFinite(hpBase) || hpBase<=0)return {applied:false,token,reason:"A forma Eternamax não possui dados oficiais de HP verificáveis."};
     const computedHp=calculateStat(hpBase,token.evs?.hp,token.ivs?.hp,token.level,1,true,formData.name);
     const nextMaxHp=Math.max(1,convertToTTRPG(computedHp,true));
     changed={...changed,maxHp:nextMaxHp,currentHp:token.currentHp<=0?0:Math.max(1,Math.ceil(nextMaxHp*token.currentHp/Math.max(1,token.maxHp)))};
   }
   changed={...changed,stats:calculateStagedStats(changed)};
 }
 return {applied:true,token:changed};
};
export const endGimmick = (token,{reset=false}={})=>{
 const state=normalizeGimmickState(token.gimmickState,token);
 const base=state.base;
 if(!state.active || !base)return {...token,gimmickState:reset?baseState():state,teraActive:reset?false:token.teraActive};
 const ratio=token.maxHp>0?token.currentHp/token.maxHp:0;
 const restored={...token,...base,currentHp:Math.min(base.maxHp,token.currentHp<=0?0:Math.max(1,Math.ceil(ratio*base.maxHp)))};
 return {...restored,stats:calculateStagedStats(restored),gimmickState:reset?baseState():{...state,active:"",rounds:0,base:null,form:""},teraActive:false};
};
export const advanceGimmickRound = token => {
 const state=normalizeGimmickState(token.gimmickState,token);
 if(state.active==="ultra" && state.rounds>0)
   return {...token,gimmickState:{...state,rounds:state.rounds-1}};
 if(!["dyna","gmax"].includes(state.active))return token;
 if(state.rounds<=1)return endGimmick(token);
 return {...token,gimmickState:{...state,rounds:state.rounds-1}};
};

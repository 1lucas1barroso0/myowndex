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
const baseline = token => ({
speciesName:slug(token.speciesName),speciesId:token.speciesId,sprite:token.sprite,
types:[...(token.types||[])],originalTypes:[...(token.originalTypes||[])],
ability:token.ability,stats:{...token.stats},originalStats:{...token.originalStats},
maxHp:token.maxHp,currentHp:token.currentHp,
});
const baseState = () => ({active:"",used:[],rounds:0,base:null,form:""});
export const normalizeGimmickState = (value,token={})=>{
 const used=[...new Set((Array.isArray(value?.used)?value.used:[]).filter(id=>["mega","tera","dyna","gmax","z"].includes(id)))].slice(0,5);
 const active=["mega","tera","dyna","gmax"].includes(value?.active)?value.active:"";
 return {...baseState(),active,used,rounds:integerInRange(value?.rounds,0,3,0),
   base:value?.base&&typeof value.base==="object"?baseline(value.base):null,
   form:slug(value?.form).slice(0,80)};
};
const baseSpecies=token=>slug(token?.gimmickState?.base?.speciesName||token?.speciesName).replace(/-(?:mega(?:-[xy])?|gmax)$/,"");
export const megaFormFor = token =>{
 const item=slug(token?.item),species=baseSpecies(token);
 if(STONE_TO_SPECIES.get(item)!==species)return "";
 const suffix=item.endsWith("-x")?"-x":item.endsWith("-y")?"-y":"";
 return `${species}-mega${suffix}`;
};
export const getGimmickChoices = (token, {phase="batalha"}={})=>{
 if(!token || token.currentHp<=0 || phase!=="batalha")return [];
 const state=normalizeGimmickState(token.gimmickState,token);
 if(state.active)return [];
 const used=new Set(state.used);
 const locked=used.has("mega")||used.has("tera")||used.has("dyna")||used.has("gmax")||used.has("z");
 if(locked)return [];
 const options=[];
 if(megaFormFor(token)&&!used.has("mega"))options.push({id:"mega",label:"Mega Evolução",form:megaFormFor(token),hint:"Mega Stone correspondente equipada"});
 if(slug(token.teraType) && !used.has("tera"))options.push({id:"tera",label:"Terastalização",hint:`Tipo Tera: ${token.teraType}`});
 const level=integerInRange(token.dynamaxLevel,0,10,0);
 if(level>0&&!used.has("dyna")&&!used.has("gmax")){
   options.push({id:"dyna",label:"Dynamax",hint:`Nível Dynamax ${level} • 3 rodadas`});
   if(Boolean(token.canGMax))options.push({id:"gmax",label:"Gigantamax",form:`${baseSpecies(token)}-gmax`,hint:"Fator Gigantamax na ficha • 3 rodadas"});
 }
 return options;
};
export const canUseZMove = (token,move) => {
 if(!token || !move || !Array.isArray(token.moves) || !token.moves.includes(slug(move.name)) || token.currentHp<=0)return false;
 const state=normalizeGimmickState(token.gimmickState,token);
 if(state.active||state.used.some(id=>["z","mega","tera","dyna","gmax"].includes(id))||!slug(token.item).endsWith("-z")||slug(move.damage_class?.name)==="status"||!Number.isFinite(move.power)||move.power<=0)return false;
 const crystal=slug(token.item),specific=SPECIFIC_Z[crystal];
 if(specific) {
   const species=baseSpecies(token);
   return (specific[0]==="tapu"?species.startsWith("tapu-"):species===specific[0])
     && (crystal!=="aloraichium-z" || slug(token.formName||token.formKey||"").includes("alola"))
     && slug(move.name)===specific[1];
 }
 return NORMAL_CRYSTALS.get(crystal)===slug(move.type?.name);
};
export const getZMovePower = power =>{
 const b=integerInRange(power,1,300,1);
 if(b<=55)return 100;if(b<=65)return 120;if(b<=75)return 140;if(b<=85)return 160;
 if(b<=95)return 175;if(b<=100)return 180;if(b<=110)return 185;if(b<=125)return 190;
 if(b<=130)return 195;return 200;
};
export const maxMovePower = power =>{
 const b=integerInRange(power,1,300,1);
 return b<45?90:b<55?100:b<65?110:b<75?120:b<100?130:b<150?140:150;
};
export const applyGimmick = (token,id,{formData=null}={})=>{
 const option=getGimmickChoices(token).find(g=>g.id===id);
 if(!option)return {applied:false,token,reason:"Esta transformação não está disponível para este Pokémon."};
 if(option.form && (!formData || slug(formData.name)!==option.form || !Array.isArray(formData.stats)))return {applied:false,token,reason:"Não foi possível confirmar a forma oficial."};
 const state=normalizeGimmickState(token.gimmickState,token);
 const nextState={...state,active:id,used:[...new Set([...state.used,id])],rounds:id==="dyna"||id==="gmax"?3:0,base:baseline(token),form:option.form||""};
 let changed={...token,gimmickState:nextState,teraActive:id==="tera"};
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
   const spriteSources=getPokemonSpriteSources({src:formData.sprites?.front_default,pokemonId:formData.id});
   changed={...changed,speciesName:formData.name,speciesId:formData.id,
      sprite:spriteSources.animated[0]||spriteSources.static[0]||formData.sprites?.front_default||token.sprite,
      types:typeNames.length?typeNames:changed.types,originalTypes:typeNames.length?typeNames:changed.originalTypes,
      ability:formData.abilities?.[0]?.ability?.name||changed.ability,stats,originalStats};
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
 return {...restored,gimmickState:reset?baseState():{...state,active:"",rounds:0,base:null,form:""},teraActive:false};
};
export const advanceGimmickRound = token => {
 const state=normalizeGimmickState(token.gimmickState,token);
 if(!["dyna","gmax"].includes(state.active))return token;
 if(state.rounds<=1)return endGimmick(token);
 return {...token,gimmickState:{...state,rounds:state.rounds-1}};
};

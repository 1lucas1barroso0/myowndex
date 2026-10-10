import powerOverrides from "../data/battle-move-power-overrides.json" with {type:"json"};
import { getZMovePower, maxMovePower, normalizeGimmickState } from "./battleGimmicks.js";

const typeMoves=Object.freeze({
 normal:["Max Strike","Breakneck Blitz"],fighting:["Max Knuckle","All-Out Pummeling"],
 flying:["Max Airstream","Supersonic Skystrike"],poison:["Max Ooze","Acid Downpour"],
 ground:["Max Quake","Tectonic Rage"],rock:["Max Rockfall","Continental Crush"],
 bug:["Max Flutterby","Savage Spin-Out"],ghost:["Max Phantasm","Never-Ending Nightmare"],
 steel:["Max Steelspike","Corkscrew Crash"],fire:["Max Flare","Inferno Overdrive"],
 water:["Max Geyser","Hydro Vortex"],grass:["Max Overgrowth","Bloom Doom"],
 electric:["Max Lightning","Gigavolt Havoc"],psychic:["Max Mindstorm","Shattered Psyche"],
 ice:["Max Hailstorm","Subzero Slammer"],dragon:["Max Wyrmwind","Devastating Drake"],
 dark:["Max Darkness","Black Hole Eclipse"],fairy:["Max Starfall","Twinkle Tackle"],
});
const signatures=Object.freeze({
 venusaur:["grass","G-Max Vine Lash"],charizard:["fire","G-Max Wildfire"],
 blastoise:["water","G-Max Cannonade"],butterfree:["bug","G-Max Befuddle"],
 pikachu:["electric","G-Max Volt Crash"],meowth:["normal","G-Max Gold Rush"],
 machamp:["fighting","G-Max Chi Strike"],gengar:["ghost","G-Max Terror"],
 kingler:["water","G-Max Foam Burst"],lapras:["ice","G-Max Resonance"],
 eevee:["normal","G-Max Cuddle"],snorlax:["normal","G-Max Replenish"],
 garbodor:["poison","G-Max Malodor"],melmetal:["steel","G-Max Meltdown"],
 rillaboom:["grass","G-Max Drum Solo"],cinderace:["fire","G-Max Fireball"],
 inteleon:["water","G-Max Hydrosnipe"],corviknight:["flying","G-Max Wind Rage"],
 orbeetle:["psychic","G-Max Gravitas"],drednaw:["water","G-Max Stonesurge"],
 coalossal:["rock","G-Max Volcalith"],flapple:["grass","G-Max Tartness"],
 appletun:["grass","G-Max Sweetness"],sandaconda:["ground","G-Max Sandblast"],
 toxtricity:["electric","G-Max Stun Shock"],centiskorch:["fire","G-Max Centiferno"],
 hatterene:["fairy","G-Max Smite"],grimmsnarl:["dark","G-Max Snooze"],
 alcremie:["fairy","G-Max Finale"],copperajah:["steel","G-Max Steelsurge"],
 duraludon:["dragon","G-Max Depletion"],
 "urshifu-single-strike":["dark","G-Max One Blow"],
 "urshifu-rapid-strike":["water","G-Max Rapid Flow"],
});
const namedZ=Object.freeze({
 "aloraichium-z":"Stoked Sparksurfer","decidium-z":"Sinister Arrow Raid",
 "eevium-z":"Extreme Evoboost","incinium-z":"Malicious Moonsault",
 "kommonium-z":"Clangorous Soulblaze","lunalium-z":"Menacing Moonraze Maelstrom",
 "lycanium-z":"Splintered Stormshards","marshadium-z":"Soul-Stealing 7-Star Strike",
 "mewnium-z":"Genesis Supernova","mimikium-z":"Let's Snuggle Forever",
 "pikanium-z":"Catastropika","pikashunium-z":"10,000,000 Volt Thunderbolt",
 "primarium-z":"Oceanic Operetta","snorlium-z":"Pulverizing Pancake",
 "solganium-z":"Searing Sunraze Smash","tapunium-z":"Guardian of Alola",
 "ultranecrozium-z":"Light That Burns the Sky",
});
// Powers are fixed for exclusive Z-Moves, not derived from their base attack.
const exclusiveZPower=Object.freeze({
 "aloraichium-z":175,"decidium-z":180,"incinium-z":180,
 "kommonium-z":185,"lunalium-z":200,"lycanium-z":190,
 "marshadium-z":195,"mewnium-z":185,"mimikium-z":190,
 "pikanium-z":210,"pikashunium-z":195,"primarium-z":195,
 "snorlium-z":210,"solganium-z":200,"ultranecrozium-z":200,
});
const canonicalSpecies=token=>{
 const base=token?.gimmickState?.base||token;
 const species=String(base.speciesName||"").replace(/-(?:gmax|mega(?:-[xy])?)$/,"");
 return species.startsWith("urshifu")?String(base.formName||species).replace(/-gmax$/,""):species.startsWith("toxtricity")?"toxtricity":species;
};
const safeType=move=>String(move?.type?.name||"").toLowerCase();
const isDamage=move=>["physical","special"].includes(move?.damage_class?.name);
export const battleMovePresentation=(token,move,{useZMove=false}={})=>{
 if(!token||!move?.name)return null;
 const type=safeType(move),active=normalizeGimmickState(token.gimmickState,token).active;
 if(move.name==="struggle")return {kind:"normal",label:move.name,type,power:move.power,source:move.name,secondary:"base",note:""};
 if(useZMove&&isDamage(move)){
   const label=namedZ[String(token.item||"").toLowerCase()]||typeMoves[type]?.[1];
   if(!label)return null;
   return {kind:"z",label,type,power:exclusiveZPower[String(token.item||"").toLowerCase()]??powerOverrides.z[move.name]??getZMovePower(move.power),source:move.name,
     note:"Energia Z consumida nesta batalha",secondary:"none"};
 }
 if(["dyna","gmax"].includes(active)){
   if(!isDamage(move))return {kind:"max-guard",label:"Max Guard",type:"normal",power:0,source:move.name,secondary:"guard",
      note:"Proteção Max durante esta rodada"};
   const species=canonicalSpecies(token),signature=active==="gmax"?signatures[species]:null;
   const unique=signature?.[0]===type?signature:null;
   const label=unique?.[1]||typeMoves[type]?.[0];
   if(!label)return null;
   const power=unique&&["G-Max Drum Solo","G-Max Fireball","G-Max Hydrosnipe"].includes(unique[1])?160
     :powerOverrides.max[move.name]??maxMovePower(move.power,type);
   return {kind:unique?"gmax-move":"max",label,type,power,source:move.name,
     secondary:unique?"signature":type,note:unique?"Efeito G-Max próprio da espécie":"Efeito Max por tipo"};
 }
 const teraBlast=active==="tera"&&token.teraType&&move.name==="tera-blast";
 return {kind:teraBlast?"tera-move":"normal",label:move.name,type:teraBlast?token.teraType:type,
   power:move.power||0,source:move.name,secondary:teraBlast?"tera":"base",note:teraBlast?"Tera Blast adota o Tipo Tera":""};
};
export const moveVariantForResolution=(move,presentation)=>{
 if(!presentation||presentation.kind==="normal")return move;
 if(presentation.kind==="tera-move")return {...move,type:{name:presentation.type}};
 const evoboost=presentation.label==="Extreme Evoboost", guard=presentation.kind==="max-guard";
 const isStatus=guard||evoboost;
 return {...move,name:presentation.label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,""),
   power:isStatus||presentation.label==="Guardian of Alola"?0:presentation.power,type:{name:presentation.type},
   target:{name:isStatus?"user":presentation.label==="Clangorous Soulblaze"?"all-opponents":"selected-pokemon"},
   accuracy:null,
   priority:guard?4:evoboost?0:move.priority,
   damage_class:{name:isStatus?"status":move.damage_class?.name},
   // Original move-specific flinch, recoil and status effects must not leak
   // into a completely different Z/Max move.
   effect_chance:null,stat_changes:evoboost?["attack","defense","special-attack","special-defense","speed"].map(name=>({stat:{name},change:2})):[],effect_entries:[],
   meta:{...move.meta,category:evoboost?{name:"net-good-stats"}:guard?{name:"unique"}:{name:"damage"},ailment:{name:"none"},ailment_chance:0,stat_chance:evoboost?100:0,
     flinch_chance:0,drain:0,healing:0,min_hits:null,max_hits:null,
     min_turns:null,max_turns:null,crit_rate:0},
 };
};
export const getBattleMoveLabels=({token,moves,details={}})=>{
 return (moves||[]).filter(Boolean).map(id=>{
   const move=details[id];
   const p=move?battleMovePresentation(token,move):null;
   return {id,label:p?.kind&&p.kind!=="normal"?p.label:id,kind:p?.kind||"normal"};
 });
};

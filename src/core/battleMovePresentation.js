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
const canonicalSpecies=token=>String(token?.gimmickState?.base?.speciesName||token?.speciesName||"").replace(/-(?:gmax|mega(?:-[xy])?)$/,"");
const safeType=move=>String(move?.type?.name||"").toLowerCase();
const isDamage=move=>Number(move?.power)>0&&["physical","special"].includes(move?.damage_class?.name);
export const battleMovePresentation=(token,move,{useZMove=false}={})=>{
 if(!token||!move?.name)return null;
 const type=safeType(move),active=normalizeGimmickState(token.gimmickState,token).active;
 if(useZMove&&isDamage(move)){
   const label=namedZ[String(token.item||"").toLowerCase()]||typeMoves[type]?.[1];
   if(!label)return null;
   return {kind:"z",label,type,power:getZMovePower(move.power),source:move.name,
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
     :maxMovePower(move.power);
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
 const isStatus=presentation.kind==="max-guard";
 return {...move,name:presentation.label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,""),
   power:presentation.power,type:{name:presentation.type},
   target:isStatus?{name:"user"}:move.target,
   accuracy:isStatus?null:move.accuracy,
   priority:isStatus?4:move.priority,
   damage_class:{name:isStatus?"status":move.damage_class?.name},
   // Original move-specific flinch, recoil and status effects must not leak
   // into a completely different Z/Max move.
   effect_chance:null,stat_changes:[],effect_entries:[],
   meta:{...move.meta,category:isStatus?{name:"unique"}:{name:"damage"},ailment:{name:"none"},ailment_chance:0,stat_chance:0,
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

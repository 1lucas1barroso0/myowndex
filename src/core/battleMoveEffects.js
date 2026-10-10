import { applyStageChange } from "./automation.js";

// Shared with local narration and remote authoritative combat. Effects must be
// applied only after the converted move actually connects.
const STAT_SECONDARIES=Object.freeze({
  "Max Strike":["foes","speed",-1],"Max Knuckle":["allies","attack",1],
  "Max Airstream":["allies","speed",1],"Max Ooze":["allies","special-attack",1],
  "Max Quake":["allies","special-defense",1],"Max Flutterby":["foes","special-attack",-1],
  "Max Phantasm":["foes","defense",-1],"Max Steelspike":["allies","defense",1],
  "Max Wyrmwind":["foes","attack",-1],"Max Darkness":["foes","special-defense",-1],
  "G-Max Foam Burst":["foes","speed",-2],"G-Max Tartness":["foes","evasion",-1],
});
const FIELD_SECONDARIES=Object.freeze({
  "Max Flare":{weather:"sol"},"Max Geyser":{weather:"chuva"},
  "Max Rockfall":{weather:"areia"},"Max Hailstorm":{weather:"neve"},
  "Max Lightning":{terrain:"eletrico"},"Max Overgrowth":{terrain:"gramado"},
  "Max Mindstorm":{terrain:"psiquico"},"Max Starfall":{terrain:"nevoa"},
});
const DIRECT_CONDITIONS=Object.freeze({
  "G-Max Volt Crash":"paralysis","G-Max Malodor":"poison",
});
// The other G-Max signatures have field traps, screens, duration, gender,
// probability or PP-specific rules: never misrepresent them as standard Max
// effects. Surface their actual names with a clear custom-rule prompt.
const GUIDED_SIGNATURES=new Set([
 "G-Max Vine Lash","G-Max Wildfire","G-Max Cannonade","G-Max Befuddle",
 "G-Max Gold Rush","G-Max Chi Strike","G-Max Terror","G-Max Resonance",
 "G-Max Cuddle","G-Max Replenish","G-Max Meltdown","G-Max Drum Solo",
 "G-Max Fireball","G-Max Hydrosnipe","G-Max Wind Rage","G-Max Gravitas",
 "G-Max Stonesurge","G-Max Volcalith","G-Max Sandblast","G-Max Stun Shock",
 "G-Max Centiferno","G-Max Smite","G-Max Snooze","G-Max Steelsurge",
 "G-Max Depletion","G-Max One Blow","G-Max Rapid Flow",
]);
const safeSide=token=>token?.side||"neutral";
export const applyMaxMoveSecondary=({tokens,attackerId,presentation,connected})=>{
  if(!presentation||!connected||!["max","gmax-move"].includes(presentation.kind))
    return {tokens,field:{},notes:[]};
  const user=tokens.find(t=>t.id===attackerId);
  if(!user)return {tokens,field:{},notes:[]};
  const label=presentation.label;
  const notes=[];
  let updated=tokens;
  const stages=STAT_SECONDARIES[label];
  if(stages){
    const [side,stat,delta]=stages;
    updated=updated.map(token=>{
      if(token.currentHp<=0||token.hidden||token.captured)return token;
      const friendly=safeSide(token)===safeSide(user);
      if((side==="allies"&&!friendly)||(side==="foes"&&friendly))return token;
      return applyStageChange(token,stat,delta);
    });
    notes.push(`${label}: ${stat} ${delta>0?"+":""}${delta} na equipe afetada.`);
  }
  const condition=DIRECT_CONDITIONS[label];
  if(condition){
    updated=updated.map(token=>{
      if(token.currentHp<=0||token.hidden||token.captured||safeSide(token)===safeSide(user)||token.status)return token;
      if(condition==="paralysis"&&token.types?.includes("electric"))return token;
      if(condition==="poison"&&(token.types?.includes("poison")||token.types?.includes("steel")))return token;
      return {...token,status:condition};
    });
    notes.push(`${label}: ${condition} nos oponentes elegíveis.`);
  }
  if(label==="G-Max Sweetness"){
    updated=updated.map(token=>safeSide(token)===safeSide(user)?{...token,status:"",sleepTurns:null,freezeTurns:null,toxicCounter:0}:token);
    notes.push("G-Max Sweetness: condições da equipe removidas.");
  }
  if(label==="G-Max Finale"){
    updated=updated.map(token=>{
      if(safeSide(token)!==safeSide(user)||token.currentHp<=0)return token;
      return {...token,currentHp:Math.min(token.maxHp,token.currentHp+Math.max(1,Math.floor(token.maxHp/6)))};
    });
    notes.push("G-Max Finale: aliados recuperaram 1/6 do HP máximo.");
  }
  if(GUIDED_SIGNATURES.has(label))notes.push(`${label}: efeito secundário específico requer arbitragem do Narrador; o dano e o PP foram resolvidos automaticamente.`);
  return {tokens:updated,field:FIELD_SECONDARIES[label]||{},notes};
};

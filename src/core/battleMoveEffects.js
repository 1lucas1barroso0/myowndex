import { applyStageChange, getStatusBlockReason, normalizeVolatileEffects } from "./automation.js";
import { confusionDuration } from "./battleConditions.js";
import { isAbilityActive } from "./traitMechanics.js";
import { randomUnit } from "./random.js";

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
 "G-Max Vine Lash","G-Max Wildfire","G-Max Cannonade",
 "G-Max Gold Rush","G-Max Chi Strike","G-Max Terror","G-Max Resonance",
 "G-Max Cuddle","G-Max Replenish","G-Max Meltdown","G-Max Drum Solo",
 "G-Max Fireball","G-Max Hydrosnipe","G-Max Wind Rage","G-Max Gravitas",
 "G-Max Stonesurge","G-Max Volcalith","G-Max Sandblast",
 "G-Max Centiferno","G-Max Steelsurge",
 "G-Max Depletion","G-Max One Blow","G-Max Rapid Flow",
]);
const safeSide=token=>token?.side||"neutral";
const lingering=Object.freeze({
 "G-Max Vine Lash":"grass","G-Max Wildfire":"fire",
 "G-Max Cannonade":"water","G-Max Volcalith":"rock",
});
// Original G-Max signatures have mutually exclusive, species-specific status
// effects. They must not inherit their normal Max Move secondaries.
const RANDOM_STATUS=Object.freeze({
  "G-Max Befuddle":["poison","paralysis","sleep"],
  "G-Max Stun Shock":["poison","paralysis"],
});
const CONFUSION_SIGNATURES=new Set(["G-Max Smite","G-Max Gold Rush"]);
const draw=(random,range)=>{
  const value=Number(random());
  return Math.min(range-1,Math.floor(Math.max(0,Math.min(0.9999999999999999,Number.isFinite(value)?value:0))*range));
};
export const applyMaxMoveSecondary=({tokens,attackerId,presentation,connected,terrain="nenhum",targetId="",random=()=>randomUnit()})=>{
  if(!presentation||!connected||!["max","gmax-move"].includes(presentation.kind))
    return {tokens,field:{},hazards:[],notes:[]};
  const user=tokens.find(t=>t.id===attackerId);
  if(!user)return {tokens,field:{},hazards:[],notes:[]};
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
      if(getStatusBlockReason(condition,token,user,{terrain}))return token;
      return {...token,status:condition};
    });
    notes.push(`${label}: ${condition} nos oponentes elegíveis.`);
  }
  const randomStatus=RANDOM_STATUS[label];
  if(randomStatus){
    updated=updated.map(token=>{
      if(token.currentHp<=0||token.hidden||token.captured||safeSide(token)===safeSide(user)||token.status)return token;
      const selected=randomStatus[draw(random,randomStatus.length)];
      if(getStatusBlockReason(selected,token,user,{terrain}))return token;
      return {...token,status:selected};
    });
    notes.push(`${label}: condição escolhida separadamente para cada adversário elegível.`);
  }
  if(CONFUSION_SIGNATURES.has(label)){
    updated=updated.map(token=>{
      if(token.currentHp<=0||token.hidden||token.captured||safeSide(token)===safeSide(user)
        ||(isAbilityActive(token)&&token.ability==="own-tempo"))return token;
      const effects=normalizeVolatileEffects(token.volatileEffects);
      if(effects.some(effect=>effect.id==="confusion"))return token;
      return {...token,volatileEffects:[...effects,{id:"confusion",sourceMove:label.toLowerCase().replace(/[^a-z0-9]+/g,"-"),turns:confusionDuration(random)}]};
    });
    notes.push(`${label}: confusão aplicada aos adversários elegíveis.`);
  }
  if(label==="G-Max Snooze"){
    updated=updated.map(token=>{
      if(token.id!==targetId||token.currentHp<=0||token.hidden||token.captured||safeSide(token)===safeSide(user)||token.status)return token;
      if(draw(random,2)!==0)return token;
      const effects=normalizeVolatileEffects(token.volatileEffects);
      if(effects.some(effect=>effect.id==="yawn"))return token;
      return {...token,volatileEffects:[...effects,{id:"yawn",sourceMove:"g-max-snooze",turns:2}]};
    });
    notes.push("G-Max Snooze: somente o alvo atingido tem 50% de chance de ficar sonolento.");
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
  const type=lingering[label];
  const hazards=type && user.side!=="neutral"
    ?[{id:label.toLowerCase().replace(/[^a-z0-9]+/g,"-"),label,side:user.side==="ally"?"opponent":"ally",type,turns:4}]
    : [];
  if(hazards.length)notes.push(`${label}: 4 rodadas de dano residual nos adversários que não são do tipo ${type}.`);
  if(GUIDED_SIGNATURES.has(label)&&!hazards.length)notes.push(`${label}: efeito secundário específico requer arbitragem do Narrador; o dano e o PP foram resolvidos automaticamente.`);
  return {tokens:updated,field:FIELD_SECONDARIES[label]||{},hazards,notes};
};

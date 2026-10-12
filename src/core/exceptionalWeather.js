// Extraordinary weather derives from living, unsuppressed Pokémon abilities.
export const SPECIAL_WEATHERS=Object.freeze({
 "primordial-sea":"chuva-intensa","desolate-land":"sol-extremo","delta-stream":"ventos-fortes",
});
const isEnabled=token=>Number(token?.currentHp)>0
  && !token?.traitState?.ability?.suppressed;
export const weatherIsExtraordinary=value=>["chuva-intensa","sol-extremo","ventos-fortes"].includes(value);
export const getSpecialWeather=tokens=>{
 const sources=(Array.isArray(tokens)?tokens:[]).filter(token=>isEnabled(token)&&SPECIAL_WEATHERS[token.ability]);
 const latest=sources.reduce((best,token)=>!best||Number(token.enteredRound||0)>=Number(best.enteredRound||0)?token:best,null);
 return latest?SPECIAL_WEATHERS[latest.ability]:"";
};
export const resolveExceptionalWeather=(weather,tokens)=>{
 const special=getSpecialWeather(tokens);
 return special||(weatherIsExtraordinary(weather)?"limpo":weather||"limpo");
};
export const ordinaryWeather=weather=>weather==="chuva-intensa"?"chuva":
  weather==="sol-extremo"?"sol":weather==="ventos-fortes"?"limpo":weather;
export const specialWeatherMoveBlocked=({weather,moveType,weatherSuppressed=false})=>!weatherSuppressed
  && ((weather==="chuva-intensa"&&moveType==="fire")||(weather==="sol-extremo"&&moveType==="water"));
export const specialWeatherFlyingDefense=({weather,defender,moveType})=>
 weather==="ventos-fortes" && (!defender?.teraActive||defender?.teraType==="stellar")
 && defender?.types?.includes("flying")&&["electric","ice","rock"].includes(moveType)?0.5:1;

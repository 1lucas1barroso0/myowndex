export const SPECIAL_WEATHERS=Object.freeze({'primordial-sea':'chuva-intensa','desolate-land':'sol-extremo','delta-stream':'ventos-fortes'});
const active=t=>t?.currentHp>0&&!t.traitState?.ability?.suppressed;
export const getSpecialWeather=tokens=>{
 const providers=(Array.isArray(tokens)?tokens:[]).filter(t=>active(t)&&SPECIAL_WEATHERS[t.ability]);
 const latest=providers.reduce((winner,token)=>!winner||Number(token.enteredRound||0)>=Number(winner.enteredRound||0)?token:winner,null);
 return latest?SPECIAL_WEATHERS[latest.ability]:'';
};
export const resolveExceptionalWeather=(weather,tokens)=>getSpecialWeather(tokens)||(['chuva-intensa','sol-extremo','ventos-fortes'].includes(weather)?'limpo':weather||'limpo');
export const ordinaryWeather=weather=>weather==='chuva-intensa'?'chuva':weather==='sol-extremo'?'sol':weather==='ventos-fortes'?'limpo':weather;
export const specialWeatherMoveBlocked=({weather,moveType,weatherSuppressed=false})=>!weatherSuppressed&&((weather==='chuva-intensa'&&moveType==='fire')||(weather==='sol-extremo'&&moveType==='water'));
export const specialWeatherFlyingDefense=({weather,defender,moveType})=>weather==='ventos-fortes'&&(!defender?.teraActive||defender?.teraType==='stellar')&&defender?.types?.includes('flying')&&['electric','ice','rock'].includes(moveType)?0.5:1;

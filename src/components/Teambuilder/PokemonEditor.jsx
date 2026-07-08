import React, { useState, useEffect, useMemo } from 'react';
import { fetchCached, calculateStat, formatName, convertToTTRPG, NATURES, STAT_MAP, TYPES, filterMovesByLatestVersion } from '../../core/mechanics';

export default function PokemonEditor({ pk, updatePk, envProps }) {
    const { allItems, allMoves, allAbilities, onRemove, isTTRPG, isHackmon } = envProps;
    const [baseForm, setBaseForm] = useState(null);

    const isNativeGMax = Boolean(pk.species?.name?.includes('-gmax'));

    useEffect(() => { if (isNativeGMax && !pk.canGMax) updatePk({ ...pk, canGMax: true }); }, [pk.species?.name, pk.canGMax, isNativeGMax]);

    useEffect(() => {
        let mounted = true;
        const checkBase = async () => {
            if(!pk.species?.species?.url) return;
            const sp = await fetchCached(pk.species.species.url);
            if(!sp || !mounted) return;
            const defVar = sp.varieties?.find(v => v.is_default);
            if(defVar && defVar.pokemon?.name !== pk.species.name) {
                const bData = await fetchCached(defVar.pokemon.url);
                if(mounted) setBaseForm(bData);
            } else setBaseForm(null);
        }; checkBase();
        return () => { mounted = false; };
    }, [pk.species?.name]);

    const validMoves = useMemo(() => {
        if (isHackmon) return allMoves;
        const processed = filterMovesByLatestVersion(pk.species?.moves || []);
        return processed.map(m => m.move);
    }, [isHackmon, allMoves, pk.species?.moves]);

    const validAbs = useMemo(() => {
        if (isHackmon) return allAbilities;
        const map = new Map();
        pk.species?.abilities?.forEach(a => { if (a?.ability?.name) map.set(a.ability.name, a.ability) });
        if (map.size === 0 && baseForm?.abilities) baseForm.abilities.forEach(a => { if (a?.ability?.name) map.set(a.ability.name, a.ability) });
        return Array.from(map.values()).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    }, [isHackmon, allAbilities, pk.species?.abilities, baseForm]);

    const cleanItems = useMemo(() => {
        if (!allItems) return [];
        const trash = [
            "candy", "mint", "mulch", "apricorn", "mail", "ticket", "pass", "key", "card", 
            "permit", "charm", "petal", "lure", "fossil", "potion", "elixir", "repel", 
            "revive", "heal", "soda", "lemonade", "moomoo", "mushroom", "flute", 
            "shard", "fused", "crest", "x-", "dire-", "guard-", "ingredient", 
            "sauce", "apple", "cheese", "curry", "lettuce", "pepper", "onion", "tomato", 
            "bacon", "prosciutto", "hamburger", "fillet", "noodle", "rice", "salt", 
            "butter", "mustard", "mayo", "vinegar", "jam", "marmalade", "oil", "cream", 
            "yogurt", "wasabi", "extract", "pickles", "sausage", "plant", "drop", "nectar", 
            "syrup", "sweet", "treasure", "relic", "nugget", "pearl", "stardust", "piece", 
            "comet", "feather", "shoal", "bottle", "spray", "scent"
        ];
        return allItems
            .map(i => typeof i === "string" ? i : (i?.name || ""))
            .filter(name => {
                if (!name) return false;
                const n = name.toLowerCase();
                if (/^(tm|hm|tr)\d/.test(n)) return false;
                for (let i = 0; i < trash.length; i++) {
                    if (n.includes(trash[i])) return false;
                }
                if (/(master|ultra|great|poke|safari|net|dive|nest|repeat|timer|luxury|premier|dusk|heal|quick|cherish|fast|level|lure|heavy|love|friend|moon|sport|dream|beast)-ball$/.test(n)) return false;
                return true;
            })
            .slice(0, 450);
    }, [allItems]);

    const handleChange = (cat, stat, val) => {
        if (val === '') { updatePk({ ...pk, [cat]: { ...(pk[cat] || {}), [stat]: '' } }); return; }
        let v = parseInt(val) || 0;
        if (v < 0) v = 0;
        if (cat === 'evs') {
            v = Math.min(v, 252);
            const rem = Object.entries(pk.evs || {}).reduce((s, [k, ev]) => k !== stat ? s + (parseInt(ev)||0) : s, 0);
            if (rem + v > 510) v = 510 - rem;
        } else if (cat === 'ivs') v = Math.min(v, 31);
        updatePk({ ...pk, [cat]: { ...(pk[cat] || {}), [stat]: v } });
    };

    const currentGenderRate = Number(pk.genderRate ?? pk.species?.gender_rate ?? -1);
    const randomize = (t) => {
        if (t === 'ivs') updatePk({ ...pk, ivs: { hp: Math.floor(Math.random()*32), attack: Math.floor(Math.random()*32), defense: Math.floor(Math.random()*32), "special-attack": Math.floor(Math.random()*32), "special-defense": Math.floor(Math.random()*32), speed: Math.floor(Math.random()*32) } });
        else if (t === 'nature') updatePk({ ...pk, nature: Object.keys(NATURES)[Math.floor(Math.random() * 25)] });
        else if (t === 'gender') {
            if (currentGenderRate === -1) return;
            if (currentGenderRate === 0) { updatePk({ ...pk, gender: 'M', genderRate: 0 }); return; }
            if (currentGenderRate === 8) { updatePk({ ...pk, gender: 'F', genderRate: 8 }); return; }
            const result = (Math.random() * 8) < currentGenderRate ? 'F' : 'M';
            updatePk({ ...pk, gender: result, genderRate: currentGenderRate });
        }
    };

    const getMulti = (sN) => { const n = NATURES[pk.nature || 'hardy']; return !n ? 1 : n.up === sN ? 1.1 : n.down === sN ? 0.9 : 1; };

    const evTotal = Object.values(pk.evs || {}).reduce((s, v) => s + (parseInt(v)||0), 0);
    const sprite = pk.species?.sprites?.other?.['official-artwork']?.front_default || pk.species?.sprites?.front_default;
    const customT = isHackmon && pk.customTypes ? pk.customTypes : (pk.species?.types?.map(t => t.type?.name) || []);

    return (
        <div className="game-panel p-4 sm:p-6 lg:p-8 mt-6 animate-fade-in relative overflow-hidden">
            <datalist id="eItems">{cleanItems.map(v => <option key={"item-" + v} value={v}></option>)}</datalist>
            <datalist id="eAbs">{validAbs.map(a => { const v = typeof a === "string" ? a : (a?.name || ""); return v ? <option key={"ab-" + v} value={v}></option> : null; })}</datalist>
            <datalist id="eMvs">{validMoves.map(m => { const v = typeof m === "string" ? m : (m?.name || ""); return v ? <option key={"mv-" + v} value={v}></option> : null; })}</datalist>
            <datalist id="eTera">{TYPES.map(t => { const v = typeof t === "string" ? t : (t?.name || t); return v ? <option key={"tr-" + v} value={v}></option> : null; })}</datalist>
            
            <div className="flex flex-col xl:flex-row justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 border-b-2 border-slate-200 pb-5 sm:pb-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center w-full min-w-0">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 bg-slate-50 rounded-2xl border-4 border-slate-200 flex justify-center items-center flex-shrink-0 relative shadow-inner">
                        {pk.canGMax && <div className="absolute inset-0 bg-red-500/10 rounded-xl animate-pulse"></div>}
                        {sprite ? <img src={sprite} className="w-full h-full p-2 object-contain drop-shadow-md relative z-10" /> : <span className="text-[10px] text-slate-400 font-black uppercase">---</span>}
                    </div>
                    
                    <div className="flex flex-col gap-2 sm:gap-3 w-full min-w-0">
                        <div className="flex flex-col w-full min-w-0">
                            <input 
                                type="text" 
                                value={pk.nickname !== undefined ? pk.nickname : formatName(pk.species?.name || "")} 
                                onChange={e => updatePk({...pk, nickname: e.target.value})} 
                                className="bg-transparent text-2xl sm:text-3xl font-black text-slate-800 focus:outline-none w-full min-w-0 tracking-tight border-b-2 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-0.5 truncate capitalize placeholder-slate-300" 
                                placeholder={formatName(pk.species?.name || "")}
                                title="Edit Nickname"
                            />
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                                {formatName(pk.species?.name || "")} {pk.species?.name?.includes('-') ? "(" + pk.species.name.substring(pk.species.name.indexOf('-') + 1).replace(/-/g, ' ') + ")" : ""}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm">
                                <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Level</label>
                                <input type="number" min="1" max={isHackmon?200:100} value={pk.level===''? '':pk.level} onChange={e => updatePk({...pk, level: e.target.value===''? '':Math.min(parseInt(e.target.value)||1, isHackmon?200:100)})} className="w-10 sm:w-12 bg-transparent text-slate-800 text-xs sm:text-sm font-black focus:outline-none text-center" />
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm">
                                <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Friendship</label>
                                <input type="number" min="0" max="255" value={pk.friendship===''? '':pk.friendship} onChange={e => updatePk({...pk, friendship: e.target.value===''? '':Math.min(parseInt(e.target.value)||0, 255)})} className="w-10 sm:w-12 bg-transparent text-slate-800 text-xs sm:text-sm font-black focus:outline-none text-center" />
                                {isTTRPG && <span className="text-[10px] sm:text-xs font-black text-red-500 border-l-2 border-slate-200 pl-2 sm:pl-3 ml-0.5 sm:ml-1">{Math.ceil((pk.friendship||0)/20)}</span>}
                            </div>
                            <label className={"flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-slate-200 transition-colors shadow-sm " + (isNativeGMax ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-red-400")}>
                                <div className={"w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border-2 flex items-center justify-center " + (pk.canGMax ? "bg-red-500 border-red-500" : "bg-white border-slate-300")}>{pk.canGMax && <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}</div>
                                <span className={"text-[9px] sm:text-[10px] font-black uppercase tracking-widest " + (pk.canGMax ? "text-red-500" : "text-slate-500")}>G-Max</span>
                                <input type="checkbox" className="hidden" checked={pk.canGMax||false} disabled={isNativeGMax} onChange={e => updatePk({...pk, canGMax: e.target.checked})} />
                            </label>
                            {isHackmon && (
                                <div className="flex gap-1.5 ml-1">
                                    {[0, 1].map(idx => <select key={idx} value={customT[idx] || ''} onChange={e => { const nT = [...customT]; nT[idx] = e.target.value; updatePk({...pk, customTypes: nT.filter(Boolean)}); }} className="bg-purple-50 border-2 border-purple-200 rounded-lg text-[10px] text-purple-600 uppercase font-black px-2 py-1 outline-none shadow-sm"><option value=""></option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <button onClick={onRemove} className="w-full xl:w-auto flex items-center justify-center gap-2 self-stretch xl:self-start px-4 py-3 xl:py-2.5 mt-2 xl:mt-0 bg-white text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 border-2 border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm outline-none shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Remove Partner
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-10">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Held Item</label><input list="eItems" value={pk.item||''} onChange={e=>updatePk({...pk, item:(e.target.value||'').toLowerCase()})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-black focus-within:border-blue-400 outline-none capitalize shadow-inner" /></div>
                        <div><label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 pl-1">Tera Type</label><input list="eTera" value={pk.teraType||''} onChange={e=>updatePk({...pk, teraType:(e.target.value||'').toLowerCase()})} className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3 text-blue-800 text-sm font-black focus:border-blue-500 outline-none capitalize shadow-inner" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Current Ability</label><input list="eAbs" value={pk.ability||''} onChange={e=>updatePk({...pk, ability:(e.target.value||'').toLowerCase()})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-black focus:border-blue-400 outline-none capitalize shadow-inner" /></div>
                        <div className="relative">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Nature</label>
                            <select value={pk.nature||'hardy'} onChange={e=>updatePk({...pk, nature:e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-black focus:border-blue-400 outline-none capitalize appearance-none shadow-inner">
                                {Object.keys(NATURES).map(n => <option key={n} value={n}>{n} {NATURES[n].up ? "(+" + STAT_MAP[NATURES[n].up] + ", -" + STAT_MAP[NATURES[n].down] + ")" : ""}</option>)}
                            </select>
                            <button onClick={()=>randomize('nature')} className="absolute right-4 top-[36px] text-slate-400 hover:text-blue-500 text-lg outline-none">🎲</button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Gender</label>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 p-2 shadow-inner">
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => updatePk({...pk, gender: 'M', genderRate: currentGenderRate})} disabled={currentGenderRate === 8} className={"flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all " + (pk.gender === 'M' ? "bg-blue-500 text-white shadow-[0_3px_0_#1d4ed8]" : "text-slate-600 disabled:opacity-30 hover:bg-blue-100")}>
                                    <span className="text-sm sm:text-base">♂</span><span>Male</span>
                                </button>
                                <button type="button" onClick={() => updatePk({...pk, gender: 'F', genderRate: currentGenderRate})} disabled={currentGenderRate === 0} className={"flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all " + (pk.gender === 'F' ? "bg-pink-500 text-white shadow-[0_3px_0_#be185d]" : "text-slate-600 disabled:opacity-30 hover:bg-pink-100")}>
                                    <span className="text-sm sm:text-base">♀</span><span>Female</span>
                                </button>
                                <button type="button" onClick={() => updatePk({...pk, gender: 'N', genderRate: currentGenderRate})} className={"flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all " + (pk.gender === 'N' ? "bg-slate-500 text-white shadow-[0_3px_0_#475569]" : "text-slate-600 hover:bg-slate-200")}>
                                    <span className="text-sm sm:text-base">⚲</span><span>Neutral</span>
                                </button>
                            </div>
                            <button type="button" onClick={() => randomize('gender')} className="rounded-xl px-3 py-2 text-sm font-black text-slate-500 transition-all hover:bg-blue-100 hover:text-blue-600 outline-none">🎲</button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1 flex justify-between"><span>Moves</span><span className="bg-slate-200 px-2 py-0.5 rounded text-slate-600">{pk.moves?.filter(Boolean).length||0}/4</span></label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[0,1,2,3].map(i=><input key={i} list="eMvs" value={pk.moves?.[i]||''} onChange={e=>{const n=[...(pk.moves||[])]; n[i]=(e.target.value||'').toLowerCase(); updatePk({...pk, moves:n});}} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-black focus:border-blue-400 outline-none capitalize shadow-inner" />)}</div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-sm mt-2 sm:mt-0">
                    <div className="flex justify-between items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b-2 border-slate-200">
                        <div className="flex items-center gap-3">
                            <h3 className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest">Training</h3>
                            <button onClick={() => randomize('ivs')} className="sm:hidden flex items-center gap-1 text-[9px] font-black text-slate-500 hover:text-blue-500 transition-colors outline-none bg-white px-2 py-1 rounded-md border-2 border-slate-200 shadow-sm active:translate-y-px">
                                IVs 🎲
                            </button>
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border-2 border-slate-200 shadow-sm">
                            Free EVs: <span className={evTotal > 508 ? "text-red-500" : "text-blue-500"}>{510 - evTotal}</span>/510
                        </div>
                    </div>
          

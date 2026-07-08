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

    const getHpBeforeAfter = () => {
        const b = isHackmon && pk.customStats?.['hp'] !== undefined ? pk.customStats['hp'] : (pk.species?.stats?.find(s=>s.stat.name==='hp')?.base_stat || 0);
        const e = pk.evs?.['hp'] || 0; const i = pk.ivs?.['hp'] || 0;
        const calc = calculateStat(b, e, i, pk.level, 1, true, pk.species?.name);
        const dyna = pk.species?.name?.toLowerCase() === 'shedinja' ? 1 : calc * 2;
        return { base: isTTRPG ? convertToTTRPG(calc, true) : calc, gmax: isTTRPG ? convertToTTRPG(dyna, true) : dyna };
    };

    const evTotal = Object.values(pk.evs || {}).reduce((s, v) => s + (parseInt(v)||0), 0);
    const sprite = pk.species?.sprites?.other?.['official-artwork']?.front_default || pk.species?.sprites?.front_default;
    const customT = isHackmon && pk.customTypes ? pk.customTypes : (pk.species?.types?.map(t => t.type?.name) || []);
    const hasStructuralShift = baseForm && ((baseForm.types?.map(t=>t.type?.name).join() !== pk.species?.types?.map(t=>t.type?.name).join()) || (baseForm.abilities?.[0]?.ability?.name !== pk.species?.abilities?.[0]?.ability?.name) || (baseForm.stats?.some((s, idx) => s.base_stat !== pk.species?.stats?.[idx]?.base_stat)));

    return (
        <div className="game-panel p-4 sm:p-6 lg:p-8 mt-6 animate-fade-in relative overflow-hidden">
            <datalist id="eItems">{allItems.map(i => <option key={i.name} value={i.name} />)}</datalist>
            <datalist id="eAbs">{validAbs.map(a => <option key={a.name} value={a.name} />)}</datalist>
            <datalist id="eMvs">{validMoves.map(m => <option key={m.name} value={m.name} />)}</datalist>
            <datalist id="eTera">{TYPES.map(t => <option key={t} value={t} />)}</datalist>
            
            <div className="flex flex-col md:flex-row justify-between gap-6 mb-8 border-b-2 border-slate-200 pb-6">
                <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-50 rounded-2xl border-4 border-slate-200 flex justify-center items-center flex-shrink-0 relative shadow-inner">
                        {pk.canGMax && <div className="absolute inset-0 bg-red-500/10 rounded-xl animate-pulse"></div>}
                        {sprite ? <img src={sprite} className="w-24 h-24 object-contain drop-shadow-md relative z-10" /> : <span className="text-[10px] text-slate-400 font-black uppercase">---</span>}
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <h3 className="text-3xl font-black capitalize text-slate-800 tracking-tight">{formatName(pk.species?.name)}</h3>
                            {isHackmon && (
                                <div className="flex gap-1.5 ml-2">
                                    {[0, 1].map(i => <select key={i} value={customT[i] || ''} onChange={e => { const nT = [...customT]; nT[i] = e.target.value; updatePk({...pk, customTypes: nT.filter(Boolean)}); }} className="bg-purple-50 border-2 border-purple-200 rounded-lg text-[10px] text-purple-600 uppercase font-black px-2 py-1 outline-none shadow-sm"><option value=""></option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>)}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Level</label><input type="number" min="1" max={isHackmon?200:100} value={pk.level===''? '':pk.level} onChange={e => updatePk({...pk, level: e.target.value===''? '':Math.min(parseInt(e.target.value)||1, isHackmon?200:100)})} className="w-12 bg-transparent text-slate-800 text-sm font-black focus:outline-none text-center" /></div>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Friendship</label><input type="number" min="0" max="255" value={pk.friendship===''? '':pk.friendship} onChange={e => updatePk({...pk, friendship: e.target.value===''? '':Math.min(parseInt(e.target.value)||0, 255)})} className="w-12 bg-transparent text-slate-800 text-sm font-black focus:outline-none text-center" />{isTTRPG && <span className="text-xs font-black text-red-500 border-l-2 border-slate-200 pl-3 ml-1">{Math.ceil((pk.friendship||0)/20)}</span>}</div>
                            <label className={"flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border-2 border-slate-200 transition-colors shadow-sm " + (isNativeGMax ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-red-400")}>
                                <div className={"w-4 h-4 rounded-md border-2 flex items-center justify-center " + (pk.canGMax ? "bg-red-500 border-red-500" : "bg-white border-slate-300")}>{pk.canGMax && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}</div>
                                <span className={"text-[10px] font-black uppercase tracking-widest " + (pk.canGMax ? "text-red-500" : "text-slate-500")}>G-Max Factor</span>
                                <input type="checkbox" className="hidden" checked={pk.canGMax||false} disabled={isNativeGMax} onChange={e => updatePk({...pk, canGMax: e.target.checked})} />
                            </label>
                        </div>
                    </div>
                </div>
                <button onClick={onRemove} className="self-start px-4 py-2 bg-white text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 border-2 border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm outline-none">Remove Partner</button>
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
                    
                    {/* Responsive gender selection controls */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Gender</label>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 p-2 shadow-inner">
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => updatePk({...pk, gender: 'M', genderRate: currentGenderRate})} disabled={currentGenderRate === 8} className={"flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all " + (pk.gender === 'M' ? "bg-blue-500 text-white shadow-[0_3px_0_#1d4ed8]" : "text-slate-600 disabled:opacity-30 hover:bg-blue-100")}>
                                    <span className="text-base">♂</span>
                                    <span>Male</span>
                                </button>
                                <button type="button" onClick={() => updatePk({...pk, gender: 'F', genderRate: currentGenderRate})} disabled={currentGenderRate === 0} className={"flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all " + (pk.gender === 'F' ? "bg-pink-500 text-white shadow-[0_3px_0_#be185d]" : "text-slate-600 disabled:opacity-30 hover:bg-pink-100")}>
                                    <span className="text-base">♀</span>
                                    <span>Female</span>
                                </button>
                                <button type="button" onClick={() => updatePk({...pk, gender: 'N', genderRate: currentGenderRate})} className={"flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all " + (pk.gender === 'N' ? "bg-slate-500 text-white shadow-[0_3px_0_#475569]" : "text-slate-600 hover:bg-slate-200")}>
                                    <span className="text-base">⚲</span>
                                    <span>Neutral</span>
                                </button>
                            </div>
                            <button type="button" onClick={() => randomize('gender')} className="rounded-xl px-3 py-2 text-sm font-black text-slate-500 transition-all hover:bg-blue-100 hover:text-blue-600" title="Randomize Gender">🎲</button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1 flex justify-between"><span>Moves</span><span className="bg-slate-200 px-2 py-0.5 rounded text-slate-600">{pk.moves?.filter(Boolean).length||0}/4</span></label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[0,1,2,3].map(i=><input key={i} list="eMvs" value={pk.moves?.[i]||''} onChange={e=>{const n=[...(pk.moves||[])]; n[i]=(e.target.value||'').toLowerCase(); updatePk({...pk, moves:n});}} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-black focus:border-blue-400 outline-none capitalize shadow-inner" />)}</div>
                    </div>
                </div>

                {/* THE FLUID TRAINING SECTION */}
                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-sm mt-2 sm:mt-0">
                    <div className="flex justify-between items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b-2 border-slate-200">
                        <h3 className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest">Training</h3>
                        <div className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border-2 border-slate-200 shadow-sm">
                            Free EVs: <span className={evTotal > 508 ? "text-red-500" : "text-blue-500"}>{510 - evTotal}</span>/510
                        </div>
                    </div>
                    
                    <div className="w-full">
                        {/* Headers (Desktop apenas) */}
                        <div className="hidden sm:flex items-center gap-2 mb-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center px-2">
                            <div className="w-12 text-left">Stat</div>
                            <div className="w-10">Base</div>
                            <div className="flex-1 text-left">Effort (EVs)</div>
                            <div className="w-12 cursor-pointer hover:text-blue-500 flex items-center justify-center gap-1 transition-colors" onClick={() => randomize('ivs')}>IVs 🎲</div>
                            <div className={"w-12 text-right " + (isTTRPG ? "text-red-500" : "text-slate-800")}>Total</div>
                        </div>
                        
                        <div className="flex flex-col gap-2.5">
                            {pk.species?.stats?.map(s => {
                                const sN = s.stat?.name;
                                if (!sN) return null;
                                const base = isHackmon && pk.customStats?.[sN] !== undefined ? pk.customStats[sN] : (s.base_stat || 0);
                                const ev = pk.evs?.[sN] ?? 0; const iv = pk.ivs?.[sN] ?? 31; const multi = getMulti(sN);
                                const rawVal = calculateStat(base, ev, iv, pk.level, multi, sN === 'hp', pk.species?.name);
                                const finalVal = isTTRPG ? convertToTTRPG(rawVal, sN === 'hp') : rawVal;
                                
                                let cCol = "text-slate-800";
                                if (isTTRPG) cCol = "text-red-600";
                                else if (multi > 1) cCol = "text-emerald-600";
                                else if (multi < 1) cCol = "text-red-500";
                                
                                return (
                                    <div key={sN} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-white p-3 sm:p-2.5 rounded-xl border-2 border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                        
                                        {/* Mobile Linha 1: Nome do Stat e Valor Final */}
                                        <div className="flex justify-between items-center w-full sm:w-12 shrink-0">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{STAT_MAP[sN] || sN}</span>
                                            <div className={"sm:hidden text-sm font-black flex items-center gap-1 " + cCol}>
                                                {!isTTRPG && multi > 1 && <span className="text-emerald-500">↑</span>}
                                                {!isTTRPG && multi < 1 && <span className="text-red-500">↓</span>}
                                                {finalVal}
                                            </div>
                                        </div>
                                        
                                        {/* Mobile Linha 2 / Desktop: Inputs */}
                                        <div className="flex items-center justify-between gap-2 w-full sm:flex-1">
                                            {/* Base */}
                                            <div className="w-10 flex justify-center shrink-0">
                                                {isHackmon ? (
                                                    <input type="number" min="1" max="255" value={base === '' ? '' : base} onChange={e => updatePk({...pk, customStats: {...(pk.customStats || {}), [sN]: e.target.value === '' ? '' : parseInt(e.target.value)}})} className="w-full bg-purple-50 border-2 border-purple-200 rounded p-1 text-purple-700 text-[10px] font-black text-center outline-none focus:border-purple-500" />
                                                ) : (
                                                    <div className="text-[11px] font-black text-slate-700">{base}</div>
                                                )}
                                            </div>
                                            
                                            {/* EVs */}
                                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                                <input type="range" min="0" max="252" step="4" value={ev === '' ? 0 : ev} onChange={e => handleChange('evs', sN, e.target.value)} className="w-full min-w-0 accent-red-500" />
                                                <input type="number" min="0" max="252" value={ev === '' ? '' : ev} onChange={e => handleChange('evs', sN, e.target.value)} className="w-11 shrink-0 bg-slate-50 border-2 border-slate-200 rounded-lg p-1 text-slate-800 text-[10px] text-center outline-none font-black focus:border-blue-400" />
                                            </div>
                                            
                                            {/* IVs */}
                                            <div className="w-10 sm:w-12 flex justify-center shrink-0">
                                                <input type="number" min="0" max="31" value={iv === '' ? '' : iv} onChange={e => handleChange('ivs', sN, e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg p-1 text-slate-800 text-[10px] text-center outline-none font-black focus:border-blue-400" />
                                            </div>
                                        </div>

                                        {/* Valor Final (Apenas Desktop) */}
                                        <div className={"hidden sm:flex w-12 justify-end items-center gap-1 text-sm font-black shrink-0 " + cCol}>
                                            {!isTTRPG && multi > 1 && <span className="text-emerald-500">↑</span>}
                                            {!isTTRPG && multi < 1 && <span className="text-red-500">↓</span>}
                                            {finalVal}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCached, calculateStat, formatName, convertToTTRPG, NATURES, STAT_MAP, TYPES } from '../../core/mechanics';

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

    const validMoves = useMemo(() => isHackmon ? allMoves : pk.species?.moves?.map(m => m.move).filter(Boolean) || [], [isHackmon, allMoves, pk.species?.moves]);
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

    const randomize = (t) => {
        if (t === 'ivs') updatePk({ ...pk, ivs: { hp: Math.floor(Math.random()*32), attack: Math.floor(Math.random()*32), defense: Math.floor(Math.random()*32), 'special-attack': Math.floor(Math.random()*32), 'special-defense': Math.floor(Math.random()*32), speed: Math.floor(Math.random()*32) } });
        else if (t === 'nature') updatePk({ ...pk, nature: Object.keys(NATURES)[Math.floor(Math.random() * 25)] });
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
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 lg:p-8 mt-6 shadow-2xl animate-fade-in relative overflow-hidden">
            <datalist id="eItems">{allItems.map(i => <option key={i.name} value={i.name} />)}</datalist>
            <datalist id="eAbs">{validAbs.map(a => <option key={a.name} value={a.name} />)}</datalist>
            <datalist id="eMvs">{validMoves.map(m => <option key={m.name} value={m.name} />)}</datalist>
            <datalist id="eTera">{TYPES.map(t => <option key={t} value={t} />)}</datalist>
            
            <div className="flex flex-col md:flex-row justify-between gap-6 mb-8 border-b border-slate-800 pb-6">
                <div className="flex gap-5 items-center">
                    <div className="w-24 h-24 bg-slate-950 rounded-2xl border border-slate-800 flex justify-center items-center flex-shrink-0 relative shadow-inner">
                        {pk.canGMax && <div className="absolute inset-0 bg-rose-500/20 rounded-2xl animate-pulse"></div>}
                        {sprite ? <img src={sprite} className="w-20 h-20 object-contain drop-shadow-xl relative z-10" /> : <span className="text-[10px] text-slate-600 font-black">N/A</span>}
                    </div>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <h3 className="text-3xl font-black capitalize text-white tracking-tight">{formatName(pk.species?.name)}</h3>
                            {isHackmon && (
                                <div className="flex gap-1.5 ml-2">
                                    {[0, 1].map(i => <select key={i} value={customT[i] || ''} onChange={e => { const nT = [...customT]; nT[i] = e.target.value; updatePk({...pk, customTypes: nT.filter(Boolean)}); }} className="bg-slate-800 border border-purple-500/50 rounded-lg text-[10px] text-purple-300 uppercase font-black px-2 py-1 outline-none shadow-sm"><option value="">{i === 1 ? '---' : 'Tipo'}</option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>)}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 shadow-inner"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nv.</label><input type="number" min="1" max={isHackmon?200:100} value={pk.level===''? '':pk.level} onChange={e => updatePk({...pk, level: e.target.value===''? '':Math.min(parseInt(e.target.value)||1, isHackmon?200:100)})} className="w-12 bg-transparent text-white text-sm font-bold focus:outline-none text-center" /></div>
                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 shadow-inner"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amizade</label><input type="number" min="0" max="255" value={pk.friendship===''? '':pk.friendship} onChange={e => updatePk({...pk, friendship: e.target.value===''? '':Math.min(parseInt(e.target.value)||0, 255)})} className="w-12 bg-transparent text-white text-sm font-bold focus:outline-none text-center" />{isTTRPG && <span className="text-xs font-black text-rose-400 border-l border-slate-600 pl-2 bg-rose-900/20 px-2 rounded">{Math.ceil((pk.friendship||0)/20)}</span>}</div>
                            <label className={`flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 transition-colors shadow-inner ${isNativeGMax ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-rose-500/50'}`}>
                                <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${pk.canGMax ? 'bg-rose-500 border-rose-500' : 'bg-slate-900 border-slate-600'}`}>{pk.canGMax && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}</div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${pk.canGMax ? 'text-rose-400' : 'text-slate-400'}`}>Fator Gigantamax</span>
                                <input type="checkbox" className="hidden" checked={pk.canGMax||false} disabled={isNativeGMax} onChange={e => updatePk({...pk, canGMax: e.target.checked})} />
                            </label>
                        </div>
                    </div>
                </div>
                <button onClick={onRemove} className="self-start px-4 py-2 bg-rose-950/30 text-rose-500 hover:bg-rose-600 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors border border-rose-900/30 outline-none">Remover da Equipe</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Item Segurado</label><input list="eItems" placeholder="" value={pk.item||''} onChange={e=>updatePk({...pk, item:(e.target.value||'').toLowerCase()})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm font-bold focus:border-blue-500 outline-none capitalize shadow-inner" /></div>
                        <div><label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 pl-1">Tera Type</label><input list="eTera" placeholder="" value={pk.teraType||''} onChange={e=>updatePk({...pk, teraType:(e.target.value||'').toLowerCase()})} className="w-full bg-slate-950 border border-blue-900/50 rounded-xl px-4 py-3 text-slate-200 text-sm font-bold focus:border-blue-500 outline-none capitalize shadow-inner" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Habilidade</label><input list="eAbs" placeholder="" value={pk.ability||''} onChange={e=>updatePk({...pk, ability:(e.target.value||'').toLowerCase()})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm font-bold focus:border-blue-500 outline-none capitalize shadow-inner" /></div>
                        <div className="relative"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Nature</label><select value={pk.nature||'hardy'} onChange={e=>updatePk({...pk, nature:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm font-bold focus:border-blue-500 outline-none capitalize appearance-none shadow-inner">{Object.keys(NATURES).map(n=><option key={n} value={n}>{n} {NATURES[n].up?`(+${STAT_MAP[NATURES[n].up]}, -${STAT_MAP[NATURES[n].down]})`:''}</option>)}</select><button onClick={()=>randomize('nature')} className="absolute right-3 top-[30px] text-slate-500 hover:text-blue-400 text-lg outline-none">🎲</button></div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Ataques</label>
                        <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map(i=><input key={i} list="eMvs" placeholder="" value={pk.moves?.[i]||''} onChange={e=>{const n=[...(pk.moves||[])]; n[i]=(e.target.value||'').toLowerCase(); updatePk({...pk, moves:n});}} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm font-bold focus:border-blue-500 outline-none capitalize shadow-inner" />)}</div>
                    </div>
                    
                    {(hasStructuralShift || pk.canGMax) && (
                        <div className="mt-4 p-5 bg-slate-950/50 rounded-2xl border border-indigo-900/40 shadow-inner">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Detalhes da Forma</h4>
                            {hasStructuralShift && (
                                <div className="flex flex-col gap-2.5 text-[10px] text-slate-300 mb-4">
                                    <div className="flex justify-between border-b border-slate-800 pb-1.5"><span className="font-bold text-slate-500">Mudança de Tipo:</span><span className="uppercase font-black">{baseForm.types?.map(t=>t.type?.name).join('/') || '---'} <span className="text-indigo-400 mx-1">➔</span> {pk.species?.types?.map(t=>t.type?.name).join('/') || '---'}</span></div>
                                    <div className="flex justify-between border-b border-slate-800 pb-1.5"><span className="font-bold text-slate-500">Mudança de Habilidade:</span><span className="uppercase font-black truncate max-w-[150px]">{(baseForm.abilities?.[0]?.ability?.name || '').replace(/-/g, ' ')} <span className="text-indigo-400 mx-1">➔</span> {(pk.species?.abilities?.[0]?.ability?.name || '').replace(/-/g, ' ')}</span></div>
                                </div>
                            )}
                            {pk.canGMax && (
                                <div className="flex flex-col gap-2 text-[10px] text-slate-300">
                                    <div className="flex justify-between border-b border-slate-800 pb-1.5"><span className="font-bold text-slate-500">HP Gigantamax:</span><span className="uppercase font-black">{getHpBeforeAfter().base} <span className="text-rose-400 mx-1">➔</span> <span className="text-rose-400">{getHpBeforeAfter().gmax}</span></span></div>
                                    <p className="text-[10px] font-medium text-slate-400 leading-relaxed mt-1">O Pokémon vai crescer de tamanho durante a batalha! Seu HP dobra e seus ataques se transformam em poderosos <span className="text-rose-400 font-bold">G-Max Moves</span>.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex justify-between items-end mb-4 pb-3 border-b border-slate-800">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Treinamento (Stats)</h3>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">EVs Restantes: <span className={evTotal>508?'text-rose-400':'text-blue-400'}>{510-evTotal}</span>/510</div>
                    </div>
                    <div className="grid grid-cols-[minmax(45px,1fr)_minmax(45px,1fr)_minmax(150px,3fr)_minmax(50px,1fr)_minmax(45px,1fr)] gap-2 mb-3 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center items-center">
                        <div className="text-left">Stat</div><div>Base</div><div>EVs</div><div className="flex items-center justify-center gap-1 cursor-pointer hover:text-blue-400 transition-colors" onClick={()=>randomize('ivs')}>IVs 🎲</div><div className={`text-right ${isTTRPG ? 'text-rose-400' : 'text-blue-400'}`}>Total</div>
                    </div>
                    <div className="flex flex-col gap-2.5">
                        {pk.species?.stats?.map(s => {
                            const sN = s.stat?.name;
                            if (!sN) return null;
                            const base = isHackmon && pk.customStats?.[sN] !== undefined ? pk.customStats[sN] : (s.base_stat || 0);
                            const ev = pk.evs?.[sN] ?? 0; const iv = pk.ivs?.[sN] ?? 31; const multi = getMulti(sN);
                            const rawVal = calculateStat(base, ev, iv, pk.level, multi, sN === 'hp', pk.species?.name);
                            const finalVal = isTTRPG ? convertToTTRPG(rawVal, sN === 'hp') : rawVal;
                            
                            let cCol = "text-slate-200";
                            if (isTTRPG) cCol = "text-rose-400";
                            else if (multi > 1) cCol = "text-emerald-400";
                            else if (multi < 1) cCol = "text-blue-400";
                            
                            return (
                                <div key={sN} className="grid grid-cols-[minmax(45px,1fr)_minmax(45px,1fr)_minmax(150px,3fr)_minmax(50px,1fr)_minmax(45px,1fr)] gap-2 items-center bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 transition-colors hover:border-slate-700 shadow-sm">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{STAT_MAP[sN] || sN}</div>
                                    <div className="flex justify-center">{isHackmon ? <input type="number" min="1" max="255" value={base===''? '':base} onChange={e=>updatePk({...pk, customStats: {...(pk.customStats||{}), [sN]: e.target.value===''? '':parseInt(e.target.value)}})} className="w-10 bg-purple-900/20 border border-purple-500/50 rounded p-1 text-purple-300 text-[10px] font-bold text-center outline-none" /> : <div className="text-[11px] font-bold text-slate-500">{base}</div>}</div>
                                    <div className="flex items-center gap-2"><input type="range" min="0" max="252" step="4" value={ev===''?0:ev} onChange={e=>handleChange('evs', sN, e.target.value)} /><input type="number" min="0" max="252" value={ev===''? '':ev} onChange={e=>handleChange('evs', sN, e.target.value)} className="w-10 bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 text-[10px] text-center outline-none font-bold focus:border-blue-500" /></div>
                                    <div className="flex justify-center"><input type="number" min="0" max="31" value={iv===''? '':iv} onChange={e=>handleChange('ivs', sN, e.target.value)} className="w-10 bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 text-[10px] text-center outline-none font-bold focus:border-blue-500" /></div>
                                    <div className={`text-sm font-black flex justify-end gap-0.5 ${cCol}`}>{!isTTRPG && multi>1&&"↑"}{!isTTRPG && multi<1&&"↓"} {finalVal}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
    }

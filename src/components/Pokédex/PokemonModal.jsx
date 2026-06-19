import React, { useState, useEffect } from 'react';
import { fetchCached, formatName, extractId, calculateDefenses, TYPE_COLORS, convertToTTRPG, STAT_MAP } from '../../core/mechanics';
import AbilityCard from './AbilityCard';
import MoveAccordion from './MoveAccordion';

export default function PokemonModal({ speciesUrl, onClose, isTTRPG, onAddToTeam }) {
    const [baseInfo, setBaseInfo] = useState(null);
    const [activeForm, setActiveForm] = useState(null);
    const [formData, setFormData] = useState(null);
    const [evoChain, setEvoChain] = useState([]);
    const [tab, setTab] = useState('stats');

    useEffect(() => {
        let mounted = true;
        fetchCached(speciesUrl).then(async data => {
            if (!mounted || !data) return;
            setBaseInfo(data);
            const defVar = data.varieties?.find(v => v.is_default)?.pokemon;
            if (defVar) setActiveForm(defVar);

            if (data.evolution_chain?.url) {
                const evo = await fetchCached(data.evolution_chain.url);
                if (mounted && evo) {
                    const paths = [];
                    const traverse = (node, path) => {
                        if(!node) return;
                        const nP = [...path, { name: node.species?.name, id: extractId(node.species?.url) }];
                        if (!node.evolves_to?.length) paths.push(nP);
                        else node.evolves_to.forEach(c => traverse(c, nP));
                    };
                    traverse(evo.chain, []);
                    setEvoChain(paths);
                }
            }
        });
        return () => mounted = false;
    }, [speciesUrl]);

    useEffect(() => {
        let mounted = true;
        if (activeForm?.url) {
            setFormData(null);
            fetchCached(activeForm.url).then(async data => {
                if (!mounted || !data) return;
                let moves = data.moves || [];
                if (!moves.length && baseInfo) {
                    const bUrl = baseInfo.varieties?.find(v => v.is_default)?.pokemon?.url;
                    if (bUrl && bUrl !== activeForm.url) {
                        const bData = await fetchCached(bUrl);
                        if (bData?.moves) moves = bData.moves;
                    }
                }
                moves.sort((a, b) => (a.version_group_details?.[a.version_group_details.length - 1]?.level_learned_at || 0) - (b.version_group_details?.[b.version_group_details.length - 1]?.level_learned_at || 0));
                data.moves = moves;
                setFormData(data);
            });
        }
        return () => mounted = false;
    }, [activeForm, baseInfo]);

    if (!baseInfo || !formData) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const defenses = calculateDefenses(formData.types);
    const bst = formData.stats?.reduce((acc, s) => acc + (isTTRPG ? convertToTTRPG(s.base_stat, s.stat?.name === 'hp') : (s.base_stat || 0)), 0) || 0;
    const primaryColor = formData.types?.[0]?.type?.name ? TYPE_COLORS[formData.types[0].type.name] : '#3b82f6';
    const sprite = formData.sprites?.other?.['official-artwork']?.front_default || formData.sprites?.front_default;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 sm:p-8 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col md:flex-row overflow-hidden border border-slate-700 relative shadow-2xl" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-full z-30 transition-all border border-slate-700 shadow-md">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                
                <div className="w-full md:w-5/12 p-8 bg-slate-900 flex flex-col overflow-y-auto no-scrollbar border-r border-slate-800">
                    <div className="z-10 mb-6">
                        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase border border-slate-700 px-3 py-1.5 rounded-md bg-slate-800 shadow-inner">Nº {String(baseInfo.id).padStart(4, '0')}</span>
                        <h2 className="text-4xl lg:text-5xl font-black capitalize text-white mt-4 tracking-tight leading-none">{activeForm?.name?.split('-')[0] || baseInfo.name}</h2>
                        {activeForm?.name?.includes('-') && <span className="text-sm font-bold text-blue-400 capitalize block mt-1.5">{activeForm.name.substring(activeForm.name.indexOf('-') + 1).replace(/-/g, ' ')} Form</span>}
                    </div>
                    
                    <div className="flex-grow flex justify-center items-center py-6 relative group mb-8 bg-slate-950/50 rounded-3xl border border-slate-800 overflow-hidden shadow-inner">
                        <div className="absolute inset-0 opacity-20 transition-opacity duration-500 group-hover:opacity-40" style={{ background: `radial-gradient(circle at center, ${primaryColor} 0%, transparent 70%)` }}></div>
                        {sprite ? <img src={sprite} alt="pkmn" className="max-h-64 object-contain drop-shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-500" /> : <span className="text-xs font-bold text-slate-600">Sem Imagem</span>}
                    </div>
                    
                    <button onClick={() => { onAddToTeam(formData); onClose(); }} className="w-full py-4 mb-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex justify-center items-center gap-2 hover:-translate-y-1 outline-none">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg> Adicionar à Equipe
                    </button>

                    <div className="grid gap-3">
                        <div className="flex gap-2 mb-3">{formData.types?.map(t => <span key={t.type?.name} className="text-[10px] px-3 py-1.5 rounded-lg text-white font-black uppercase tracking-widest shadow-sm" style={{ backgroundColor: TYPE_COLORS[t.type?.name] || TYPE_COLORS.normal }}>{t.type?.name}</span>)}</div>
                        {formData.stats?.map(s => {
                            if (!s.stat?.name) return null;
                            const val = isTTRPG ? convertToTTRPG(s.base_stat, s.stat.name === 'hp') : (s.base_stat || 0);
                            const pct = Math.min((val / (isTTRPG ? 13 : 255)) * 100, 100);
                            return (
                                <div key={s.stat.name}>
                                    <div className="flex justify-between items-end mb-1.5"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{STAT_MAP[s.stat.name] || s.stat.name}</span><span className={`text-xs font-black ${isTTRPG ? 'text-rose-400' : 'text-white'}`}>{val}</span></div>
                                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: primaryColor }}></div></div>
                                </div>
                            );
                        })}
                        <div className="flex justify-between items-center mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Stat Total</span><span className="text-xl font-black text-blue-400">{bst}</span></div>
                    </div>
                </div>

                <div className="w-full md:w-7/12 flex flex-col bg-slate-900 relative border-t md:border-t-0 md:border-l border-slate-800">
                    <div className="flex border-b border-slate-800 bg-slate-950 sticky top-0 z-20">
                        {['stats', 'defenses', 'moves'].map(t => (
                            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-5 text-[10px] font-black uppercase tracking-widest transition-all outline-none ${tab === t ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}>
                                {t === 'stats' ? 'Sobre' : t === 'defenses' ? 'Fraquezas' : 'Ataques'}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
                        {tab === 'stats' && (
                            <div className="animate-fade-in space-y-8">
                                <div className="flex gap-4">
                                    <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 flex-1 flex flex-col items-center shadow-sm"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Altura</span><span className="text-2xl font-bold text-slate-200">{((formData.height || 0) / 10).toFixed(1)}m</span></div>
                                    <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 flex-1 flex flex-col items-center shadow-sm"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Peso</span><span className="text-2xl font-bold text-slate-200">{((formData.weight || 0) / 10).toFixed(1)}kg</span></div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Habilidades</h3>
                                    <div className="flex flex-col gap-3">{formData.abilities?.map((a, i) => <AbilityCard key={i} url={a.ability?.url} isHidden={a.is_hidden} />)}</div>
                                </div>
                                {baseInfo.varieties?.length > 1 && (
                                    <div>
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Outras Formas</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {baseInfo.varieties.map(v => {
                                                const btnName = v.pokemon?.name === baseInfo.name ? 'Base Form' : (v.pokemon?.name || '').replace(baseInfo.name + '-', '').replace(/-/g, ' ') || 'Base';
                                                return <button key={v.pokemon?.name || Math.random()} onClick={() => setActiveForm(v.pokemon)} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border outline-none ${activeForm?.name === v.pokemon?.name ? 'bg-blue-600 text-white border-blue-500 shadow-md scale-105' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>{btnName}</button>
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Evoluções</h3>
                                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col gap-4 shadow-inner">
                                        {evoChain.length > 0 ? evoChain.map((path, idx) => (
                                            <div key={idx} className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                                                {path.map((node, i) => (
                                                    <React.Fragment key={node.name + i}>
                                                        <div className="flex flex-col items-center min-w-[75px] group">
                                                            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center border border-slate-700 shadow-inner group-hover:border-blue-500 transition-colors"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${node.id}.png`} className="w-14 h-14 pixelated" alt={node.name} onError={e=>e.target.style.display='none'} /></div>
                                                            <span className="text-[10px] font-bold uppercase text-slate-400 mt-2.5 truncate w-full text-center group-hover:text-blue-400 transition-colors">{node.name}</span>
                                                        </div>
                                                        {i < path.length - 1 && <svg className="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )) : <span className="text-xs font-bold text-slate-600">Este Pokémon não evolui.</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {tab === 'defenses' && (
                            <div className="animate-fade-in">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Dano Recebido</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.entries(defenses).map(([t, multi]) => (
                                        <div key={t} className={`flex items-center justify-between p-4 rounded-xl border ${multi > 1 ? 'text-rose-400 border-rose-900/50 bg-rose-950/30' : multi < 1 && multi > 0 ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/30' : multi === 0 ? 'text-blue-400 border-blue-900/50 bg-blue-950/30' : 'text-slate-400 border-slate-800 bg-slate-900/50'}`}>
                                            <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: TYPE_COLORS[t] || TYPE_COLORS.normal }}></div><span className="text-[10px] font-black uppercase tracking-widest">{t}</span></div>
                                            <span className="text-sm font-black">{multi === 0 ? '0x' : `${multi}x`}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {tab === 'moves' && (
                            <div className="animate-fade-in">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">Golpes que pode aprender <span className="bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">{formData.moves?.length || 0}</span></h3>
                                <div className="flex flex-col gap-1">{formData.moves?.map((m, i) => <MoveAccordion key={i} moveData={m} isTTRPG={isTTRPG} />)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  }

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

    if (!baseInfo || !formData) return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"><div className="w-16 h-16 border-8 border-red-500 border-t-white rounded-full animate-spin shadow-lg"></div></div>;

    const defenses = calculateDefenses(formData.types);
    const bst = formData.stats?.reduce((acc, s) => acc + (isTTRPG ? convertToTTRPG(s.base_stat, s.stat?.name === 'hp') : (s.base_stat || 0)), 0) || 0;
    const primaryColor = formData.types?.[0]?.type?.name ? TYPE_COLORS[formData.types[0].type.name] : '#3b82f6';
    const sprite = formData.sprites?.other?.['official-artwork']?.front_default || formData.sprites?.front_default;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 animate-fade-in" onClick={onClose}>
            
            {/* O Botão de Fechar agora fica flutuando na tela para nunca sumir ao rolar no celular */}
            <button onClick={onClose} className="fixed md:absolute top-5 right-5 md:top-4 md:right-4 w-12 h-12 flex items-center justify-center bg-white hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full z-[70] transition-all border-4 border-slate-200 shadow-xl outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            {/* Contêiner Híbrido: Rolagem livre no Celular, Travado e Dividido no PC */}
            <div className="bg-slate-50 rounded-3xl w-full max-w-6xl max-h-[95vh] md:h-[90vh] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden border-8 border-red-600 relative shadow-2xl" onClick={e => e.stopPropagation()}>
                
                {/* Coluna Esquerda: Dados Principais e Visualização */}
                <div className="w-full md:w-5/12 p-6 sm:p-8 bg-white flex flex-col flex-shrink-0 md:h-full md:overflow-y-auto no-scrollbar border-b-8 md:border-b-0 md:border-r-8 border-slate-200 z-10">
                    <div className="z-10 mb-6 flex flex-col items-start pr-12 md:pr-0">
                        <span className="text-[11px] font-black text-slate-500 tracking-widest uppercase border-2 border-slate-200 px-3 py-1 rounded-full bg-slate-50 shadow-sm">No. {String(baseInfo.id).padStart(4, '0')}</span>
                        <h2 className="text-4xl lg:text-5xl font-black capitalize text-slate-800 mt-4 tracking-tight leading-none drop-shadow-sm break-words w-full">{activeForm?.name?.split('-')[0] || baseInfo.name}</h2>
                        {activeForm?.name?.includes('-') && <span className="text-sm font-black text-red-500 capitalize block mt-2">{activeForm.name.substring(activeForm.name.indexOf('-') + 1).replace(/-/g, ' ')} Form</span>}
                    </div>
                    
                    <div className="flex-grow flex justify-center items-center py-8 relative group mb-8 bg-slate-50 rounded-3xl border-4 border-slate-200 overflow-hidden shadow-inner min-h-[220px]">
                        <div className="absolute inset-0 opacity-10 transition-opacity duration-500 group-hover:opacity-20" style={{ background: `radial-gradient(circle at center, ${primaryColor} 0%, transparent 70%)` }}></div>
                        {sprite ? <img src={sprite} alt="pkmn" className="max-h-56 sm:max-h-64 object-contain drop-shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-500" /> : <span className="text-sm font-black text-slate-400">Imagem Ausente!</span>}
                    </div>
                    
                    <button onClick={() => { onAddToTeam(formData, baseInfo?.gender_rate ?? -1); onClose(); }} className="w-full py-4 mb-8 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-[0_6px_0_#991b1b] active:shadow-[0_0px_0_#991b1b] active:translate-y-1.5 transition-all flex justify-center items-center gap-2 outline-none flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg> Levar para a Equipe
                    </button>

                    <div className="grid gap-4 flex-shrink-0">
                        <div className="flex flex-wrap gap-2 mb-2">{formData.types?.map(t => <span key={t.type?.name} className="text-[10px] px-3 py-1.5 rounded-lg text-white font-black uppercase tracking-widest shadow-sm border border-black/10" style={{ backgroundColor: TYPE_COLORS[t.type?.name] || TYPE_COLORS.normal }}>{t.type?.name}</span>)}</div>
                        
                        <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 shadow-inner flex flex-col gap-3">
                            {formData.stats?.map(s => {
                                if (!s.stat?.name) return null;
                                const val = isTTRPG ? convertToTTRPG(s.base_stat, s.stat.name === 'hp') : (s.base_stat || 0);
                                const pct = Math.min((val / (isTTRPG ? 13 : 255)) * 100, 100);
                                return (
                                    <div key={s.stat.name}>
                                        <div className="flex justify-between items-end mb-1"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{STAT_MAP[s.stat.name] || s.stat.name}</span><span className={`text-xs font-black ${isTTRPG ? 'text-red-500' : 'text-slate-800'}`}>{val}</span></div>
                                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner"><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: primaryColor }}></div></div>
                                    </div>
                                );
                            })}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-slate-200">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Base Stat Total</span>
                                <span className="text-xl font-black text-slate-800">{bst}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna Direita: Guias Interativas (Aba de Fichário) */}
                <div className="w-full md:w-7/12 flex flex-col bg-slate-100 relative md:h-full overflow-visible md:overflow-hidden">
                    
                    {/* Cabeçalho de Abas Magnético: Fica fixo no topo ao rolar pelo celular! */}
                    <div className="flex bg-slate-200 pt-4 px-2 sm:px-4 gap-1 sm:gap-2 pr-20 md:pr-24 z-20 flex-shrink-0 border-b-4 border-red-500 sticky top-0 md:relative">
                        {['stats', 'defenses', 'moves'].map(t => (
                            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 sm:py-4 text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all outline-none rounded-t-xl border-t-4 border-x-4 border-b-0 ${tab === t ? 'text-white bg-red-500 border-red-600 shadow-inner' : 'text-slate-400 bg-white border-slate-300 hover:bg-slate-100'}`}>
                                {t === 'stats' ? 'Dados Dex' : t === 'defenses' ? 'Tipagem' : 'Golpes'}
                            </button>
                        ))}
                    </div>
                    
                    {/* Área de Conteúdo Proporcional */}
                    <div className="flex-1 p-5 sm:p-8 md:p-10 md:overflow-y-auto no-scrollbar pb-10">
                        {tab === 'stats' && (
                            <div className="animate-fade-in space-y-8">
                                <div className="flex gap-3 sm:gap-4">
                                    <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200 flex-1 flex flex-col items-center shadow-[0_4px_0_#e2e8f0]"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Altura</span><span className="text-2xl sm:text-3xl font-black text-slate-800">{((formData.height || 0) / 10).toFixed(1)}m</span></div>
                                    <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200 flex-1 flex flex-col items-center shadow-[0_4px_0_#e2e8f0]"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Peso</span><span className="text-2xl sm:text-3xl font-black text-slate-800">{((formData.weight || 0) / 10).toFixed(1)}kg</span></div>
                                </div>
                                
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Habilidades</h3>
                                    <div className="flex flex-col gap-3">{formData.abilities?.map((a, i) => <AbilityCard key={i} url={a.ability?.url} isHidden={a.is_hidden} />)}</div>
                                </div>
                                
                                {baseInfo.varieties?.length > 1 && (
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Outras Formas</h3>
                                        <div className="flex flex-wrap gap-2 bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
                                            {baseInfo.varieties.map(v => {
                                                const btnName = v.pokemon?.name === baseInfo.name ? 'Base Form' : (v.pokemon?.name || '').replace(baseInfo.name + '-', '').replace(/-/g, ' ') || 'Base';
                                                return (
                                                    <button key={v.pokemon?.name || Math.random()} onClick={() => setActiveForm(v.pokemon)} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-2 outline-none ${activeForm?.name === v.pokemon?.name ? 'bg-blue-500 text-white border-blue-700 shadow-[0_3px_0_#1d4ed8] scale-105' : 'bg-slate-50 text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-white shadow-sm'}`}>{btnName}</button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Linha Evolutiva</h3>
                                    <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-slate-200 flex flex-col gap-6 shadow-sm">
                                        {evoChain.length > 0 ? evoChain.map((path, idx) => (
                                            <div key={idx} className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar">
                                                {path.map((node, i) => (
                                                    <React.Fragment key={node.name + i}>
                                                        <div className="flex flex-col items-center min-w-[70px] sm:min-w-[85px] group">
                                                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full flex items-center justify-center border-4 border-slate-200 shadow-inner group-hover:border-red-400 transition-colors"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${node.id}.png`} className="w-12 h-12 sm:w-16 sm:h-16 pixelated drop-shadow-md" alt={node.name} onError={e=>e.target.style.display='none'} /></div>
                                                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-600 mt-3 truncate w-full text-center group-hover:text-red-600 transition-colors">{node.name}</span>
                                                        </div>
                                                        {i < path.length - 1 && <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7"></path></svg>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )) : <span className="text-[11px] font-black text-slate-400 text-center w-full block py-4">Este Pokémon não possui estágios evolutivos.</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {tab === 'defenses' && (
                            <div className="animate-fade-in">
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Eficiência de Tipo (Dano Recebido)</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                                    {Object.entries(defenses).map(([t, multi]) => {
                                        let cardStyle = 'text-slate-600 border-slate-300 bg-white';
                                        if (multi > 1) cardStyle = 'text-red-700 border-red-300 bg-red-50';
                                        if (multi < 1 && multi > 0) cardStyle = 'text-emerald-700 border-emerald-300 bg-emerald-50';
                                        if (multi === 0) cardStyle = 'text-slate-400 border-slate-300 bg-slate-100 opacity-70';
                                        
                                        return (
                                            <div key={t} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 shadow-sm ${cardStyle}`}>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: TYPE_COLORS[t] || TYPE_COLORS.normal }}></div><span className="text-[10px] font-black uppercase tracking-widest">{t}</span></div>
                                                <span className="text-sm font-black">{multi === 0 ? '0x' : `${multi}x`}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {tab === 'moves' && (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Base de Dados de Golpes</h3>
                                    <span className="bg-slate-800 px-3 py-1 rounded-full text-white text-[10px] font-black shadow-inner">{formData.moves?.length || 0} Registrados</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {formData.moves?.map((m, i) => <MoveAccordion key={i} moveData={m} isTTRPG={isTTRPG} />)}
                                </div>
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import PokemonEditor from './PokemonEditor';
import { formatName } from '../../core/mechanics';

export default function Teambuilder({ envProps }) {
    const { teams, setTeams, allItems, allMoves, allAbilities, activeTeamId, setActiveTeamId, isTTRPG, isHackmon, onSearchClick } = envProps;
    const [editingSlot, setEditingSlot] = useState(null);
    const [shareText, setShareText] = useState('');
    
    const active = teams.find(t => t.id === activeTeamId);
    
    const createTeam = () => { 
        const id = Date.now().toString(); 
        setTeams([...teams, { id, name: 'Nova Caixa', pokemon: [] }]); 
        setActiveTeamId(id); 
        setEditingSlot(null); 
    };
    
    const updateActive = (cb) => setTeams(teams.map(t => t.id === activeTeamId ? cb(t) : t));

    const generateTradeLink = () => {
        if (!active || !active.pokemon.length) return;
        
        // Compactador de Dados da MyOwnDex
        const liteTeam = {
            name: active.name,
            p: active.pokemon.map(pk => ({
                u: pk.species?.url, l: pk.level, f: pk.friendship, g: pk.canGMax, 
                i: pk.item, t: pk.teraType, a: pk.ability, n: pk.nature, m: pk.moves, 
                iv: pk.ivs, ev: pk.evs, cs: pk.customStats, ct: pk.customTypes
            }))
        };
        
        const encoded = encodeURIComponent(btoa(JSON.stringify(liteTeam)));
        const url = `${window.location.origin}${window.location.pathname}?trade=${encoded}`;
        
        navigator.clipboard.writeText(url).then(() => {
            setShareText('Sinal Enviado!');
            setTimeout(() => setShareText(''), 3000);
        }).catch(() => {
            setShareText('Falha no Rotom Phone');
            setTimeout(() => setShareText(''), 3000);
        });
    };

    if (!teams.length) return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center max-w-lg mx-auto">
            <div className="w-24 h-24 bg-white rounded-full border-4 border-slate-200 shadow-sm flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">O PC está vazio!</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed font-semibold">Organize sua mochila, escolha seus parceiros e prepare sua próxima tática de batalha.</p>
            <button onClick={createTeam} className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-[0_6px_0_#991b1b] active:shadow-none active:translate-y-1.5 transition-all outline-none">
                Acessar Sistema de Caixas
            </button>
        </div>
    );

    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-fade-in">
            <div className="w-full xl:w-1/4 bg-white border-4 border-slate-200 rounded-3xl p-6 flex flex-col gap-3 h-fit shadow-[0_8px_0_#cbd5e1]">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Caixas do PC</h3>
                {teams.map(t => (
                    <button key={t.id} onClick={() => {setActiveTeamId(t.id); setEditingSlot(null);}} className={`p-4 rounded-2xl text-left font-black text-xs border-2 transition-all outline-none shadow-sm ${activeTeamId === t.id ? 'bg-blue-500 border-blue-600 text-white shadow-[0_4px_0_#1d4ed8] translate-y-[-2px]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-white'}`}>
                        {t.name}
                    </button>
                ))}
                <button onClick={createTeam} className="p-4 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all outline-none">
                    + Nova Caixa
                </button>
            </div>
            
            <div className="w-full xl:w-3/4">
                {active && (
                    <div className="bg-white border-4 border-slate-200 p-6 md:p-8 rounded-3xl shadow-[0_8px_0_#cbd5e1]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-4 border-slate-100 pb-5">
                            <input type="text" placeholder="" value={active.name || ''} onChange={e => updateActive(t => ({...t, name: e.target.value}))} className="bg-transparent text-3xl font-black text-slate-800 focus:outline-none w-full max-w-md tracking-tight border-b-4 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-1" />
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={generateTradeLink} className="flex-1 sm:flex-none px-4 py-3.5 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-2xl transition-colors border-2 border-blue-200 hover:border-blue-600 shadow-sm outline-none flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                    {shareText || 'Cabo Link'}
                                </button>
                                <button onClick={() => { const nT = teams.filter(t=>t.id!==activeTeamId); setTeams(nT); setActiveTeamId(nT.length > 0 ? nT[0].id : null); setEditingSlot(null); }} className="p-3.5 bg-white text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-colors border-2 border-slate-200 shadow-sm outline-none flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {active.pokemon?.map((pk, i) => (
                                <div key={i} onClick={() => setEditingSlot(i)} className={`p-4 rounded-2xl border-2 cursor-pointer flex gap-4 items-center transition-all relative overflow-hidden group shadow-sm ${editingSlot === i ? 'bg-blue-50 border-blue-400 shadow-[0_4px_0_#60a5fa] translate-y-[-2px]' : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-white'}`}>
                                    {pk.canGMax && <div className="absolute -bottom-4 -right-4 text-red-500/10 text-8xl font-black rotate-12 pointer-events-none">X</div>}
                                    <div className="w-16 h-16 bg-white rounded-xl border-2 border-slate-100 flex items-center justify-center shadow-inner relative z-10 flex-shrink-0">
                                        {pk.species?.sprites?.front_default ? <img src={pk.species.sprites.front_default} className="w-14 h-14 pixelated drop-shadow-md group-hover:scale-110 transition-transform" /> : <span className="text-[9px] font-black text-slate-400">N/A</span>}
                                    </div>
                                    <div className="relative z-10 min-w-0">
                                        <div className="font-black text-sm text-slate-800 capitalize truncate">{formatName(pk.species?.name)}</div>
                                        <div className="text-[10px] font-bold text-slate-500 mt-1 truncate">Nv.{pk.level||1} • {pk.item ? formatName(pk.item) : 'Sem Item'}</div>
                                    </div>
                                </div>
                            ))}
                            {(active.pokemon?.length || 0) < 6 && (
                                <div onClick={onSearchClick} className="p-4 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col justify-center items-center cursor-pointer text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all bg-slate-50 min-h-[96px]">
                                    + Convidar Parceiro
                                </div>
                            )}
                        </div>
                        
                        {editingSlot !== null && active.pokemon?.[editingSlot] && (
                            <PokemonEditor pk={active.pokemon[editingSlot]} updatePk={n => updateActive(t => { const arr = [...(t.pokemon||[])]; arr[editingSlot] = n; return {...t, pokemon: arr}; })} envProps={{allItems, allMoves, allAbilities, onRemove: () => { updateActive(t => ({...t, pokemon: (t.pokemon||[]).filter((_, idx)=>idx!==editingSlot)})); setEditingSlot(null); }, isTTRPG, isHackmon}} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

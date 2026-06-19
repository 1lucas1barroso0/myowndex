import React, { useState } from 'react';
import PokemonEditor from './PokemonEditor';
import { formatName } from '../../core/mechanics';

export default function Teambuilder({ envProps }) {
    const { teams, setTeams, allItems, allMoves, allAbilities, activeTeamId, setActiveTeamId, isTTRPG, isHackmon, onSearchClick } = envProps;
    const [editingSlot, setEditingSlot] = useState(null);
    
    const active = teams.find(t => t.id === activeTeamId);
    const createTeam = () => { const id = Date.now().toString(); setTeams([...teams, { id, name: 'Nova Equipe', pokemon: [] }]); setActiveTeamId(id); setEditingSlot(null); };
    const updateActive = (cb) => setTeams(teams.map(t => t.id === activeTeamId ? cb(t) : t));

    if (!teams.length) return (
        <div className="flex flex-col items-center justify-center py-32 animate-fade-in text-center max-w-lg mx-auto">
            <div className="w-24 h-24 bg-slate-900 rounded-full border-2 border-slate-800 shadow-inner flex items-center justify-center mb-8"><svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg></div>
            <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Nenhuma equipe formada ainda!</h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">Você ainda não tem nenhuma equipe. Escolha seus Pokémon e prepare-se para a próxima batalha!</p>
            <button onClick={createTeam} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all outline-none hover:-translate-y-1">Criar Nova Equipe</button>
        </div>
    );

    return (
        <div className="flex flex-col xl:flex-row gap-8 animate-fade-in">
            <div className="w-full xl:w-1/4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-3 h-fit shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Suas Equipes</h3>
                {teams.map(t => <button key={t.id} onClick={() => {setActiveTeamId(t.id); setEditingSlot(null);}} className={`p-4 rounded-xl text-left font-bold text-xs border transition-all outline-none ${activeTeamId === t.id ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-slate-950 border-transparent text-slate-400 hover:border-slate-700'}`}>{t.name}</button>)}
                <button onClick={createTeam} className="p-4 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-950/50 border border-dashed border-slate-700 rounded-xl hover:text-white hover:border-blue-500 transition-all outline-none">+ Nova Equipe</button>
            </div>
            
            <div className="w-full xl:w-3/4">
                {active && (
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
                        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-5">
                            <input type="text" placeholder="" value={active.name || ''} onChange={e => updateActive(t => ({...t, name: e.target.value}))} className="bg-transparent text-3xl font-black text-white focus:outline-none w-full max-w-md tracking-tight border-b-2 border-transparent hover:border-slate-700 focus:border-blue-500 transition-colors pb-1" />
                            <button onClick={() => { const nT = teams.filter(t=>t.id!==activeTeamId); setTeams(nT); setActiveTeamId(nT.length > 0 ? nT[0].id : null); setEditingSlot(null); }} className="p-3.5 bg-rose-950/30 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl transition-colors border border-rose-900/30 outline-none"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {active.pokemon?.map((pk, i) => (
                                <div key={i} onClick={() => setEditingSlot(i)} className={`p-4 rounded-2xl border cursor-pointer flex gap-4 items-center transition-all relative overflow-hidden group ${editingSlot === i ? 'bg-slate-800 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]' : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'}`}>
                                    {pk.canGMax && <div className="absolute -bottom-4 -right-4 text-rose-500/10 text-8xl font-black rotate-12 pointer-events-none">X</div>}
                                    <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center shadow-inner relative z-10 flex-shrink-0">
                                        {pk.species?.sprites?.front_default ? <img src={pk.species.sprites.front_default} className="w-14 h-14 pixelated drop-shadow-md group-hover:scale-110 transition-transform" /> : <span className="text-[9px] font-black text-slate-600">Sem Imagem</span>}
                                    </div>
                                    <div className="relative z-10 min-w-0">
                                        <div className="font-black text-sm text-white capitalize truncate">{formatName(pk.species?.name)}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1 truncate">Nv.{pk.level||1} • {pk.item ? formatName(pk.item) : 'Sem Item'}</div>
                                    </div>
                                </div>
                            ))}
                            {(active.pokemon?.length || 0) < 6 && (
                                <div onClick={onSearchClick} className="p-4 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col justify-center items-center cursor-pointer text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-400 hover:bg-slate-800/30 transition-all bg-slate-950/30 min-h-[96px]">
                                    + Adicionar Pokémon
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

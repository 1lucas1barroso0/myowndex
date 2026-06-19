import React, { useState, useEffect, useMemo } from 'react';
import { fetchCached, extractId, formatName } from './core/mechanics';
import PokemonModal from './components/Pokedex/PokemonModal';
import Teambuilder from './components/Teambuilder/Teambuilder';

export default function App() {
    const [species, setSpecies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isTTRPG, setIsTTRPG] = useState(false);
    const [isHackmon, setIsHackmon] = useState(false);
    const [limit, setLimit] = useState(60);
    const [selectedUrl, setSelectedUrl] = useState(null);
    const [view, setView] = useState('pokedex'); 
    
    const [teams, setTeams] = useState(() => { 
        try { 
            const local = localStorage.getItem('myowndex_v1'); 
            if (local) { const parsed = JSON.parse(local); return Array.isArray(parsed) ? parsed : []; }
            return [];
        } catch { return []; } 
    });
    const [activeTeamId, setActiveTeamId] = useState(teams[0]?.id || null);
    const [env, setEnv] = useState({ items: [], moves: [], abilities: [] });

    useEffect(() => { try { localStorage.setItem('myowndex_v1', JSON.stringify(teams)); } catch{} }, [teams]);

    useEffect(() => {
        let mounted = true;
        const bootDex = async () => {
            try {
                const spRes = await fetchCached('https://pokeapi.co/api/v2/pokemon-species?limit=1500');
                if (mounted && spRes?.results) setSpecies(spRes.results);
                
                const [iRes, mRes, aRes] = await Promise.all([ fetchCached('https://pokeapi.co/api/v2/item?limit=2500'), fetchCached('https://pokeapi.co/api/v2/move?limit=1000'), fetchCached('https://pokeapi.co/api/v2/ability?limit=350') ]);
                if (mounted) {
                    const spamRx = /tm\d+|tr\d+|hm\d+|dynamax|dummy-|data-card|z-ring|mega-bracelet|candy|mint/i;
                    setEnv({
                        items: iRes?.results ? iRes.results.filter((v,i,a) => v?.name && a.findIndex(t=>t.name===v.name)===i && !spamRx.test(v.name)).sort((a,b)=>(a.name||'').localeCompare(b.name||'')) : [],
                        moves: mRes?.results || [], abilities: aRes?.results || []
                    });
                }
            } catch (err) { console.error("Erro ao conectar com a rede principal.", err); }
        }; bootDex(); return () => { mounted = false; };
    }, []);

    const visible = useMemo(() => {
        if (!searchTerm) return species.slice(0, limit);
        const query = searchTerm.toLowerCase();
        return species.filter(s => (s.name||'').includes(query) || extractId(s.url) === query).slice(0, limit);
    }, [species, searchTerm, limit]);

    const integrateTeam = (formData) => {
        const pTemplate = { species: formData, level: 50, friendship: 150, canGMax: false, teraType: '', item: '', ability: formData.abilities?.[0]?.ability?.name || '', nature: 'hardy', moves: ['', '', '', ''], ivs: { hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31 }, evs: { hp:0, attack:0, defense:0, 'special-attack':0, 'special-defense':0, speed:0 } };
        if (!teams.length) {
            const id = Date.now().toString();
            setTeams([{ id, name: 'Minha Equipe', pokemon: [pTemplate] }]); setActiveTeamId(id);
        } else {
            setTeams(prev => prev.map(t => { if (t.id === (activeTeamId || teams[0].id) && (t.pokemon?.length || 0) < 6) return { ...t, pokemon: [...(t.pokemon||[]), pTemplate] }; return t; }));
        }
        setView('teambuilder');
    };

    return (
        <div className="min-h-screen flex flex-col pb-24">
            <header className="bg-slate-900/90 border-b border-slate-800 p-4 md:p-5 sticky top-0 z-40 backdrop-blur-xl shadow-lg">
                <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row justify-between items-center gap-5">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('pokedex')}>
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-blue-400 group-hover:scale-105 transition-transform"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
                            <h1 className="text-2xl font-black text-white tracking-tight hidden sm:block">MyOwnDex</h1>
                        </div>
                        <div className="flex bg-slate-950 rounded-xl p-1.5 border border-slate-800 shadow-inner">
                            <button onClick={() => setView('pokedex')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all outline-none ${view==='pokedex'?'bg-slate-800 text-white shadow-md':'text-slate-500 hover:text-slate-300'}`}>Pokédex</button>
                            <button onClick={() => setView('teambuilder')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all outline-none ${view==='teambuilder'?'bg-slate-800 text-white shadow-md':'text-slate-500 hover:text-slate-300'}`}>Equipes</button>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto items-center justify-end flex-wrap sm:flex-nowrap">
                        {view === 'pokedex' && (
                            <div className="relative flex-grow md:w-80 w-full">
                                <input type="text" placeholder="" className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" onChange={e => {setSearchTerm(e.target.value); setLimit(60);}} />
                                <svg className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                        )}
                        <div className="flex bg-slate-950 rounded-xl p-1.5 border border-slate-800">
                            <button onClick={() => setIsHackmon(!isHackmon)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all outline-none ${isHackmon?'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]':'text-slate-500 hover:text-slate-300'}`} title="Modo Livre">Hackmon</button>
                            <button onClick={() => setIsTTRPG(!isTTRPG)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all outline-none ml-1 ${isTTRPG?'bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]':'text-slate-500 hover:text-slate-300'}`} title="Modo RPG de Mesa">TTRPG</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1700px] mx-auto p-6 md:p-8 w-full flex-grow relative z-10">
                {view === 'pokedex' ? (
                    species.length === 0 ? <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-5 w-full">{[...Array(40)].map((_, i) => <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-36 skeleton"></div>)}</div> : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-5">
                                {visible.map(sp => {
                                    if (!sp?.url) return null;
                                    const id = extractId(sp.url);
                                    return (
                                        <div key={sp.name || Math.random()} onClick={() => setSelectedUrl(sp.url)} className="card-hover bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col items-center cursor-pointer group relative">
                                            <span className="absolute top-3.5 left-4 text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">#{id.padStart(4, '0')}</span>
                                            <div className="w-full h-20 mt-4 flex justify-center items-center"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} className="w-20 h-20 pixelated drop-shadow-md group-hover:scale-110 transition-transform duration-300" loading="lazy" onError={e=>e.target.style.display='none'} /></div>
                                            <span className="text-[10px] font-bold text-slate-400 mt-3 capitalize truncate w-full text-center group-hover:text-white transition-colors">{formatName(sp.name)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {limit < species.length && !searchTerm && <button onClick={() => setLimit(p => p + 60)} className="mt-10 w-full py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-blue-500 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm outline-none">Carregar Mais</button>}
                        </>
                    )
                ) : <Teambuilder envProps={{ teams, setTeams, allItems: env.items, allMoves: env.moves, allAbilities: env.abilities, activeTeamId, setActiveTeamId, isTTRPG, isHackmon, onSearchClick: () => setView('pokedex') }} />}
            </main>
            {selectedUrl && <PokemonModal speciesUrl={selectedUrl} onClose={() => setSelectedUrl(null)} isTTRPG={isTTRPG} onAddToTeam={integrateTeam} />}
        </div>
    );
      }

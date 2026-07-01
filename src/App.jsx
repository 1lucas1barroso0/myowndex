import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { fetchCached, extractId, formatName } from './core/mechanics';
import PokemonModal from './components/Pokedex/PokemonModal';
import Teambuilder from './components/Teambuilder/Teambuilder';

const PokemonCard = React.memo(function PokemonCard({ species, id, onSelect }) {
    return (
        <div onClick={onSelect} className="pokemon-grid-card p-4 flex flex-col items-center cursor-pointer group relative">
            <span className="absolute top-2 left-3 text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">No. {id.padStart(4, '0')}</span>
            <div className="w-full h-20 mt-4 flex justify-center items-center">
                <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} className="w-20 h-20 pixelated drop-shadow-md group-hover:scale-110 transition-transform duration-200" loading="lazy" decoding="async" onError={e=>e.target.style.display='none'} />
            </div>
            <span className="text-[11px] font-black text-slate-700 mt-3 capitalize truncate w-full text-center group-hover:text-red-600 transition-colors">{formatName(species.name)}</span>
        </div>
    );
});

export default function App() {
    const [species, setSpecies] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isTTRPG, setIsTTRPG] = useState(false);
    const [isHackmon, setIsHackmon] = useState(false);
    const [limit, setLimit] = useState(60);
    const [selectedUrl, setSelectedUrl] = useState(null);
    const [view, setView] = useState('pokedex'); 
    const [envLoaded, setEnvLoaded] = useState(false);
    const [envLoading, setEnvLoading] = useState(false);
    const deferredSearchTerm = useDeferredValue(searchTerm);
    
    const [teams, setTeams] = useState(() => { 
        try { 
            const local = localStorage.getItem('myowndex_rotom_v3'); 
            if (local) { const parsed = JSON.parse(local); return Array.isArray(parsed) ? parsed : []; }
            return [];
        } catch { return []; } 
    });
    const [activeTeamId, setActiveTeamId] = useState(teams[0]?.id || null);
    const [env, setEnv] = useState({ items: [], moves: [], abilities: [] });

    useEffect(() => { try { localStorage.setItem('myowndex_rotom_v3', JSON.stringify(teams)); } catch{} }, [teams]);

    useEffect(() => {
        const timer = window.setTimeout(() => setSearchTerm(searchInput), 140);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        let mounted = true;
        const bootPokedex = async () => {
            try {
                const cKey = 'myowndex_dex_cache';
                const localDex = localStorage.getItem(cKey);
                if(localDex) { setSpecies(JSON.parse(localDex)); } 
                else {
                    const spRes = await fetchCached('https://pokeapi.co/api/v2/pokemon-species?limit=1500');
                    if (mounted && spRes?.results) { setSpecies(spRes.results); try { localStorage.setItem(cKey, JSON.stringify(spRes.results)); } catch{} }
                }
            } catch (err) { console.error("A conexão com o Centro Pokémon falhou.", err); }
        }; bootPokedex(); return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (view !== 'teambuilder' || envLoaded || envLoading) return;
        let mounted = true;
        const loadEnv = async () => {
            setEnvLoading(true);
            try {
                const [iRes, mRes, aRes] = await Promise.all([
                    fetchCached('https://pokeapi.co/api/v2/item?limit=2500'),
                    fetchCached('https://pokeapi.co/api/v2/move?limit=1500'),
                    fetchCached('https://pokeapi.co/api/v2/ability?limit=500')
                ]);
                if (!mounted) return;
                const spamRx = /tm\d+|tr\d+|hm\d+|dynamax|dummy-|data-card|z-ring|mega-bracelet|candy|mint/i;
                setEnv({
                    items: iRes?.results ? iRes.results.filter((v,i,a) => v?.name && a.findIndex(t=>t.name===v.name)===i && !spamRx.test(v.name)).sort((a,b)=>(a.name||'').localeCompare(b.name||'')) : [],
                    moves: mRes?.results || [], abilities: aRes?.results || []
                });
                setEnvLoaded(true);
            } catch (err) {
                console.error("A conexão com os dados de equipe falhou.", err);
            } finally {
                if (mounted) setEnvLoading(false);
            }
        };

        loadEnv();
        return () => { mounted = false; };
    }, [view, envLoaded, envLoading]);

    const visible = useMemo(() => {
        if (!deferredSearchTerm) return species.slice(0, limit);
        const query = deferredSearchTerm.toLowerCase();
        return species.filter(s => (s.name||'').includes(query) || extractId(s.url) === query).slice(0, limit);
    }, [species, deferredSearchTerm, limit]);

    const teamBuilderProps = useMemo(() => ({
        teams,
        setTeams,
        allItems: env.items,
        allMoves: env.moves,
        allAbilities: env.abilities,
        activeTeamId,
        setActiveTeamId,
        isTTRPG,
        isHackmon,
        onSearchClick: handleOpenPokedex
    }), [teams, setTeams, env.items, env.moves, env.abilities, activeTeamId, setActiveTeamId, isTTRPG, isHackmon, handleOpenPokedex]);

    const handleOpenPokedex = useCallback(() => setView('pokedex'), []);
    const handleOpenTeambuilder = useCallback(() => setView('teambuilder'), []);
    const handleSearchInputChange = useCallback((e) => { setSearchInput(e.target.value); setLimit(60); }, []);
    const handleSelectPokemon = useCallback((url) => setSelectedUrl(url), []);
    const handleLoadMore = useCallback(() => setLimit(prev => prev + 60), []);
    const toggleHackmon = useCallback(() => setIsHackmon(prev => !prev), []);
    const toggleTTRPG = useCallback(() => setIsTTRPG(prev => !prev), []);

    const integrateTeam = useCallback((formData, genderRate) => {
        const resolvedGenderRate = typeof genderRate === 'number' ? genderRate : (formData.gender_rate ?? formData.species?.gender_rate ?? -1);
        let initialGender = 'N';
        if (resolvedGenderRate === 0) initialGender = 'M';
        else if (resolvedGenderRate === 8) initialGender = 'F';
        else if (resolvedGenderRate !== -1) {
            initialGender = (Math.random() * 8) < resolvedGenderRate ? 'F' : 'M';
        }

        const pTemplate = { 
            species: formData,
            level: 50,
            friendship: 150,
            canGMax: false,
            teraType: '',
            item: '', 
            ability: formData.abilities?.[0]?.ability?.name || '',
            nature: 'hardy',
            moves: ['', '', '', ''], 
            ivs: { hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31 }, 
            evs: { hp:0, attack:0, defense:0, 'special-attack':0, 'special-defense':0, speed:0 },
            gender: initialGender,
            genderRate: resolvedGenderRate
        };
        
        if (!teams.length) {
            const id = Date.now().toString();
            setTeams([{ id, name: 'Caixa 1', pokemon: [pTemplate] }]); setActiveTeamId(id);
        } else {
            setTeams(prev => prev.map(t => { if (t.id === (activeTeamId || teams[0].id) && (t.pokemon?.length || 0) < 6) return { ...t, pokemon: [...(t.pokemon||[]), pTemplate] }; return t; }));
        }
        setView('teambuilder');
    }, [activeTeamId, teams]);

    return (
        <div className="min-h-screen flex flex-col pb-6 sm:pb-10 lg:pb-24">
            <header className="bg-red-600 border-b-8 border-red-800 p-3 sm:p-4 md:p-5 sticky top-0 z-40 shadow-xl">
                <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                    <div className="flex items-center justify-between gap-4 w-full lg:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-sky-400 rounded-full border-4 border-white shadow-[0_0_15px_#00d2ff] relative overflow-hidden cursor-pointer shrink-0" onClick={handleOpenPokedex}>
                                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full opacity-70"></div>
                            </div>
                            <div className="flex gap-1.5 self-start mt-1">
                                <div className="w-3 h-3 bg-rose-500 rounded-full border border-rose-700 shadow-[0_0_5px_rgba(239,68,68,1)]"></div>
                                <div className="w-3 h-3 bg-amber-400 rounded-full border border-amber-600 shadow-[0_0_5px_rgba(251,191,36,1)]"></div>
                                <div className="w-3 h-3 bg-emerald-400 rounded-full border border-emerald-600 shadow-[0_0_5px_rgba(52,211,153,1)]"></div>
                            </div>
                        </div>
                        <div className="flex bg-red-800 rounded-xl p-1 border-2 border-red-950 shadow-inner w-full max-w-[220px]">
                            <button onClick={handleOpenPokedex} className={`flex-1 px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all outline-none ${view==='pokedex'?'bg-red-500 text-white shadow-md border-b-2 border-red-700':'text-red-300 hover:text-white'}`}>Pokédex</button>
                            <button onClick={handleOpenTeambuilder} className={`flex-1 px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all outline-none ${view==='teambuilder'?'bg-red-500 text-white shadow-md border-b-2 border-red-700':'text-red-300 hover:text-white'}`}>PC</button>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 w-full lg:w-auto items-center justify-end flex-wrap sm:flex-nowrap">
                        {view === 'pokedex' && (
                            <div className="relative flex-grow w-full sm:w-80">
                                <input type="text" value={searchInput} placeholder="Buscar Pokémon" className="w-full pl-11 pr-4 py-3 bg-slate-900 border-2 border-red-800 rounded-xl text-xs text-white font-bold outline-none focus:border-white transition-colors shadow-inner" onChange={handleSearchInputChange} />
                                <svg className="w-4 h-4 absolute left-4 top-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                        )}
                        <div className="flex bg-red-800 rounded-xl p-1 border-2 border-red-950">
                            <button onClick={toggleHackmon} className={`px-3 sm:px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all outline-none ${isHackmon?'bg-purple-600 text-white border-b-2 border-purple-800':'text-red-300'}`}>Hackmon</button>
                            <button onClick={toggleTTRPG} className={`px-3 sm:px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all outline-none ml-1 ${isTTRPG?'bg-amber-500 text-white border-b-2 border-amber-700':'text-red-300'}`}>TTRPG</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1700px] mx-auto p-3 sm:p-4 md:p-8 w-full flex-grow relative z-10">
                <div className="pokedex-screen p-3 sm:p-5 md:p-8 min-h-[70vh]">
                    {view === 'pokedex' ? (
                        species.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-5 w-full">
                                {[...Array(40)].map((_, i) => <div key={i} className="bg-slate-200 border-2 border-slate-300 rounded-2xl h-36 skeleton"></div>)}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-5">
                                    {visible.map(sp => {
                                        if (!sp?.url) return null;
                                        const id = extractId(sp.url);
                                        return <PokemonCard key={sp.name} species={sp} id={id} onSelect={() => handleSelectPokemon(sp.url)} />;
                                    })}
                                </div>
                                {limit < species.length && !deferredSearchTerm && (
                                    <button onClick={handleLoadMore} className="mt-8 sm:mt-10 w-full py-4 bg-slate-300 border-2 border-slate-400 hover:bg-red-500 hover:border-red-700 text-slate-600 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md outline-none">
                                        Procurar Mais Pokémon
                                    </button>
                                )}
                            </>
                        )
                    ) : <Teambuilder envProps={teamBuilderProps} />}
                </div>
            </main>
            {selectedUrl && <PokemonModal speciesUrl={selectedUrl} onClose={() => setSelectedUrl(null)} isTTRPG={isTTRPG} onAddToTeam={integrateTeam} />}
        </div>
    );
}

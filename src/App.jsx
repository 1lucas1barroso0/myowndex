import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { fetchCached, extractId, formatName } from './core/mechanics';
import PokemonModal from './components/Pokedex/PokemonModal';
import Teambuilder from './components/Teambuilder/Teambuilder';

const PokemonCard = React.memo(function PokemonCard({ species, id, onSelect }) {
    return (
        <div onClick={onSelect} className="game-card p-4 flex flex-col items-center cursor-pointer group relative">
            <span className="absolute top-2 left-3 text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">No. {id.padStart(4, '0')}</span>
            <div className="w-full h-20 mt-4 flex justify-center items-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200">
                <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} className="w-20 h-20 pixelated drop-shadow-md group-hover:scale-110 transition-transform duration-200" loading="lazy" decoding="async" onError={e=>e.target.style.display='none'} />
            </div>
            <span className="text-[11px] font-black text-slate-700 mt-3 capitalize truncate w-full text-center group-hover:text-red-600 transition-colors">{formatName(species.name)}</span>
        </div>
    );
});

export default function App() {
    const [species, setSpecies] = useState(() => {
        try {
            const cached = localStorage.getItem('myowndex_dex_cache');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
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

    const handleOpenPokedex = useCallback(() => setView('pokedex'), []);
    const handleOpenTeambuilder = useCallback(() => setView('teambuilder'), []);

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
            level: 5,
            friendship: 70,
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
            setTeams([{ id, name: 'Box 1', pokemon: [pTemplate] }]);
            setActiveTeamId(id);
        } else {
            const targetTeamId = activeTeamId || teams[0]?.id;
            setTeams(prev => prev.map(t => {
                if (t.id === targetTeamId && (t.pokemon?.length || 0) < 6) {
                    return { ...t, pokemon: [...(t.pokemon || []), pTemplate] };
                }
                return t;
            }));
        }
        setView('teambuilder');
    }, [activeTeamId, teams]);

    return (
        <div className="h-[100dvh] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_30%)]">
            <header className="shrink-0 px-3 sm:px-4 md:px-5 pt-3 sm:pt-4 md:pt-5 pb-2 z-40">
                <div className="max-w-[1700px] mx-auto game-shell p-3 sm:p-4 md:p-5">
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                        <div className="flex items-center justify-between gap-4 w-full lg:w-auto">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-sky-400 rounded-full border-4 border-white shadow-[0_0_18px_#00d2ff] relative overflow-hidden cursor-pointer shrink-0" onClick={handleOpenPokedex}>
                                    <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-white rounded-full opacity-70"></div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Pokémon</span>
                                    <h1 className="text-xl sm:text-2xl font-black text-slate-800">MyOwnDex</h1>
                                </div>
                            </div>
                            <div className="flex bg-slate-800/90 rounded-full p-1 border-2 border-slate-700 shadow-inner w-full max-w-[220px]">
                                <button onClick={handleOpenPokedex} className={`game-button flex-1 px-4 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none ${view==='pokedex'?'bg-red-500 text-white':'bg-slate-100 text-slate-600'}`}>Pokédex</button>
                                <button onClick={handleOpenTeambuilder} className={`game-button flex-1 px-4 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none ${view==='teambuilder'?'bg-red-500 text-white':'bg-slate-100 text-slate-600'}`}>Box</button>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 w-full lg:w-auto items-center justify-end flex-wrap sm:flex-nowrap">
                            {view === 'pokedex' && (
                                <div className="relative flex-grow w-full sm:w-80">
                                    <input type="text" value={searchInput} placeholder="Search Pokémon" className="w-full pl-11 pr-4 py-3 bg-slate-900 border-2 border-red-800 rounded-full text-xs text-white font-bold outline-none focus:border-white transition-colors shadow-inner" onChange={handleSearchInputChange} />
                                    <svg className="w-4 h-4 absolute left-4 top-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                            )}
                            <div className="flex bg-slate-800/90 rounded-full p-1 border-2 border-slate-700">
                                <button onClick={toggleHackmon} className={`px-3 sm:px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all outline-none ${isHackmon?'bg-purple-600 text-white':'text-slate-300'}`}>Hackmon</button>
                                <button onClick={toggleTTRPG} className={`px-3 sm:px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all outline-none ml-1 ${isTTRPG?'bg-amber-500 text-white':'text-slate-300'}`}>TTRPG</button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto app-scroll-area px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-8 relative z-10">
                <div className="max-w-[1700px] mx-auto game-shell p-3 sm:p-5 md:p-8 min-h-[70vh]">
                    {view === 'pokedex' ? (
                        species.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-5 w-full">
                                {[...Array(40)].map((_, i) => <div key={i} className="bg-slate-200 border-2 border-slate-300 rounded-2xl h-36 skeleton"></div>)}
                            </div>
                        ) : (
                            <>
                                <div className="game-panel p-5 mb-6">
                                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Search Hub</p>
                                            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Explore the Pokédex and build your perfect team.</h2>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-3 py-2 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest">Searching</span>
                                            <span className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest">{visible.length} Pokémon</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-5">
                                    {visible.map(sp => {
                                        if (!sp?.url) return null;
                                        const id = extractId(sp.url);
                                        return <PokemonCard key={sp.name} species={sp} id={id} onSelect={() => handleSelectPokemon(sp.url)} />;
                                    })}
                                </div>
                                {limit < species.length && !deferredSearchTerm && (
                                    <button onClick={handleLoadMore} className="mt-8 sm:mt-10 w-full py-4 bg-slate-300 border-2 border-slate-400 hover:bg-red-500 hover:border-red-700 text-slate-600 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md outline-none">
                                        Load more Pokémon
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

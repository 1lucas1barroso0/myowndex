import React, { useState } from 'react';
import PokemonEditor from './PokemonEditor';
import { formatName, fetchCached } from '../../core/mechanics';

export default function Teambuilder({ envProps }) {
    const { teams, setTeams, allItems, allMoves, allAbilities, activeTeamId, setActiveTeamId, isTTRPG, isHackmon, onSearchClick } = envProps;
    const [editingSlot, setEditingSlot] = useState(null);
    
    const [importing, setImporting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importData, setImportData] = useState('');
    const [importError, setImportError] = useState(false);
    const [shareCode, setShareCode] = useState('');
    const [copied, setCopied] = useState(false);
    
    const active = teams.find(t => t.id === activeTeamId);
    
    const createTeam = () => { 
        const id = Date.now().toString(); 
        setTeams([...teams, { id, name: 'Nova Caixa', pokemon: [] }]); 
        setActiveTeamId(id); 
        setEditingSlot(null); 
    };
    
    const updateActive = (cb) => setTeams(teams.map(t => t.id === activeTeamId ? cb(t) : t));

    const generateLinkCode = () => {
        try {
            // Preservando a integridade do Cabo Link com inclusão de Gênero
            const slimTeam = {
                n: active.name,
                p: active.pokemon.map(pk => ({
                    n: pk.species?.name, l: pk.level, i: pk.item, a: pk.ability, na: pk.nature, m: pk.moves,
                    iv: pk.ivs, ev: pk.evs, gx: pk.canGMax, tt: pk.teraType, f: pk.friendship,
                    cs: pk.customStats, ct: pk.customTypes, g: pk.gender, gr: pk.genderRate
                }))
            };
            const code = btoa(encodeURIComponent(JSON.stringify(slimTeam)));
            setShareCode(`MYOWNDEX-${code}`);
            setCopied(false);
        } catch { /* Ignorado silenciosamente */ }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            const textArea = document.createElement("textarea");
            textArea.value = shareCode;
            document.body.appendChild(textArea);
            textArea.select();
            try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch { }
            document.body.removeChild(textArea);
        }
    };

    const receiveViaLinkCable = async () => {
        try {
            setIsProcessing(true);
            setImportError(false);
            const cleanCode = importData.replace('MYOWNDEX-', '').trim();
            const jsonStr = decodeURIComponent(atob(cleanCode));
            const decoded = JSON.parse(jsonStr);
            
            const newTeamId = Date.now().toString();
            let newTeam = { id: newTeamId, name: decoded.n || decoded.name || 'Nova Caixa Recebida', pokemon: [] };
            const pkmns = decoded.p || decoded.pokemon || [];
            
            const reconstructed = await Promise.all(pkmns.map(async (pk) => {
                if (pk.species && pk.species.sprites) return pk; 
                const spData = await fetchCached(`https://pokeapi.co/api/v2/pokemon/${pk.n || pk.species?.name}`);
                return {
                    species: spData,
                    level: pk.l ?? pk.level ?? 50, item: pk.i ?? pk.item ?? '', ability: pk.a ?? pk.ability ?? '',
                    nature: pk.na ?? pk.nature ?? 'hardy', moves: pk.m ?? pk.moves ?? ['', '', '', ''],
                    ivs: pk.iv ?? pk.ivs ?? {hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31},
                    evs: pk.ev ?? pk.evs ?? {hp:0, attack:0, defense:0, 'special-attack':0, 'special-defense':0, speed:0},
                    canGMax: pk.gx ?? pk.canGMax ?? false, teraType: pk.tt ?? pk.teraType ?? '', friendship: pk.f ?? pk.friendship ?? 150,
                    customStats: pk.cs ?? pk.customStats ?? null, customTypes: pk.ct ?? pk.customTypes ?? null,
                    gender: pk.g ?? 'N', genderRate: pk.gr ?? -1
                };
            }));
            
            newTeam.pokemon = reconstructed.filter(p => p.species);
            setTeams([...teams, newTeam]);
            setActiveTeamId(newTeam.id);
            setImporting(false);
            setImportData('');
        } catch {
            setImportError(true);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!teams.length) return null; // App.jsx cuida do estado vazio inicial

    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-fade-in">
            <div className="w-full xl:w-1/4 bg-white border-4 border-slate-200 rounded-3xl p-6 flex flex-col gap-3 h-fit shadow-[0_8px_0_#cbd5e1]">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Caixas do PC</h3>
                {teams.map(t => (
                    <button key={t.id} onClick={() => {setActiveTeamId(t.id); setEditingSlot(null); setShareCode('');}} className={`p-4 rounded-2xl text-left font-black text-xs border-2 transition-all outline-none shadow-sm ${activeTeamId === t.id ? 'bg-blue-500 border-blue-600 text-white shadow-[0_4px_0_#1d4ed8] translate-y-[-2px]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-white'}`}>
                        {t.name}
                    </button>
                ))}
                <button onClick={createTeam} className="p-4 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all outline-none">
                    + Nova Caixa
                </button>

                <div className="mt-4 pt-4 border-t-2 border-slate-100">
                    {importing ? (
                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl shadow-inner animate-fade-in">
                            <input type="text" disabled={isProcessing} value={importData} onChange={e => { setImportData(e.target.value); setImportError(false); }} className="w-full p-2 rounded-xl border-2 border-blue-200 text-xs font-bold text-slate-700 outline-none mb-2 focus:border-blue-500 shadow-inner" />
                            {importError && <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2 block">Erro no cabo link!</span>}
                            {isProcessing ? <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div> : (
                                <div className="flex gap-2">
                                    <button onClick={receiveViaLinkCable} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl shadow-[0_3px_0_#1d4ed8] outline-none">Conectar</button>
                                    <button onClick={() => { setImporting(false); setImportData(''); setImportError(false); }} className="flex-1 bg-white border-2 border-slate-200 text-slate-500 hover:text-red-500 text-[9px] font-black uppercase tracking-widest py-2 rounded-xl hover:border-red-200 transition-colors outline-none">X</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={() => setImporting(true)} className="w-full p-4 text-[10px] font-black uppercase tracking-widest text-blue-500 bg-white border-2 border-blue-200 rounded-2xl hover:text-white hover:bg-blue-500 transition-all outline-none shadow-sm">
                            🔗 Conectar Cabo Link
                        </button>
                    )}
                </div>
            </div>
            
            <div className="w-full xl:w-3/4">
                {active && (
                    <div className="bg-white border-4 border-slate-200 p-6 md:p-8 rounded-3xl shadow-[0_8px_0_#cbd5e1]">
                        <div className="flex justify-between items-center mb-8 border-b-4 border-slate-100 pb-5">
                            <input type="text" value={active.name || ''} onChange={e => updateActive(t => ({...t, name: e.target.value}))} className="bg-transparent text-3xl font-black text-slate-800 focus:outline-none w-full max-w-md tracking-tight border-b-4 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-1" />
                            <div className="flex gap-3">
                                <button onClick={generateLinkCode} className="px-4 py-3.5 bg-white text-blue-500 hover:bg-blue-50 hover:text-blue-600 border-2 border-slate-200 shadow-sm rounded-2xl outline-none">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                </button>
                                <button onClick={() => { const nT = teams.filter(t=>t.id!==activeTeamId); setTeams(nT); setActiveTeamId(nT.length > 0 ? nT[0].id : null); setEditingSlot(null); setShareCode(''); }} className="px-4 py-3.5 bg-white text-slate-400 hover:bg-red-50 hover:text-red-500 border-2 border-slate-200 shadow-sm rounded-2xl outline-none">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>

                        {shareCode && (
                            <div className="mb-8 p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-inner animate-fade-in">
                                <div className="flex-1 w-full">
                                    <input type="text" readOnly value={shareCode} className="w-full bg-white border-2 border-blue-200 rounded-xl p-3 text-xs font-bold text-slate-600 outline-none shadow-sm" />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button onClick={copyToClipboard} className="px-6 py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_4px_0_#1d4ed8] outline-none">{copied ? 'Copiado!' : 'Copiar'}</button>
                                    <button onClick={() => setShareCode('')} className="px-4 py-3.5 bg-white border-2 border-slate-200 text-slate-500 hover:text-red-500 rounded-xl outline-none">X</button>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {active.pokemon?.map((pk, i) => (
                                <div key={i} onClick={() => setEditingSlot(i)} className={`p-4 rounded-2xl border-2 cursor-pointer flex gap-4 items-center transition-all relative overflow-hidden group shadow-sm ${editingSlot === i ? 'bg-blue-50 border-blue-400 shadow-[0_4px_0_#60a5fa] translate-y-[-2px]' : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-white'}`}>
                                    {pk.canGMax && <div className="absolute -bottom-4 -right-4 text-red-500/10 text-8xl font-black rotate-12 pointer-events-none">X</div>}
                                    <div className="w-16 h-16 bg-white rounded-xl border-2 border-slate-100 flex items-center justify-center shadow-inner relative z-10 flex-shrink-0">
                                        {pk.species?.sprites?.front_default ? <img src={pk.species.sprites.front_default} className="w-14 h-14 pixelated drop-shadow-md group-hover:scale-110 transition-transform" /> : <span className="text-[9px] font-black text-slate-400 uppercase">---</span>}
                                    </div>
                                    <div className="relative z-10 min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className="font-black text-sm text-slate-800 capitalize truncate">{formatName(pk.species?.name)}</div>
                                            <span className={`text-xs font-black px-1.5 py-0.5 rounded border ${pk.gender === 'M' ? 'text-blue-500 bg-blue-50 border-blue-200' : pk.gender === 'F' ? 'text-pink-500 bg-pink-50 border-pink-200' : 'text-slate-400 bg-slate-100 border-slate-200'}`}>{pk.gender === 'M' ? '♂' : pk.gender === 'F' ? '♀' : '⚲'}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1 truncate">Nv.{pk.level||1} • {pk.item ? formatName(pk.item) : 'Sem Item'}</div>
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

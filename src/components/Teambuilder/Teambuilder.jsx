import React, { useState } from 'react';
import PokemonEditor from './PokemonEditor';
import { formatName, fetchCached, encodeTeamShare, decodeTeamShare } from '../../core/mechanics';

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
        setTeams(prev => [...prev, { id, name: 'New Box', pokemon: [] }]); 
        setActiveTeamId(id); 
        setEditingSlot(null); 
    };
    
    const updateActive = (cb) => setTeams(prev => prev.map(t => t.id === activeTeamId ? cb(t) : t));

    // 1. Exportação Segura: Garante que todos os campos existem para não crashar o compressor
    const generateLinkCode = () => {
        try {
            const exportTeam = {
                id: active.id,
                name: active.name,
                pokemon: (active.pokemon || []).map(pk => ({
                    nickname: pk.nickname || "",
                    species: { name: pk.species?.name, url: pk.species?.url },
                    level: pk.level || 1,
                    item: pk.item || "",
                    ability: pk.ability || "",
                    nature: pk.nature || "hardy",
                    moves: pk.moves || ["", "", "", ""],
                    ivs: pk.ivs || { hp:31, attack:31, defense:31, "special-attack":31, "special-defense":31, speed:31 },
                    evs: pk.evs || { hp:0, attack:0, defense:0, "special-attack":0, "special-defense":0, speed:0 },
                    canGMax: pk.canGMax || false,
                    teraType: pk.teraType || "",
                    friendship: pk.friendship || 150,
                    customStats: pk.customStats || null,
                    customTypes: pk.customTypes || null,
                    gender: pk.gender || "N",
                    genderRate: pk.genderRate || -1
                }))
            };
            setShareCode(encodeTeamShare(exportTeam));
            setCopied(false);
        } catch (e) {
            setShareCode('');
        }
    };

    // 2. Cópia Infalível: Funciona mesmo se o telemóvel bloquear a API moderna de Clipboard
    const copyToClipboard = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(shareCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = shareCode;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand("copy");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                } catch (err) { }
                document.body.removeChild(textArea);
            }
        } catch (e) { }
    };

    // 3. Importação Blindada: Corta espaços fantasmas do teclado e protege contra falhas de API
    const receiveViaLinkCable = async () => {
        try {
            setIsProcessing(true);
            setImportError(false);
            
            const cleanCode = importData.trim();
            if (!cleanCode) throw new Error("Empty code");
            
            const decoded = decodeTeamShare(cleanCode);
            if (!decoded) throw new Error("Decode failed");
            
            const incomingTeam = decoded.team || decoded;
            const newTeamId = Date.now().toString();
            let newTeam = { id: newTeamId, name: incomingTeam.name || incomingTeam.id || 'Received Box', pokemon: [] };
            const pkmns = incomingTeam.pokemon || [];
            
            const reconstructed = await Promise.all(pkmns.map(async (pk) => {
                const speciesName = pk.species?.name || pk.species;
                if (!speciesName) return null;

                const speciesUrl = pk.species?.url || "https://pokeapi.co/api/v2/pokemon/" + speciesName;
                const spData = await fetchCached(speciesUrl);
                if (!spData) return null;

                const genderRate = typeof pk.genderRate === 'number' ? pk.genderRate : (spData.gender_rate ?? -1);
                const gender = pk.gender === 'M' || pk.gender === 'F' || pk.gender === 'N'
                    ? pk.gender
                    : (genderRate === 0 ? 'M' : genderRate === 8 ? 'F' : 'N');

                return {
                    nickname: pk.nickname || "",
                    species: spData,
                    level: pk.level ?? 50,
                    item: pk.item ?? '',
                    ability: pk.ability ?? '',
                    nature: pk.nature ?? 'hardy',
                    moves: pk.moves ?? ['', '', '', ''],
                    ivs: pk.ivs ?? { hp:31, attack:31, defense:31, "special-attack":31, "special-defense":31, speed:31 },
                    evs: pk.evs ?? { hp:0, attack:0, defense:0, "special-attack":0, "special-defense":0, speed:0 },
                    canGMax: pk.canGMax ?? false,
                    teraType: pk.teraType ?? '',
                    friendship: pk.friendship ?? 150,
                    customStats: pk.customStats ?? null,
                    customTypes: pk.customTypes ?? null,
                    gender,
                    genderRate
                };
            }));
            
            newTeam.pokemon = reconstructed.filter(Boolean);
            setTeams(prev => [...prev, newTeam]);
            setActiveTeamId(newTeam.id);
            setImporting(false);
            setImportData('');
        } catch (e) {
            setImportError(true);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!teams.length) {
        return (
            <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-[2rem] border-4 border-slate-200 bg-white p-6 text-center shadow-[0_10px_0_#cbd5e1] sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">📦</div>
                    <h2 className="text-2xl font-black text-slate-800">Your first box is waiting</h2>
                    <p className="mt-3 text-sm text-slate-500">Create a box, gather your partners and start building your team with strategy and style.</p>
                    <button onClick={createTeam} className="mt-6 rounded-2xl bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_4px_0_#991b1b] transition-all hover:bg-red-600 outline-none">Create first box</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-fade-in w-full">
            <div className="w-full xl:w-1/4 xl:sticky xl:top-24 self-start game-panel p-4 sm:p-6 flex flex-col gap-3 h-full xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pb-6">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">PC Boxes</h3>
                {teams.map(t => (
                    <button key={t.id} onClick={() => {setActiveTeamId(t.id); setEditingSlot(null); setShareCode('');}} className={"w-full p-4 rounded-2xl text-left font-black text-xs border-2 transition-all outline-none shadow-sm break-words " + (activeTeamId === t.id ? "bg-blue-500 border-blue-600 text-white shadow-[0_4px_0_#1d4ed8] translate-y-[-2px]" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-white")}>
                        {t.name}
                    </button>
                ))}
                <button onClick={createTeam} className="w-full p-4 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all outline-none">
                    + New Box
                </button>

                <div className="mt-4 pt-4 border-t-2 border-slate-100">
                    {importing ? (
                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl shadow-inner animate-fade-in">
                            <input type="text" disabled={isProcessing} value={importData} onChange={e => { setImportData(e.target.value); setImportError(false); }} className="w-full p-2 rounded-xl border-2 border-blue-200 text-xs font-bold text-slate-700 outline-none mb-2 focus:border-blue-500 shadow-inner" placeholder="Paste code here..." />
                            {importError && <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2 block">Link Cable error!</span>}
                            {isProcessing ? <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div> : (
                                <div className="flex gap-2">
                                    <button onClick={receiveViaLinkCable} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl shadow-[0_3px_0_#1d4ed8] outline-none">Connect</button>
                                    <button onClick={() => { setImporting(false); setImportData(''); setImportError(false); }} className="flex-1 bg-white border-2 border-slate-200 text-slate-500 hover:text-red-500 text-[9px] font-black uppercase tracking-widest py-2 rounded-xl hover:border-red-200 transition-colors outline-none">Cancel</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={() => setImporting(true)} className="w-full p-4 text-[10px] font-black uppercase tracking-widest text-blue-500 bg-white border-2 border-blue-200 rounded-2xl hover:text-white hover:bg-blue-500 transition-all outline-none shadow-sm">
                            🔗 Connect Link Cable
                        </button>
                    )}
                </div>
            </div>
            
            <div className="w-full xl:w-3/4 min-w-0 flex-1">
                {active && (
                    <div className="game-panel p-4 sm:p-6 md:p-8 overflow-hidden">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-4 border-slate-100 pb-5">
                            <input 
                                type="text" 
                                value={active.name || ''} 
                                onChange={e => updateActive(t => ({...t, name: e.target.value}))} 
                                className="bg-transparent text-2xl sm:text-3xl font-black text-slate-800 focus:outline-none w-full min-w-0 tracking-tight border-b-4 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-1 truncate" 
                                placeholder="Box Name"
                            />
                            
                            <div className="flex gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
                                <button onClick={generateLinkCode} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-blue-500 hover:bg-blue-50 hover:text-blue-600 border-2 border-slate-200 shadow-sm rounded-2xl outline-none">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                    <span className="text-[10px] font-black uppercase tracking-widest sm:hidden">Share</span>
                                </button>
                                <button onClick={() => { const nT = teams.filter(t=>t.id!==activeTeamId); setTeams(nT); setActiveTeamId(nT.length > 0 ? nT[0].id : null); setEditingSlot(null); setShareCode(''); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-slate-400 hover:bg-red-50 hover:text-red-500 border-2 border-slate-200 shadow-sm rounded-2xl outline-none">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    <span className="text-[10px] font-black uppercase tracking-widest sm:hidden">Delete</span>
                                </button>
                            </div>
                        </div>

                        {shareCode && (
                            <div className="mb-8 p-4 sm:p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-between shadow-inner animate-fade-in w-full min-w-0">
                                <div className="flex-1 w-full min-w-0">
                                    <input type="text" readOnly value={shareCode} className="w-full bg-white border-2 border-blue-200 rounded-xl p-2.5 sm:p-3 text-[10px] sm:text-xs font-bold text-slate-600 outline-none shadow-sm truncate" />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                    <button onClick={copyToClipboard} className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_4px_0_#1d4ed8] outline-none active:translate-y-1 active:shadow-none transition-all">{copied ? 'Copied!' : 'Copy'}</button>
                                    <button onClick={() => setShareCode('')} className="px-3 sm:px-4 py-2.5 sm:py-3.5 bg-white border-2 border-slate-200 text-slate-500 hover:text-red-500 rounded-xl outline-none font-black text-sm">X</button>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 w-full">
                            {active.pokemon?.map((pk, i) => (
                                <div key={i} onClick={() => setEditingSlot(i)} className={"p-3 sm:p-4 rounded-2xl border-2 cursor-pointer flex gap-3 sm:gap-4 items-center transition-all relative overflow-hidden group shadow-sm " + (editingSlot === i ? "bg-blue-50 border-blue-400 shadow-[0_4px_0_#60a5fa] translate-y-[-2px]" : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-white")}>
                                    {pk.canGMax && <div className="absolute -bottom-4 -right-4 text-red-500/10 text-[80px] font-black rotate-12 pointer-events-none">X</div>}
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl border-2 border-slate-100 flex items-center justify-center shadow-inner relative z-10 flex-shrink-0">
                                        {pk.species?.sprites?.front_default ? <img src={pk.species.sprites.front_default} className="w-10 h-10 sm:w-14 sm:h-14 pixelated drop-shadow-md group-hover:scale-110 transition-transform" alt={pk.species?.name} /> : <span className="text-[9px] font-black text-slate-400 uppercase">---</span>}
                                    </div>
                                    <div className="relative z-10 min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1 sm:gap-2 mb-0.5">
                                            <div className="font-black text-xs sm:text-sm text-slate-800 capitalize truncate">
                                                {pk.nickname ? pk.nickname : formatName(pk.species?.name)}
                                            </div>
                                            <span className={"text-[9px] sm:text-xs font-black px-1.5 py-0.5 rounded border shrink-0 " + (pk.gender === 'M' ? "text-blue-500 bg-blue-50 border-blue-200" : pk.gender === 'F' ? "text-pink-500 bg-pink-50 border-pink-200" : "text-slate-400 bg-slate-100 border-slate-200")}>{pk.gender === 'M' ? '♂' : pk.gender === 'F' ? '♀' : '⚲'}</span>
                                        </div>
                                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate">
                                            {pk.nickname ? <span className="uppercase tracking-wider">{formatName(pk.species?.name)} • </span> : ""}Lv.{pk.level||1} • {pk.item ? formatName(pk.item) : 'No Item'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(active.pokemon?.length || 0) < 6 && (
                                <div onClick={onSearchClick} className="p-3 sm:p-4 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col justify-center items-center cursor-pointer text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all bg-slate-50 min-h-[80px] sm:min-h-[96px] outline-none">
                                    + Add Partner
                                </div>
                            )}
                        </div>
                        
                        {editingSlot !== null && active.pokemon?.[editingSlot] && (
                            <div className="mt-4 sm:mt-6">
                                <PokemonEditor 
                                    pk={active.pokemon[editingSlot]} 
                                    updatePk={n => updateActive(t => { const arr = [...(t.pokemon||[])]; arr[editingSlot] = n; return {...t, pokemon: arr}; })} 
                                    envProps={{allItems, allMoves, allAbilities, onRemove: () => { updateActive(t => ({...t, pokemon: (t.pokemon||[]).filter((_, idx)=>idx!==editingSlot)})); setEditingSlot(null); }, isTTRPG, isHackmon}} 
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

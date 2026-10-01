import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { describeSpecies } from '../../core/descriptions.js';
import { fetchCached, extractId, calculateDefenses, TYPE_COLORS, TYPE_TEXT_COLORS, convertToTTRPG, STAT_MAP, filterMovesByLatestVersion, VERSION_LABELS, formatName, formatNumberPtBr, formatType } from '../../core/mechanics.js';
import { formatCount } from '../../core/copy.js';
import AbilityCard from './AbilityCard.jsx';
import MoveAccordion from './MoveAccordion.jsx';
import PokemonSprite from '../Shared/PokemonSprite.jsx';
import '../../pokedex-record.css';

const RECORD_TABS = [
    { id: 'stats', label: 'Perfil', icon: '▤' },
    { id: 'defenses', label: 'Tipos', icon: '◆' },
    { id: 'moves', label: 'Movimentos', icon: '✦' },
];
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export default function PokemonModal({ speciesUrl, onClose, isTTRPG, onAddToTeam }) {
    const [baseInfo, setBaseInfo] = useState(null);
    const [activeForm, setActiveForm] = useState(null);
    const [formData, setFormData] = useState(null);
    const [evoChain, setEvoChain] = useState([]);
    const [tab, setTab] = useState("stats");
    const [loadError, setLoadError] = useState("");
    const [evolutionStatus, setEvolutionStatus] = useState("loading");
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const recordId = useId();
    const titleId = `${recordId}-title`;
    const panelId = `${recordId}-panel`;
    const phase = loadError ? "error" : !baseInfo || !formData ? "loading" : "ready";

    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        let mounted = true;
        setBaseInfo(null);
        setActiveForm(null);
        setEvoChain([]);
        setFormData(null);
        setLoadError("");
        setEvolutionStatus("loading");
        setTab("stats");
        fetchCached(speciesUrl).then(async data => {
            if (!mounted) return;
            if (!data) {
                setLoadError("A Pokédex não conseguiu abrir este registro agora. Feche e tente novamente.");
                return;
            }
            setBaseInfo(data);
            const defVar = data.varieties?.find(v => v.is_default)?.pokemon || data.varieties?.[0]?.pokemon;
            if (defVar?.url) setActiveForm(defVar);
            else setLoadError("Este registro não trouxe os dados de uma forma. Feche a ficha e tente novamente.");

            if (data.evolution_chain?.url) {
                const evo = await fetchCached(data.evolution_chain.url).catch(() => null);
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
                if (mounted) setEvolutionStatus(evo ? "ready" : "unavailable");
            } else {
                setEvolutionStatus("ready");
            }
        }).catch(() => mounted && setLoadError("A Pokédex não conseguiu abrir este registro agora. Feche e tente novamente."));
        return () => mounted = false;
    }, [speciesUrl]);

    useEffect(() => {
        let mounted = true;
        if (activeForm?.url) {
            setFormData(null);
            setLoadError("");
            fetchCached(activeForm.url).then(async data => {
                if (!mounted) return;
                if (!data) {
                    setLoadError("A Pokédex não conseguiu abrir esta forma agora. Tente novamente em instantes.");
                    return;
                }
                let moves = data.moves || [];
                if (!moves.length && baseInfo) {
                    const bUrl = baseInfo.varieties?.find(v => v.is_default)?.pokemon?.url;
                    if (bUrl && bUrl !== activeForm.url) {
                        const bData = await fetchCached(bUrl);
                        if (bData?.moves) moves = bData.moves;
                    }
                }
                
                if (mounted) setFormData({ ...data, moves });
            }).catch(() => mounted && setLoadError("A Pokédex não conseguiu abrir esta forma agora. Tente novamente em instantes."));
        }
        return () => mounted = false;
    }, [activeForm, baseInfo]);

    // Keep keyboard and assistive-technology navigation inside the open record.
    useEffect(() => {
        const dialog = dialogRef.current;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const inertElements = [];
        const getFocusable = () => [...dialog.querySelectorAll(FOCUSABLE)]
            .filter(element => element.tabIndex >= 0 && element.getClientRects().length && !element.closest('[hidden], [inert]'));
        const focusFirst = () => (closeRef.current || getFocusable()[0] || dialog).focus({ preventScroll: true });
        focusFirst();
        document.body.style.overflow = "hidden";

        // The record lives inside the app, so hide siblings at each ancestor level.
        let branch = dialog;
        while (branch.parentElement && branch.parentElement !== document.documentElement) {
            for (const sibling of branch.parentElement.children) {
                if (sibling === branch || !(sibling instanceof HTMLElement) || ["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) continue;
                inertElements.push([sibling, sibling.inert]);
                sibling.inert = true;
            }
            branch = branch.parentElement;
        }

        const handleKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current();
            }
            if (event.key !== "Tab") return;
            const items = getFocusable();
            const first = items[0];
            const last = items[items.length - 1];
            if (!first) {
                event.preventDefault();
                dialog.focus();
            } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const handleFocus = event => {
            if (!dialog.contains(event.target)) focusFirst();
        };
        document.addEventListener("keydown", handleKeyDown, true);
        document.addEventListener("focusin", handleFocus);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            document.removeEventListener("focusin", handleFocus);
            document.body.style.overflow = previousOverflow;
            inertElements.forEach(([element, previous]) => { element.inert = previous; });
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
        };
    }, []);

    useEffect(() => {
        // A loading screen or form switch can remove the previously focused control.
        if (!dialogRef.current?.contains(document.activeElement)) closeRef.current?.focus({ preventScroll: true });
    }, [phase]);

    const legalMoves = useMemo(() => filterMovesByLatestVersion(formData?.moves || []), [formData?.moves]);
    const moveVersion = legalMoves[0]?.version_group;
    const handleTabKeyDown = event => {
        const index = RECORD_TABS.findIndex(item => item.id === tab);
        let nextIndex;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % RECORD_TABS.length;
        if (event.key === "ArrowLeft") nextIndex = (index + RECORD_TABS.length - 1) % RECORD_TABS.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = RECORD_TABS.length - 1;
        if (nextIndex == null) return;
        event.preventDefault();
        setTab(RECORD_TABS[nextIndex].id);
        document.getElementById(`${recordId}-tab-${RECORD_TABS[nextIndex].id}`)?.focus();
    };

    const defenses = calculateDefenses(formData?.types || []);
    const bst = formData?.stats?.reduce((acc, s) => acc + (isTTRPG ? convertToTTRPG(s.base_stat, s.stat?.name === "hp") : (s.base_stat || 0)), 0) || 0;
    const primaryColor = TYPE_COLORS[formData?.types?.[0]?.type?.name] || "#0EA5E9";
    const sprite = formData?.sprites?.front_default || formData?.sprites?.other?.["official-artwork"]?.front_default;
    const speciesDescription = phase === "ready" ? describeSpecies(baseInfo, formData) : null;

    return (
        <div className="pokemon-modal-backdrop record-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={phase === "loading"} tabIndex={-1} className={`pokemon-modal-shell record-shell ${phase !== "ready" ? "record-state-shell" : ""}`} style={{ "--record-type": primaryColor }}>
                <button ref={closeRef} type="button" aria-label="Fechar registro da Pokédex" onClick={onClose} className="record-close">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {phase !== "ready" ? (
                    <div className="record-state">
                        <span className={`record-pokeball ${phase === "loading" ? "is-reading" : ""}`} aria-hidden="true" />
                        <small>Pokédex · registro de campo</small>
                        <h2 id={titleId}>{phase === "loading" ? "Um instante, treinador!" : "Este registro não abriu"}</h2>
                        <p role={phase === "loading" ? "status" : "alert"}>{phase === "loading" ? "Estamos buscando a ficha do seu próximo parceiro." : loadError}</p>
                        <button type="button" className="record-state-button" onClick={onClose}>{phase === "loading" ? "Cancelar consulta" : "Voltar à Pokédex"}</button>
                    </div>
                ) : (<>
                {/* === TELA 1: APRESENTAÇÃO === */}
                <div className="pokemon-modal-overview record-overview">
                    
                    <header className="record-header">
                        <div className="record-cartridge-label"><span aria-hidden="true" /><small>Pokédex nacional</small><b>No. {String(baseInfo.id).padStart(4, "0")}</b></div>
                        <h2 id={titleId}>{formatName(baseInfo.name)}</h2>
                        {activeForm?.name !== baseInfo.name && <p className="record-form-label">Forma {formatName(activeForm.name.replace(`${baseInfo.name}-`, ""))}</p>}
                    </header>
                    <div className="record-sprite-stage">
                        <span className="record-screen-caption" aria-hidden="true">POKÉMON DATA</span>
                        <span className="record-sprite-ground" aria-hidden="true" />
                        {sprite ? (
                            <PokemonSprite
                                src={sprite} 
                                pokemonId={formData.id}
                                alt={formatName(activeForm?.name || baseInfo.name)}
                                loading="eager"
                                className="record-partner-sprite"
                            />
                        ) : (
                            <span className="text-sm font-black text-slate-400">Este registro ainda não tem imagem.</span>
                        )}
                    </div>
                    
                    <button type="button" onClick={() => { onAddToTeam(formData, baseInfo?.gender_rate ?? -1); onClose(); }} className="record-add-partner">
                        <span className="record-mini-ball" aria-hidden="true" /> Adicionar à equipe <span aria-hidden="true">＋</span>
                    </button>

                    <div className="record-attributes">
                        <div className="record-types" aria-label="Tipos deste Pokémon">
                            {formData.types?.map(t => (
                                <span key={t.type?.name} className="record-type-chip" style={{ backgroundColor: TYPE_COLORS[t.type?.name] || TYPE_COLORS.normal, color: TYPE_TEXT_COLORS[t.type?.name] || TYPE_TEXT_COLORS.normal }}>
                                    {formatType(t.type?.name)}
                                </span>
                            ))}
                        </div>
                        
                        <section className="record-stats" aria-labelledby={`${recordId}-stats-title`}>
                            <h3 id={`${recordId}-stats-title`}>{isTTRPG ? "Atributos do RPG" : "Atributos base"}<span aria-hidden="true">▰ ▰ ▰</span></h3>
                            {formData.stats?.map(s => {
                                if (!s.stat?.name) return null;
                                const val = isTTRPG ? convertToTTRPG(s.base_stat, s.stat.name === "hp") : (s.base_stat || 0);
                                const pct = Math.min((val / (isTTRPG ? 13 : 255)) * 100, 100);
                                return (
                                    <div key={s.stat.name}>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{STAT_MAP[s.stat.name] || s.stat.name}</span>
                                            <span className={"text-xs font-black " + (isTTRPG ? "text-red-500" : "text-slate-800")}>{val}</span>
                                        </div>
                                        <div className="record-stat-track" role="meter" aria-label={STAT_MAP[s.stat.name] || s.stat.name} aria-valuemin={0} aria-valuemax={Math.max(isTTRPG ? 13 : 255, val)} aria-valuenow={val}>
                                            <div className="record-stat-fill" style={{ width: pct + "%", backgroundColor: primaryColor }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-slate-200">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{isTTRPG ? "Total no RPG" : "Total de atributos base"}</span>
                                <span className="text-xl font-black text-slate-800">{bst}</span>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="pokemon-modal-details record-details">
                    <div className="pokemon-modal-tabs record-tabs" role="tablist" aria-label="Páginas da ficha" onKeyDown={handleTabKeyDown}>
                        {RECORD_TABS.map(item => (
                            <button key={item.id} type="button" role="tab" id={`${recordId}-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={panelId} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>
                                <span aria-hidden="true">{item.icon}</span>{item.label}
                            </button>
                        ))}
                    </div>
                    <div id={panelId} role="tabpanel" aria-labelledby={`${recordId}-tab-${tab}`} tabIndex={0} className="pokemon-modal-body record-body">
                        {tab === "stats" && (
                            <div className="animate-fade-in space-y-8">
                                <section className="species-description" aria-labelledby={`${recordId}-description-title`}>
                                    <span>Registro de campo</span>
                                    <h3 id={`${recordId}-description-title`}>Conheça seu parceiro</h3>
                                    <p lang={speciesDescription.flavor.text ? speciesDescription.flavor.code : "pt-BR"}>{speciesDescription.summary}</p>
                                    {speciesDescription.flavor.text && speciesDescription.flavor.code === "en" && <small>A Pokédex identificou este relato como texto original em inglês. Os dados explicativos abaixo continuam em português.</small>}
                                    <ul>
                                        {speciesDescription.facts.map((fact, index) => <li key={`species-fact-${index}`}>{fact}</li>)}
                                    </ul>
                                </section>
                                <div className="flex gap-4">
                                    <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 flex-1 flex flex-col items-center shadow-[0_4px_0_#CBD5E1]"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Altura</span><span className="text-3xl font-black text-slate-800">{formatNumberPtBr((formData.height || 0) / 10)} m</span></div>
                                    <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 flex-1 flex flex-col items-center shadow-[0_4px_0_#CBD5E1]"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Peso</span><span className="text-3xl font-black text-slate-800">{formatNumberPtBr((formData.weight || 0) / 10)} kg</span></div>
                                </div>
                                
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Habilidades</h3>
                                    <div className="flex flex-col gap-3">{formData.abilities?.map((a, i) => <AbilityCard key={i} url={a.ability?.url} isHidden={a.is_hidden} />)}</div>
                                </div>
                                
                                {baseInfo.varieties?.length > 1 && (
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Outras formas</h3>
                                        <div className="flex flex-wrap gap-2 bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
                                            {baseInfo.varieties.map((v, index) => {
                                                const formSlug = (v.pokemon?.name || "").replace(baseInfo.name + "-", "");
                                                const btnName = v.pokemon?.name === baseInfo.name || !formSlug
                                                    ? "Forma base"
                                                    : formatName(formSlug);
                                                return (
                                                    <button 
                                                        key={v.pokemon?.name || `form-${index}`}
                                                        type="button"
                                                        aria-pressed={activeForm?.name === v.pokemon?.name}
                                                        onClick={() => setActiveForm(v.pokemon)} 
                                                        className={"px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-2 outline-none shadow-sm " + (activeForm?.name === v.pokemon?.name ? "bg-blue-500 text-white border-blue-700 shadow-[0_3px_0_#0EA5E9] scale-105" : "bg-slate-50 text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-white")}
                                                    >
                                                        {btnName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Linha evolutiva</h3>
                                    <p className="record-section-note">Cada evolução tem suas próprias condições.</p>
                                    <div className="record-evolution-list bg-white p-6 rounded-2xl border-2 border-slate-200 flex flex-col gap-6 shadow-sm">
                                        {evolutionStatus === "loading" ? <p role="status" className="record-section-note">Consultando a linha evolutiva...</p> : evolutionStatus === "unavailable" ? <p className="record-section-note">A linha evolutiva não chegou desta vez. As outras páginas da ficha continuam disponíveis.</p> : evoChain.length > 0 ? evoChain.map((path, idx) => (
                                            <div key={idx} className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                                                {path.map((node, i) => (
                                                    <React.Fragment key={node.name + i}>
                                                        <div className="flex flex-col items-center min-w-[85px] group">
                                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border-4 border-slate-200 shadow-inner group-hover:border-red-400 transition-colors">
                                                                <PokemonSprite
                                                                    pokemonId={node.id}
                                                                    className="record-evolution-sprite w-16 h-16 object-contain drop-shadow-md group-hover:scale-110 transition-transform" 
                                                                    alt={formatName(node.name)}
                                                                />
                                                            </div>
                                                            <span className="pokemon-evolution-name mt-3 w-full text-center text-[10px] font-black uppercase text-slate-600 transition-colors group-hover:text-red-600">{formatName(node.name)}</span>
                                                        </div>
                                                        {i < path.length - 1 && <svg aria-hidden="true" className="w-8 h-8 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7"></path></svg>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )) : <span className="text-xs font-black text-slate-400 text-center w-full block py-4">Nenhuma evolução conhecida foi registrada para este Pokémon.</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {tab === "defenses" && (
                            <div className="animate-fade-in">
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Como os tipos afetam este Pokémon</h3>
                                <p className="record-section-note">Os multiplicadores consideram os tipos. Habilidades e outros efeitos podem mudar o dano.</p>
                                <div className="record-matchups">
                                    {[
                                        { label: "Fraquezas", kind: "weak", match: value => value > 1, empty: "Nenhuma fraqueza por tipo." },
                                        { label: "Resistências", kind: "resist", match: value => value > 0 && value < 1, empty: "Nenhuma resistência por tipo." },
                                        { label: "Imunidades", kind: "immune", match: value => value === 0, empty: "Nenhuma imunidade por tipo." },
                                        { label: "Dano normal", kind: "neutral", match: value => value === 1 },
                                    ].map(group => {
                                        const matchups = Object.entries(defenses).filter(([, multiplier]) => group.match(multiplier));
                                        return <section key={group.kind} className={`record-matchup-group is-${group.kind}`}>
                                            <h4>{group.label}<span>{matchups.length}</span></h4>
                                            <div>{matchups.map(([type, multiplier]) => <span key={type} className="record-matchup-chip"><i aria-hidden="true" style={{ backgroundColor: TYPE_COLORS[type] || TYPE_COLORS.normal }} />{formatType(type)}<b>{formatNumberPtBr(multiplier)}×</b></span>)}</div>
                                            {!matchups.length && <p>{group.empty || "Nenhum tipo nesta faixa."}</p>}
                                        </section>;
                                    })}
                                </div>
                            </div>
                        )}
                        {tab === "moves" && (
                            <div className="animate-fade-in">
                                <div className="record-moves-heading flex justify-between items-center mb-6">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Movimentos que pode aprender</h3>
                                    <span className="bg-slate-800 px-3 py-1 rounded-full text-white text-[10px] font-black shadow-inner">{formatCount(legalMoves.length, "movimento")} • {VERSION_LABELS[moveVersion] || "Mais recente"}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {legalMoves.map(move => <MoveAccordion key={move.move?.name} moveData={move} isTTRPG={isTTRPG} />)}
                                    {!legalMoves.length && <p className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center text-xs font-bold text-slate-500">A Pokédex ainda não tem movimentos registrados para esta forma.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </>)}
            </div>
        </div>
    );
}

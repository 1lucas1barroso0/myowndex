import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { describeSpecies } from '../../core/descriptions.js';
import { formatReferenceText, getPokedexRecord } from '../../core/pokedexRecord.js';
import { getSpeciesRecordHistory, loadCatalogText } from '../../core/catalogText.js';
import { getLearnsetGames, resolveLearnsetGame } from '../../core/referenceGames.js';
import pokedexEntries from '../../data/pokedex-entries.json';
import { fetchCached, extractId, calculateDefenses, TYPE_COLORS, TYPE_TEXT_COLORS, convertToTTRPG, STAT_MAP, filterMovesByLatestVersion, VERSION_LABELS, formatName, formatNumberPtBr, formatType } from '../../core/mechanics.js';
import { formatCount } from '../../core/copy.js';
import AbilityCard from './AbilityCard.jsx';
import MoveAccordion from './MoveAccordion.jsx';
import PokemonSprite from '../Shared/PokemonSprite.jsx';
import GameIcon from '../Shared/GameIcon.jsx';
import RoomSelect from '../Shared/RoomSelect.jsx';
import '../../pokedex-record.css';

const RECORD_TABS = [
    { id: 'stats', label: 'Perfil', icon: 'dex' },
    { id: 'defenses', label: 'Tipos', icon: 'types' },
    { id: 'moves', label: 'Movimentos', icon: 'move' },
];
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Keep the catalog's facts intact, with measurements shown only once below.
const organizeSpeciesFacts = facts => facts
    .filter(fact => !fact.startsWith('A forma consultada mede '))
    .map(fact => {
        const labels = [
            ['Habitat associado: ', 'Habitat'],
            ['Ritmo de crescimento: ', 'Crescimento'],
            ['Taxa de captura dos jogos: ', 'Captura'],
            ['Amizade inicial de referência: ', 'Amizade inicial'],
        ];
        const match = labels.find(([prefix]) => fact.startsWith(prefix));
        if (!match) return { label: 'Categoria', value: fact };
        const [value, note] = fact.slice(match[0].length).replace(/\.$/, '').split('; ');
        const catalogScale = value.match(/^(\d+) em (\d+)$/);
        return catalogScale
            ? { label: match[1], value: catalogScale[1], scale: catalogScale[2], note: note ? note.charAt(0).toUpperCase() + note.slice(1) : '' }
            : { label: match[1], value, note };
    });

export default function PokemonModal({ speciesUrl, initialForm = null, onClose, isTTRPG, onAddToTeam }) {
    const [baseInfo, setBaseInfo] = useState(null);
    const [activeForm, setActiveForm] = useState(null);
    const [formData, setFormData] = useState(null);
    const [formIdentity, setFormIdentity] = useState(initialForm);
    const [formAppearance, setFormAppearance] = useState(null);
    const [evoChain, setEvoChain] = useState([]);
    const [tab, setTab] = useState("stats");
    const [recordLanguage, setRecordLanguage] = useState('en');
    const [recordVersion, setRecordVersion] = useState('auto');
    const [learnsetVersion, setLearnsetVersion] = useState('auto');
    const [recordHistory, setRecordHistory] = useState([]);
    const [loadError, setLoadError] = useState("");
    const [retryAttempt, setRetryAttempt] = useState(0);
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
        setFormIdentity(initialForm);
        setFormAppearance(null);
        setEvoChain([]);
        setFormData(null);
        setLoadError("");
        setEvolutionStatus("loading");
        setTab("stats");
        setRecordLanguage('en');
        setRecordVersion('auto');
        setLearnsetVersion('auto');
        setRecordHistory([]);
        fetchCached(speciesUrl, { forceRefresh: retryAttempt > 0 }).then(async data => {
            if (!mounted) return;
            if (!data) {
                setLoadError("Não foi possível abrir este Pokémon. Tente novamente.");
                return;
            }
            setBaseInfo(data);
            const requestedVariety = initialForm?.pokemonName
                ? data.varieties?.find(v => v.pokemon?.name === initialForm.pokemonName)?.pokemon
                : null;
            const defVar = requestedVariety || data.varieties?.find(v => v.is_default)?.pokemon || data.varieties?.[0]?.pokemon;
            if (defVar?.url) setActiveForm(defVar);
            else setLoadError("Não foi possível abrir as formas deste Pokémon. Tente novamente.");

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
        }).catch(() => mounted && setLoadError("Não foi possível abrir este Pokémon. Tente novamente."));
        return () => mounted = false;
    }, [speciesUrl, initialForm, retryAttempt]);

    useEffect(() => {
        let mounted = true;
        setFormAppearance(null);
        if (!formIdentity?.formId) return () => { mounted = false; };
        fetchCached(`https://pokeapi.co/api/v2/pokemon-form/${formIdentity.formId}/`, { forceRefresh: retryAttempt > 0 })
            .then(data => { if (mounted && data) setFormAppearance(data); })
            .catch(() => {});
        return () => { mounted = false; };
    }, [formIdentity?.formId, retryAttempt]);

    useEffect(() => {
        let mounted = true;
        if (activeForm?.url) {
            setLearnsetVersion('auto');
            setRecordVersion('auto');
            setFormData(null);
            setLoadError("");
            fetchCached(activeForm.url, { forceRefresh: retryAttempt > 0 }).then(async data => {
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
    }, [activeForm, baseInfo, retryAttempt]);

    useEffect(() => {
        if (!baseInfo?.id) return;
        let active = true;
        loadCatalogText('species', baseInfo.id).then(() => {
            if (active) setRecordHistory(getSpeciesRecordHistory(baseInfo.id, activeForm?.name));
        }).catch(() => { if (active) setRecordHistory([]); });
        return () => { active = false; };
    }, [baseInfo?.id, activeForm?.name]);

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

    const learnsetGames = useMemo(() => getLearnsetGames(formData?.moves || []), [formData?.moves]);
    const moveVersion = resolveLearnsetGame(formData?.moves || [], learnsetVersion);
    const legalMoves = useMemo(() => filterMovesByLatestVersion(formData?.moves || [], learnsetVersion), [formData?.moves, learnsetVersion]);
    const selectedMoveGame = learnsetGames.find(game => game.value === moveVersion);
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
    const sprite = formAppearance?.sprites?.front_default || formData?.sprites?.other?.["official-artwork"]?.front_default || formData?.sprites?.front_default;
    const speciesDescription = phase === "ready" ? describeSpecies(baseInfo, formData) : null;
    const speciesFacts = speciesDescription ? organizeSpeciesFacts(speciesDescription.facts) : [];
    const profileFacts = speciesFacts.filter(fact => !fact.scale);
    const referenceFacts = speciesFacts.filter(fact => fact.scale);
    const record = (recordVersion === 'auto' ? recordHistory[0] : recordHistory.find(entry => entry.id === recordVersion))
        || recordHistory[0] || getPokedexRecord(baseInfo?.id, pokedexEntries, speciesDescription?.flavor, activeForm?.name);
    const recordTextLanguage = recordLanguage === 'pt-BR' && record.portuguese ? 'pt-BR' : record.originalLanguage;
    const recordText = formatReferenceText(recordTextLanguage === 'pt-BR' && record.portuguese ? record.portuguese : record.original, recordTextLanguage);
    const recordLanguageLabel = recordLanguage === 'pt-BR' ? 'Ver registro original em inglês' : 'Ver tradução do registro em português';

    return (
        <div className="pokemon-modal-backdrop record-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={phase === "loading"} tabIndex={-1} className={`pokemon-modal-shell record-shell ${phase !== "ready" ? "record-state-shell" : ""}`} style={{ "--record-type": primaryColor }}>
                <header className="record-topbar"><button ref={closeRef} type="button" aria-label="Fechar registro da Pokédex" onClick={onClose} className="record-close">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg> Fechar
                </button></header>
                {phase !== "ready" ? (
                    <div className="record-state">
                        <span className={`record-pokeball ${phase === "loading" ? "is-reading" : ""}`} aria-hidden="true" />
                        <small>Pokédex</small>
                        <h2 id={titleId}>{phase === "loading" ? "Consultando Pokémon…" : "Registro indisponível"}</h2>
                        <p role={phase === "loading" ? "status" : "alert"}>{phase === "loading" ? "Carregando a ficha." : loadError}</p>
                        {phase === "error" && <button type="button" className="record-state-button" onClick={() => { closeRef.current?.focus({ preventScroll: true }); setLoadError(""); setRetryAttempt(attempt => attempt + 1); }}>Tentar novamente</button>}
                        <button type="button" className="record-state-button" onClick={onClose}>{phase === "loading" ? "Cancelar consulta" : "Voltar à Pokédex"}</button>
                    </div>
                ) : (<>
                {/* === TELA 1: APRESENTAÇÃO === */}
                <div className="pokemon-modal-overview record-overview">
                    
                    <header className="record-header">
                        <div className="record-cartridge-label"><span aria-hidden="true" /><small>Pokédex nacional</small><b>No. {String(baseInfo.id).padStart(4, "0")}</b></div>
                        <h2 id={titleId}>{formatName(baseInfo.name)}</h2>
                        {(formIdentity?.formKey || activeForm?.name !== baseInfo.name) && <p className="record-form-label">Forma {formatName((formIdentity?.formKey || activeForm.name).replace(`${baseInfo.name}-`, ""))}</p>}
                    </header>
                    <div className="record-sprite-stage">
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
                    
                    <button type="button" onClick={() => {
                        const selectedFormData = formAppearance?.sprites
                            ? { ...formData, sprites: { ...(formData.sprites || {}), ...formAppearance.sprites } }
                            : formData;
                        onAddToTeam(selectedFormData, baseInfo?.gender_rate ?? -1, formIdentity);
                        onClose();
                    }} className="record-add-partner">
                        <span className="record-mini-ball" aria-hidden="true" /> Adicionar à equipe <span aria-hidden="true">＋</span>
                    </button>

                    <div className="record-attributes">
                        <div className="record-types" role="group" aria-label="Tipos deste Pokémon">
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
                                    <div key={s.stat.name} className="record-stat-row">
                                        <div className="record-stat-heading">
                                            <span>{STAT_MAP[s.stat.name] || s.stat.name}</span>
                                            <strong>{val}</strong>
                                        </div>
                                        <div className="record-stat-track" role="meter" aria-label={STAT_MAP[s.stat.name] || s.stat.name} aria-valuemin={0} aria-valuemax={Math.max(isTTRPG ? 13 : 255, val)} aria-valuenow={val}>
                                            <div className="record-stat-fill" style={{ width: pct + "%", backgroundColor: primaryColor }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="record-stat-total">
                                <span>{isTTRPG ? "Total no RPG" : "Total de atributos base"}</span>
                                <strong>{bst}</strong>
                            </div>
                            <details className="record-reference-help">
                                <summary>Entender os atributos</summary>
                                <p><strong>HP</strong> é a energia do Pokémon. <strong>Ataque e Defesa</strong> são usados em movimentos físicos; <strong>Ataque Especial e Defesa Especial</strong>, em movimentos especiais. <strong>Velocidade</strong> ajuda a definir a ordem dos turnos.</p>
                            </details>
                        </section>
                    </div>
                </div>

                <div className="pokemon-modal-details record-details">
                    <div className="pokemon-modal-tabs record-tabs" role="tablist" aria-label="Páginas da ficha" onKeyDown={handleTabKeyDown}>
                        {RECORD_TABS.map(item => (
                            <button key={item.id} type="button" role="tab" id={`${recordId}-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={panelId} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>
                                <GameIcon name={item.icon} />{item.label}
                            </button>
                        ))}
                    </div>
                    <div id={panelId} role="tabpanel" aria-labelledby={`${recordId}-tab-${tab}`} tabIndex={0} className="pokemon-modal-body record-body">
                        {tab === "stats" && (
                            <div className="animate-fade-in record-profile">
                                <section className="species-description" aria-labelledby={`${recordId}-description-title`}>
                                    <header className="record-entry-heading">
                                        <h3 id={`${recordId}-description-title`}>Registro da Pokédex</h3>
                                        {record.portuguese && <button type="button" className="record-language-toggle" aria-pressed={recordLanguage === 'pt-BR'} aria-label={recordLanguageLabel} title={recordLanguageLabel} aria-controls={`${recordId}-description-text`} onClick={() => setRecordLanguage(language => language === 'en' ? 'pt-BR' : 'en')}>
                                            {recordLanguage === 'pt-BR' ? 'PT' : 'EN'}
                                        </button>}
                                    </header>
                                    {recordHistory.length > 1 && <div className="record-game-picker">
                                        <label htmlFor={`${recordId}-record-game`}>Registro de</label>
                                        <RoomSelect id={`${recordId}-record-game`} value={recordHistory.some(entry => entry.id === recordVersion) ? recordVersion : 'auto'} onChange={event => setRecordVersion(event.target.value)}>
                                            <option value="auto">Mais recente · {recordHistory[0].label}</option>
                                            {recordHistory.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                                        </RoomSelect>
                                    </div>}
                                    <p id={`${recordId}-description-text`} lang={recordTextLanguage} aria-live="polite" aria-atomic="true">{recordText || speciesDescription.summary}</p>
                                    {record.source && <small className="record-entry-source">{record.label || (record.source === 'pokemon-go' ? 'Pokémon GO' : record.source === 'pokemon-scarlet' ? 'Pokémon Scarlet' : record.source)}{recordTextLanguage === 'pt-BR' && record.sourceKind === 'editorial' ? ' · Tradução MyOwnDex' : ''}</small>}
                                </section>
                                <div className="record-profile-facts">
                                <dl className="record-species-facts">
                                    {profileFacts.map((fact, index) => <div key={`species-fact-${index}`} className={fact.label === 'Categoria' ? 'record-species-category' : undefined}>
                                        <dt>{fact.label}</dt>
                                        <dd>{fact.value}{fact.note && <small>{fact.note}</small>}</dd>
                                    </div>)}
                                </dl>
                                <dl className="record-measurements" aria-label="Medidas desta forma">
                                    <div><dt>Altura</dt><dd>{formatNumberPtBr((formData.height || 0) / 10)} m</dd></div>
                                    <div><dt>Peso</dt><dd>{formatNumberPtBr((formData.weight || 0) / 10)} kg</dd></div>
                                </dl>
                                </div>
                                {referenceFacts.length > 0 && <section className="record-references" aria-labelledby={`${recordId}-references-title`}>
                                    <h3 id={`${recordId}-references-title`}>Referências dos jogos</h3>
                                    <dl className="record-reference-values">
                                        {referenceFacts.map(fact => <div key={fact.label}>
                                            <dt>{fact.label}</dt>
                                            <dd>{fact.value}</dd>
                                        </div>)}
                                    </dl>
                                    <details className="record-reference-help">
                                        <summary>Como interpretar esses valores</summary>
                                        <p>Escala de 0 a {referenceFacts[0].scale}.</p>
                                        {referenceFacts.filter(fact => fact.note).map(fact => <p key={fact.label}><strong>{fact.label}.</strong> {fact.note}</p>)}
                                    </details>
                                </section>}
                                
                                <div>
                                    <h3 className="record-section-title">Habilidades</h3>
                                    <div className="record-abilities-list">{formData.abilities?.map((a, i) => <AbilityCard key={a.ability?.name || i} name={a.ability?.name} url={a.ability?.url} isHidden={a.is_hidden} />)}</div>
                                </div>
                                
                                {baseInfo.varieties?.length > 1 && (
                                    <div>
                                        <h3 className="record-section-title">Formas</h3>
                                        <div className="record-form-options">
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
                                                        className={`record-form-button ${activeForm?.name === v.pokemon?.name ? "is-selected" : ""}`}
                                                    >
                                                        {btnName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <h3 className="record-section-title">Linha evolutiva</h3>
                                    <div className="record-evolution-list">
                                        {evolutionStatus === "loading" ? <p role="status" className="record-section-note">Consultando a linha evolutiva…</p> : evolutionStatus === "unavailable" ? <p className="record-section-note">Não foi possível abrir a linha evolutiva agora.</p> : evoChain.length > 0 ? evoChain.map((path, idx) => (
                                            <ol key={idx} className="record-evolution-path" aria-label={evoChain.length > 1 ? `Caminho evolutivo ${idx + 1}` : "Caminho evolutivo"} style={{ "--evolution-stages": path.length }}>
                                                {path.map((node, i) => (
                                                        <li key={node.name + i} className={`record-evolution-node ${String(node.id) === String(baseInfo.id) ? "is-current" : ""}`} aria-current={String(node.id) === String(baseInfo.id) ? "step" : undefined}>
                                                            <div className="record-evolution-stage">
                                                                <PokemonSprite
                                                                    pokemonId={node.id}
                                                                    className="record-evolution-sprite"
                                                                    alt={formatName(node.name)}
                                                                />
                                                            </div>
                                                            <span className="record-evolution-name">{formatName(node.name)}</span>
                                                        </li>
                                                ))}
                                            </ol>
                                        )) : <p className="record-section-note">Nenhuma evolução conhecida foi registrada para este Pokémon.</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {tab === "defenses" && (
                            <div className="animate-fade-in">
                                <h3 className="record-section-title">Afinidades de tipo</h3>
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
                                <div className="record-moves-heading">
                                    <h3 className="record-section-title">Movimentos</h3>
                                    {learnsetGames.length > 0 && <div className="record-game-picker">
                                        <label htmlFor={`${recordId}-move-game`}>Jogo</label>
                                        <RoomSelect id={`${recordId}-move-game`} value={learnsetVersion === 'auto' || learnsetGames.some(game => game.value === learnsetVersion) ? learnsetVersion : 'auto'} onChange={event => setLearnsetVersion(event.target.value)}>
                                            <option value="auto">Mais recente · {VERSION_LABELS[resolveLearnsetGame(formData.moves)] || selectedMoveGame?.label}</option>
                                            {learnsetGames.map(game => <option key={game.value} value={game.value}>{game.label}</option>)}
                                        </RoomSelect>
                                    </div>}
                                    <span className="record-move-version" aria-live="polite">{formatCount(legalMoves.length, "movimento")} · {VERSION_LABELS[moveVersion] || selectedMoveGame?.label || "Sem registro"}</span>
                                </div>
                                <div className="record-moves-list">
                                    {legalMoves.map(move => <MoveAccordion key={`${moveVersion}-${move.move?.name}`} moveData={move} versionGroup={selectedMoveGame} isTTRPG={isTTRPG} />)}
                                    {!legalMoves.length && <p className="record-section-note">A Pokédex ainda não tem movimentos registrados para esta forma.</p>}
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

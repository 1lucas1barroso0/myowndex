import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatCanonicalItemName, formatCount, formatPartnerArrival } from "../../core/copy.js";
import { formatName, formatType, TYPE_COLORS, TYPE_TEXT_COLORS, VERSION_GROUPS } from "../../core/mechanics.js";
import { createTeam as makeTeam, createId, hydrateTeam, insertImportedPokemon, mergeImportedTeam, normalizeTeam, removeTeamById, restoreTeamAt, touchTeam } from "../../core/team.js";
import { decodeShare, encodePokemonBundle, encodeTeam } from "../../core/teamShare.js";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import PokemonEditor from "./PokemonEditor.jsx";
import "../../pc-retro.css";

const PARTY_SIZE = 6;
const getPartnerSprite = partner => partner?.shiny
    ? partner.species?.sprites?.front_shiny
    : partner?.species?.sprites?.front_default;

function BoxPortraits({ pokemon = [] }) {
    return (
        <span className="pc-box-portraits" aria-hidden="true">
            {Array.from({ length: PARTY_SIZE }, (_, index) => (
                <span key={index} className={`pc-box-portrait ${pokemon[index] ? "is-occupied" : ""}`}>
                    {pokemon[index] ? <PokemonSprite src={getPartnerSprite(pokemon[index])} pokemonId={pokemon[index].species?.id} shiny={pokemon[index].shiny} alt="" /> : <span className="pc-mini-ball" />}
                </span>
            ))}
        </span>
    );
}

const dismissKeyboard = () => {
    if (document.activeElement?.blur) document.activeElement.blur();
};

const copyText = async text => {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
};

export default function Teambuilder({ envProps }) {
    const {
        teams,
        setTeams,
        allItems,
        allMoves,
        allAbilities,
        activeTeamId,
        setActiveTeamId,
        isTTRPG,
        isHackmon,
        experienceMode,
        envLoading,
        envError,
        setNotice,
        onSearchClick
    } = envProps;

    const [editingSlot, setEditingSlot] = useState(null);
    const [importing, setImporting] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importData, setImportData] = useState("");
    const [importError, setImportError] = useState("");
    const [importPreview, setImportPreview] = useState(null);
    const [importStrategy, setImportStrategy] = useState("add");
    const [importTargetId, setImportTargetId] = useState("");
    const [shareScope, setShareScope] = useState("pokemon");
    const [selectedShareIds, setSelectedShareIds] = useState([]);
    const [shareCode, setShareCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [pendingPartnerDelete, setPendingPartnerDelete] = useState(null);
    const partySlotRefs = useRef([]);
    const active = useMemo(() => teams.find(team => team.id === activeTeamId), [teams, activeTeamId]);
    const occupiedSlots = active?.pokemon?.length || 0;
    const freeSlots = PARTY_SIZE - occupiedSlots;

    const selectPartner = index => {
        dismissKeyboard();
        setEditingSlot(index);
    };

    useEffect(() => {
        if (teams.length && !active) setActiveTeamId(teams[0].id);
    }, [teams, active, setActiveTeamId]);

    useEffect(() => {
        setSelectedShareIds([]);
        setShareCode("");
    }, [activeTeamId]);

    const createTeam = () => {
        dismissKeyboard();
        const next = makeTeam(teams.length ? `Box ${teams.length + 1}` : "Box 1");
        setTeams(current => [...current, next]);
        setActiveTeamId(next.id);
        setEditingSlot(null);
        setShareCode("");
    };

    const cloneTeam = () => {
        if (!active) return;
        const id = createId("box");
        const clone = normalizeTeam({
            ...active,
            id,
            shareId: id,
            name: `${active.name} — Cópia`,
            updatedAt: Date.now(),
            pokemon: active.pokemon?.map(partner => ({ ...partner, id: createId("partner") }))
        });
        setTeams(current => [...current, clone]);
        setActiveTeamId(clone.id);
        setEditingSlot(null);
        setShareCode("");
        setNotice?.({ tone: "blue", text: `Uma nova Box foi criada a partir de “${active.name}”.` });
    };

    const updateActive = callback => {
        setShareCode("");
        setTeams(current => current.map(team => team.id === activeTeamId ? touchTeam(callback(team)) : team));
    };

    const openShare = () => {
        if (!active) return;
        setShareScope(active.pokemon?.length ? "pokemon" : "team");
        setSelectedShareIds(active.pokemon?.length === 1 ? [active.pokemon[0].id] : []);
        setShareCode("");
        setCopied(false);
        setSharing(true);
    };

    const generateLinkCode = async () => {
        dismissKeyboard();
        if (!active) return;
        setIsProcessing(true);
        try {
            if (shareScope === "team") {
                setShareCode(await encodeTeam(active));
            } else {
                const selected = active.pokemon.filter(partner => selectedShareIds.includes(partner.id));
                setShareCode(await encodePokemonBundle(selected, active));
            }
            setCopied(false);
        } catch (error) {
            setNotice?.({ tone: "red", text: error?.message || "O Link Cable não conseguiu preparar este envio. Tente novamente." });
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await copyText(shareCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 3000);
        } catch {
            setNotice?.({ tone: "red", text: "Não foi possível copiar o código com um toque. Selecione o conteúdo e use a opção Copiar do aparelho." });
        }
    };

    const resetImport = () => {
        setImporting(false);
        setImportData("");
        setImportError("");
        setImportPreview(null);
        setImportStrategy("add");
        setImportTargetId("");
    };

    const previewLinkCable = async () => {
        dismissKeyboard();
        setIsProcessing(true);
        setImportError("");
        try {
            const decoded = await decodeShare(importData);
            const sourceTeam = decoded.kind === "team"
                ? decoded.team
                : normalizeTeam({
                    name: decoded.sourceName,
                    versionGroup: decoded.versionGroup,
                    pokemon: decoded.pokemon,
                });
            const hydrated = await hydrateTeam(sourceTeam);
            const preview = decoded.kind === "team"
                ? { kind: "team", team: hydrated, pokemon: hydrated.pokemon, sourceName: hydrated.name }
                : { kind: "pokemon", pokemon: hydrated.pokemon, sourceName: decoded.sourceName, versionGroup: decoded.versionGroup };
            const suggested = teams.find(team => team.id === activeTeamId && 6 - team.pokemon.length >= preview.pokemon.length)
                || teams.find(team => 6 - team.pokemon.length >= preview.pokemon.length);
            setImportPreview(preview);
            setImportStrategy(decoded.kind === "team" ? "team" : "add");
            setImportTargetId(suggested?.id || "__new__");
        } catch (error) {
            setImportError(error?.message || "O Link Cable não conseguiu ler este envio. Confira o código e tente novamente.");
        } finally {
            setIsProcessing(false);
        }
    };

    const receiveViaLinkCable = () => {
        if (!importPreview) return;
        if (importPreview.kind === "team" && importStrategy === "team") {
            const result = mergeImportedTeam(teams, importPreview.team);
            setTeams(result.teams);
            setActiveTeamId(result.team.id);
            const messages = {
                added: `Box recebida! ${formatPartnerArrival(result.team.pokemon?.length)}`,
                replaced: "A versão mais recente desta Box chegou e substituiu a anterior.",
                ignored: "Esta Box já está na versão mais recente. Nenhuma cópia foi criada.",
            };
            setNotice?.({ tone: "blue", text: messages[result.status] });
            setEditingSlot(null);
            resetImport();
            return;
        }

        let sourceTeams = teams;
        let destinationId = importTargetId;
        if (destinationId === "__new__") {
            const created = makeTeam(importPreview.sourceName || "Box recebida");
            sourceTeams = [...teams, created];
            destinationId = created.id;
        }
        const result = insertImportedPokemon(sourceTeams, destinationId, importPreview.pokemon);
        if (!result.team || result.status === "full" || result.status === "missing-target") {
            setImportError("Essa Box não tem espaço suficiente. Escolha outra Box ou crie uma nova.");
            return;
        }
        setTeams(result.teams);
        setActiveTeamId(result.team.id);
        setEditingSlot(null);
        setNotice?.({
            tone: result.rejected.length ? "amber" : "blue",
            text: result.rejected.length
                ? `${result.added.length} Pokémon chegaram a ${result.team.name}; ${result.rejected.length} ficaram de fora por falta de espaço.`
                : `${formatPartnerArrival(result.added.length)} ${result.team.name} foi atualizada.`,
        });
        resetImport();
    };

    const confirmDeleteActive = () => {
        if (!pendingDelete) return;
        const result = removeTeamById(teams, pendingDelete.id);
        if (!result.removed) {
            setPendingDelete(null);
            return;
        }
        const nextActive = result.teams[Math.min(result.index, result.teams.length - 1)] || null;
        setTeams(result.teams);
        setActiveTeamId(nextActive?.id || null);
        setEditingSlot(null);
        setShareCode("");
        setPendingDelete(null);
        setNotice?.({
            tone: "amber",
            text: `“${result.removed.name}” foi removida do PC.`,
            actionLabel: "Desfazer",
            onAction: () => {
                setTeams(current => restoreTeamAt(current, result.removed, result.index));
                setActiveTeamId(result.removed.id);
                setNotice?.({ tone: "blue", text: `“${result.removed.name}” voltou ao PC.` });
            }
        });
    };

    const confirmDeletePartner = () => {
        if (!pendingPartnerDelete) return;
        const { teamId, partner, index } = pendingPartnerDelete;
        setTeams(current => current.map(team => team.id === teamId
            ? touchTeam({
                ...team,
                pokemon: (team.pokemon || []).filter(candidate => candidate.id !== partner.id),
            })
            : team
        ));
        setEditingSlot(null);
        setPendingPartnerDelete(null);
        setNotice?.({
            tone: "amber",
            text: `${partner.nickname || formatName(partner.species?.name)} saiu da Box.`,
            actionLabel: "Desfazer",
            onAction: () => {
                setTeams(current => current.map(team => {
                    if (team.id !== teamId || team.pokemon.some(candidate => candidate.id === partner.id)) return team;
                    const pokemon = [...team.pokemon];
                    pokemon.splice(Math.min(Math.max(0, index), pokemon.length), 0, partner);
                    return touchTeam({ ...team, pokemon });
                }));
                setActiveTeamId(teamId);
                setEditingSlot(index);
                setNotice?.({ tone: "blue", text: `${partner.nickname || formatName(partner.species?.name)} voltou para a Box.` });
            },
        });
    };


    return (
        <div className="pc-workspace pc-retro flex flex-col xl:flex-row gap-5 animate-fade-in w-full">
            <aside className="pc-sidebar w-full xl:w-1/4 xl:sticky xl:top-24 self-start game-panel p-4 sm:p-5 flex flex-col gap-3 h-full xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pb-6" aria-label="Boxes do PC">
                <div className="pc-sidebar-heading mb-2 flex items-center justify-between gap-3 px-1">
                    <div>
                        <span className="pc-eyebrow"><span className="pc-status-light" aria-hidden="true" /> Sistema de armazenamento</span>
                        <h3 className="text-base font-black text-slate-800">PC do Bill</h3>
                    </div>
                    <span className="pc-box-count rounded-full bg-blue-100 px-2.5 py-1.5 text-xs font-black text-blue-700">{formatCount(teams.length, "Box", "Boxes")}</span>
                </div>
                <div className="pc-box-list">
                {teams.map(team => (
                    <button
                        type="button"
                        key={team.id}
                        aria-pressed={activeTeamId === team.id}
                        aria-label={`${team.name}, ${team.pokemon?.length || 0} de 6 Pokémon`}
                        onClick={() => {
                            dismissKeyboard();
                            setActiveTeamId(team.id);
                            setEditingSlot(null);
                            setShareCode("");
                        }}
                        className={`pc-box-button w-full p-3.5 rounded-xl text-left font-black text-sm border transition-all outline-none shadow-sm break-words ${activeTeamId === team.id ? "is-selected bg-blue-600 border-blue-700 text-white shadow-[0_3px_0_#0EA5E9] translate-y-[-1px]" : "bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-white"}`}
                    >
                        <span className="pc-box-button-heading flex justify-between gap-3">
                            <span><span className="pc-box-cursor" aria-hidden="true">{activeTeamId === team.id ? "▶" : "▸"}</span>{team.name}</span>
                            <span className="pc-box-capacity">{team.pokemon?.length || 0}/6</span>
                        </span>
                        <BoxPortraits pokemon={team.pokemon} />
                    </button>
                ))}
                </div>
                <button type="button" onClick={createTeam} className="pc-create-box-button w-full p-3.5 mt-1 text-xs font-black border-2 border-dashed rounded-xl transition-all outline-none">+ Criar nova Box</button>

                <div className="mt-3 pt-4 border-t border-slate-200">
                    <button type="button" onClick={() => setImporting(true)} className="pc-import-button w-full p-3.5 text-xs font-black border rounded-xl transition-all outline-none shadow-sm">
                        <span aria-hidden="true">⇩</span>
                        <span>Importar Pokémon ou Box</span>
                    </button>
                    <p className="pc-sidebar-tip mt-2 px-1 text-xs font-semibold leading-relaxed text-slate-500">Pelo Link Cable, seus parceiros podem viajar para outra aventura.</p>
                </div>
            </aside>

            <section className="w-full xl:w-3/4 min-w-0 flex-1">
                {!active && <div className="pc-empty-state">
                    <div className="pc-welcome-partners" aria-hidden="true">{[133, 25].map(id => <PokemonSprite key={id} pokemonId={id} alt="" className="pixelated" />)}</div>
                    <span className="screen-eyebrow">Conexão com o PC estabelecida!</span>
                    <h2>Sua próxima aventura começa aqui.</h2>
                    <p>Eevee e Pikachu já estão de olho! Abra uma Box para guardar até seis parceiros ou receba uma equipe pelo Link Cable.</p>
                    <button type="button" onClick={createTeam} className="room-primary-button">Abrir primeira Box</button>
                </div>}
                {active && (
                    <div className="game-panel pc-main-panel p-4 sm:p-6 md:p-8">
                        <div className="pc-screen-topline">
                            <span><span className="pc-mini-ball" aria-hidden="true" /> Organização de Pokémon</span>
                            <span className="pc-storage-status">{occupiedSlots === PARTY_SIZE ? "Equipe completa!" : `${freeSlots} ${freeSlots === 1 ? "espaço livre" : "espaços livres"}`}</span>
                        </div>
                        <div className="pc-toolbar flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b-4 border-slate-100 pb-5">
                            <div className="w-full min-w-0">
                                <label htmlFor="active-box-name" className="sr-only">Nome da Box</label>
                                <input id="active-box-name" type="text" value={active.name || ""} onKeyDown={event => event.key === "Enter" && event.currentTarget.blur()} onChange={event => updateActive(team => ({ ...team, name: event.target.value }))} className="pc-box-name bg-transparent text-2xl sm:text-3xl font-black text-slate-800 focus:outline-none w-full min-w-0 tracking-tight border-b-4 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-1" placeholder="Nome da Box" />
                                <label className="mt-3 flex max-w-md items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Jogo de referência
                                    <select value={active.versionGroup || "auto"} onChange={event => updateActive(team => ({ ...team, versionGroup: event.target.value }))} className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-700 outline-none focus:border-blue-400">
                                        {VERSION_GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
                                    </select>
                                </label>
                                <p className="pc-reference-tip mt-2 text-xs font-semibold text-slate-500">Os movimentos e as habilidades acompanham o jogo da sua aventura.</p>
                            </div>

                            <div className="pc-toolbar-actions flex gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
                                <button type="button" onClick={openShare} disabled={isProcessing} title="Compartilhar Box ou Pokémon" className="pc-action-button is-share flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 border shadow-sm rounded-xl outline-none disabled:opacity-50">
                                    <span aria-hidden="true">↗</span><span className="text-xs font-black">Compartilhar</span>
                                </button>
                                <button type="button" onClick={cloneTeam} title="Duplicar Box" className="pc-action-button is-duplicate flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 border shadow-sm rounded-xl outline-none"><span aria-hidden="true">⧉</span><span className="text-xs font-black">Duplicar</span></button>
                                <button type="button" onClick={() => setPendingDelete(active)} title="Apagar Box" className="pc-action-button is-delete flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 border shadow-sm rounded-xl outline-none"><span aria-hidden="true">⌫</span><span className="text-xs font-black">Apagar</span></button>
                            </div>
                        </div>

                        {(envLoading || envError) && (
                            <div className="mb-6 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-bold text-slate-500">
                                {envLoading ? "Rotom está preparando movimentos, habilidades e itens…" : envError}
                            </div>
                        )}

                        <div className="pc-party-ribbon" aria-label="Acesso rápido aos seis espaços da Box">
                            {Array.from({ length: PARTY_SIZE }, (_, index) => {
                                const partner = active.pokemon?.[index];
                                return (
                                    <button
                                        key={partner?.id || `slot-${index}`}
                                        type="button"
                                        className={`pc-party-slot ${partner ? "is-occupied" : "is-empty"} ${partner && editingSlot === index ? "is-selected" : ""}`}
                                        onClick={() => partner ? selectPartner(index) : onSearchClick()}
                                        aria-pressed={Boolean(partner && editingSlot === index)}
                                        ref={element => { partySlotRefs.current[index] = element; }}
                                        aria-label={partner ? `Abrir ficha de ${partner.nickname || formatName(partner.species?.name)}, espaço ${index + 1}` : `Espaço ${index + 1} livre: buscar um Pokémon`}
                                        title={partner ? partner.nickname || formatName(partner.species?.name) : "Um lugar para o próximo parceiro"}
                                    >
                                        <span className="pc-party-slot-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                                        {partner
                                            ? <PokemonSprite src={getPartnerSprite(partner)} pokemonId={partner.species?.id} shiny={partner.shiny} alt="" className="pixelated" />
                                            : <span className="pc-empty-ball" aria-hidden="true" />}
                                        <span className="pc-party-slot-label">{partner ? `Nv. ${partner.level || 1}` : "+"}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={`pc-grid-heading ${occupiedSlots ? "" : "is-empty"}`}>
                            {!occupiedSlots && <span className="pc-box-guide-sprite" aria-hidden="true"><PokemonSprite pokemonId={133} alt="" className="pixelated" /></span>}
                            <h3>{occupiedSlots ? "Seus parceiros" : "A Box está esperando por você"}</h3>
                            <p>{occupiedSlots ? "Escolha um parceiro para abrir a ficha." : "Toque em um espaço e encontre seu primeiro Pokémon."}</p>
                        </div>

                        <div className="pc-partner-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 w-full">
                            {active.pokemon?.map((partner, index) => {
                                const sprite = getPartnerSprite(partner);
                                const types = (partner.species?.types || []).map(entry => entry.type?.name).filter(Boolean);
                                return (
                                    <button type="button" key={partner.id || `${partner.species?.name}-${index}`} onClick={() => selectPartner(index)} aria-pressed={editingSlot === index} style={{ "--pc-partner-type": TYPE_COLORS[types[0]] || "var(--ui-line)" }} className={`pc-partner-card p-3 sm:p-4 rounded-2xl border-2 cursor-pointer flex gap-3 sm:gap-4 items-center transition-all relative group shadow-sm text-left ${editingSlot === index ? "is-selected bg-blue-50 border-blue-400 shadow-[0_4px_0_#38BDF8] translate-y-[-2px]" : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-white"}`}>
                                        {partner.canGMax && <span className="absolute -bottom-4 -right-4 text-red-500/10 text-[80px] font-black rotate-12 pointer-events-none">X</span>}
                                        <span className="pc-card-position" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="pc-partner-sprite w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl border-2 border-slate-100 flex items-center justify-center shadow-inner relative z-10 flex-shrink-0">
                                            <PokemonSprite src={sprite} pokemonId={partner.species?.id} shiny={partner.shiny} className="w-10 h-10 sm:w-14 sm:h-14 pixelated drop-shadow-md group-hover:scale-110 transition-transform" alt="" />
                                            {partner.shiny && <span className="pc-shiny-mark" role="img" aria-label="Shiny">✦</span>}
                                        </span>
                                        <span className="relative z-10 min-w-0 flex-1">
                                            <span className="flex items-center justify-between gap-1 sm:gap-2 mb-0.5">
                                                <span className="pc-partner-name font-black text-xs sm:text-sm text-slate-800 capitalize">{partner.nickname || formatName(partner.species?.name)}</span>
                                                <span aria-label={partner.gender === "M" ? "Macho" : partner.gender === "F" ? "Fêmea" : "Sem gênero definido"} className={`pc-partner-gender text-[9px] sm:text-xs font-black px-1.5 py-0.5 rounded border shrink-0 ${partner.gender === "M" ? "text-blue-500 bg-blue-50 border-blue-200" : partner.gender === "F" ? "text-pink-500 bg-pink-50 border-pink-200" : "text-slate-400 bg-slate-100 border-slate-200"}`}>{partner.gender === "M" ? "♂" : partner.gender === "F" ? "♀" : "⚲"}</span>
                                            </span>
                                            <span className="pc-partner-meta block text-[9px] sm:text-[10px] font-bold text-slate-400">{partner.nickname ? `${formatName(partner.species?.name)} • ` : ""}Nv. {partner.level || 1} • {partner.item ? formatCanonicalItemName(partner.item) : "Sem item"}</span>
                                            <span className="pc-partner-types">
                                                {types.map(type => <span key={type} style={{ backgroundColor: TYPE_COLORS[type], color: TYPE_TEXT_COLORS[type] }}>{formatType(type)}</span>)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                            {Array.from({ length: Math.max(0, freeSlots) }, (_, index) => (
                                <button key={`empty-${index}`} type="button" onClick={onSearchClick} className="pc-add-partner p-3 sm:p-4 rounded-2xl border-2 border-dashed flex justify-center items-center text-[10px] font-black transition-all min-h-[80px] sm:min-h-[96px] outline-none">
                                    <span className="pc-empty-ball" aria-hidden="true" />
                                    <span><strong>Buscar um Pokémon</strong><small>Espaço {occupiedSlots + index + 1} · Um novo amigo cabe aqui</small></span>
                                    <span className="pc-add-plus" aria-hidden="true">+</span>
                                </button>
                            ))}
                        </div>

                        {editingSlot !== null && active.pokemon?.[editingSlot] && (
                            <div className="pc-editor-region mt-4 sm:mt-6">
                                <div className="pc-editor-heading">
                                    <span><span aria-hidden="true">▶</span> Ficha de {active.pokemon[editingSlot].nickname || formatName(active.pokemon[editingSlot].species?.name)}</span>
                                    <button type="button" onClick={() => { partySlotRefs.current[editingSlot]?.focus(); setEditingSlot(null); }}>Fechar ficha <span aria-hidden="true">×</span></button>
                                </div>
                                <PokemonEditor
                                    pk={active.pokemon[editingSlot]}
                                    updatePk={next => updateActive(team => {
                                        const pokemon = [...(team.pokemon || [])];
                                        pokemon[editingSlot] = next;
                                        return { ...team, pokemon };
                                    })}
                                    envProps={{
                                        allItems,
                                        allMoves,
                                        allAbilities,
                                        selectedVersionGroup: active.versionGroup || "auto",
                                        experienceMode,
                                        onRemove: () => setPendingPartnerDelete({
                                            teamId: active.id,
                                            partner: active.pokemon[editingSlot],
                                            index: editingSlot,
                                        }),
                                        isTTRPG,
                                        isHackmon
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </section>
            {sharing && active && (
                <div className="link-cable-overlay" role="presentation">
                    <section className="link-cable-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
                        <button type="button" className="link-cable-close" onClick={() => { setSharing(false); setShareCode(""); }} aria-label="Fechar compartilhamento">×</button>
                        <span className="link-cable-kicker">Link Cable</span>
                        <h2 id="share-dialog-title">O que você quer compartilhar?</h2>
                        <p className="link-cable-intro">Envie a Box inteira ou escolha só os Pokémon que devem viajar. O aparelho que receber decide em qual Box colocá-los.</p>

                        {!shareCode ? (
                            <>
                                <div className="link-cable-segment" role="radiogroup" aria-label="Tipo de compartilhamento">
                                    <button type="button" role="radio" aria-checked={shareScope === "pokemon"} onClick={() => setShareScope("pokemon")} disabled={!active.pokemon.length}>
                                        <strong>Pokémon escolhidos</strong>
                                        <small>Um ou vários parceiros</small>
                                    </button>
                                    <button type="button" role="radio" aria-checked={shareScope === "team"} onClick={() => setShareScope("team")}>
                                        <strong>Box inteira</strong>
                                        <small>Equipe e jogo de referência</small>
                                    </button>
                                </div>

                                {shareScope === "pokemon" && (
                                    <div className="link-cable-partners" aria-label="Pokémon para compartilhar">
                                        {active.pokemon.map(partner => {
                                            const selected = selectedShareIds.includes(partner.id);
                                            const sprite = partner.shiny ? partner.species?.sprites?.front_shiny : partner.species?.sprites?.front_default;
                                            return (
                                                <button
                                                    type="button"
                                                    key={partner.id}
                                                    aria-pressed={selected}
                                                    onClick={() => setSelectedShareIds(current => selected
                                                        ? current.filter(id => id !== partner.id)
                                                        : [...current, partner.id]
                                                    )}
                                                >
                                                    <span className="link-cable-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                                                    <PokemonSprite src={sprite} pokemonId={partner.species?.id} shiny={partner.shiny} alt="" className="pixelated" fallbackClassName="link-cable-sprite-fallback" />
                                                    <span><strong>{partner.nickname || formatName(partner.species?.name)}</strong><small>{formatName(partner.species?.name)} • Nv. {partner.level}</small></span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="link-cable-footer">
                                    <span>{shareScope === "team" ? `${active.pokemon.length}/6 Pokémon na Box` : selectedShareIds.length === 1 ? "1 Pokémon escolhido" : `${selectedShareIds.length} Pokémon escolhidos`}</span>
                                    <button type="button" className="link-cable-primary" onClick={generateLinkCode} disabled={isProcessing || (shareScope === "pokemon" && !selectedShareIds.length)}>
                                        {isProcessing ? "Preparando…" : "Gerar código"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="link-cable-result animate-fade-in">
                                <span className="link-cable-success" aria-hidden="true">✓</span>
                                <strong>Envio pronto</strong>
                                <p>Copie o código abaixo e envie por qualquer aplicativo. Ele contém apenas o que você escolheu.</p>
                                <label>
                                    <span className="sr-only">Código de compartilhamento</span>
                                    <textarea readOnly value={shareCode} rows={5} onFocus={event => event.currentTarget.select()} />
                                </label>
                                <div>
                                    <button type="button" className="link-cable-primary" onClick={copyToClipboard}>{copied ? "Código copiado!" : "Copiar código"}</button>
                                    <button type="button" className="link-cable-secondary" onClick={() => setShareCode("")}>Mudar seleção</button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {importing && (
                <div className="link-cable-overlay" role="presentation">
                    <section className="link-cable-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
                        <button type="button" className="link-cable-close" onClick={resetImport} aria-label="Fechar importação">×</button>
                        <span className="link-cable-kicker">Link Cable</span>
                        <h2 id="import-dialog-title">{importPreview ? "Escolha onde guardar" : "Receber Pokémon ou Box"}</h2>
                        <p className="link-cable-intro">{importPreview ? "Confira o conteúdo e escolha o destino. Sua Box atual não será substituída." : "Cole um código do MyOwnDex. Primeiro mostraremos tudo o que chegou; nada será salvo ainda."}</p>

                        {!importPreview ? (
                            <>
                                <label className="link-cable-code-field" htmlFor="link-cable-code">
                                    <span>Código compartilhado</span>
                                    <textarea id="link-cable-code" disabled={isProcessing} value={importData} onChange={event => { setImportData(event.target.value); setImportError(""); }} rows={7} placeholder="Cole aqui o código da Box ou dos Pokémon…" autoFocus />
                                </label>
                                {importError && <div role="alert" className="link-cable-error">{importError}</div>}
                                <div className="link-cable-footer">
                                    <button type="button" className="link-cable-secondary" onClick={resetImport}>Cancelar</button>
                                    <button type="button" className="link-cable-primary" onClick={previewLinkCable} disabled={isProcessing || !importData.trim()}>{isProcessing ? "Lendo…" : "Conferir conteúdo"}</button>
                                </div>
                            </>
                        ) : (
                            <div className="link-cable-import-preview animate-fade-in">
                                <div className="link-cable-preview-heading">
                                    <span><strong>{importPreview.sourceName}</strong><small>{formatCount(importPreview.pokemon.length, "Pokémon", "Pokémon")} no envio</small></span>
                                    <button type="button" onClick={() => { setImportPreview(null); setImportError(""); }}>Trocar código</button>
                                </div>
                                <div className="link-cable-preview-list">
                                    {importPreview.pokemon.map((partner, index) => {
                                        const sprite = partner.shiny ? partner.species?.sprites?.front_shiny : partner.species?.sprites?.front_default;
                                        return (
                                            <span key={partner.id || index}>
                                                <PokemonSprite src={sprite} pokemonId={partner.species?.id} shiny={partner.shiny} alt="" className="pixelated" fallbackClassName="link-cable-sprite-fallback" />
                                                <b>{partner.nickname || formatName(partner.species?.name)}</b>
                                                <small>Nv. {partner.level}</small>
                                            </span>
                                        );
                                    })}
                                </div>

                                {importPreview.kind === "team" && (
                                    <div className="link-cable-segment" role="radiogroup" aria-label="Como receber a Box">
                                        <button type="button" role="radio" aria-checked={importStrategy === "team"} onClick={() => setImportStrategy("team")}>
                                            <strong>Como Box inteira</strong>
                                            <small>Mantém a equipe compartilhada</small>
                                        </button>
                                        <button type="button" role="radio" aria-checked={importStrategy === "add"} onClick={() => setImportStrategy("add")}>
                                            <strong>Adicionar a uma Box</strong>
                                            <small>Preenche espaços disponíveis</small>
                                        </button>
                                    </div>
                                )}

                                {(importPreview.kind === "pokemon" || importStrategy === "add") && (
                                    <label className="link-cable-destination">
                                        <span>Box de destino</span>
                                        <select value={importTargetId} onChange={event => { setImportTargetId(event.target.value); setImportError(""); }}>
                                            {teams.map(team => {
                                                const free = Math.max(0, 6 - team.pokemon.length);
                                                const fits = free >= importPreview.pokemon.length;
                                                return <option key={team.id} value={team.id} disabled={!fits}>{team.name} • {free} {free === 1 ? "espaço" : "espaços"}{fits ? "" : " (não cabe)"}</option>;
                                            })}
                                            <option value="__new__">Criar nova Box para este envio</option>
                                        </select>
                                        <small>{importTargetId === "__new__" ? "Uma nova Box será criada somente porque você escolheu essa opção." : "Os Pokémon entrarão nos espaços livres desta Box."}</small>
                                    </label>
                                )}
                                {importError && <div role="alert" className="link-cable-error">{importError}</div>}
                                <div className="link-cable-footer">
                                    <button type="button" className="link-cable-secondary" onClick={resetImport}>Cancelar</button>
                                    <button type="button" className="link-cable-primary" onClick={receiveViaLinkCable}>{importPreview.kind === "team" && importStrategy === "team" ? "Receber Box inteira" : "Adicionar à Box escolhida"}</button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}
            <ConfirmDialog
                open={Boolean(pendingDelete)}
                title="Apagar esta Box?"
                description={pendingDelete ? `“${pendingDelete.name}” guarda ${formatCount(pendingDelete.pokemon?.length || 0, "parceiro")}. Se mudar de ideia, você poderá desfazer logo depois.` : ""}
                confirmLabel="Apagar Box"
                onConfirm={confirmDeleteActive}
                onCancel={() => setPendingDelete(null)}
            />
            <ConfirmDialog
                open={Boolean(pendingPartnerDelete)}
                title="Remover este parceiro?"
                description={pendingPartnerDelete ? `${pendingPartnerDelete.partner.nickname || formatName(pendingPartnerDelete.partner.species?.name)} sairá desta Box. Se mudar de ideia, você poderá desfazer logo depois.` : ""}
                confirmLabel="Remover parceiro"
                onConfirm={confirmDeletePartner}
                onCancel={() => setPendingPartnerDelete(null)}
            />
        </div>
    );
}

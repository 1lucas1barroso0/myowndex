import React, { useEffect, useMemo, useState } from "react";
import { formatCanonicalItemName, formatCount, formatPartnerArrival } from "../../core/copy.js";
import { formatName, VERSION_GROUPS } from "../../core/mechanics.js";
import { createTeam as makeTeam, createId, hydrateTeam, insertImportedPokemon, mergeImportedTeam, normalizeTeam, removeTeamById, restoreTeamAt, touchTeam } from "../../core/team.js";
import { decodeShare, encodePokemonBundle, encodeTeam } from "../../core/teamShare.js";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import PokemonEditor from "./PokemonEditor.jsx";

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
    const active = useMemo(() => teams.find(team => team.id === activeTeamId), [teams, activeTeamId]);

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

    if (!teams.length) {
        return (
            <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-[2rem] border-4 border-slate-200 bg-white p-6 text-center shadow-[0_10px_0_#cbd5e1] sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl" aria-hidden="true">📦</div>
                    <h2 className="text-2xl font-black text-slate-800">Seu PC está pronto para a primeira equipe</h2>
                    <p className="mt-3 text-sm text-slate-500">Abra uma Box, reúna seus parceiros e prepare a próxima aventura no seu ritmo.</p>
                    <button type="button" onClick={createTeam} className="mt-6 rounded-2xl bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_4px_0_#991b1b] transition-all hover:bg-red-600 outline-none">Abrir primeira Box</button>
                </div>
            </div>
        );
    }

    return (
        <div className="pc-workspace flex flex-col xl:flex-row gap-5 animate-fade-in w-full">
            <aside className="pc-sidebar w-full xl:w-1/4 xl:sticky xl:top-24 self-start game-panel p-4 sm:p-5 flex flex-col gap-3 h-full xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pb-6" aria-label="Boxes do PC">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <div>
                        <span className="pc-eyebrow">Suas equipes</span>
                        <h3 className="text-base font-black text-slate-800">PC do Bill</h3>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1.5 text-xs font-black text-blue-700">{formatCount(teams.length, "Box", "Boxes")}</span>
                </div>
                {teams.map(team => (
                    <button
                        type="button"
                        key={team.id}
                        onClick={() => {
                            dismissKeyboard();
                            setActiveTeamId(team.id);
                            setEditingSlot(null);
                            setShareCode("");
                        }}
                        className={`pc-box-button w-full p-3.5 rounded-xl text-left font-black text-sm border transition-all outline-none shadow-sm break-words ${activeTeamId === team.id ? "bg-blue-600 border-blue-700 text-white shadow-[0_3px_0_#1d4ed8] translate-y-[-1px]" : "bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-white"}`}
                    >
                        <span className="flex justify-between gap-3">
                            <span>{team.name}</span>
                            <span className="opacity-70">{team.pokemon?.length || 0}/6</span>
                        </span>
                    </button>
                ))}
                <button type="button" onClick={createTeam} className="w-full p-3.5 mt-1 text-xs font-black text-slate-600 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all outline-none">+ Criar nova Box</button>

                <div className="mt-3 pt-4 border-t border-slate-200">
                    <button type="button" onClick={() => setImporting(true)} className="pc-import-button w-full p-3.5 text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:text-white hover:bg-blue-600 transition-all outline-none shadow-sm">
                        <span aria-hidden="true">⇩</span>
                        <span>Importar Pokémon ou Box</span>
                    </button>
                    <p className="mt-2 px-1 text-xs font-semibold leading-relaxed text-slate-500">Escolha a Box de destino antes de salvar. Nada é substituído sem você decidir.</p>
                </div>
            </aside>

            <section className="w-full xl:w-3/4 min-w-0 flex-1">
                {active && (
                    <div className="game-panel p-4 sm:p-6 md:p-8 overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b-4 border-slate-100 pb-5">
                            <div className="w-full min-w-0">
                                <label htmlFor="active-box-name" className="sr-only">Nome da Box</label>
                                <input id="active-box-name" type="text" value={active.name || ""} onKeyDown={event => event.key === "Enter" && event.currentTarget.blur()} onChange={event => updateActive(team => ({ ...team, name: event.target.value }))} className="bg-transparent text-2xl sm:text-3xl font-black text-slate-800 focus:outline-none w-full min-w-0 tracking-tight border-b-4 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-1 truncate" placeholder="Nome da Box" />
                                <label className="mt-3 flex max-w-md items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Jogo de referência
                                    <select value={active.versionGroup || "auto"} onChange={event => updateActive(team => ({ ...team, versionGroup: event.target.value }))} className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-700 outline-none focus:border-blue-400">
                                        {VERSION_GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
                                    </select>
                                </label>
                                <p className="mt-2 text-xs font-semibold text-slate-500">As sugestões acompanham o jogo escolhido. Você continua livre para registrar escolhas próprias da aventura.</p>
                            </div>

                            <div className="flex gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
                                <button type="button" onClick={openShare} disabled={isProcessing} title="Compartilhar Box ou Pokémon" className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-sm rounded-xl outline-none disabled:opacity-50">
                                    <span aria-hidden="true">↗</span><span className="text-xs font-black">Compartilhar</span>
                                </button>
                                <button type="button" onClick={cloneTeam} title="Duplicar Box" className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm rounded-xl outline-none"><span aria-hidden="true">⧉</span><span className="text-xs font-black">Duplicar</span></button>
                                <button type="button" onClick={() => setPendingDelete(active)} title="Apagar Box" className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-red-600 hover:bg-red-50 border border-red-200 shadow-sm rounded-xl outline-none"><span aria-hidden="true">⌫</span><span className="text-xs font-black">Apagar</span></button>
                            </div>
                        </div>

                        {(envLoading || envError) && (
                            <div className="mb-6 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-bold text-slate-500">
                                {envLoading ? "Rotom está preparando movimentos, habilidades e itens…" : envError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 w-full">
                            {active.pokemon?.map((partner, index) => {
                                const sprite = partner.shiny
                                    ? partner.species?.sprites?.front_shiny
                                    : partner.species?.sprites?.front_default;
                                return (
                                    <button type="button" key={partner.id || `${partner.species?.name}-${index}`} onClick={() => { dismissKeyboard(); setEditingSlot(index); }} className={`p-3 sm:p-4 rounded-2xl border-2 cursor-pointer flex gap-3 sm:gap-4 items-center transition-all relative overflow-hidden group shadow-sm text-left ${editingSlot === index ? "bg-blue-50 border-blue-400 shadow-[0_4px_0_#60a5fa] translate-y-[-2px]" : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-white"}`}>
                                        {partner.canGMax && <span className="absolute -bottom-4 -right-4 text-red-500/10 text-[80px] font-black rotate-12 pointer-events-none">X</span>}
                                        <span className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl border-2 border-slate-100 flex items-center justify-center shadow-inner relative z-10 flex-shrink-0">
                                            {sprite ? <img src={sprite} className="w-10 h-10 sm:w-14 sm:h-14 pixelated drop-shadow-md group-hover:scale-110 transition-transform" alt="" /> : <span className="text-[9px] font-black text-slate-400 uppercase">---</span>}
                                        </span>
                                        <span className="relative z-10 min-w-0 flex-1">
                                            <span className="flex items-center justify-between gap-1 sm:gap-2 mb-0.5">
                                                <span className="font-black text-xs sm:text-sm text-slate-800 capitalize truncate">{partner.nickname || formatName(partner.species?.name)}</span>
                                                <span className={`text-[9px] sm:text-xs font-black px-1.5 py-0.5 rounded border shrink-0 ${partner.gender === "M" ? "text-blue-500 bg-blue-50 border-blue-200" : partner.gender === "F" ? "text-pink-500 bg-pink-50 border-pink-200" : "text-slate-400 bg-slate-100 border-slate-200"}`}>{partner.gender === "M" ? "♂" : partner.gender === "F" ? "♀" : "⚲"}</span>
                                            </span>
                                            <span className="block text-[9px] sm:text-[10px] font-bold text-slate-400 truncate">{partner.nickname ? `${formatName(partner.species?.name)} • ` : ""}Nv. {partner.level || 1} • {partner.item ? formatCanonicalItemName(partner.item) : "Sem item"}</span>
                                        </span>
                                    </button>
                                );
                            })}
                            {(active.pokemon?.length || 0) < 6 && (
                                <button type="button" onClick={onSearchClick} className="p-3 sm:p-4 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col justify-center items-center text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all bg-slate-50 min-h-[80px] sm:min-h-[96px] outline-none">+ Buscar um Pokémon</button>
                            )}
                        </div>

                        {editingSlot !== null && active.pokemon?.[editingSlot] && (
                            <div className="mt-4 sm:mt-6">
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
                                                    {sprite ? <img src={sprite} alt="" className="pixelated" /> : <span className="link-cable-sprite-fallback">?</span>}
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
                                                {sprite ? <img src={sprite} alt="" className="pixelated" /> : <i />}
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

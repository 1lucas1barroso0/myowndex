import React, { useEffect, useMemo, useState } from "react";
import { formatCanonicalItemName, formatCount, formatPartnerArrival } from "../../core/copy.js";
import { formatName, VERSION_GROUPS } from "../../core/mechanics.js";
import { createTeam as makeTeam, createId, hydrateTeam, mergeImportedTeam, normalizeTeam, removeTeamById, restoreTeamAt, touchTeam } from "../../core/team.js";
import { decodeTeam, encodeTeam } from "../../core/teamShare.js";
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
    const [isProcessing, setIsProcessing] = useState(false);
    const [importData, setImportData] = useState("");
    const [importError, setImportError] = useState("");
    const [shareCode, setShareCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [pendingPartnerDelete, setPendingPartnerDelete] = useState(null);
    const active = useMemo(() => teams.find(team => team.id === activeTeamId), [teams, activeTeamId]);

    useEffect(() => {
        if (teams.length && !active) setActiveTeamId(teams[0].id);
    }, [teams, active, setActiveTeamId]);

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

    const generateLinkCode = async () => {
        dismissKeyboard();
        if (!active) return;
        setIsProcessing(true);
        try {
            setShareCode(await encodeTeam(active));
            setCopied(false);
        } catch {
            setNotice?.({ tone: "red", text: "O Link Cable não conseguiu preparar esta Box. Tente novamente." });
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
            setNotice?.({ tone: "red", text: "A cópia automática não funcionou. Selecione o código e copie manualmente." });
        }
    };

    const receiveViaLinkCable = async () => {
        dismissKeyboard();
        setIsProcessing(true);
        setImportError("");
        try {
            const decoded = await decodeTeam(importData);
            const hydrated = await hydrateTeam(decoded);
            const result = mergeImportedTeam(teams, hydrated);
            setTeams(result.teams);
            setActiveTeamId(result.team.id);
            setEditingSlot(null);
            setImporting(false);
            setImportData("");
            const messages = {
                added: `Box recebida! ${formatPartnerArrival(result.team.pokemon?.length)}`,
                replaced: "A versão mais recente desta Box chegou e substituiu a anterior.",
                ignored: "Esta Box já está na versão mais recente. Nenhuma cópia foi criada."
            };
            setNotice?.({ tone: "blue", text: messages[result.status] });
        } catch (error) {
            setImportError(error?.message || "O Link Cable não conseguiu receber esta Box. Confira o código e tente novamente.");
        } finally {
            setIsProcessing(false);
        }
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
        <div className="flex flex-col xl:flex-row gap-6 animate-fade-in w-full">
            <aside className="w-full xl:w-1/4 xl:sticky xl:top-24 self-start game-panel p-4 sm:p-6 flex flex-col gap-3 h-full xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pb-6" aria-label="Boxes do PC">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">PC do Bill</h3>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[9px] font-black text-blue-600">{formatCount(teams.length, "Box", "Boxes")}</span>
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
                        className={`w-full p-4 rounded-2xl text-left font-black text-xs border-2 transition-all outline-none shadow-sm break-words ${activeTeamId === team.id ? "bg-blue-500 border-blue-600 text-white shadow-[0_4px_0_#1d4ed8] translate-y-[-2px]" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-white"}`}
                    >
                        <span className="flex justify-between gap-3">
                            <span>{team.name}</span>
                            <span className="opacity-70">{team.pokemon?.length || 0}/6</span>
                        </span>
                    </button>
                ))}
                <button type="button" onClick={createTeam} className="w-full p-4 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all outline-none">+ Nova Box</button>

                <div className="mt-4 pt-4 border-t-2 border-slate-100">
                    {importing ? (
                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl shadow-inner animate-fade-in">
                            <label htmlFor="link-cable-code" className="block text-[9px] font-black uppercase tracking-widest text-blue-700 mb-2">Código ou link compartilhado</label>
                            <textarea id="link-cable-code" disabled={isProcessing} value={importData} onChange={event => { setImportData(event.target.value); setImportError(""); }} className="w-full min-h-24 resize-y p-2 rounded-xl border-2 border-blue-200 text-xs font-bold text-slate-700 outline-none mb-2 focus:border-blue-500 shadow-inner" placeholder="Cole aqui…" />
                            {importError && <span role="alert" className="text-[9px] font-black text-red-500 mb-2 block">{importError}</span>}
                            {isProcessing ? <div aria-label="Recebendo Box" className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /> : (
                                <div className="flex gap-2">
                                    <button type="button" onClick={receiveViaLinkCable} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl shadow-[0_3px_0_#1d4ed8] outline-none">Receber Box</button>
                                    <button type="button" onClick={() => { setImporting(false); setImportData(""); setImportError(""); }} className="flex-1 bg-white border-2 border-slate-200 text-slate-500 hover:text-red-500 text-[9px] font-black uppercase tracking-widest py-2 rounded-xl hover:border-red-200 transition-colors outline-none">Cancelar</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button type="button" onClick={() => setImporting(true)} className="w-full p-4 text-[10px] font-black uppercase tracking-widest text-blue-500 bg-white border-2 border-blue-200 rounded-2xl hover:text-white hover:bg-blue-500 transition-all outline-none shadow-sm">🔗 Receber por Link Cable</button>
                    )}
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
                                <p className="mt-2 text-[9px] font-bold text-slate-400">As sugestões acompanham o jogo escolhido. Você continua livre para registrar escolhas próprias da aventura.</p>
                            </div>

                            <div className="flex gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
                                <button type="button" onClick={generateLinkCode} disabled={isProcessing} title="Compartilhar Box" className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-blue-500 hover:bg-blue-50 hover:text-blue-600 border-2 border-slate-200 shadow-sm rounded-2xl outline-none disabled:opacity-50">
                                    <span aria-hidden="true">↗</span><span className="text-[9px] font-black uppercase tracking-wider">Compartilhar</span>
                                </button>
                                <button type="button" onClick={cloneTeam} title="Duplicar Box" className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-slate-500 hover:bg-slate-50 border-2 border-slate-200 shadow-sm rounded-2xl outline-none"><span aria-hidden="true">⧉</span><span className="text-[9px] font-black uppercase tracking-wider">Duplicar</span></button>
                                <button type="button" onClick={() => setPendingDelete(active)} title="Apagar Box" className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 bg-white text-red-500 hover:bg-red-50 border-2 border-red-200 shadow-sm rounded-2xl outline-none"><span aria-hidden="true">⌫</span><span className="text-[9px] font-black uppercase tracking-wider">Apagar</span></button>
                            </div>
                        </div>

                        {(envLoading || envError) && (
                            <div className="mb-6 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-bold text-slate-500">
                                {envLoading ? "Rotom está preparando movimentos, habilidades e itens…" : envError}
                            </div>
                        )}

                        {shareCode && (
                            <div className="mb-8 p-4 sm:p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-between shadow-inner animate-fade-in w-full min-w-0">
                                <label className="flex-1 w-full min-w-0">
                                    <span className="sr-only">Código de compartilhamento</span>
                                    <input type="text" readOnly value={shareCode} onFocus={event => event.currentTarget.select()} className="w-full bg-white border-2 border-blue-200 rounded-xl p-2.5 sm:p-3 text-[10px] sm:text-xs font-bold text-slate-600 outline-none shadow-sm" />
                                </label>
                                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                    <button type="button" onClick={copyToClipboard} className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_4px_0_#1d4ed8] outline-none active:translate-y-1 active:shadow-none transition-all">{copied ? "Código copiado!" : "Copiar código"}</button>
                                    <button type="button" onClick={() => setShareCode("")} className="px-3 sm:px-4 py-2.5 sm:py-3.5 bg-white border-2 border-slate-200 text-slate-500 hover:text-red-500 rounded-xl outline-none font-black text-sm" aria-label="Fechar código de compartilhamento">×</button>
                                </div>
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

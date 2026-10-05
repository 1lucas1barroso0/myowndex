import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCanonicalItemName, formatCount, formatPartnerArrival } from "../../core/copy.js";
import { formatName, formatPokemonIdentity, formatType, TYPE_COLORS, TYPE_TEXT_COLORS, VERSION_GROUPS } from "../../core/mechanics.js";
import { createTeam as makeTeam, createId, hydrateTeam, insertImportedPokemon, mergeImportedTeam, normalizeTeam, removeTeamById, restoreTeamAt, touchTeam } from "../../core/team.js";
import { decodeShare, encodePokemonBundle, encodeTeam } from "../../core/teamShare.js";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";
import GameIcon from "../Shared/GameIcon.jsx";
import RoomSelect from "../Shared/RoomSelect.jsx";
import PokemonEditor from "./PokemonEditor.jsx";
import "../../pc-retro.css";

const PARTY_SIZE = 6;
const handleRadioNavigation = event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const choices = [...event.currentTarget.querySelectorAll('button[role="radio"]:not([disabled])')];
    if (!choices.length) return;
    const index = choices.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0
        : event.key === "End" ? choices.length - 1
            : (Math.max(0, index) + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + choices.length) % choices.length;
    event.preventDefault();
    choices[next].focus();
    choices[next].click();
};
const getPartnerSprite = partner => partner?.shiny
    ? partner.species?.sprites?.front_shiny
    : partner?.species?.sprites?.front_default;

const dismissKeyboard = () => {
    const control = document.activeElement;
    if (control?.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"])')) control.blur();
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
    const partnerButtonRefs = useRef([]);
    const editorHeadingRef = useRef(null);
    const linkCableRef = useRef(null);
    const importRequestRef = useRef(0);
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
        if (editingSlot === null || !editorHeadingRef.current) return;
        editorHeadingRef.current.focus({ preventScroll: true });
        editorHeadingRef.current.scrollIntoView({ block: "nearest", behavior: "auto" });
    }, [editingSlot, activeTeamId]);

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
            setNotice?.({ tone: "red", text: "Selecione o código e use a opção Copiar do dispositivo." });
        }
    };

    const resetImport = useCallback(() => {
        importRequestRef.current += 1;
        setImporting(false);
        setImportData("");
        setImportError("");
        setImportPreview(null);
        setImportStrategy("add");
        setImportTargetId("");
    }, []);

    useEffect(() => () => { importRequestRef.current += 1; }, []);

    useEffect(() => {
        if (!sharing && !importing) return;
        const dialog = linkCableRef.current;
        if (!dialog) return;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const inertElements = [];
        const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
            .filter(element => element.tabIndex >= 0 && element.getClientRects().length && !element.closest('[hidden], [inert]'));
        const focusFirst = () => (dialog.querySelector('textarea:not([readonly])') || focusable()[0] || dialog).focus({ preventScroll: true });
        focusFirst();
        document.body.style.overflow = "hidden";
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
                if (sharing) { setSharing(false); setShareCode(""); }
                if (importing) resetImport();
                return;
            }
            if (event.key !== "Tab") return;
            const controls = focusable();
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (!first) { event.preventDefault(); dialog.focus(); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        const handleFocus = event => { if (!dialog.contains(event.target)) focusFirst(); };
        document.addEventListener("keydown", handleKeyDown, true);
        document.addEventListener("focusin", handleFocus);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            document.removeEventListener("focusin", handleFocus);
            document.body.style.overflow = previousOverflow;
            inertElements.forEach(([element, previous]) => { element.inert = previous; });
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
        };
    }, [sharing, importing, resetImport]);

    useEffect(() => {
        if ((sharing || importing) && linkCableRef.current && !linkCableRef.current.contains(document.activeElement)) {
            linkCableRef.current.querySelector("button")?.focus({ preventScroll: true });
        }
    }, [sharing, importing, importPreview, shareCode]);

    const previewLinkCable = async () => {
        const requestId = ++importRequestRef.current;
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
            if (requestId !== importRequestRef.current) return;
            const preview = decoded.kind === "team"
                ? { kind: "team", team: hydrated, pokemon: hydrated.pokemon, sourceName: hydrated.name }
                : { kind: "pokemon", pokemon: hydrated.pokemon, sourceName: decoded.sourceName, versionGroup: decoded.versionGroup };
            const suggested = teams.find(team => team.id === activeTeamId && 6 - team.pokemon.length >= preview.pokemon.length)
                || teams.find(team => 6 - team.pokemon.length >= preview.pokemon.length);
            setImportPreview(preview);
            setImportStrategy(decoded.kind === "team" ? "team" : "add");
            setImportTargetId(suggested?.id || "__new__");
        } catch (error) {
            if (requestId === importRequestRef.current) setImportError(error?.message || "O Link Cable não conseguiu ler este envio. Confira o código e tente novamente.");
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
            text: `${partner.nickname || formatPokemonIdentity(partner)} saiu da Box.`,
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
                setNotice?.({ tone: "blue", text: `${partner.nickname || formatPokemonIdentity(partner)} voltou para a Box.` });
            },
        });
    };


    return (
        <div className="pc-workspace pc-retro animate-fade-in">
            <aside className="pc-sidebar" aria-label="Boxes do PC">
                <header className="pc-sidebar-heading">
                    <div className="pc-storage-title"><h2>Boxes</h2><span className="pc-box-count" aria-hidden="true">{teams.length}</span><span className="sr-only">{formatCount(teams.length, "Box", "Boxes")} no PC</span></div>
                    <PokemonCompanion place="pc" eager />
                </header>
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
                        className={`pc-box-button ${activeTeamId === team.id ? "is-selected" : ""}`}
                    >
                        <span className="pc-box-button-heading">
                            <span><span className="pc-box-cursor" aria-hidden="true">{activeTeamId === team.id ? "▶" : "▸"}</span>{team.name}</span>
                            <span className="pc-box-capacity">{team.pokemon?.length || 0} de 6</span>
                        </span>

                    </button>
                ))}
                </div>
                <button type="button" onClick={createTeam} className="pc-create-box-button">+ Criar nova Box</button>

                <div className="pc-import-region">
                    <button type="button" onClick={() => setImporting(true)} aria-haspopup="dialog" className="pc-import-button">
                        <GameIcon name="receive" />
                        <span>Importar Pokémon ou Box</span>
                    </button>
                </div>
            </aside>

            <section className="pc-content">
                {!active && <div className="pc-empty-state">
                    <h2>Seus parceiros, suas equipes</h2>
                    <p>Organize seus Pokémon em Boxes e leve sua equipe para a aventura.</p>
                    <button type="button" onClick={createTeam} className="room-primary-button">Abrir primeira Box</button>
                </div>}
                {active && (
                    <div className="pc-main-panel">
                        <div className="pc-toolbar">
                            <div className="pc-toolbar-fields">
                                <label className="pc-name-field">
                                    <span className="editor-label">Nome da Box</span>
                                    <input id="active-box-name" type="text" value={active.name || ""} onKeyDown={event => event.key === "Enter" && event.currentTarget.blur()} onChange={event => updateActive(team => ({ ...team, name: event.target.value }))} className="pc-box-name" />
                                </label>
                                <label className="pc-version-field">
                                    Jogo de referência
                                    <RoomSelect aria-label="Jogo de referência" value={active.versionGroup || "auto"} onChange={event => updateActive(team => ({ ...team, versionGroup: event.target.value }))} className="pc-version-select">
                                        {VERSION_GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
                                    </RoomSelect>
                                </label>
                            </div>

                            <div className="pc-toolbar-actions" role="group" aria-label="Ações da Box">
                                <button type="button" onClick={openShare} disabled={isProcessing} aria-haspopup="dialog" title="Compartilhar Box ou Pokémon" className="pc-action-button is-share">
                                    <GameIcon name="link" /><span className="pc-action-label">Compartilhar</span>
                                </button>
                                <button type="button" onClick={cloneTeam} title="Duplicar Box" className="pc-action-button is-duplicate"><span aria-hidden="true">⧉</span><span className="pc-action-label">Duplicar</span></button>
                                <button type="button" onClick={() => setPendingDelete(active)} title="Apagar Box" className="pc-action-button is-delete"><span aria-hidden="true">⌫</span><span className="pc-action-label">Apagar</span></button>
                            </div>
                        </div>

                        {(envLoading || envError) && (
                            <div className="pc-catalog-status" role="status">
                                {envLoading ? "Carregando catálogo…" : envError}
                            </div>
                        )}

                        <header className="pc-grid-heading">
                            <div className="pc-grid-title"><h3>Equipe</h3><span>{occupiedSlots} de {PARTY_SIZE} Pokémon</span></div>
                            {freeSlots > 0 && <button type="button" onClick={onSearchClick} className="pc-add-button">+ Adicionar Pokémon</button>}
                        </header>

                        <div className="pc-partner-grid">
                            {active.pokemon?.map((partner, index) => {
                                const sprite = getPartnerSprite(partner);
                                const types = (partner.species?.types || []).map(entry => entry.type?.name).filter(Boolean);
                                return (
                                    <button type="button" key={partner.id || `${partner.species?.name}-${index}`} onClick={() => selectPartner(index)} aria-pressed={editingSlot === index} aria-label={`Abrir ficha de ${partner.nickname || formatPokemonIdentity(partner)}, nível ${partner.level || 1}${partner.shiny ? ", Shiny" : ""}`} style={{ "--pc-partner-type": TYPE_COLORS[types[0]] || "var(--ui-line)" }} className={`pc-partner-card ${editingSlot === index ? "is-selected" : ""}`} ref={element => { partnerButtonRefs.current[index] = element; }}>

                                        <span className="pc-card-position" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="pc-partner-sprite">
                                            <PokemonSprite src={sprite} pokemonId={partner.species?.id} shiny={partner.shiny} className="pixelated" alt="" />
                                            {partner.shiny && <span className="pc-shiny-mark" role="img" aria-label="Shiny">✦</span>}
                                        </span>
                                        <span className="pc-partner-info">
                                            <span className="pc-partner-heading">
                                                <span className="pc-partner-name">{partner.nickname || formatPokemonIdentity(partner)}</span>
                                                <span role="img" aria-label={partner.gender === "M" ? "Macho" : partner.gender === "F" ? "Fêmea" : "Sem gênero definido"} className="pc-partner-gender">{partner.gender === "M" ? "♂" : partner.gender === "F" ? "♀" : "⚲"}</span>
                                            </span>
                                            {partner.nickname && <span className="pc-partner-species">{formatPokemonIdentity(partner)}</span>}
                                            <span className="pc-partner-meta"><span>Nv. {partner.level || 1}</span><span>{partner.item ? formatCanonicalItemName(partner.item) : "Sem item"}</span></span>
                                            <span className="pc-partner-types">
                                                {types.map(type => <span key={type} style={{ backgroundColor: TYPE_COLORS[type], color: TYPE_TEXT_COLORS[type] }}>{formatType(type)}</span>)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}

                        </div>

                        {!occupiedSlots && <p className="pc-box-empty">Nenhum Pokémon nesta Box.</p>}

                        {editingSlot !== null && active.pokemon?.[editingSlot] && (
                            <div className="pc-editor-region">
                                <header className="pc-editor-heading">
                                    <h3 ref={editorHeadingRef} tabIndex={-1}>Ficha de {active.pokemon[editingSlot].nickname || formatPokemonIdentity(active.pokemon[editingSlot])}</h3>
                                    <div className="pc-editor-actions" role="group" aria-label="Ações da ficha">
                                        <button type="button" onClick={() => { partnerButtonRefs.current[editingSlot]?.focus(); setEditingSlot(null); }} className="pc-close-editor">Fechar ficha <span aria-hidden="true">×</span></button>
                                        <button type="button" onClick={() => { dismissKeyboard(); setPendingPartnerDelete({ teamId: active.id, partner: active.pokemon[editingSlot], index: editingSlot }); }} className="pokemon-remove-button">Remover da Box</button>
                                    </div>
                                </header>
                                <PokemonEditor
                                    key={active.pokemon[editingSlot].id}
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
                    <section ref={linkCableRef} tabIndex={-1} className="link-cable-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
                        <button type="button" className="link-cable-close" onClick={() => { setSharing(false); setShareCode(""); }} aria-label="Fechar compartilhamento">×</button>
                        <span className="link-cable-kicker">Link Cable</span>
                        <h2 id="share-dialog-title">Compartilhar equipe</h2>
                        <p className="link-cable-intro">Escolha os Pokémon ou a Box inteira para enviar a outro treinador.</p>

                        {!shareCode ? (
                            <>
                                <div className="link-cable-segment" role="radiogroup" aria-label="Tipo de compartilhamento" onKeyDown={handleRadioNavigation}>
                                    <button type="button" role="radio" tabIndex={shareScope === "pokemon" ? 0 : -1} aria-checked={shareScope === "pokemon"} onClick={() => setShareScope("pokemon")} disabled={!active.pokemon.length}>
                                        <strong>Pokémon escolhidos</strong>
                                        <small>Um ou vários parceiros</small>
                                    </button>
                                    <button type="button" role="radio" tabIndex={shareScope === "team" ? 0 : -1} aria-checked={shareScope === "team"} onClick={() => setShareScope("team")}>
                                        <strong>Box inteira</strong>
                                        <small>Equipe e jogo de referência</small>
                                    </button>
                                </div>

                                {shareScope === "pokemon" && (
                                    <div className="link-cable-partners" role="group" aria-label="Pokémon para compartilhar">
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
                                                    <span><strong>{partner.nickname || formatPokemonIdentity(partner)}</strong><small>{formatPokemonIdentity(partner)} • Nv. {partner.level}</small></span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="link-cable-footer">
                                    <span>{shareScope === "team" ? `${active.pokemon.length} de 6 Pokémon na Box` : selectedShareIds.length === 1 ? "1 Pokémon escolhido" : `${selectedShareIds.length} Pokémon escolhidos`}</span>
                                    <button type="button" className="link-cable-primary" onClick={generateLinkCode} disabled={isProcessing || (shareScope === "pokemon" && !selectedShareIds.length)}>
                                        {isProcessing ? "Preparando…" : "Gerar código"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="link-cable-result animate-fade-in">
                                <span className="link-cable-success" aria-hidden="true">✓</span>
                                <strong>Envio pronto</strong>
                                <p>Copie o código e envie para outro treinador.</p>
                                <div className="link-cable-code-field">
                                    <label htmlFor="link-cable-share-code">Código de compartilhamento</label>
                                    <textarea id="link-cable-share-code" readOnly value={shareCode} rows={5} onFocus={event => event.currentTarget.select()} />
                                </div>
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
                    <section ref={linkCableRef} tabIndex={-1} className="link-cable-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
                        <button type="button" className="link-cable-close" onClick={resetImport} aria-label="Fechar importação">×</button>
                        <span className="link-cable-kicker">Link Cable</span>
                        <h2 id="import-dialog-title">{importPreview ? "Escolha onde guardar" : "Receber Pokémon ou Box"}</h2>
                        <p className="link-cable-intro">{importPreview ? "Confira o envio e escolha o destino." : "Cole um código do MyOwnDex para conferir o envio."}</p>

                        {!importPreview ? (
                            <>
                                <div className="link-cable-code-field">
                                    <label htmlFor="link-cable-code">Código compartilhado</label>
                                    <textarea id="link-cable-code" disabled={isProcessing} aria-invalid={Boolean(importError)} aria-describedby={importError ? "link-cable-import-error" : undefined} value={importData} onChange={event => { setImportData(event.target.value); setImportError(""); }} rows={7} autoFocus />
                                </div>
                                {importError && <div id="link-cable-import-error" role="alert" className="link-cable-error">{importError}</div>}
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
                                                <b>{partner.nickname || formatPokemonIdentity(partner)}</b>
                                                <small>Nv. {partner.level}</small>
                                            </span>
                                        );
                                    })}
                                </div>

                                {importPreview.kind === "team" && (
                                    <div className="link-cable-segment" role="radiogroup" aria-label="Como receber a Box" onKeyDown={handleRadioNavigation}>
                                        <button type="button" role="radio" tabIndex={importStrategy === "team" ? 0 : -1} aria-checked={importStrategy === "team"} onClick={() => setImportStrategy("team")}>
                                            <strong>Como Box inteira</strong>
                                            <small>Mantém a equipe compartilhada</small>
                                        </button>
                                        <button type="button" role="radio" tabIndex={importStrategy === "add" ? 0 : -1} aria-checked={importStrategy === "add"} onClick={() => setImportStrategy("add")}>
                                            <strong>Adicionar a uma Box</strong>
                                            <small>Preenche espaços disponíveis</small>
                                        </button>
                                    </div>
                                )}

                                {(importPreview.kind === "pokemon" || importStrategy === "add") && (
                                    <label className="link-cable-destination">
                                        <span>Box de destino</span>
                                        <RoomSelect aria-label="Box de destino" value={importTargetId} onChange={event => { setImportTargetId(event.target.value); setImportError(""); }}>
                                            {teams.map(team => {
                                                const free = Math.max(0, 6 - team.pokemon.length);
                                                const fits = free >= importPreview.pokemon.length;
                                                return <option key={team.id} value={team.id} disabled={!fits}>{team.name} • {free} {free === 1 ? "espaço" : "espaços"}{fits ? "" : " (não cabe)"}</option>;
                                            })}
                                            <option value="__new__">Criar nova Box para este envio</option>
                                        </RoomSelect>
                                        <small>{importTargetId === "__new__" ? "Cria uma Box para os Pokémon recebidos." : "Os Pokémon ocuparão os espaços livres."}</small>
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

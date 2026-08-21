import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import {
    accuracyStageMultiplier,
    applyStageChange,
    calculateStagedStats,
    normalizeStageMap,
    STAGE_LABELS,
    STAGE_STAT_KEYS,
} from "../../core/automation.js";
import {
    addTeamToSnapshot,
    advanceInitiative,
    applyEndOfRoundEffects,
    buildInitiative,
    compactTeamOffer,
    createTokenFromPokemon,
    createRoomSnapshot,
    eventSummary,
    LOCAL_ROOM_STORAGE_KEY,
    mergeRoomConflictSnapshot,
    normalizeRoomSnapshot,
    STATUS_LABELS,
    syncTeamsWithRoomProgress,
} from "../../core/room.js";
import { formatName, formatNumberPtBr, formatType } from "../../core/mechanics.js";
import { formatCount } from "../../core/copy.js";
import {
    buildPlayerInvite,
    buildRoomInviteToken,
    clearRoomSession,
    createRemoteRoom,
    deleteRemoteRoom,
    fetchRemoteRoom,
    joinRemoteRoom,
    loadRoomSession,
    parseRoomInvite,
    parseRoomInviteValue,
    postRoomEvent,
    saveRemoteRoom,
    saveRoomSession,
} from "../../core/roomClient.js";
import { getFumbleSuggestion, getNextLevelXp, rollAttributeTest, rollPercentTest } from "../../core/rpgRules.js";
import { mergeImportedTeam, normalizeTeam, touchTeam } from "../../core/team.js";
import { readStorage, removeStorage, writeStorage } from "../../core/storage.js";
import { getBattleDisplayIdentity, normalizeSpecialState } from "../../core/specialMechanics.js";
import AudioDeck from "./AudioDeck.jsx";
import Battlefield from "./Battlefield.jsx";
import CombatAssistant from "./CombatAssistant.jsx";
import SpecialMechanicsPanel from "./SpecialMechanicsPanel.jsx";
import TraitMechanicsPanel from "./TraitMechanicsPanel.jsx";
import VoiceCall from "./VoiceCall.jsx";
import AdventurePhaseControl from "./AdventurePhaseControl.jsx";

const connectionLabels = {
    connected: "Aventura conectada",
    connecting: "Entrando na aventura…",
    saving: "Guardando mudanças…",
    offline: "Sem conexão",
    local: "Neste aparelho",
    error: "Conexão interrompida",
};

const roleLabel = role => role === "narrator" ? "Narrador" : "Jogador";
const volatileEffectLabel = effect => {
    const turns = effect.turns != null ? ` • ${formatCount(effect.turns, "rodada")}` : "";
    const amount = effect.amount != null ? ` • ${formatNumberPtBr(effect.amount)} HP` : "";
    if (effect.id === "yawn") return `Sonolento por Bocejo${turns}`;
    if (effect.id === "wish") return `Wish preparado${turns}${amount}`;
    if (["future-sight", "doom-desire"].includes(effect.id)) return `${formatName(effect.id)} preparado${turns}${amount}`;
    if (effect.id === "perish-song") return `Contagem de Perish Song${turns}`;
    if (effect.id === "substitute") return `Substitute ativo${amount}`;
    if (effect.id === "leech-seed") return "Leech Seed ativo";
    if (["aqua-ring", "ingrain"].includes(effect.id)) return `${formatName(effect.id)} ativo`;
    return `${formatName(effect.sourceMove || effect.id)}${turns}${amount}`;
};
const roundEffectSummary = effect => {
    if (effect.kind === "status") return effect.status
        ? `${effect.tokenName} recebeu ${STATUS_LABELS[effect.status] || formatName(effect.status)} por ${effect.sources.join(" e ")}`
        : `${effect.tokenName} teve a condição removida por ${effect.sources.join(" e ")}`;
    if (effect.kind === "heal") return `${effect.tokenName} recuperou ${formatNumberPtBr(effect.healed)} HP por ${effect.sources.join(" e ")}`;
    if (effect.kind === "perish") return `${effect.tokenName} chegou ao fim da contagem de Perish Song e não pode mais batalhar`;
    if (effect.kind === "state") return `${effect.tokenName}: ${effect.sources.join(" e ")}`;
    if (effect.kind === "stage") return `${effect.tokenName}: ${effect.sources.join(" e ")}`;
    return `${effect.tokenName} perdeu ${formatNumberPtBr(effect.damage)} HP por ${effect.sources.join(" e ")}${effect.fainted ? " e não pode mais batalhar" : ""}`;
};
const roomDate = value => {
    const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2} /.test(value)
        ? `${value.replace(" ", "T")}Z`
        : value;
    return new Date(normalized);
};
const timeLabel = value => {
    const date = roomDate(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
};
const isPlayerPresent = player => {
    const lastSeen = roomDate(player?.lastSeenAt);
    return !Number.isNaN(lastSeen.getTime()) && Date.now() - lastSeen.getTime() < 20_000;
};

const errorMessage = error => error instanceof Error ? error.message : "Algo impediu esta ação. Tente novamente.";

function Lobby({ defaultInvite, savedSession, busy, error, onCreate, onJoin, onLocal, onResume }) {
    const [title, setTitle] = useState("Minha aventura Pokémon");
    const [narratorName, setNarratorName] = useState("Narrador");
    const [invite, setInvite] = useState(defaultInvite ? buildRoomInviteToken(defaultInvite) : "");
    const [displayName, setDisplayName] = useState("");
    const parsedInvite = useMemo(() => parseRoomInviteValue(invite), [invite]);
    const canResumeInvite = savedSession && defaultInvite && savedSession.code === defaultInvite.code;

    return (
        <div className="room-lobby animate-fade-in">
            <section className="room-lobby-hero">
                <div>
                    <span className="room-kicker">Central da Aventura • MyOwnDex</span>
                    <h2>Sua aventura Pokémon começa aqui.</h2>
                    <p>Reúna campo, fichas, regras, rolagens, progresso e trilha em um só lugar, com tudo preparado para Narrador e jogadores.</p>
                </div>
                <div className="room-live-orb" aria-hidden="true">
                    <i className="room-live-screen" />
                </div>
            </section>

            {error && <div className="room-error" role="alert">{error}</div>}
            {savedSession && (!defaultInvite || canResumeInvite) && (
                <button type="button" className="room-resume" disabled={busy} onClick={() => onResume(savedSession)}>
                    <span>
                        <small>Última aventura</small>
                        <strong>{savedSession.code} • {roleLabel(savedSession.role)}</strong>
                    </span>
                    <b>{canResumeInvite ? "Voltar para esta aventura" : "Continuar"}</b>
                </button>
            )}

            <div className="room-lobby-grid">
                <form
                    className="room-lobby-card is-narrator"
                    onSubmit={event => {
                        event.preventDefault();
                        onCreate({ title, narratorName });
                    }}
                >
                    <header>
                        <span className="room-role-mark">N</span>
                        <div>
                            <small>Quem conduz a aventura</small>
                            <h3>Começar como Narrador</h3>
                        </div>
                    </header>
                    <label>
                        <span>Nome da aventura</span>
                        <input value={title} maxLength={80} required onChange={event => setTitle(event.target.value)} />
                    </label>
                    <label>
                        <span>Seu nome na aventura</span>
                        <input value={narratorName} maxLength={32} required onChange={event => setNarratorName(event.target.value)} />
                    </label>
                    <details className="room-role-help">
                        <summary>O que você pode fazer como Narrador</summary>
                        <ul>
                            <li>Organiza o campo, as rodadas, o HP e a iniciativa.</li>
                            <li>Leva equipes para a cena e acompanha cada resultado.</li>
                            <li>Convida jogadores sem compartilhar os controles do Narrador.</li>
                        </ul>
                    </details>
                    <button type="submit" className="room-primary-button" disabled={busy}>
                        {busy ? "Preparando a aventura…" : "Abrir nova aventura"}
                    </button>
                </form>

                <form
                    className="room-lobby-card is-player"
                    onSubmit={event => {
                        event.preventDefault();
                        onJoin({ invite, displayName });
                    }}
                >
                    <header>
                        <span className="room-role-mark">J</span>
                        <div>
                            <small>Um lugar na aventura</small>
                            <h3>Entrar como Jogador</h3>
                        </div>
                    </header>
                    <label>
                        <span>Link ou convite da aventura</span>
                        <textarea
                            value={invite}
                            rows={3}
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            placeholder="Cole aqui o link enviado pelo Narrador"
                            onChange={event => setInvite(event.target.value)}
                        />
                        <small className={`room-invite-detection ${parsedInvite ? "is-valid" : ""}`}>
                            {parsedInvite ? `Aventura ${parsedInvite.code} encontrada` : "O código e a chave serão reconhecidos juntos."}
                        </small>
                    </label>
                    <label>
                        <span>Seu nome na aventura</span>
                        <input value={displayName} maxLength={32} required autoFocus={Boolean(defaultInvite)} onChange={event => setDisplayName(event.target.value)} />
                    </label>
                    <details className="room-role-help">
                        <summary>O que você pode fazer como Jogador</summary>
                        <ul>
                            <li>Acompanha o campo e o progresso conforme a aventura acontece.</li>
                            <li>Rola dados, conversa e apresenta sua equipe ao Narrador.</li>
                            <li>Declara movimentos e controla os próprios Pokémon.</li>
                        </ul>
                    </details>
                    <button type="submit" className="room-primary-button" disabled={busy}>
                        {busy ? "Entrando…" : "Entrar na aventura"}
                    </button>
                </form>
            </div>
            <button
                type="button"
                className="room-local-entry"
                disabled={busy}
                onClick={() => onLocal({ title, narratorName })}
            >
                <span>
                    <small>Para jogar sozinho ou no mesmo aparelho</small>
                    <strong>Começar uma aventura local</strong>
                </span>
                <b>Neste aparelho</b>
            </button>
            <p className="room-lobby-footnote">Suas Boxes continuam salvas neste aparelho. Em aventuras compartilhadas, o MyOwnDex mantém as mudanças de todos em ordem, mesmo quando acontecem juntas.</p>
        </div>
    );
}

function QuickRoller({ onEvent, onError }) {
    const [kind, setKind] = useState("attribute");
    const [mode, setMode] = useState("normal");
    const [attribute, setAttribute] = useState(0);
    const [chance, setChance] = useState(50);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);

    const roll = async () => {
        setBusy(true);
        try {
            if (kind === "attribute") {
                const test = rollAttributeTest({ mode, attribute });
                setResult({
                    title: test.critical ? "Acerto crítico" : test.fumble ? "Erro crítico" : `Total ${test.total}`,
                    detail: test.fumble
                        ? getFumbleSuggestion()
                        : `${test.dice.join(" • ")}${Number(attribute) ? ` + ${Number(attribute)}` : ""}`,
                });
                await onEvent("roll", {
                    label: mode === "advantage" ? "teste com vantagem" : mode === "disadvantage" ? "teste com desvantagem" : "teste de atributo",
                    result: test.total,
                    dice: test.dice,
                    kept: test.kept,
                    attribute: Number(attribute) || 0,
                    critical: test.critical,
                    fumble: test.fumble,
                });
            } else {
                const test = rollPercentTest({ chance, advantage: mode === "advantage" });
                setResult({
                    title: test.success ? "Sucesso" : "Falha",
                    detail: `${test.rolls.join(" • ")} contra ${test.chance}%`,
                });
                await onEvent("roll", {
                    label: "teste percentual",
                    result: test.result,
                    rolls: test.rolls,
                    chance: test.chance,
                    success: test.success,
                });
            }
        } catch (error) {
            onError(error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <details className="room-tool" open>
            <summary>
                <span>
                    <small>Rolagens da aventura</small>
                    <strong>Rolagem rápida</strong>
                </span>
                <span className="room-tool-badge">Ao vivo</span>
            </summary>
            <div className="room-tool-body">
                <div className="quick-roll-kind">
                    <button type="button" aria-pressed={kind === "attribute"} onClick={() => setKind("attribute")}>2d6</button>
                    <button type="button" aria-pressed={kind === "percent"} onClick={() => setKind("percent")}>d100</button>
                </div>
                <div className="quick-roll-controls">
                    <label>
                        <span>{kind === "attribute" ? "Atributo" : "Chance"}</span>
                        <input
                            type="number"
                            min={kind === "attribute" ? -20 : 0}
                            max={kind === "attribute" ? 99 : 100}
                            value={kind === "attribute" ? attribute : chance}
                            onChange={event => kind === "attribute" ? setAttribute(event.target.value) : setChance(event.target.value)}
                        />
                    </label>
                    <label>
                        <span>Como rolar</span>
                        <select value={mode} onChange={event => setMode(event.target.value)}>
                            <option value="normal">Normal</option>
                            <option value="advantage">Vantagem</option>
                            {kind === "attribute" && <option value="disadvantage">Desvantagem</option>}
                        </select>
                    </label>
                </div>
                <button type="button" className="room-primary-button" disabled={busy} onClick={roll}>Rolar e compartilhar</button>
                {result && (
                    <div className="quick-roll-result" aria-live="polite">
                        <strong>{result.title}</strong>
                        <span>{result.detail}</span>
                    </div>
                )}
            </div>
        </details>
    );
}

function NoteField({ label, value, privateNote, disabled, onCommit }) {
    const [draft, setDraft] = useState(value || "");
    useEffect(() => setDraft(value || ""), [value]);
    return (
        <label className={`room-note ${privateNote ? "is-private" : ""}`}>
            <span>{label}{privateNote ? " • só Narrador" : ""}</span>
            <textarea
                value={draft}
                disabled={disabled}
                rows={3}
                maxLength={privateNote ? 6000 : 4000}
                onChange={event => setDraft(event.target.value)}
                onBlur={() => draft !== value && onCommit(draft)}
            />
        </label>
    );
}

export default function RpgRoom({ teams, setTeams, onOpenGuide, setNotice }) {
    const initialInvite = useMemo(() => parseRoomInvite(), []);
    const initialSavedSession = useMemo(() => loadRoomSession(), []);
    const [session, setSession] = useState(null);
    const [room, setRoom] = useState(null);
    const [busy, setBusy] = useState(false);
    const [connection, setConnection] = useState("connecting");
    const [error, setError] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id || "");
    const [selectedTokenId, setSelectedTokenId] = useState("");
    const [mobilePane, setMobilePane] = useState("field");
    const [ending, setEnding] = useState(false);
    const revisionRef = useRef(0);
    const pendingSavesRef = useRef(0);
    const saveQueueRef = useRef(Promise.resolve());
    const channelRef = useRef(null);
    const mountedRef = useRef(true);
    const snapshotRef = useRef(createRoomSnapshot());

    const snapshot = useMemo(() => normalizeRoomSnapshot(room?.snapshot), [room?.snapshot]);
    const role = session?.role || "";
    const selectedTeam = teams.find(team => team.id === selectedTeamId) || teams[0] || null;
    const selectedToken = snapshot.tokens.find(token => token.id === selectedTokenId) || null;
    const selectedDisplayIdentity = selectedToken ? getBattleDisplayIdentity(selectedToken) : null;

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    useEffect(() => {
        if (!room || !role) return;
        const playerId = role === "player" ? session?.playerId : null;
        setTeams(current => syncTeamsWithRoomProgress(current, snapshot, playerId));
    }, [role, room, session?.playerId, setTeams, snapshot]);

    useEffect(() => {
        if (!selectedTeamId && teams[0]) setSelectedTeamId(teams[0].id);
    }, [selectedTeamId, teams]);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const showError = useCallback(value => {
        const message = errorMessage(value);
        setError(message);
        setNotice?.({ tone: "red", text: message });
    }, [setNotice]);

    const applyBundle = useCallback(bundle => {
        if (!bundle) return;
        revisionRef.current = Number(bundle.revision) || 0;
        setRoom({
            ...bundle,
            snapshot: normalizeRoomSnapshot(bundle.snapshot),
            players: Array.isArray(bundle.players) ? bundle.players : [],
            events: Array.isArray(bundle.events) ? bundle.events : [],
            media: Array.isArray(bundle.media) ? bundle.media : [],
        });
        setConnection("connected");
        setError("");
    }, []);

    const refresh = useCallback(async (targetSession = session) => {
        if (!targetSession || pendingSavesRef.current > 0) return null;
        if (targetSession.local) {
            setConnection("local");
            return null;
        }
        try {
            const bundle = await fetchRemoteRoom(targetSession);
            if (mountedRef.current) applyBundle(bundle);
            return bundle;
        } catch (value) {
            if (!navigator.onLine) setConnection("offline");
            else setConnection("error");
            throw value;
        }
    }, [applyBundle, session]);

    const resume = useCallback(async targetSession => {
        setBusy(true);
        setConnection("connecting");
        setError("");
        try {
            if (targetSession.local) {
                const localRoom = readStorage(LOCAL_ROOM_STORAGE_KEY, null);
                if (!localRoom?.snapshot) throw new Error("Não encontramos a aventura salva neste aparelho.");
                setSession(targetSession);
                setRoom(localRoom);
                setConnection("local");
                return;
            }
            const bundle = await fetchRemoteRoom(targetSession);
            setSession(targetSession);
            saveRoomSession(targetSession);
            applyBundle(bundle);
        } catch (value) {
            clearRoomSession();
            showError(value);
        } finally {
            setBusy(false);
        }
    }, [applyBundle, showError]);

    useEffect(() => {
        if (!initialInvite && initialSavedSession) void resume(initialSavedSession);
    }, [initialInvite, initialSavedSession, resume]);

    useEffect(() => {
        if (!session || session.local) return undefined;
        let stopped = false;
        let timer = 0;
        const tick = async () => {
            if (stopped) return;
            try {
                await refresh(session);
            } catch {
                // The connection badge communicates transient polling failures.
            }
            timer = window.setTimeout(tick, document.hidden ? 5000 : 1600);
        };
        timer = window.setTimeout(tick, 1200);
        return () => {
            stopped = true;
            window.clearTimeout(timer);
        };
    }, [refresh, session]);

    useEffect(() => {
        if (!session || typeof BroadcastChannel !== "function") return undefined;
        const channel = new BroadcastChannel(`myowndex-room-${session.code}`);
        channel.onmessage = event => {
            if (event.data?.type === "invalidate") void refresh(session).catch(() => {});
        };
        channelRef.current = channel;
        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, [refresh, session]);

    const create = async input => {
        setBusy(true);
        setError("");
        try {
            const initial = createRoomSnapshot(input.title);
            const result = await createRemoteRoom({ ...input, snapshot: initial });
            const nextSession = {
                code: result.code,
                key: result.narratorKey,
                inviteCode: result.inviteCode,
                role: "narrator",
                playerId: null,
                displayName: input.narratorName,
            };
            setSession(nextSession);
            saveRoomSession(nextSession);
            const bundle = await fetchRemoteRoom(nextSession);
            applyBundle(bundle);
            setNotice?.({ tone: "blue", text: `A aventura ${result.code} está pronta — e o convite para jogadores também.` });
        } catch (value) {
            showError(value);
        } finally {
            setBusy(false);
        }
    };

    const createLocal = input => {
        const nextSession = {
            code: "LOCAL",
            key: "local",
            role: "narrator",
            playerId: null,
            displayName: input.narratorName || "Narrador",
            inviteCode: "",
            local: true,
        };
        const localRoom = {
            code: "LOCAL",
            title: input.title,
            revision: 0,
            updatedAt: new Date().toISOString(),
            snapshot: createRoomSnapshot(input.title),
            players: [],
            events: [{
                id: Date.now(),
                playerId: null,
                author: input.narratorName || "Narrador",
                type: "system",
                payload: { text: `A aventura “${input.title}” começou neste aparelho.` },
                createdAt: new Date().toISOString(),
            }],
            media: [],
        };
        setSession(nextSession);
        setRoom(localRoom);
        setConnection("local");
        saveRoomSession(nextSession);
        writeStorage(LOCAL_ROOM_STORAGE_KEY, localRoom);
    };

    const join = async input => {
        setBusy(true);
        setError("");
        try {
            const invite = parseRoomInviteValue(input.invite);
            if (!invite) throw new Error("Cole o link ou convite completo enviado pelo Narrador.");
            const result = await joinRemoteRoom({ ...invite, displayName: input.displayName });
            const nextSession = {
                code: result.code,
                key: result.playerKey,
                role: "player",
                playerId: result.playerId,
                displayName: input.displayName,
            };
            setSession(nextSession);
            saveRoomSession(nextSession);
            applyBundle({ ...result.room, role: "player", playerId: result.playerId });
            if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } catch (value) {
            showError(value);
        } finally {
            setBusy(false);
        }
    };

    const commitSnapshot = useCallback(nextValue => {
        if (!session || session.role !== "narrator") return;
        const baseSnapshot = snapshot;
        const normalized = normalizeRoomSnapshot(nextValue);
        if (session.local) {
            setRoom(current => {
                if (!current) return current;
                const next = {
                    ...current,
                    revision: (Number(current.revision) || 0) + 1,
                    updatedAt: new Date().toISOString(),
                    snapshot: normalized,
                };
                writeStorage(LOCAL_ROOM_STORAGE_KEY, next);
                return next;
            });
            setConnection("local");
            return;
        }
        setRoom(current => current ? { ...current, snapshot: normalized } : current);
        pendingSavesRef.current += 1;
        setConnection("saving");

        const persist = async () => {
            let expectedRevision = revisionRef.current;
            let snapshotToSave = normalized;
            try {
                let result;
                try {
                    result = await saveRemoteRoom(session, snapshotToSave, expectedRevision);
                } catch (value) {
                    if (value?.status !== 409 || !value?.data?.room) throw value;
                    expectedRevision = Number(value.data.room.revision) || expectedRevision;
                    snapshotToSave = mergeRoomConflictSnapshot(
                        baseSnapshot,
                        normalized,
                        value.data.room.snapshot,
                    );
                    result = await saveRemoteRoom(session, snapshotToSave, expectedRevision);
                }
                revisionRef.current = Number(result.revision) || expectedRevision + 1;
                if (mountedRef.current && pendingSavesRef.current <= 1) applyBundle(result);
                channelRef.current?.postMessage({ type: "invalidate" });
            } catch (value) {
                if (mountedRef.current) {
                    setConnection(navigator.onLine ? "error" : "offline");
                    showError(value);
                }
            } finally {
                pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
                if (mountedRef.current && pendingSavesRef.current === 0) setConnection("connected");
            }
        };

        saveQueueRef.current = saveQueueRef.current.then(persist, persist);
    }, [applyBundle, session, showError, snapshot]);

    const sendEvent = useCallback(async (type, payload) => {
        if (!session) return;
        if (session.local) {
            setRoom(current => {
                if (!current) return current;
                const next = {
                    ...current,
                    events: [...(current.events || []), {
                        id: Date.now() + Math.random(),
                        playerId: null,
                        author: session.displayName || "Narrador",
                        type,
                        payload: payload || {},
                        createdAt: new Date().toISOString(),
                    }].slice(-180),
                };
                writeStorage(LOCAL_ROOM_STORAGE_KEY, next);
                return next;
            });
            return;
        }
        try {
            await postRoomEvent(session, type, payload);
            channelRef.current?.postMessage({ type: "invalidate" });
            await refresh(session);
        } catch (value) {
            showError(value);
            return null;
        }
    }, [refresh, session, showError]);

    const copy = async (value, label) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = value;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                textArea.remove();
            }
            setNotice?.({ tone: "blue", text: `${label} está na área de transferência.` });
        } catch {
            showError(new Error("Não foi possível copiar o convite com um toque. Selecione o conteúdo e use a opção Copiar do aparelho."));
        }
    };

    const shareInvite = async value => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Convite para ${snapshot.title}`,
                    text: `Entre na aventura “${snapshot.title}” no MyOwnDex.`,
                    url: value,
                });
                return;
            }
            await copy(value, "Convite dos jogadores");
        } catch (value) {
            if (value?.name !== "AbortError") showError(value);
        }
    };

    const leave = async () => {
        const leavingSession = session;
        clearRoomSession();
        setSession(null);
        setRoom(null);
        setError("");
        setConnection("connecting");
        try {
            if (leavingSession?.role === "player" && !leavingSession.local) {
                await postRoomEvent(leavingSession, "leave", {});
            }
        } catch {
            // Sair da interface local não deve ser bloqueado por uma falha transitória.
        }
    };

    const endRoom = async () => {
        if (!session) return;
        setBusy(true);
        try {
            if (session.local) removeStorage(LOCAL_ROOM_STORAGE_KEY);
            else await deleteRemoteRoom(session);
            await leave();
            setNotice?.({ tone: "blue", text: "A aventura foi encerrada. Suas Boxes continuam no PC." });
        } catch (value) {
            showError(value);
        } finally {
            setBusy(false);
            setEnding(false);
        }
    };

    const addSelectedTeam = async side => {
        if (!selectedTeam) return;
        const result = addTeamToSnapshot(snapshot, selectedTeam, side);
        commitSnapshot(result.room);
        await sendEvent("system", {
            text: `${selectedTeam.name} entrou em campo${side === "opponent" ? " no lado dos oponentes" : ""}.`,
        });
        if (result.tokens[0]) setSelectedTokenId(result.tokens[0].id);
    };

    const updateToken = patch => {
        if (!selectedToken || role !== "narrator") return;
        const nextToken = { ...selectedToken, ...patch };
        const specialState = normalizeSpecialState(nextToken.specialState);
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.map(token => token.id === selectedToken.id ? nextToken : token),
        });
        if (nextToken.pokemonId) {
            setTeams(current => current.map(team => team.id === nextToken.teamId
                ? touchTeam({
                    ...team,
                    pokemon: team.pokemon.map(pokemon => pokemon.id === nextToken.pokemonId
                        ? {
                            ...pokemon,
                            rpg: {
                                ...pokemon.rpg,
                                currentHp: nextToken.currentHp,
                                status: nextToken.status,
                                xp: nextToken.xp,
                                pp: specialState.transform?.base?.pp
                                    || (specialState.moveOverrides.some(override => !override.permanent) ? pokemon.rpg?.pp : nextToken.pp),
                            },
                        }
                        : pokemon),
                })
                : team
            ));
        }
    };

    const replaceSelectedToken = nextToken => {
        if (!selectedToken || role !== "narrator" || nextToken?.id !== selectedToken.id) return;
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.map(token => token.id === selectedToken.id ? nextToken : token),
        });
    };

    const adjustSelectedStage = (stat, change) => {
        if (!selectedToken || role !== "narrator") return;
        const changed = applyStageChange(selectedToken, stat, change);
        updateToken({ stages: changed.stages, stats: changed.stats });
    };

    const resetSelectedStages = () => {
        if (!selectedToken || role !== "narrator") return;
        const stages = normalizeStageMap({});
        updateToken({
            stages,
            stats: calculateStagedStats({ ...selectedToken, stages }),
        });
    };

    const removeToken = () => {
        if (!selectedToken || role !== "narrator") return;
        const removed = selectedToken;
        const tokenIndex = snapshot.tokens.findIndex(token => token.id === removed.id);
        const initiativeIndex = snapshot.initiative.indexOf(removed.id);
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.filter(token => token.id !== removed.id),
            initiative: snapshot.initiative.filter(id => id !== removed.id),
            turnIndex: 0,
        });
        setSelectedTokenId("");
        setNotice?.({
            tone: "amber",
            text: `${removed.name} saiu da cena.`,
            actionLabel: "Desfazer",
            onAction: () => {
                const latest = normalizeRoomSnapshot(snapshotRef.current);
                if (latest.tokens.some(token => token.id === removed.id)) return;
                const tokens = [...latest.tokens];
                tokens.splice(Math.min(Math.max(0, tokenIndex), tokens.length), 0, removed);
                const initiative = [...latest.initiative];
                if (initiativeIndex >= 0) {
                    initiative.splice(Math.min(initiativeIndex, initiative.length), 0, removed.id);
                }
                commitSnapshot({ ...latest, tokens, initiative });
                setSelectedTokenId(removed.id);
                setNotice?.({ tone: "blue", text: `${removed.name} voltou à cena.` });
            },
        });
    };

    const applySelectedExperience = (nextXp, announce = true) => {
        if (!selectedToken || role !== "narrator") return;
        const normalizedXp = Math.max(0, Number(nextXp) || 0);
        if (selectedToken.level >= 200) {
            updateToken({ xp: normalizedXp });
            return;
        }
        const goal = getNextLevelXp(selectedToken.level);
        if (normalizedXp < goal) {
            updateToken({ xp: normalizedXp });
            return;
        }
        const sourceTeam = teams.find(team => team.id === selectedToken.teamId);
        const sourcePokemon = sourceTeam?.pokemon.find(pokemon => pokemon.id === selectedToken.pokemonId);
        if (!sourceTeam || !sourcePokemon) {
            updateToken({ level: selectedToken.level + 1, xp: 0 });
            if (announce) {
                setNotice?.({ tone: "blue", text: `${selectedToken.name} alcançou o nível ${selectedToken.level + 1}!` });
                void sendEvent("system", { text: `${selectedToken.name} alcançou o nível ${selectedToken.level + 1}!` });
            }
            return;
        }
        const nextPokemon = {
            ...sourcePokemon,
            level: selectedToken.level + 1,
            rpg: { ...sourcePokemon.rpg, xp: 0 },
        };
        const recalculated = createTokenFromPokemon(nextPokemon, sourceTeam, 0, selectedToken.side);
        const hpGrowth = Math.max(0, recalculated.maxHp - selectedToken.maxHp);
        const levelledToken = {
            ...selectedToken,
            level: nextPokemon.level,
            xp: 0,
            maxHp: recalculated.maxHp,
            currentHp: Math.min(recalculated.maxHp, selectedToken.currentHp + hpGrowth),
            stats: recalculated.stats,
            originalStats: recalculated.originalStats,
        };
        const nextToken = { ...levelledToken, stats: calculateStagedStats(levelledToken) };
        const synchronizedPokemon = {
            ...nextPokemon,
            rpg: {
                ...nextPokemon.rpg,
                currentHp: nextToken.currentHp,
                status: nextToken.status,
                pp: nextToken.pp,
            },
        };
        const nextTeam = {
            ...sourceTeam,
            pokemon: sourceTeam.pokemon.map(pokemon => pokemon.id === synchronizedPokemon.id ? synchronizedPokemon : pokemon),
        };
        setTeams(current => current.map(team => team.id === nextTeam.id ? touchTeam(nextTeam) : team));
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.map(token => token.id === selectedToken.id ? nextToken : token),
        });
        if (announce) {
            setNotice?.({ tone: "blue", text: `${selectedToken.name} alcançou o nível ${nextPokemon.level}!` });
            void sendEvent("system", { text: `${selectedToken.name} alcançou o nível ${nextPokemon.level}!` });
        }
    };

    const awardSelectedExperience = amount => {
        applySelectedExperience((Number(selectedToken?.xp) || 0) + Number(amount || 0));
    };

    const generateInitiative = async () => {
        const generated = buildInitiative(snapshot);
        commitSnapshot(generated.room);
        await sendEvent("system", {
            text: `Ordem da rodada: ${generated.results.map(result => {
                const name = snapshot.tokens.find(token => token.id === result.tokenId)?.name;
                const traits = result.traitState.entries.map(entry => formatName(entry.sourceId)).join(" + ");
                return `${name} (${result.total}${traits ? `; ${traits}` : ""})`;
            }).join(", ")}.`,
        });
    };

    const nextTurn = async () => {
        const closingRound = snapshot.initiative.length > 0
            && snapshot.turnIndex >= snapshot.initiative.length - 1;
        const roundEnd = closingRound ? applyEndOfRoundEffects(snapshot) : null;
        const next = closingRound
            ? {
                ...roundEnd.room,
                round: snapshot.round + 1,
                turnIndex: 0,
                initiative: [],
                tokens: roundEnd.room.tokens.map(token => ({ ...token, declaredMove: "", priority: 0 })),
            }
            : advanceInitiative(snapshot);
        commitSnapshot(next);
        const activeId = next.initiative[next.turnIndex];
        const active = next.tokens.find(token => token.id === activeId);
        await sendEvent("system", {
            text: closingRound
                ? `${roundEnd.effects.length
                    ? `${roundEnd.effects.map(roundEffectSummary).join("; ")}. `
                    : ""}Rodada ${next.round} pronta! Escolha os movimentos para formar a nova ordem.`
                : active
                    ? `Turno de ${active.name}. Rodada ${next.round}.`
                    : `Rodada ${next.round}.`,
        });
    };

    const declareMove = async (tokenId, move) => {
        const token = snapshot.tokens.find(candidate => candidate.id === tokenId);
        const moveName = String(move?.name || "").toLowerCase();
        const priority = Math.max(-7, Math.min(7, Math.round(Number(move?.priority) || 0)));
        if (!token || !moveName || !token.moves.includes(moveName)) return;
        if (role === "narrator") {
            if (token.declaredMove === moveName && token.priority === priority) return;
            commitSnapshot({
                ...snapshot,
                tokens: snapshot.tokens.map(candidate => candidate.id === token.id
                    ? { ...candidate, declaredMove: moveName, priority }
                    : candidate),
            });
            setNotice?.({
                tone: "blue",
                text: `${token.name} vai usar ${formatName(moveName)}. A prioridade ficou em ${priority > 0 ? `+${priority}` : priority}.`,
            });
            return;
        }
        if (!session.playerId || token.ownerPlayerId !== session.playerId) return;
        setRoom(current => current ? {
            ...current,
            snapshot: normalizeRoomSnapshot({
                ...snapshot,
                tokens: snapshot.tokens.map(candidate => candidate.id === token.id
                    ? { ...candidate, declaredMove: moveName, priority }
                    : candidate),
            }),
        } : current);
        await sendEvent("move-declared", {
            tokenId: token.id,
            tokenName: token.name,
            moveName,
            priority,
        });
    };

    const offerTeam = async () => {
        if (!selectedTeam) return;
        await sendEvent("team-offer", { team: compactTeamOffer(selectedTeam) });
        setNotice?.({ tone: "blue", text: `${selectedTeam.name} chegou ao Narrador.` });
    };

    const acceptTeamOffer = async event => {
        if (role !== "narrator" || !event.payload?.team) return;
        const incoming = normalizeTeam(event.payload.team);
        const merged = mergeImportedTeam(teams, incoming);
        setTeams(merged.teams);
        const result = addTeamToSnapshot(snapshot, merged.team, "ally", event.playerId || "");
        commitSnapshot(result.room);
        await sendEvent("team-accepted", {
            offerId: event.id,
            text: `${event.author}: equipe pronta para entrar em campo.`,
        });
    };

    const toggleReady = async () => {
        const current = room.players?.find(player => player.id === session.playerId);
        await sendEvent("ready", { ready: !current?.ready });
    };

    const inviteUrl = role === "narrator" && !session.local ? buildPlayerInvite(session) : "";
    const inviteToken = role === "narrator" && !session.local ? buildRoomInviteToken(session) : "";
    const players = room?.players || [];
    const events = room?.events || [];
    const acceptedOfferIds = new Set(
        events
            .filter(event => event.type === "team-accepted")
            .map(event => Number(event.payload?.offerId))
            .filter(Number.isFinite),
    );
    const currentTokenId = snapshot.initiative[snapshot.turnIndex] || "";
    const handleBattlefieldChange = nextSnapshot => {
        if (role === "narrator") {
            commitSnapshot(nextSnapshot);
            return;
        }
        const changed = nextSnapshot.tokens.find(nextToken => {
            const current = snapshot.tokens.find(token => token.id === nextToken.id);
            return current && (current.x !== nextToken.x || current.y !== nextToken.y);
        });
        if (changed) {
            setRoom(current => current ? { ...current, snapshot: normalizeRoomSnapshot(nextSnapshot) } : current);
            void sendEvent("token-move", {
                tokenId: changed.id,
                x: changed.x,
                y: changed.y,
            }).catch(() => refresh(session).catch(() => {}));
        }
    };

    if (!session || !room) {
        return (
            <Lobby
                defaultInvite={initialInvite}
                savedSession={loadRoomSession()}
                busy={busy}
                error={error}
                onCreate={create}
                onJoin={join}
                onLocal={createLocal}
                onResume={resume}
            />
        );
    }

    return (
        <div className={`room-app role-${role} mobile-pane-${mobilePane}`}>
            <header className="room-header">
                <div className="room-title">
                    <span className={`room-connection is-${connection}`} />
                    <div>
                        <small>{session.local ? "Aventura neste aparelho" : `${connectionLabels[connection]} • Código ${session.code}`}</small>
                        <h2>{snapshot.title}</h2>
                    </div>
                </div>
                <div className="room-header-actions">
                    <span className={`room-role-badge is-${role}`}>{roleLabel(role)}</span>
                    {role === "narrator" && !session.local && (
                        <button type="button" onClick={() => copy(inviteUrl, "Convite dos jogadores")}>Convidar</button>
                    )}
                    <button type="button" onClick={onOpenGuide}>Guia</button>
                    <button type="button" className="room-leave" onClick={() => role === "narrator" ? setEnding(true) : void leave()}>
                        {role === "narrator" ? "Encerrar" : "Sair"}
                    </button>
                </div>
            </header>

            {role === "narrator" && !session.local && (
                <details className="room-invite-panel" open>
                    <summary>
                        <span>
                            <strong>Convidar jogadores</strong>
                            <small>Link pronto • {players.length ? `${players.length} ${players.length === 1 ? "jogador conectado" : "jogadores conectados"}` : "aguardando jogadores"}</small>
                        </span>
                        <b>Código {session.code}</b>
                    </summary>
                    <div>
                        <p>Envie um único link. Quem abrir só precisa escrever o próprio nome; o MyOwnDex reconhece a aventura e o convite automaticamente.</p>
                        <label>
                            <span className="sr-only">Link de convite dos jogadores</span>
                            <input readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} />
                        </label>
                        <div className="room-invite-actions">
                            <button type="button" className="is-primary" onClick={() => void shareInvite(inviteUrl)}>Enviar convite</button>
                            <button type="button" onClick={() => copy(inviteUrl, "Link da aventura")}>Copiar link</button>
                            <button type="button" onClick={() => copy(inviteToken, "Convite curto")}>Copiar convite curto</button>
                        </div>
                    </div>
                </details>
            )}

            {error && <button type="button" className="room-error is-action" onClick={() => refresh(session).catch(showError)}>{error} • tentar reconectar</button>}

            <nav className="room-mobile-nav" aria-label="Painéis da aventura">
                <button type="button" aria-pressed={mobilePane === "roster"} onClick={() => setMobilePane("roster")}>Equipe</button>
                <button type="button" aria-pressed={mobilePane === "field"} onClick={() => setMobilePane("field")}>Campo</button>
                <button type="button" aria-pressed={mobilePane === "tools"} onClick={() => setMobilePane("tools")}>Ações</button>
            </nav>

            <div className="room-layout">
                <aside className="room-roster">
                    <section className="room-section">
                        <div className="room-section-heading">
                            <div>
                                <span className="room-kicker">Na aventura</span>
                                <h3>Quem participa</h3>
                            </div>
                            <span>{players.length + 1}</span>
                        </div>
                        <div className="room-player-list">
                            <div className="room-player is-narrator">
                                <i />
                                <span><strong>Narrador</strong><small>Conduz a aventura</small></span>
                            </div>
                            {players.map(player => {
                                const present = isPlayerPresent(player);
                                return (
                                <div key={player.id} className={`room-player ${player.ready ? "is-ready" : ""} ${present ? "is-online" : "is-away"}`}>
                                    <i style={{ background: player.accent }} />
                                    <span><strong>{player.displayName}</strong><small>{present ? (player.ready ? "Tudo pronto" : "Preparando-se") : "Ausente"}</small></span>
                                    {present && player.ready && <b>✓</b>}
                                </div>
                                );
                            })}
                        </div>
                        {role === "player" && (
                            <button type="button" className="room-secondary-button" onClick={toggleReady}>
                                {players.find(player => player.id === session.playerId)?.ready ? "Quero me preparar mais" : "Tudo pronto"}
                            </button>
                        )}
                    </section>

                    <section className="room-section">
                        <div className="room-section-heading">
                            <div>
                                <span className="room-kicker">PC do Bill</span>
                                <h3>Equipe para a cena</h3>
                            </div>
                            <span>{teams.length}</span>
                        </div>
                        {teams.length ? (
                            <>
                                <select className="room-wide-select" value={selectedTeam?.id || ""} onChange={event => setSelectedTeamId(event.target.value)}>
                                    {teams.map(team => <option key={team.id} value={team.id}>{team.name} • {team.pokemon.length}/6</option>)}
                                </select>
                                <div className="room-mini-team">
                                    {selectedTeam?.pokemon.map(pokemon => (
                                        <span key={pokemon.id} title={pokemon.nickname || pokemon.species?.name}>
                                            <PokemonSprite src={pokemon.species?.sprites?.front_default} pokemonId={pokemon.species?.id} alt="" className="pixelated" fallbackClassName="room-token-fallback" />
                                        </span>
                                    ))}
                                    {!selectedTeam?.pokemon.length && <small>Esta Box ainda está vazia.</small>}
                                </div>
                                {role === "narrator" ? (
                                    <div className="room-button-row">
                                        <button type="button" onClick={() => addSelectedTeam("ally")}>Levar como aliados</button>
                                        <button type="button" onClick={() => addSelectedTeam("opponent")}>Levar como oponentes</button>
                                    </div>
                                ) : (
                                    <button type="button" className="room-secondary-button" disabled={!selectedTeam?.pokemon.length} onClick={offerTeam}>Enviar ao Narrador</button>
                                )}
                            </>
                        ) : <p className="room-empty-copy">Crie uma Box no PC para trazê-la à aventura.</p>}
                    </section>

                    <section className="room-section">
                        <div className="room-section-heading">
                            <div>
                                <span className="room-kicker">Ordem da rodada</span>
                                <h3>Iniciativa</h3>
                            </div>
                            <span>R{snapshot.round}</span>
                        </div>
                        <ol className="initiative-list">
                            {snapshot.initiative.map((tokenId, index) => {
                                const token = snapshot.tokens.find(item => item.id === tokenId);
                                if (!token) return null;
                                return (
                                    <li key={tokenId} className={currentTokenId === tokenId ? "is-current" : ""}>
                                        <span>{index + 1}</span>
                                        <button type="button" onClick={() => setSelectedTokenId(tokenId)}>{token.name}</button>
                                        <small title={token.declaredMove ? "Movimento escolhido e prioridade correspondente" : "Velocidade atual"}>
                                            {token.declaredMove
                                                ? `${formatName(token.declaredMove)} • ${token.priority > 0 ? `+${token.priority}` : token.priority}`
                                                : `Velocidade ${token.stats?.speed ?? "—"}`}
                                        </small>
                                    </li>
                                );
                            })}
                            {!snapshot.initiative.length && <li className="is-empty">Escolha os movimentos e role a iniciativa.</li>}
                        </ol>
                        {role === "narrator" && (
                            <div className="room-button-row">
                                <button type="button" disabled={!snapshot.tokens.length} onClick={generateInitiative}>Rolar iniciativa</button>
                                <button type="button" disabled={!snapshot.initiative.length} onClick={nextTurn}>
                                    {snapshot.initiative.length && snapshot.turnIndex >= snapshot.initiative.length - 1 ? "Encerrar rodada" : "Próximo turno"}
                                </button>
                            </div>
                        )}
                    </section>
                </aside>

                <main className="room-field">
                    <div className="room-scene-strip">
                        <AdventurePhaseControl
                            value={snapshot.phase}
                            readOnly={role !== "narrator"}
                            onChange={phase => commitSnapshot({ ...snapshot, phase })}
                        />
                        <div className="room-scene-stats" aria-label="Resumo da cena">
                            <div>
                                <small>Rodada</small>
                                <strong>{snapshot.round}</strong>
                            </div>
                            <div>
                                <small>Em cena</small>
                                <strong>{snapshot.tokens.length}</strong>
                            </div>
                        </div>
                    </div>

                    <Battlefield
                        snapshot={snapshot}
                        role={role}
                        playerId={session.playerId}
                        selectedTokenId={selectedTokenId}
                        onSelectToken={setSelectedTokenId}
                        onSnapshotChange={handleBattlefieldChange}
                    />

                    {selectedToken && (
                        <section className="token-inspector">
                            <button type="button" className="token-inspector-close" onClick={() => setSelectedTokenId("")} aria-label="Fechar ficha rápida">×</button>
                            <div className="token-inspector-identity">
                                <PokemonSprite src={selectedDisplayIdentity?.sprite} pokemonId={selectedToken.speciesId} alt="" className="pixelated" fallbackClassName="room-token-fallback" />
                                <span>
                                    <small>Nível {selectedToken.level}</small>
                                    <strong>{selectedDisplayIdentity?.name || selectedToken.name}</strong>
                                    <em>{(selectedDisplayIdentity?.types || selectedToken.types).map(formatType).join(" / ") || "Tipo personalizado"}</em>
                                    {role === "narrator" && selectedDisplayIdentity?.disguised && <small>Identidade real: {selectedToken.name}</small>}
                                    {selectedToken.declaredMove && <small>{formatName(selectedToken.declaredMove)} • prioridade {selectedToken.priority > 0 ? `+${selectedToken.priority}` : selectedToken.priority}</small>}
                                </span>
                            </div>
                            <div className="token-hp-control">
                                <span>HP</span>
                                <button type="button" disabled={role !== "narrator"} onClick={() => updateToken({ currentHp: Math.max(0, selectedToken.currentHp - 1) })}>−</button>
                                <strong>{selectedToken.currentHp}/{selectedToken.maxHp}</strong>
                                <button type="button" disabled={role !== "narrator"} onClick={() => updateToken({ currentHp: Math.min(selectedToken.maxHp, selectedToken.currentHp + 1) })}>+</button>
                            </div>
                            <div className="token-xp-control">
                                <span>XP</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={selectedToken.xp}
                                    disabled={role !== "narrator"}
                                    onChange={event => updateToken({ xp: Math.max(0, Number(event.target.value) || 0) })}
                                    onBlur={() => applySelectedExperience(selectedToken.xp)}
                                />
                                <small>/ {formatNumberPtBr(getNextLevelXp(selectedToken.level))}</small>
                                {role === "narrator" && (
                                    <span className="token-xp-actions">
                                        <button type="button" disabled={selectedToken.level >= 200} onClick={() => awardSelectedExperience(0.5)}>+0,5</button>
                                        <button type="button" disabled={selectedToken.level >= 200} onClick={() => awardSelectedExperience(1)}>+1 XP</button>
                                    </span>
                                )}
                            </div>
                            <label>
                                <span>Condição</span>
                                <select value={selectedToken.status} disabled={role !== "narrator"} onChange={event => updateToken({ status: event.target.value })}>
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            {selectedToken.volatileEffects?.length > 0 && (
                                <div className="token-volatile-list" aria-label="Efeitos temporários ativos">
                                    {selectedToken.volatileEffects.map(effect => (
                                        <span key={effect.id}>
                                            {volatileEffectLabel(effect)}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <SpecialMechanicsPanel
                                token={selectedToken}
                                snapshot={snapshot}
                                role={role}
                                onTokenChange={replaceSelectedToken}
                                onNotice={text => setNotice?.({ tone: "blue", text })}
                            />
                            <TraitMechanicsPanel
                                token={selectedToken}
                                snapshot={snapshot}
                                role={role}
                                onTokenChange={replaceSelectedToken}
                                onNotice={text => setNotice?.({ tone: "blue", text })}
                            />
                            <details className="token-modifiers">
                                <summary>
                                    <span>Modificadores</span>
                                    <strong>
                                        {Object.values(selectedToken.stages || {}).filter(value => value !== 0).length
                                            ? `${formatCount(Object.values(selectedToken.stages || {}).filter(value => value !== 0).length, "modificador")} ${Object.values(selectedToken.stages || {}).filter(value => value !== 0).length === 1 ? "ativo" : "ativos"}`
                                            : "Todos neutros"}
                                    </strong>
                                </summary>
                                <div className="token-modifier-grid">
                                    {STAGE_STAT_KEYS.map(stat => {
                                        const value = selectedToken.stages?.[stat] || 0;
                                        const calculated = stat === "accuracy" || stat === "evasion"
                                            ? `${formatNumberPtBr(accuracyStageMultiplier(value))}×`
                                            : formatNumberPtBr(selectedToken.stats?.[stat] || 0);
                                        return (
                                            <div className="token-modifier" key={stat}>
                                                <span>
                                                    <strong>{STAGE_LABELS[stat]}</strong>
                                                    <small>Valor atual {calculated}</small>
                                                </span>
                                                <button type="button" disabled={role !== "narrator" || value <= -6} onClick={() => adjustSelectedStage(stat, -1)} aria-label={`Reduzir ${STAGE_LABELS[stat]}`}>−</button>
                                                <b aria-label={`Estágio ${value}`}>{value > 0 ? `+${value}` : value}</b>
                                                <button type="button" disabled={role !== "narrator" || value >= 6} onClick={() => adjustSelectedStage(stat, 1)} aria-label={`Aumentar ${STAGE_LABELS[stat]}`}>+</button>
                                            </div>
                                        );
                                    })}
                                </div>
                                {role === "narrator" && (
                                    <button type="button" className="token-modifier-reset" onClick={resetSelectedStages}>Neutralizar todos</button>
                                )}
                            </details>
                            {role === "narrator" && (
                                <>
                                    {selectedToken.teraType && (
                                        <button
                                            type="button"
                                            className={`token-tera ${selectedToken.teraActive ? "is-active" : ""}`}
                                            onClick={() => updateToken({ teraActive: !selectedToken.teraActive })}
                                        >
                                            {selectedToken.teraActive ? `Tipo Tera ${formatType(selectedToken.teraType)} ativo` : `Terastalizar como ${formatType(selectedToken.teraType)}`}
                                        </button>
                                    )}
                                    <label>
                                        <span>Lado</span>
                                        <select value={selectedToken.side} onChange={event => updateToken({ side: event.target.value })}>
                                            <option value="ally">Treinadores</option>
                                            <option value="opponent">Oponentes</option>
                                            <option value="neutral">Sem lado</option>
                                        </select>
                                    </label>
                                    <label>
                                        <span>Quem controla</span>
                                        <select value={selectedToken.ownerPlayerId} onChange={event => updateToken({ ownerPlayerId: event.target.value })}>
                                            <option value="">Narrador</option>
                                            {players.map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Ajustar prioridade</span>
                                        <select value={selectedToken.priority || 0} onChange={event => updateToken({ priority: Number(event.target.value) })}>
                                            {[7,6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6,-7].map(value => <option key={value} value={value}>{value > 0 ? `+${value}` : value}</option>)}
                                        </select>
                                    </label>
                                    <button type="button" className="token-remove" onClick={removeToken}>Retirar da cena</button>
                                </>
                            )}
                        </section>
                    )}

                    <div className="room-notes-grid">
                        <NoteField
                            label="Descrição da cena"
                            value={snapshot.sceneNotes}
                            disabled={role !== "narrator"}
                            onCommit={sceneNotes => commitSnapshot({ ...snapshot, sceneNotes })}
                        />
                        {role === "narrator" && (
                            <NoteField
                                label="Notas do Narrador"
                                value={snapshot.gmNotes}
                                privateNote
                                onCommit={gmNotes => commitSnapshot({ ...snapshot, gmNotes })}
                            />
                        )}
                    </div>
                </main>

                <aside className="room-tools">
                    <VoiceCall session={session} role={role} />
                    <QuickRoller onEvent={sendEvent} onError={showError} />
                    <CombatAssistant
                        role={role}
                        playerId={session.playerId}
                        snapshot={snapshot}
                        selectedTokenId={selectedTokenId}
                        onSnapshotChange={commitSnapshot}
                        onDeclareMove={declareMove}
                        onEvent={sendEvent}
                        onError={showError}
                    />
                    <AudioDeck
                        session={session}
                        role={role}
                        snapshot={snapshot}
                        media={room.media || []}
                        events={events}
                        onSnapshotChange={commitSnapshot}
                        onEvent={sendEvent}
                        onRefresh={() => refresh(session)}
                        onError={showError}
                    />

                    <details className="room-tool" open>
                        <summary>
                            <span>
                                <small>O que aconteceu</small>
                                <strong>Diário da aventura</strong>
                            </span>
                            <span className="room-tool-badge">{events.length}</span>
                        </summary>
                        <div className="room-tool-body">
                            <div className="event-log" aria-live="polite">
                                {events.slice(-40).reverse().map(event => (
                                    <article key={event.id} className={`event-${event.type}`}>
                                        <span>{timeLabel(event.createdAt)}</span>
                                        <p>{eventSummary(event)}</p>
                                        {role === "narrator" && event.type === "team-offer" && !acceptedOfferIds.has(Number(event.id)) && (
                                            <button type="button" onClick={() => acceptTeamOffer(event)}>Aceitar equipe</button>
                                        )}
                                        {role === "narrator" && event.type === "team-offer" && acceptedOfferIds.has(Number(event.id)) && (
                                            <small className="event-accepted">Equipe aceita</small>
                                        )}
                                    </article>
                                ))}
                                {!events.length && <p className="room-empty-copy">As ações da aventura aparecerão aqui.</p>}
                            </div>
                            <form
                                className="room-message"
                                onSubmit={event => {
                                    event.preventDefault();
                                    const form = new FormData(event.currentTarget);
                                    const text = String(form.get("message") || "").trim();
                                    if (!text) return;
                                    event.currentTarget.reset();
                                    void sendEvent("message", { text: text.slice(0, 500) });
                                }}
                            >
                                <input name="message" maxLength={500} placeholder="Compartilhe uma mensagem…" aria-label="Mensagem da aventura" />
                                <button type="submit">Enviar</button>
                            </form>
                        </div>
                    </details>

                    {role === "narrator" && (
                        <details className="room-tool">
                            <summary>
                                <span>
                                    <small>Visão do campo</small>
                                    <strong>Preferências da cena</strong>
                                </span>
                                <span className="room-tool-badge">N</span>
                            </summary>
                            <div className="room-tool-body room-settings">
                                <label>
                                    <input type="checkbox" checked={snapshot.settings.showHp} onChange={event => commitSnapshot({ ...snapshot, settings: { ...snapshot.settings, showHp: event.target.checked } })} />
                                    <span>Mostrar barras de HP no campo</span>
                                </label>
                                <label>
                                    <input type="checkbox" checked={snapshot.settings.allowPlayerMovement} onChange={event => commitSnapshot({ ...snapshot, settings: { ...snapshot.settings, allowPlayerMovement: event.target.checked } })} />
                                    <span>Jogadores podem mover seus Pokémon</span>
                                </label>
                                <label>
                                    <input type="checkbox" checked={snapshot.settings.mirrorSprites} onChange={event => commitSnapshot({ ...snapshot, settings: { ...snapshot.settings, mirrorSprites: event.target.checked } })} />
                                    <span>Espelhar aliados como nos jogos</span>
                                </label>
                            </div>
                        </details>
                    )}
                </aside>
            </div>

            <ConfirmDialog
                open={ending}
                title="Encerrar esta aventura?"
                description="Esta aventura, o diário compartilhado e as trilhas serão apagados para todos. Suas Boxes continuarão seguras no PC."
                confirmLabel={busy ? "Encerrando…" : "Encerrar aventura"}
                cancelLabel="Continuar aventura"
                danger
                onConfirm={endRoom}
                onCancel={() => setEnding(false)}
            />
        </div>
    );
}

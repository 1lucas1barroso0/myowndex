import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import {
    addTeamToSnapshot,
    advanceInitiative,
    buildInitiative,
    compactTeamOffer,
    createTokenFromPokemon,
    createRoomSnapshot,
    eventSummary,
    LOCAL_ROOM_STORAGE_KEY,
    mergeRoomConflictSnapshot,
    normalizeRoomSnapshot,
    ROOM_PHASES,
    STATUS_LABELS,
    syncTeamsWithRoomProgress,
} from "../../core/room.js";
import { formatNumberPtBr, formatType } from "../../core/mechanics.js";
import {
    buildPlayerInvite,
    clearRoomSession,
    createRemoteRoom,
    deleteRemoteRoom,
    fetchRemoteRoom,
    joinRemoteRoom,
    loadRoomSession,
    parseRoomInvite,
    postRoomEvent,
    saveRemoteRoom,
    saveRoomSession,
} from "../../core/roomClient.js";
import { getNextLevelXp, rollAttributeTest, rollPercentTest } from "../../core/rpgRules.js";
import { mergeImportedTeam, normalizeTeam, touchTeam } from "../../core/team.js";
import { readStorage, removeStorage, writeStorage } from "../../core/storage.js";
import AudioDeck from "./AudioDeck.jsx";
import Battlefield from "./Battlefield.jsx";
import CombatAssistant from "./CombatAssistant.jsx";

const connectionLabels = {
    connected: "Sincronizado",
    connecting: "Conectando",
    saving: "Salvando",
    offline: "Offline",
    local: "Mesa local",
    error: "Reconectar",
};

const roleLabel = role => role === "narrator" ? "Narrador" : "Jogador";
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

const errorMessage = error => error instanceof Error ? error.message : "Não foi possível concluir a ação.";

function Lobby({ defaultInvite, savedSession, busy, error, onCreate, onJoin, onLocal, onResume }) {
    const [title, setTitle] = useState("Minha aventura Pokémon");
    const [narratorName, setNarratorName] = useState("Narrador");
    const [code, setCode] = useState(defaultInvite?.code || "");
    const [inviteCode, setInviteCode] = useState(defaultInvite?.inviteCode || "");
    const [displayName, setDisplayName] = useState("");

    return (
        <div className="room-lobby animate-fade-in">
            <section className="room-lobby-hero">
                <div>
                    <span className="room-kicker">MyOwnDex Live</span>
                    <h2>O RPG inteiro, em uma única sala.</h2>
                    <p>Campo 2D, fichas, regras, cálculos, iniciativa, progressão e áudio conectados ao mesmo estado da aventura.</p>
                </div>
                <div className="room-live-orb" aria-hidden="true">
                    <span />
                    <i />
                </div>
            </section>

            {error && <div className="room-error" role="alert">{error}</div>}
            {savedSession && !defaultInvite && (
                <button type="button" className="room-resume" disabled={busy} onClick={() => onResume(savedSession)}>
                    <span>
                        <small>Sala recente</small>
                        <strong>{savedSession.code} • {roleLabel(savedSession.role)}</strong>
                    </span>
                    <b>Retomar</b>
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
                            <small>Autoridade da campanha</small>
                            <h3>Criar como Narrador</h3>
                        </div>
                    </header>
                    <label>
                        <span>Nome da aventura</span>
                        <input value={title} maxLength={80} required onChange={event => setTitle(event.target.value)} />
                    </label>
                    <label>
                        <span>Como será chamado</span>
                        <input value={narratorName} maxLength={32} required onChange={event => setNarratorName(event.target.value)} />
                    </label>
                    <ul>
                        <li>Controla campo, rodada, HP e iniciativa.</li>
                        <li>Importa equipes e decide o estado oficial.</li>
                        <li>Compartilha um convite separado da chave de controle.</li>
                    </ul>
                    <button type="submit" className="room-primary-button" disabled={busy}>
                        {busy ? "Preparando sala…" : "Criar Sala RPG"}
                    </button>
                </form>

                <form
                    className="room-lobby-card is-player"
                    onSubmit={event => {
                        event.preventDefault();
                        onJoin({ code, inviteCode, displayName });
                    }}
                >
                    <header>
                        <span className="room-role-mark">J</span>
                        <div>
                            <small>Acesso por convite</small>
                            <h3>Entrar como Jogador</h3>
                        </div>
                    </header>
                    <div className="room-code-row">
                        <label>
                            <span>Código da sala</span>
                            <input value={code} maxLength={8} required autoCapitalize="characters" onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                        </label>
                        <label>
                            <span>Convite</span>
                            <input value={inviteCode} maxLength={64} required onChange={event => setInviteCode(event.target.value)} />
                        </label>
                    </div>
                    <label>
                        <span>Nome do Jogador</span>
                        <input value={displayName} maxLength={32} required onChange={event => setDisplayName(event.target.value)} />
                    </label>
                    <ul>
                        <li>Acompanha o campo e a progressão em tempo quase real.</li>
                        <li>Rola dados, conversa e envia sua equipe.</li>
                        <li>Não pode substituir decisões do Narrador.</li>
                    </ul>
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
                    <small>Sem conexão ou apenas neste aparelho</small>
                    <strong>Abrir uma mesa local</strong>
                </span>
                <b>Modo offline</b>
            </button>
            <p className="room-lobby-footnote">A Sala RPG preserva uma cópia local das suas Boxes. O estado compartilhado usa acesso protegido e revisão contra alterações simultâneas.</p>
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
                    detail: `${test.dice.join(" • ")}${Number(attribute) ? ` + ${Number(attribute)}` : ""}`,
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
                    <small>Dados oficiais</small>
                    <strong>Rolagem rápida</strong>
                </span>
                <span className="room-tool-badge">LIVE</span>
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
                        <span>Condição</span>
                        <select value={mode} onChange={event => setMode(event.target.value)}>
                            <option value="normal">Normal</option>
                            <option value="advantage">Vantagem</option>
                            {kind === "attribute" && <option value="disadvantage">Desvantagem</option>}
                        </select>
                    </label>
                </div>
                <button type="button" className="room-primary-button" disabled={busy} onClick={roll}>Rolar para a sala</button>
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

    const snapshot = useMemo(() => normalizeRoomSnapshot(room?.snapshot), [room?.snapshot]);
    const role = session?.role || "";
    const selectedTeam = teams.find(team => team.id === selectedTeamId) || teams[0] || null;
    const selectedToken = snapshot.tokens.find(token => token.id === selectedTokenId) || null;

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
                if (!localRoom?.snapshot) throw new Error("A mesa local salva não foi encontrada.");
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
            setNotice?.({ tone: "blue", text: `Sala ${result.code} criada. O convite de Jogador já está pronto.` });
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
            const result = await joinRemoteRoom(input);
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
            await navigator.clipboard.writeText(value);
            setNotice?.({ tone: "blue", text: `${label} copiado.` });
        } catch {
            showError(new Error("O navegador não permitiu copiar automaticamente."));
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
            setNotice?.({ tone: "blue", text: "A Sala RPG foi encerrada." });
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
            text: `${selectedTeam.name} entrou em campo${side === "opponent" ? " como oposição" : ""}.`,
        });
        if (result.tokens[0]) setSelectedTokenId(result.tokens[0].id);
    };

    const updateToken = patch => {
        if (!selectedToken || role !== "narrator") return;
        const nextToken = { ...selectedToken, ...patch };
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
                            },
                        }
                        : pokemon),
                })
                : team
            ));
        }
    };

    const removeToken = () => {
        if (!selectedToken || role !== "narrator") return;
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.filter(token => token.id !== selectedToken.id),
            initiative: snapshot.initiative.filter(id => id !== selectedToken.id),
            turnIndex: 0,
        });
        setSelectedTokenId("");
    };

    const levelUpSelectedToken = () => {
        if (!selectedToken || role !== "narrator" || selectedToken.level >= 200) return;
        const goal = getNextLevelXp(selectedToken.level);
        if (selectedToken.xp < goal) return;
        const sourceTeam = teams.find(team => team.id === selectedToken.teamId);
        const sourcePokemon = sourceTeam?.pokemon.find(pokemon => pokemon.id === selectedToken.pokemonId);
        if (!sourceTeam || !sourcePokemon) {
            updateToken({ level: selectedToken.level + 1, xp: 0 });
            return;
        }
        const nextPokemon = {
            ...sourcePokemon,
            level: sourcePokemon.level + 1,
            rpg: { ...sourcePokemon.rpg, xp: 0 },
        };
        const nextTeam = {
            ...sourceTeam,
            pokemon: sourceTeam.pokemon.map(pokemon => pokemon.id === nextPokemon.id ? nextPokemon : pokemon),
        };
        const recalculated = createTokenFromPokemon(nextPokemon, nextTeam, 0, selectedToken.side);
        const hpGrowth = Math.max(0, recalculated.maxHp - selectedToken.maxHp);
        const nextToken = {
            ...selectedToken,
            level: nextPokemon.level,
            xp: 0,
            maxHp: recalculated.maxHp,
            currentHp: Math.min(recalculated.maxHp, selectedToken.currentHp + hpGrowth),
            stats: recalculated.stats,
        };
        setTeams(current => current.map(team => team.id === nextTeam.id ? touchTeam(nextTeam) : team));
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.map(token => token.id === selectedToken.id ? nextToken : token),
        });
        setNotice?.({ tone: "blue", text: `${selectedToken.name} avançou para o nível ${nextPokemon.level}.` });
    };

    const generateInitiative = async () => {
        const generated = buildInitiative(snapshot);
        commitSnapshot(generated.room);
        await sendEvent("system", {
            text: `Iniciativa definida: ${generated.results.map(result => `${snapshot.tokens.find(token => token.id === result.tokenId)?.name} (${result.total})`).join(", ")}.`,
        });
    };

    const nextTurn = async () => {
        const closingRound = snapshot.initiative.length > 0
            && snapshot.turnIndex >= snapshot.initiative.length - 1;
        const next = closingRound
            ? {
                ...buildInitiative({ ...snapshot, round: snapshot.round + 1 }).room,
                round: snapshot.round + 1,
            }
            : advanceInitiative(snapshot);
        commitSnapshot(next);
        const activeId = next.initiative[next.turnIndex];
        const active = next.tokens.find(token => token.id === activeId);
        await sendEvent("system", { text: active ? `Turno de ${active.name}. Rodada ${next.round}.` : `Rodada ${next.round}.` });
    };

    const offerTeam = async () => {
        if (!selectedTeam) return;
        await sendEvent("team-offer", { team: compactTeamOffer(selectedTeam) });
        setNotice?.({ tone: "blue", text: `${selectedTeam.name} foi enviada ao Narrador.` });
    };

    const acceptTeamOffer = async event => {
        if (role !== "narrator" || !event.payload?.team) return;
        const incoming = normalizeTeam(event.payload.team);
        const merged = mergeImportedTeam(teams, incoming);
        setTeams(merged.teams);
        const result = addTeamToSnapshot(snapshot, merged.team, "ally", event.playerId || "");
        commitSnapshot(result.room);
        await sendEvent("team-accepted", { text: `${event.author}: equipe aceita pelo Narrador.` });
    };

    const toggleReady = async () => {
        const current = room.players?.find(player => player.id === session.playerId);
        await sendEvent("ready", { ready: !current?.ready });
    };

    const inviteUrl = role === "narrator" && !session.local ? buildPlayerInvite(session) : "";
    const players = room?.players || [];
    const events = room?.events || [];
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
                savedSession={initialSavedSession}
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
                        <small>{connectionLabels[connection]} • Sala {session.code}</small>
                        <h2>{snapshot.title}</h2>
                    </div>
                </div>
                <div className="room-header-actions">
                    <span className={`room-role-badge is-${role}`}>{roleLabel(role)}</span>
                    {role === "narrator" && !session.local && (
                        <>
                            <button type="button" onClick={() => copy(session.code, "Código da sala")}>Código</button>
                            <button type="button" onClick={() => copy(inviteUrl, "Convite de Jogador")}>Copiar convite</button>
                        </>
                    )}
                    <button type="button" onClick={onOpenGuide}>Regras</button>
                    <button type="button" className="room-leave" onClick={() => role === "narrator" ? setEnding(true) : void leave()}>
                        {role === "narrator" ? "Encerrar" : "Sair"}
                    </button>
                </div>
            </header>

            {error && <button type="button" className="room-error is-action" onClick={() => refresh(session).catch(showError)}>{error} • tentar novamente</button>}

            <nav className="room-mobile-nav" aria-label="Painéis da Sala RPG">
                <button type="button" aria-pressed={mobilePane === "roster"} onClick={() => setMobilePane("roster")}>Equipe</button>
                <button type="button" aria-pressed={mobilePane === "field"} onClick={() => setMobilePane("field")}>Campo</button>
                <button type="button" aria-pressed={mobilePane === "tools"} onClick={() => setMobilePane("tools")}>Ações</button>
            </nav>

            <div className="room-layout">
                <aside className="room-roster">
                    <section className="room-section">
                        <div className="room-section-heading">
                            <div>
                                <span className="room-kicker">Sala ao vivo</span>
                                <h3>Treinadores</h3>
                            </div>
                            <span>{players.length}</span>
                        </div>
                        <div className="room-player-list">
                            <div className="room-player is-narrator">
                                <i />
                                <span><strong>Narrador</strong><small>Autoridade da sala</small></span>
                            </div>
                            {players.map(player => {
                                const present = isPlayerPresent(player);
                                return (
                                <div key={player.id} className={`room-player ${player.ready ? "is-ready" : ""} ${present ? "is-online" : "is-away"}`}>
                                    <i style={{ background: player.accent }} />
                                    <span><strong>{player.displayName}</strong><small>{present ? (player.ready ? "Pronto" : "Preparando-se") : "Ausente"}</small></span>
                                    {present && player.ready && <b>✓</b>}
                                </div>
                                );
                            })}
                        </div>
                        {role === "player" && (
                            <button type="button" className="room-secondary-button" onClick={toggleReady}>
                                {players.find(player => player.id === session.playerId)?.ready ? "Ainda não estou pronto" : "Estou pronto"}
                            </button>
                        )}
                    </section>

                    <section className="room-section">
                        <div className="room-section-heading">
                            <div>
                                <span className="room-kicker">PC do Bill</span>
                                <h3>Equipe local</h3>
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
                                            {pokemon.species?.sprites?.front_default
                                                ? <img src={pokemon.species.sprites.front_default} alt="" className="pixelated" />
                                                : <i />}
                                        </span>
                                    ))}
                                    {!selectedTeam?.pokemon.length && <small>Esta Box está vazia.</small>}
                                </div>
                                {role === "narrator" ? (
                                    <div className="room-button-row">
                                        <button type="button" onClick={() => addSelectedTeam("ally")}>Adicionar aliados</button>
                                        <button type="button" onClick={() => addSelectedTeam("opponent")}>Adicionar oposição</button>
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
                                        <small>{token.stats?.speed ?? "—"}</small>
                                    </li>
                                );
                            })}
                            {!snapshot.initiative.length && <li className="is-empty">A ordem ainda não foi rolada.</li>}
                        </ol>
                        {role === "narrator" && (
                            <div className="room-button-row">
                                <button type="button" disabled={!snapshot.tokens.length} onClick={generateInitiative}>Gerar ordem</button>
                                <button type="button" disabled={!snapshot.initiative.length} onClick={nextTurn}>Próximo turno</button>
                            </div>
                        )}
                    </section>
                </aside>

                <main className="room-field">
                    <div className="room-scene-strip">
                        <label>
                            <span>Momento</span>
                            <select value={snapshot.phase} disabled={role !== "narrator"} onChange={event => commitSnapshot({ ...snapshot, phase: event.target.value })}>
                                {ROOM_PHASES.map(phase => <option key={phase.id} value={phase.id}>{phase.label}</option>)}
                            </select>
                        </label>
                        <div>
                            <small>Rodada</small>
                            <strong>{snapshot.round}</strong>
                        </div>
                        <div>
                            <small>Em cena</small>
                            <strong>{snapshot.tokens.length}</strong>
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
                                {selectedToken.sprite ? <img src={selectedToken.sprite} alt="" className="pixelated" /> : <i />}
                                <span>
                                    <small>Nível {selectedToken.level}</small>
                                    <strong>{selectedToken.name}</strong>
                                    <em>{selectedToken.types.map(formatType).join(" / ") || "Tipo livre"}</em>
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
                                />
                                <small>/ {formatNumberPtBr(getNextLevelXp(selectedToken.level))}</small>
                                {role === "narrator" && (
                                    <button
                                        type="button"
                                        disabled={selectedToken.xp < getNextLevelXp(selectedToken.level) || selectedToken.level >= 200}
                                        onClick={levelUpSelectedToken}
                                    >
                                        Subir nível
                                    </button>
                                )}
                            </div>
                            <label>
                                <span>Condição</span>
                                <select value={selectedToken.status} disabled={role !== "narrator"} onChange={event => updateToken({ status: event.target.value })}>
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            {role === "narrator" && (
                                <>
                                    <label>
                                        <span>Lado</span>
                                        <select value={selectedToken.side} onChange={event => updateToken({ side: event.target.value })}>
                                            <option value="ally">Treinadores</option>
                                            <option value="opponent">Oposição</option>
                                            <option value="neutral">Neutro</option>
                                        </select>
                                    </label>
                                    <label>
                                        <span>Controle</span>
                                        <select value={selectedToken.ownerPlayerId} onChange={event => updateToken({ ownerPlayerId: event.target.value })}>
                                            <option value="">Narrador</option>
                                            {players.map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Prioridade</span>
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
                    <QuickRoller onEvent={sendEvent} onError={showError} />
                    <CombatAssistant
                        role={role}
                        snapshot={snapshot}
                        selectedTokenId={selectedTokenId}
                        onSnapshotChange={commitSnapshot}
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
                                <small>Registro compartilhado</small>
                                <strong>Acontecimentos</strong>
                            </span>
                            <span className="room-tool-badge">{events.length}</span>
                        </summary>
                        <div className="room-tool-body">
                            <div className="event-log" aria-live="polite">
                                {events.slice(-40).reverse().map(event => (
                                    <article key={event.id} className={`event-${event.type}`}>
                                        <span>{timeLabel(event.createdAt)}</span>
                                        <p>{eventSummary(event)}</p>
                                        {role === "narrator" && event.type === "team-offer" && (
                                            <button type="button" onClick={() => acceptTeamOffer(event)}>Aceitar equipe</button>
                                        )}
                                    </article>
                                ))}
                                {!events.length && <p className="room-empty-copy">Os acontecimentos aparecerão aqui.</p>}
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
                                <input name="message" maxLength={500} placeholder="Falar com a sala…" aria-label="Mensagem para a sala" />
                                <button type="submit">Enviar</button>
                            </form>
                        </div>
                    </details>

                    {role === "narrator" && (
                        <details className="room-tool">
                            <summary>
                                <span>
                                    <small>Preferências da mesa</small>
                                    <strong>Controles de exibição</strong>
                                </span>
                                <span className="room-tool-badge">GM</span>
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
                title="Encerrar esta Sala RPG?"
                description="A sala, o registro compartilhado e as trilhas enviadas serão apagados. Suas Boxes locais continuarão intactas."
                confirmLabel={busy ? "Encerrando…" : "Encerrar sala"}
                cancelLabel="Continuar aventura"
                danger
                onConfirm={endRoom}
                onCancel={() => setEnding(false)}
            />
        </div>
    );
}

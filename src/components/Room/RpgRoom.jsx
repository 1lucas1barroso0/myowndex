import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";
import GameIcon from "../Shared/GameIcon.jsx";
import RoomSelect from "../Shared/RoomSelect.jsx";
import TurnOrder from "../Shared/TurnOrder.jsx";
import ExperienceAward from "../Shared/ExperienceAward.jsx";
import HitKillExplanation from "../Shared/HitKillExplanation.jsx";
import { awardRoomPokemonExperience, getRoomBattleRewardContext } from "../../core/roomExperience.js";
import {
    accuracyStageMultiplier,
    applyStageChange,
    calculateStagedStats,
    clearHitKillSurvivalGrace,
    disableHitKillProtection,
    getHitKillProtectionKey,
    getHitKillSurvivalGraceKeys,
    hasHitKillProtectionDisabled,
    normalizeStageMap,
    resolveDamageSequence,
    STAGE_LABELS,
    STAGE_STAT_KEYS,
} from "../../core/automation.js";
import {
    addTeamToSnapshot,
    advanceInitiative,
    applyEndOfRoundEffects,
    buildInitiative,
    changeRoomPhase,
    startNewRoomBattle,
    compactTeamOffer,
    createTokenFromPokemon,
    createRoomSnapshot,
    declareRoomMove,
    getRoundMoveBlockReason,
    eventSummary,
    LOCAL_ROOM_STORAGE_KEY,
    mergeRoomConflictSnapshot,
    normalizeRoomSnapshot,
    STATUS_LABELS,
    swapTeamPokemonInSnapshot,
    syncTeamsWithRoomProgress,
} from "../../core/room.js";
import { formatName, formatNumberPtBr, formatType } from "../../core/mechanics.js";
import { formatCount } from "../../core/copy.js";
import { integerInRange } from "../../core/math.js";
import {
    buildPlayerInvite,
    buildRoomInviteToken,
    clearRoomSession,
    createRoomActionRequestId,
    createRemoteRoom,
    deleteRemoteRoom,
    deleteRoomJournal,
    fetchRemoteRoom,
    joinRemoteRoom,
    loadRoomSession,
    loadRoomSessionDurable,
    parseRoomInvite,
    parseRoomInviteValue,
    postRoomEvent,
    requestRemoteRoomAction,
    saveRemoteRoom,
    saveRoomSession,
} from "../../core/roomClient.js";
import { getNextLevelXp } from "../../core/rpgRules.js";
import { applyAuthoritativeMovePriorities } from "../../../server/authoritativeActions.js";
import { accountRequest } from "../../core/accountClient.js";
import { bindAccountRoom, listAccountRooms, unlinkAccountRoom } from "../../core/accountRooms.js";
import { mergeImportedTeam, normalizeTeam, touchTeam } from "../../core/team.js";
import { getStorageScope, readDurableStorage, removeStorage, writeStorage } from "../../core/storage.js";
import { getBattleDisplayIdentity, normalizeSpecialState } from "../../core/specialMechanics.js";
import AudioDeck from "./AudioDeck.jsx";
import Battlefield from "./Battlefield.jsx";
import CombatAssistant from "./CombatAssistant.jsx";
import CaptureAssistant from "./CaptureAssistant.jsx";
import SpecialMechanicsPanel from "./SpecialMechanicsPanel.jsx";
import TraitMechanicsPanel from "./TraitMechanicsPanel.jsx";
import VoiceCall from "./VoiceCall.jsx";
import AdventurePhaseControl from "./AdventurePhaseControl.jsx";

const connectionLabels = {
    connected: "Aventura conectada",
    connecting: "Entrando na aventura…",
    saving: "Guardando mudanças…",
    offline: "Sem conexão",
    local: "Neste dispositivo",
    error: "Conexão interrompida",
};

const roleLabel = role => role === "narrator" ? "Narrador" : "Jogador";
const volatileEffectLabel = effect => {
    const turns = effect.turns != null ? ` • ${formatCount(effect.turns, "rodada")}` : "";
    const amount = effect.amount != null ? ` • ${formatNumberPtBr(effect.amount)} HP` : "";
    if (effect.id === "yawn") return `Sonolento por Yawn${turns}`;
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
    if (effect.protectedFromKnockout) return `${effect.tokenName} sofreu ${formatNumberPtBr(effect.damage)} de dano por ${effect.sources.join(" e ")}, mas consumiu a proteção contra Hit Kill`;
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

function Lobby({ defaultInvite, savedSession, accountRooms = [], busy, error, onCreate, onJoin, onLocal, onResume, onUnlink }) {
    const [title, setTitle] = useState("");
    const [narratorName, setNarratorName] = useState("");
    const [invite, setInvite] = useState(defaultInvite ? buildRoomInviteToken(defaultInvite) : "");
    const [displayName, setDisplayName] = useState("");
    const parsedInvite = useMemo(() => parseRoomInviteValue(invite), [invite]);
    const canResumeInvite = savedSession && defaultInvite && savedSession.code === defaultInvite.code;

    return (
        <div className="room-lobby animate-fade-in">
            <section className="room-lobby-hero adventure-intro">
                <div>
                    <h2>Aventuras</h2>
                    <p>Crie uma aventura ou entre com o convite do seu grupo.</p>
                </div>
                <PokemonCompanion place="adventure" eager />
            </section>

            {error && <div className="room-error" role="alert">{error}</div>}
            {accountRooms.length > 0 && <section className="room-account-adventures" aria-label="Aventuras da conta">
                <h3>Suas aventuras</h3>
                <div className="room-account-adventure-list">
                    {accountRooms.map(adventure => <article key={adventure.code}>
                        <button type="button" className="room-resume" disabled={busy} onClick={() => onResume(adventure)}>
                            <span><small>{roleLabel(adventure.role)} · {adventure.code}</small><strong>{adventure.title}</strong></span>
                            <b>Continuar</b>
                        </button>
                        <details><summary>Opções desta aventura</summary><button type="button" className="room-secondary-button" disabled={busy} onClick={() => onUnlink(adventure)}>Retirar da conta</button></details>
                    </article>)}
                </div>
            </section>}
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
                        if (!title.trim() || !narratorName.trim()) return;
                        onCreate({ title: title.trim(), narratorName: narratorName.trim() });
                    }}
                >
                    <header>
                        <span className="room-role-mark"><GameIcon name="adventure" /></span>
                        <div>
                            <h3>Narrador</h3>
                        </div>
                    </header>
                    <label>
                        <span>Nome da aventura</span>
                        <input value={title} maxLength={80} required pattern={".*\\S.*"} onChange={event => setTitle(event.target.value)} />
                    </label>
                    <label>
                        <span>Seu nome na aventura</span>
                        <input value={narratorName} maxLength={32} required pattern={".*\\S.*"} onChange={event => setNarratorName(event.target.value)} />
                    </label>
                    <details className="room-role-help">
                        <summary>Controles do Narrador</summary>
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
                        if (!invite.trim() || !displayName.trim()) return;
                        onJoin({ invite: invite.trim(), displayName: displayName.trim() });
                    }}
                >
                    <header>
                        <span className="room-role-mark"><GameIcon name="dex" /></span>
                        <div>
                            <h3>Jogador</h3>
                        </div>
                    </header>
                    <label>
                        <span>Link ou convite da aventura</span>
                        <textarea
                            value={invite}
                            rows={2}
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            onChange={event => setInvite(event.target.value)}
                        />
                        {parsedInvite && <small className="room-invite-detection is-valid">Aventura {parsedInvite.code} encontrada</small>}
                    </label>
                    <label>
                        <span>Seu nome na aventura</span>
                        <input value={displayName} maxLength={32} required pattern={".*\\S.*"} autoFocus={Boolean(defaultInvite)} onChange={event => setDisplayName(event.target.value)} />
                    </label>
                    <details className="room-role-help">
                        <summary>Controles do Jogador</summary>
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
                    <strong>Começar uma aventura local</strong>
                </span>
                <b>Neste dispositivo</b>
            </button>
        </div>
    );
}

function NoteField({ label, value, privateNote, disabled, onCommit }) {
    const [draft, setDraft] = useState(value || "");
    const noteId = useId();
    useEffect(() => setDraft(value || ""), [value]);
    return (
        <label className={`room-note ${privateNote ? "is-private" : ""}`} htmlFor={noteId}>
            <span id={`${noteId}-label`}>{label}{privateNote ? " • só Narrador" : ""}</span>
            <textarea
                id={noteId}
                aria-labelledby={`${noteId}-label`}
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

export default function RpgRoom({ teams, setTeams, onOpenGuide, onOpenPc, setNotice, account, onDiceContext }) {
    const storageScope = useMemo(() => getStorageScope(), []);
    const initialInvite = useMemo(() => parseRoomInvite(), []);
    const [session, setSession] = useState(null);
    const [room, setRoom] = useState(null);
    const [busy, setBusy] = useState(false);
    const [initiativeBusy, setInitiativeBusy] = useState(false);
    const initiativeLock = useRef(false);
    const [connection, setConnection] = useState("connecting");
    const [error, setError] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id || "");
    const [selectedTeamPokemonId, setSelectedTeamPokemonId] = useState(teams[0]?.pokemon[0]?.id || "");
    const [selectedTokenId, setSelectedTokenId] = useState("");
    const [selectedBenchTokenId, setSelectedBenchTokenId] = useState("");
    const [mobilePane, setMobilePane] = useState("field");
    const [ending, setEnding] = useState(false);
    const [deletingJournal, setDeletingJournal] = useState(null);
    const [journalBusy, setJournalBusy] = useState(false);
    const [accountRooms, setAccountRooms] = useState([]);
    const [unlinking, setUnlinking] = useState(null);
    const [renewingInvite, setRenewingInvite] = useState(false);
    const revisionRef = useRef(0);
    const pendingSavesRef = useRef(0);
    const saveQueueRef = useRef(Promise.resolve());
    const channelRef = useRef(null);
    const authoritativeRequestsRef = useRef(new Map());
    const mountedRef = useRef(true);
    const snapshotRef = useRef(createRoomSnapshot());

    const reloadAccountRooms = useCallback(async () => {
        if (!account?.id) return;
        const result = await listAccountRooms(account.id);
        if (mountedRef.current) setAccountRooms(Array.isArray(result.rooms) ? result.rooms : []);
    }, [account]);

    useEffect(() => {
        void reloadAccountRooms().catch(() => {});
    }, [reloadAccountRooms]);

    const linkRoomToAccount = useCallback(async target => {
        if (!account?.id || target.local || target.key.startsWith("account_")) return;
        try {
            await bindAccountRoom(account.id, target);
            if (mountedRef.current) await reloadAccountRooms();
        } catch {
            if (mountedRef.current) setNotice?.({ tone: "amber", text: "A aventura continua disponível aqui. Não foi possível vinculá-la à conta; abra novamente quando a conexão voltar." });
        }
    }, [account, reloadAccountRooms, setNotice]);

    const snapshot = useMemo(() => normalizeRoomSnapshot(room?.snapshot), [room?.snapshot]);
    const role = session?.role || "";
    const selectedTeam = teams.find(team => team.id === selectedTeamId) || teams[0] || null;
    const selectedTeamPokemon = selectedTeam?.pokemon.find(pokemon => pokemon.id === selectedTeamPokemonId)
        || selectedTeam?.pokemon[0]
        || null;
    const selectedTeamPokemonToken = selectedTeamPokemon
        ? snapshot.tokens.find(token => token.pokemonId === selectedTeamPokemon.id && (
            token.teamId === selectedTeam?.id
            || (token.teamShareId && token.teamShareId === selectedTeam?.shareId)
        )) || null
        : null;
    const selectedTeamPokemonBenchToken = selectedTeamPokemon
        ? snapshot.benchTokens.find(token => token.pokemonId === selectedTeamPokemon.id && (
            token.teamId === selectedTeam?.id
            || (token.teamShareId && token.teamShareId === selectedTeam?.shareId)
        )) || null
        : null;
    const selectedToken = snapshot.tokens.find(token => token.id === selectedTokenId) || null;
    const selectedDisplayIdentity = selectedToken ? getBattleDisplayIdentity(selectedToken) : null;
    const selectedBenchTokens = selectedToken
        ? snapshot.benchTokens.filter(token => token.currentHp > 0 && (
            token.teamId === selectedToken.teamId
            || (token.teamShareId && token.teamShareId === selectedToken.teamShareId)
        ))
        : [];
    const selectedBenchToken = selectedBenchTokens.find(token => token.id === selectedBenchTokenId)
        || selectedBenchTokens[0]
        || null;
    const selectedProtectionKey = getHitKillProtectionKey(selectedToken);
    const selectedProtectionState = selectedToken
        ? selectedProtectionKey && snapshot.hitKillProtectionUsed.includes(selectedProtectionKey)
            ? "used"
            : hasHitKillProtectionDisabled(snapshot.hitKillProtectionDisabled, selectedToken)
                ? "lost"
                : "available"
        : "available";

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    useEffect(() => {
        if (!session?.local) return undefined;
        const receive = event => {
            const incoming = event.detail?.document?.localAdventure;
            if (event.detail?.scope !== storageScope || !incoming?.snapshot) return;
            const next = normalizeRoomSnapshot(incoming.snapshot);
            snapshotRef.current = next;
            setRoom(current => current ? { ...incoming, snapshot: next } : current);
        };
        window.addEventListener("myowndex:account-document", receive);
        return () => window.removeEventListener("myowndex:account-document", receive);
    }, [session?.local, storageScope]);

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

    useEffect(() => {
        authoritativeRequestsRef.current.clear();
    }, [session?.code]);

    const showError = useCallback(value => {
        const message = errorMessage(value);
        setError(message);
        setNotice?.({ tone: "red", text: message });
    }, [setNotice]);

    const applyBundle = useCallback(bundle => {
        if (!bundle) return;
        revisionRef.current = integerInRange(bundle.revision, 0, Number.MAX_SAFE_INTEGER, 0);
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
                const localRoom = await readDurableStorage(LOCAL_ROOM_STORAGE_KEY, null, { scope: storageScope });
                if (!mountedRef.current) return;
                if (!localRoom?.snapshot) throw new Error("Não encontramos a aventura salva neste dispositivo.");
                setSession(targetSession);
                setRoom(localRoom);
                setConnection("local");
                return;
            }
            const bundle = await fetchRemoteRoom(targetSession);
            if (!mountedRef.current) return;
            setSession(targetSession);
            saveRoomSession(targetSession, { scope: storageScope });
            applyBundle(bundle);
            await linkRoomToAccount(targetSession);
        } catch (value) {
            clearRoomSession({ scope: storageScope });
            if (mountedRef.current) showError(value);
        } finally {
            if (mountedRef.current) setBusy(false);
        }
    }, [applyBundle, linkRoomToAccount, showError, storageScope]);

    useEffect(() => {
        if (initialInvite) return undefined;
        let active = true;
        void loadRoomSessionDurable({ scope: storageScope }).then(saved => {
            if (active && saved) void resume(saved);
        });
        return () => { active = false; };
    }, [initialInvite, resume, storageScope]);

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
            saveRoomSession(nextSession, { scope: storageScope });
            if (!mountedRef.current) return;
            setSession(nextSession);
            const bundle = await fetchRemoteRoom(nextSession);
            if (!mountedRef.current) return;
            applyBundle(bundle);
            await linkRoomToAccount(nextSession);
            setNotice?.({ tone: "blue", text: `A aventura ${result.code} está pronta — e o convite para jogadores também.` });
        } catch (value) {
            showError(value);
        } finally {
            setBusy(false);
        }
    };

    const createLocal = input => {
        const localTitle = String(input.title || "").trim() || "Aventura local";
        const localName = String(input.narratorName || "").trim() || "Narrador";
        const nextSession = {
            code: "LOCAL",
            key: "local",
            role: "narrator",
            playerId: null,
            displayName: localName,
            inviteCode: "",
            local: true,
        };
        const localRoom = {
            code: "LOCAL",
            title: localTitle,
            revision: 0,
            updatedAt: new Date().toISOString(),
            snapshot: createRoomSnapshot(localTitle),
            players: [],
            events: [{
                id: Date.now(),
                playerId: null,
                author: localName,
                type: "system",
                payload: { text: `A aventura “${localTitle}” começou neste dispositivo.` },
                createdAt: new Date().toISOString(),
            }],
            media: [],
        };
        setSession(nextSession);
        setRoom(localRoom);
        setConnection("local");
        saveRoomSession(nextSession, { scope: storageScope });
        writeStorage(LOCAL_ROOM_STORAGE_KEY, localRoom, { scope: storageScope });
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
            saveRoomSession(nextSession, { scope: storageScope });
            if (!mountedRef.current) return;
            setSession(nextSession);
            applyBundle({ ...result.room, role: "player", playerId: result.playerId });
            await linkRoomToAccount(nextSession);
            if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } catch (value) {
            showError(value);
        } finally {
            setBusy(false);
        }
    };

    const commitSnapshot = useCallback(nextValue => {
        if (!session || session.role !== "narrator") return;
        const baseSnapshot = snapshotRef.current;
        const normalized = normalizeRoomSnapshot(nextValue);
        snapshotRef.current = normalized;
        if (session.local) {
            setRoom(current => {
                if (!current) return current;
                const next = {
                    ...current,
                    revision: Math.min(Number.MAX_SAFE_INTEGER, integerInRange(current.revision, 0, Number.MAX_SAFE_INTEGER, 0) + 1),
                    updatedAt: new Date().toISOString(),
                    snapshot: normalized,
                };
                writeStorage(LOCAL_ROOM_STORAGE_KEY, next, { scope: storageScope });
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
                    expectedRevision = integerInRange(value.data.room.revision, 0, Number.MAX_SAFE_INTEGER, expectedRevision);
                    snapshotToSave = mergeRoomConflictSnapshot(
                        baseSnapshot,
                        normalized,
                        value.data.room.snapshot,
                    );
                    result = await saveRemoteRoom(session, snapshotToSave, expectedRevision);
                }
                revisionRef.current = integerInRange(result.revision, 0, Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, expectedRevision + 1));
                if (mountedRef.current && pendingSavesRef.current <= 1) applyBundle(result);
                channelRef.current?.postMessage({ type: "invalidate" });
                return true;
            } catch (value) {
                if (mountedRef.current) {
                    setConnection(navigator.onLine ? "error" : "offline");
                    showError(value);
                }
                return false;
            } finally {
                pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
                if (mountedRef.current && pendingSavesRef.current === 0) setConnection("connected");
            }
        };

        saveQueueRef.current = saveQueueRef.current.then(persist, persist);
        return saveQueueRef.current;
    }, [applyBundle, session, showError, storageScope]);

    const sendEvent = useCallback(async (type, payload) => {
        if (!session) return;
        if (session.local) {
            setRoom(current => {
                if (!current) return current;
                const previousEventId = integerInRange(current.events?.at(-1)?.id, 0, Number.MAX_SAFE_INTEGER, 0);
                const next = {
                    ...current,
                    events: [...(current.events || []), {
                        id: Math.max(previousEventId + 1, Date.now()),
                        playerId: null,
                        author: session.displayName || "Narrador",
                        type,
                        payload: payload || {},
                        createdAt: new Date().toISOString(),
                    }].slice(-180),
                };
                writeStorage(LOCAL_ROOM_STORAGE_KEY, next, { scope: storageScope });
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
    }, [refresh, session, showError, storageScope]);

    const requestAuthoritativeAction = useCallback(async input => {
        if (!session || session.local) throw new Error("Esta ação autoritativa só existe em aventuras compartilhadas.");
        const requestKey = JSON.stringify(input);
        let pending = authoritativeRequestsRef.current.get(requestKey);
        if (!pending) {
            await saveQueueRef.current;
            pending = authoritativeRequestsRef.current.get(requestKey);
            if (!pending) {
                const needsRevision = ["initiative", "advance-turn", "combat", "capture", "start-battle"].includes(input.action);
                pending = {
                    requestId: createRoomActionRequestId(),
                    ...(needsRevision ? { expectedRevision: revisionRef.current } : {}),
                };
                authoritativeRequestsRef.current.set(requestKey, pending);
            }
        }
        setConnection("saving");
        let completed = false;
        try {
            const response = await requestRemoteRoomAction(session, { ...input, ...pending });
            authoritativeRequestsRef.current.delete(requestKey);
            if (response.room && mountedRef.current) applyBundle(response.room);
            channelRef.current?.postMessage({ type: "invalidate" });
            completed = true;
            return response.result;
        } catch (value) {
            if (value?.data?.room && mountedRef.current) applyBundle(value.data.room);
            if (!value?.retryable && value?.status && value.status < 500 && ![408, 429].includes(value.status)) {
                authoritativeRequestsRef.current.delete(requestKey);
            }
            if (mountedRef.current && !value?.data?.room) setConnection(navigator.onLine ? "error" : "offline");
            throw value;
        } finally {
            if (mountedRef.current && completed) setConnection("connected");
        }
    }, [applyBundle, session]);

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
            showError(new Error("Não foi possível copiar o convite com um toque. Selecione o conteúdo e use a opção Copiar do dispositivo."));
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
        clearRoomSession({ scope: storageScope });
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
            if (session.local) removeStorage(LOCAL_ROOM_STORAGE_KEY, { scope: storageScope });
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

    const deleteJournal = async () => {
        if (!session || !deletingJournal || journalBusy) return;
        const selection = deletingJournal;
        setJournalBusy(true);
        try {
            if (session.local) {
                setRoom(current => {
                    if (!current) return current;
                    const next = { ...current, events: (current.events || []).filter(event =>
                        selection.all ? event.id > selection.through.events : event.id !== selection.id) };
                    writeStorage(LOCAL_ROOM_STORAGE_KEY, next, { scope: storageScope });
                    return next;
                });
            } else {
                await deleteRoomJournal(session, selection);
                channelRef.current?.postMessage({ type: "invalidate" });
                await refresh(session);
            }
            setDeletingJournal(null);
            setNotice?.({ tone: "blue", text: selection.all ? "Histórico limpo." : "Registro apagado." });
        } catch (value) {
            showError(value);
        } finally {
            setJournalBusy(false);
        }
    };

    const addSelectedTeam = async side => {
        if (!selectedTeam || !selectedTeamPokemon) return;
        const pokemonName = selectedTeamPokemon.nickname
            || formatName(selectedTeamPokemon.species?.species?.name || selectedTeamPokemon.species?.name);
        const result = addTeamToSnapshot(snapshot, selectedTeam, side, "", {
            activePokemonIds: [selectedTeamPokemon.id],
            benchRemaining: true,
        });
        if (!result.tokens.length && !result.benchTokens.length) {
            const text = selectedTeamPokemonToken
                ? `${pokemonName} já está em campo.`
                : selectedTeamPokemonBenchToken?.currentHp <= 0
                    ? `${pokemonName} não pode mais batalhar.`
                    : snapshot.tokens.length >= 40
                        ? "O campo já chegou ao limite seguro de 40 Pokémon."
                        : `${pokemonName} já está vinculado a esta cena.`;
            setNotice?.({ tone: "amber", text });
            return;
        }
        commitSnapshot(result.room);
        if (!result.tokens.length) {
            await sendEvent("system", { text: `O banco de ${selectedTeam.name} foi preparado para as trocas.` });
            setNotice?.({ tone: "blue", text: `Reservas de ${selectedTeam.name} prontas no banco.` });
            return;
        }
        await sendEvent("system", {
            text: `${pokemonName} entrou em campo por ${selectedTeam.name}${side === "opponent" ? " no lado dos oponentes" : ""}.`,
        });
    };

    const updateToken = (patch, { selfInflictedHpLoss = false } = {}) => {
        if (!selectedToken || role !== "narrator") return;
        const normalizedPatch = { ...patch };
        if (Object.hasOwn(normalizedPatch, "currentHp")) {
            normalizedPatch.currentHp = integerInRange(
                normalizedPatch.currentHp,
                0,
                integerInRange(selectedToken.maxHp, 1, 99999, 1),
                selectedToken.currentHp,
            );
        }
        if (Object.hasOwn(normalizedPatch, "xp")) {
            normalizedPatch.xp = integerInRange(normalizedPatch.xp, 0, 999999, selectedToken.xp);
        }
        if (Object.hasOwn(normalizedPatch, "priority")) {
            normalizedPatch.priority = integerInRange(normalizedPatch.priority, -7, 7, selectedToken.priority);
        }
        const nextToken = { ...selectedToken, ...normalizedPatch };
        const specialState = normalizeSpecialState(nextToken.specialState);
        const lostHp = Object.hasOwn(normalizedPatch, "currentHp")
            && nextToken.currentHp < selectedToken.currentHp;
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.map(token => token.id === selectedToken.id ? nextToken : token),
            hitKillProtectionDisabled: lostHp && selfInflictedHpLoss
                ? disableHitKillProtection(snapshot.hitKillProtectionDisabled, selectedToken)
                : snapshot.hitKillProtectionDisabled,
            hitKillSurvivalGrace: lostHp
                ? clearHitKillSurvivalGrace(snapshot.hitKillSurvivalGrace, selectedToken)
                : snapshot.hitKillSurvivalGrace,
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

    const applySelectedDamage = ({ selfInflicted = false } = {}) => {
        if (!selectedToken || role !== "narrator" || selectedToken.currentHp <= 0) return;
        if (selfInflicted) {
            updateToken(
                { currentHp: Math.max(0, selectedToken.currentHp - 1) },
                { selfInflictedHpLoss: true },
            );
            return;
        }
        const key = getHitKillProtectionKey(selectedToken);
        const resolved = resolveDamageSequence({
            token: selectedToken,
            hitDamages: [{ damage: 1, hitNumber: 1 }],
            round: snapshot.round,
            protectionUsed: Boolean(key && snapshot.hitKillProtectionUsed.includes(key)),
            protectionDisabled: hasHitKillProtectionDisabled(snapshot.hitKillProtectionDisabled, selectedToken),
            survivalGrace: getHitKillSurvivalGraceKeys(selectedToken).some(graceKey => snapshot.hitKillSurvivalGrace.includes(graceKey)),
            allowSurvivalTrait: false,
        });
        const hitKillProtectionUsed = resolved.protectionConsumed && key
            ? [...new Set([...snapshot.hitKillProtectionUsed, key])]
            : snapshot.hitKillProtectionUsed;
        const hitKillSurvivalGrace = resolved.survivalGraceRemaining
            ? [...new Set([
                ...clearHitKillSurvivalGrace(snapshot.hitKillSurvivalGrace, selectedToken),
                ...getHitKillSurvivalGraceKeys(resolved.token || selectedToken),
            ])]
            : clearHitKillSurvivalGrace(snapshot.hitKillSurvivalGrace, selectedToken);
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.map(token => token.id === selectedToken.id ? resolved.token : token),
            hitKillProtectionUsed,
            hitKillSurvivalGrace,
        });
    };

    const swapBlockReason = selectedToken?.currentHp > 0 && snapshot.initiative.length
        ? getRoundMoveBlockReason({ snapshot, token: selectedToken, move: null }) : "";
    const swapSelectedPokemon = () => {
        if (!selectedToken || !selectedBenchToken || role !== "narrator") return;
        const synchronizedTeams = syncTeamsWithRoomProgress(teams, snapshot);
        const result = swapTeamPokemonInSnapshot(snapshot, selectedToken.id, selectedBenchToken.id);
        if (!result.swapped) {
            setNotice?.({ tone: "amber", text: result.reason });
            return;
        }
        setTeams(synchronizedTeams);
        commitSnapshot(result.room);
        setSelectedTokenId(result.incoming.id);
        setSelectedBenchTokenId(result.outgoing.id);
        setNotice?.({ tone: "blue", text: `${result.outgoing.name} voltou para a equipe e ${result.incoming.name} entrou em campo.` });
        void sendEvent("system", { text: `${result.outgoing.name} voltou e ${result.incoming.name} entrou em campo.` });
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
        const initiative = snapshot.initiative.filter(id => id !== removed.id);
        const turnIndex = initiative.length ? Math.max(0, Math.min(initiative.length - 1,
            snapshot.turnIndex - (initiativeIndex >= 0 && initiativeIndex < snapshot.turnIndex ? 1 : 0))) : 0;
        commitSnapshot({
            ...snapshot,
            tokens: snapshot.tokens.filter(token => token.id !== removed.id),
            initiative,
            turnIndex,
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
                tokens.splice(Math.min(Math.max(0, tokenIndex), tokens.length), 0,
                    { ...removed, declaredMove: "", declaredDamageClass: "", priority: 0 });
                // Returning to the field cannot rewrite the rolled order.
                commitSnapshot({ ...latest, tokens });
                setSelectedTokenId(removed.id);
                setNotice?.({ tone: "blue", text: `${removed.name} voltou à cena.${latest.initiative.length ? " Participa da próxima ordem." : ""}` });
            },
        });
    };

    const applySelectedExperience = (nextXp, announce = true) => {
        if (!selectedToken || role !== "narrator") return;
        const normalizedXp = integerInRange(nextXp, 0, 999999, selectedToken.xp);
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
            currentHp: selectedToken.currentHp === 0 ? 0 : Math.min(recalculated.maxHp, selectedToken.currentHp + hpGrowth),
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

    const awardSelectedExperience = async reward => {
        if (!selectedToken || role !== "narrator") return false;
        const before = snapshotRef.current;
        const next = awardRoomPokemonExperience(before, selectedToken.id, reward, teams);
        const updated = next.tokens.find(token => token.id === selectedToken.id);
        const saved = await commitSnapshot(next);
        if (saved === false) { await refresh(session).catch(() => {}); return false; }
        if (updated.level !== selectedToken.level) {
            setTeams(current => syncTeamsWithRoomProgress(current, { ...next, tokens: [updated] }));
            setNotice?.({ tone: "blue", text: `${updated.name} alcançou o nível ${updated.level}!` });
            void sendEvent("system", { text: `${updated.name} alcançou o nível ${updated.level}!` });
        }
        return true;
    };

    const choosePokemon = () => {
        if (!teams.some(team => team.pokemon.length)) { onOpenPc?.(); return; }
        setMobilePane("roster");
        window.requestAnimationFrame(() => {
            const entry = document.querySelector(".room-team-entry");
            entry?.scrollIntoView({ block: "nearest", behavior: "auto" });
            entry?.querySelector("select,button")?.focus({ preventScroll: true });
        });
    };

    const startBattle = async () => {
        if (role !== "narrator" || initiativeLock.current) return false;
        initiativeLock.current = true;
        setInitiativeBusy(true);
        try {
            if (!session.local) await requestAuthoritativeAction({ action: "start-battle" });
            else {
                const saved = await commitSnapshot(startNewRoomBattle(snapshotRef.current));
                if (saved === false) throw new Error("A nova batalha ainda não foi salva. Tente novamente.");
                await sendEvent("system", { text: "Nova batalha pronta. Escolha as ações da primeira rodada." });
            }
            setNotice?.({ tone: "blue", text: "Nova batalha pronta." });
            return true;
        } finally {
            initiativeLock.current = false;
            setInitiativeBusy(false);
        }
    };

    const generateInitiative = async () => {
        if (initiativeLock.current) return;
        initiativeLock.current = true;
        setInitiativeBusy(true);
        try {
            if (!session.local) {
                await requestAuthoritativeAction({ action: "initiative" });
                return;
            }
            const { fetchCached } = await import("../../core/mechanics.js");
            const names = [...new Set(snapshotRef.current.tokens.map(token => token.declaredMove).filter(Boolean))];
            const references = new Map(await Promise.all(names.map(async name => {
                const move = await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`);
                if (!move) throw new Error("Não foi possível confirmar os movimentos. Tente rolar novamente.");
                return [name, move];
            })));
            const current = snapshotRef.current;
            if (current.tokens.some(token => token.declaredMove && !references.has(token.declaredMove))) throw new Error("Uma escolha mudou. Confira os movimentos e role novamente.");
            const generated = buildInitiative(applyAuthoritativeMovePriorities(current, references));
            commitSnapshot(generated.room);
            await sendEvent("system", {
                text: `Ordem da rodada: ${generated.results.map(result => {
                    const name = snapshot.tokens.find(token => token.id === result.tokenId)?.name;
                    const traits = result.traitState.entries.map(entry => formatName(entry.sourceId)).join(" + ");
                    return `${name}${traits ? ` (${traits})` : ""}`;
                }).join(", ")}.`,
            });
        } catch (error) {
            showError(error);
        } finally {
            initiativeLock.current = false;
            if (mountedRef.current) setInitiativeBusy(false);
        }
    };

    const nextTurn = async () => {
        if (initiativeLock.current) return;
        initiativeLock.current = true;
        setInitiativeBusy(true);
        try {
            if (!session.local) {
                await requestAuthoritativeAction({ action: "advance-turn" });
                return;
            }
            const closingRound = snapshot.initiative.length > 0
                && snapshot.turnIndex >= snapshot.initiative.length - 1;
            const roundEnd = closingRound ? applyEndOfRoundEffects(snapshot) : null;
            const next = closingRound
                ? {
                    ...roundEnd.room,
                    round: snapshot.round + 1,
                    turnIndex: 0,
                    initiative: [],
                    tokens: roundEnd.room.tokens.map(token => ({ ...token, declaredMove: "", declaredDamageClass: "", priority: 0 })),
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
        } catch (error) {
            showError(error);
        } finally {
            initiativeLock.current = false;
            if (mountedRef.current) setInitiativeBusy(false);
        }
    };

    const declareMove = async (tokenId, move) => {
        const current = snapshotRef.current;
        const token = current.tokens.find(candidate => candidate.id === tokenId);
        const moveName = String(move?.name || "").toLowerCase();
        if (!token) throw new Error("Este Pokémon saiu do campo.");
        const next = declareRoomMove(current, tokenId, move);
        if (role === "narrator") {
            const saved = await commitSnapshot(next);
            if (saved === false) { await refresh(session); throw new Error("Não foi possível confirmar a escolha. Tente novamente."); }
            return;
        }
        if (!session.playerId || token.ownerPlayerId !== session.playerId) throw new Error("Escolha um Pokémon sob seu controle.");
        await postRoomEvent(session, "move-declared", {
            tokenId: token.id,
            tokenName: token.name,
            moveName,
            expectedRevision: revisionRef.current,
        });
        channelRef.current?.postMessage({ type: "invalidate" });
        await refresh(session);
    };

    const diceHandlersRef = useRef({});
    useEffect(() => {
        diceHandlersRef.current = { commitSnapshot, declareMove, requestAuthoritativeAction, sendEvent, showError };
    });
    const diceHandlers = useMemo(() => ({
        onSnapshotChange: (...args) => diceHandlersRef.current.commitSnapshot?.(...args),
        onDeclareMove: (...args) => diceHandlersRef.current.declareMove?.(...args),
        onAuthoritativeAction: (...args) => diceHandlersRef.current.requestAuthoritativeAction?.(...args),
        onEvent: (...args) => diceHandlersRef.current.sendEvent?.(...args),
        onError: (...args) => diceHandlersRef.current.showError?.(...args),
    }), []);
    const dicePokemonContext = useMemo(() => ({
        ...diceHandlers, snapshot, role, playerId: session?.playerId || "", remote: Boolean(session && !session.local), teams, setTeams,
    }), [diceHandlers, snapshot, role, session, teams, setTeams]);
    useEffect(() => {
        onDiceContext?.(session && room ? dicePokemonContext : null);
        return () => { onDiceContext?.(null); };
    }, [dicePokemonContext, onDiceContext, room, session]);

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
        const lead = merged.team.pokemon.find(pokemon => (pokemon.rpg?.currentHp ?? 1) > 0) || merged.team.pokemon[0];
        const result = addTeamToSnapshot(snapshot, merged.team, "ally", event.playerId || "", {
            activePokemonIds: lead ? [lead.id] : [],
            benchRemaining: true,
        });
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

    const inviteUrl = role === "narrator" && !session.local && session.inviteCode ? buildPlayerInvite(session) : "";
    const inviteToken = role === "narrator" && !session.local && session.inviteCode ? buildRoomInviteToken(session) : "";
    const renewInvite = async () => {
        if (!account?.id || role !== "narrator" || session.local || busy) return;
        setBusy(true);
        try {
            const result = await accountRequest("rooms/invite", { method: "POST", accountId: account.id, body: { code: session.code } });
            if (!mountedRef.current) return;
            const next = { ...session, inviteCode: result.inviteCode };
            saveRoomSession(next, { scope: storageScope });
            setSession(next);
            setRenewingInvite(false);
        } catch (value) { if (mountedRef.current) showError(value); }
        finally { if (mountedRef.current) setBusy(false); }
    };
    const removeAccountLink = async () => {
        if (!account?.id || !unlinking || busy) return;
        setBusy(true);
        try {
            await unlinkAccountRoom(account.id, unlinking.code);
            if (!mountedRef.current) return;
            const saved = loadRoomSession({ scope: storageScope });
            if (saved?.code === unlinking.code && saved.key.startsWith("account_")) clearRoomSession({ scope: storageScope });
            await reloadAccountRooms();
            setUnlinking(null);
        } catch (value) { if (mountedRef.current) showError(value); }
        finally { if (mountedRef.current) setBusy(false); }
    };
    const players = room?.players || [];
    const events = room?.events || [];
    const acceptedOfferIds = new Set(
        events
            .filter(event => event.type === "team-accepted")
            .map(event => integerInRange(event.payload?.offerId, 0, Number.MAX_SAFE_INTEGER, 0))
            .filter(Number.isFinite),
    );
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
        return (<>
            <Lobby
                defaultInvite={initialInvite}
                savedSession={loadRoomSession({ scope: storageScope })}
                accountRooms={accountRooms}
                busy={busy}
                error={error}
                onCreate={create}
                onJoin={join}
                onLocal={createLocal}
                onResume={resume}
                onUnlink={setUnlinking}
            />
            <ConfirmDialog
                open={Boolean(unlinking)}
                title="Retirar o acesso desta conta?"
                description="A aventura e seus jogadores continuam. Este acesso sai de todos os seus dispositivos: para recuperá-lo, você precisará do acesso original ou de um novo convite de jogador."
                confirmLabel={busy ? "Retirando…" : "Retirar da conta"}
                cancelLabel="Manter acesso"
                onConfirm={removeAccountLink}
                onCancel={() => !busy && setUnlinking(null)}
            />
        </>);
    }

    return (
        <div className={`room-app role-${role} phase-${snapshot.phase} mobile-pane-${mobilePane}`}>
            <header className="room-header">
                <div className="room-title">
                    <span className={`room-connection is-${connection}`} />
                    <div>
                        <small>{session.local ? "Aventura neste dispositivo" : `${connectionLabels[connection]} • Código ${session.code}`}</small>
                        <h2>{snapshot.title}</h2>
                    </div>
                </div>
                <div className="room-header-actions">
                    <span className={`room-role-badge is-${role}`}>{roleLabel(role)}</span>
                    {role === "narrator" && !session.local && (
                        <button type="button" disabled={busy} onClick={() => inviteUrl ? copy(inviteUrl, "Convite dos jogadores") : setRenewingInvite(true)}>{inviteUrl ? "Convidar" : "Gerar convite"}</button>
                    )}
                    <button type="button" onClick={onOpenGuide}>Guia</button>
                    <button type="button" className="room-leave" onClick={() => role === "narrator" ? setEnding(true) : void leave()}>
                        {role === "narrator" ? "Encerrar" : "Sair"}
                    </button>
                </div>
            </header>

            {role === "narrator" && !session.local && (
                <details className="room-invite-panel">
                    <summary>
                        <span>
                            <strong>Convidar jogadores</strong>
                            <small>{players.length ? `${players.length} ${players.length === 1 ? "jogador conectado" : "jogadores conectados"}` : "Aguardando jogadores"}</small>
                        </span>
                        <b>Código {session.code}</b>
                    </summary>
                    <div>
                        {inviteUrl ? <>
                        <p>Compartilhe o convite. Cada jogador informa seu nome ao entrar.</p>
                        <label>
                            <span className="sr-only">Link de convite dos jogadores</span>
                            <input readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} />
                        </label>
                        <div className="room-invite-actions">
                            <button type="button" className="is-primary" onClick={() => void shareInvite(inviteUrl)}>Enviar convite</button>
                            <button type="button" onClick={() => copy(inviteUrl, "Link da aventura")}>Copiar link</button>
                            <button type="button" onClick={() => copy(inviteToken, "Convite curto")}>Copiar convite curto</button>
                        </div>
                        </> : <><p>Você retomou esta aventura pela conta. Gere um convite para chamar novos jogadores.</p><button type="button" className="room-primary-button" disabled={busy} onClick={() => setRenewingInvite(true)}>Gerar convite</button></>}
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
                    <details className="room-section room-participants">
                        <summary><strong>Participantes</strong><span>{players.length + 1}</span></summary>
                        <div className="room-player-list">
                            <div className="room-player is-narrator">
                                <i />
                                <span><strong>{session.role === "narrator" ? session.displayName : "Narrador"}</strong></span>
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
                    </details>

                    <section className="room-section room-team-entry">
                        <div className="room-section-heading">
                            <div>
                                <h3>Trazer Pokémon</h3>
                            </div>
                        </div>
                        {teams.length ? (
                            <>
                                <label className="room-team-box">
                                    <span>Box</span>
                                    <RoomSelect
                                        aria-label="Box"
                                        className="room-wide-select"
                                        value={selectedTeam?.id || ""}
                                        onChange={event => {
                                            const nextTeam = teams.find(team => team.id === event.target.value);
                                            setSelectedTeamId(event.target.value);
                                            setSelectedTeamPokemonId(nextTeam?.pokemon[0]?.id || "");
                                        }}
                                    >
                                        {teams.map(team => <option key={team.id} value={team.id}>{team.name} · {team.pokemon.length} de 6</option>)}
                                    </RoomSelect>
                                </label>
                                <label className="room-team-lead">
                                    <span>Quem entra em campo</span>
                                    <RoomSelect
                                        aria-label="Quem entra em campo"
                                        className="room-wide-select"
                                        value={selectedTeamPokemon?.id || ""}
                                        disabled={!selectedTeam?.pokemon.length}
                                        onChange={event => setSelectedTeamPokemonId(event.target.value)}
                                    >
                                        {!selectedTeam?.pokemon.length && <option value="">Esta Box está vazia</option>}
                                        {selectedTeam?.pokemon.map(pokemon => (
                                            <option key={pokemon.id} value={pokemon.id}>
                                                {pokemon.nickname || formatName(pokemon.species?.species?.name || pokemon.species?.name)}
                                            </option>
                                        ))}
                                    </RoomSelect>
                                </label>
                                <div className="room-mini-team">
                                    {selectedTeam?.pokemon.map(pokemon => (
                                        <span key={pokemon.id} title={pokemon.nickname || pokemon.species?.name}>
                                            <PokemonSprite src={pokemon.species?.sprites?.front_default} pokemonId={pokemon.species?.id} alt="" className="pixelated" fallbackClassName="room-token-fallback" />
                                        </span>
                                    ))}
                                    {!selectedTeam?.pokemon.length && <small>Esta Box ainda está vazia.</small>}
                                </div>
                                {role === "narrator" ? (
                                    selectedTeamPokemonToken ? <button type="button" className="room-secondary-button" onClick={() => {
                                        setMobilePane("field");
                                        setSelectedTokenId(selectedTeamPokemonToken.id);
                                        window.requestAnimationFrame(() => {
                                            const button = [...document.querySelectorAll(".room-token")].find(node => node.getAttribute("aria-label")?.startsWith(`${selectedTeamPokemonToken.name},`));
                                            button?.focus();
                                        });
                                    }}>{snapshot.phase === "intervalo" ? "Ver ficha" : "Ver no campo"}</button> : <div className="room-button-row">
                                        <button type="button" disabled={!selectedTeamPokemon} onClick={() => addSelectedTeam("ally")}>Entrar como aliado</button>
                                        <button type="button" disabled={!selectedTeamPokemon} onClick={() => addSelectedTeam("opponent")}>Entrar como oponente</button>
                                    </div>
                                ) : (
                                    <button type="button" className="room-secondary-button" disabled={!selectedTeam?.pokemon.length} onClick={offerTeam}>Enviar ao Narrador</button>
                                )}
                            </>
                        ) : <button type="button" className="room-secondary-button" onClick={onOpenPc}>Abrir PC</button>}
                    </section>

                </aside>

                <section className="room-field" aria-label="Campo e ficha">
                    <div className="room-scene-strip">
                        <AdventurePhaseControl
                            value={snapshot.phase}
                            readOnly={role !== "narrator"}
                            onChange={phase => commitSnapshot(changeRoomPhase(snapshotRef.current, phase))}
                            onStartBattle={startBattle}
                            activeRound={snapshot.initiative.length > 0}
                            busy={initiativeBusy}
                            onError={showError}
                        />
                    </div>

                    <Battlefield
                        snapshot={snapshot}
                        role={role}
                        playerId={session.playerId}
                        selectedTokenId={selectedTokenId}
                        onSelectToken={setSelectedTokenId}
                        onSnapshotChange={handleBattlefieldChange}
                        onChoosePokemon={choosePokemon}
                        compact={["interpretacao", "intervalo"].includes(snapshot.phase)}
                    />
                    {snapshot.phase === "batalha" && snapshot.tokens.length > 0 && <TurnOrder snapshot={snapshot} onSelect={setSelectedTokenId} canControl={role === "narrator"} busy={initiativeBusy}
                        onDeclareMove={declareMove} canDeclareToken={token => role === "narrator" || Boolean(session.playerId && token.ownerPlayerId === session.playerId)}
                        onRoll={generateInitiative} onAdvance={nextTurn} />}

                    {selectedToken && ["batalha", "intervalo"].includes(snapshot.phase) && (
                        <section className="token-inspector">
                            <header className="token-inspector-header">
                                <div className="token-inspector-identity">
                                    <PokemonSprite src={selectedDisplayIdentity?.sprite} pokemonId={selectedDisplayIdentity?.disguised ? selectedToken.specialState?.illusion?.speciesId || selectedToken.speciesId : selectedToken.speciesId} alt="" className="pixelated" fallbackClassName="room-token-fallback" />
                                    <span>
                                        <small>Nível {selectedToken.level}</small>
                                        <strong>{selectedDisplayIdentity?.name || selectedToken.name}</strong>
                                        <em>{(selectedDisplayIdentity?.types || selectedToken.types).map(formatType).join(" · ") || "Tipo personalizado"}</em>
                                        {role === "narrator" && selectedDisplayIdentity?.disguised && <small>Identidade real: {selectedToken.name}</small>}
                                        {selectedToken.declaredMove && <small>{formatName(selectedToken.declaredMove)} • prioridade {selectedToken.priority > 0 ? `+${selectedToken.priority}` : selectedToken.priority}</small>}
                                    </span>
                                </div>
                                <button type="button" className="token-inspector-close" onClick={() => setSelectedTokenId("")} aria-label="Fechar ficha rápida">×</button>
                            </header>
                            <div className="token-battle-vitals">
                                <div className="token-hp-control">
                                    <span>HP</span>
                                    <button
                                        type="button"
                                        disabled={role !== "narrator" || selectedToken.currentHp <= 0}
                                        onClick={() => applySelectedDamage()}
                                        aria-label="Registrar 1 ponto de dano recebido"
                                        title="Dano recebido"
                                    >−</button>
                                    <strong>{selectedToken.currentHp} de {selectedToken.maxHp}</strong>
                                    <button
                                        type="button"
                                        disabled={role !== "narrator"}
                                        onClick={() => updateToken({ currentHp: Math.min(selectedToken.maxHp, selectedToken.currentHp + 1) })}
                                        aria-label="Recuperar 1 ponto de HP"
                                        title="Recuperar HP"
                                    >+</button>
                                </div>
                                <details className="token-protection-details"><summary><div
                                    className={`token-hit-kill-state is-${selectedProtectionState}`}
                                    role="status"
                                    aria-live="polite"
                                    aria-label={`Proteção contra hit kill: ${selectedProtectionState === "lost"
                                        ? "encerrada por autocusto nesta batalha"
                                        : selectedProtectionState === "used"
                                            ? "consumida nesta batalha"
                                            : "pronta para agir no HP máximo"}`}
                                >
                                    <i className="token-hit-kill-led" aria-hidden="true" />
                                    <span className="token-hit-kill-copy">
                                        <small>Proteção contra hit kill</small>
                                        <strong>
                                            {selectedProtectionState === "lost"
                                                ? "Encerrada por autocusto"
                                                : selectedProtectionState === "used"
                                                    ? "Consumida nesta batalha"
                                                    : selectedToken.currentHp === selectedToken.maxHp ? "Pronta" : "Precisa de HP cheio"}
                                        </strong>
                                    </span>
                                    <span className="token-hit-kill-meter" aria-hidden="true"><i /></span>
                                </div></summary><HitKillExplanation expanded /></details>
                                {role === "narrator" && selectedToken.currentHp > 0 && (
                                    <button
                                        type="button"
                                        className="token-self-damage-action"
                                        onClick={() => applySelectedDamage({ selfInflicted: true })}
                                        aria-label="Registrar 1 ponto de autocusto; isso encerra a proteção contra hit kill nesta batalha"
                                        title="Use apenas quando o próprio Pokémon reduzir o próprio HP"
                                    >
                                        <span>Registrar autocusto</span>
                                        <strong>−1 HP</strong>
                                    </button>
                                )}
                            </div>
                            <div className="token-xp-control">
                                <label htmlFor="room-token-xp">XP</label>
                                <input
                                    id="room-token-xp"
                                    type="number"
                                    min="0"
                                    step="1"
                                    max="999999"
                                    value={selectedToken.xp}
                                    disabled={role !== "narrator"}
                                    onChange={event => updateToken({ xp: event.target.value })}
                                    onBlur={() => applySelectedExperience(selectedToken.xp)}
                                />
                                <small className="token-xp-next-level">{selectedToken.level >= 200 ? "Nível máximo · 200" : `Meta: ${formatNumberPtBr(getNextLevelXp(selectedToken.level))} XP`}</small>
                            </div>
                            <label>
                                <span>Condição</span>
                                <RoomSelect aria-label="Condição" value={selectedToken.status} disabled={role !== "narrator"} onChange={event => updateToken({ status: event.target.value })}>
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </RoomSelect>
                            </label>
                            {role === "narrator" && selectedBenchToken && (
                                <div className="token-switch-control">
                                    <label>
                                        <span>Trocar com o banco</span>
                                        <RoomSelect aria-label="Trocar com o banco" value={selectedBenchToken.id} onChange={event => setSelectedBenchTokenId(event.target.value)}>
                                            {selectedBenchTokens.map(token => <option key={token.id} value={token.id}>{token.name} • {token.currentHp} de {token.maxHp} HP</option>)}
                                        </RoomSelect>
                                    </label>
                                    <button type="button" disabled={Boolean(swapBlockReason)} onClick={swapSelectedPokemon}>Fazer a troca</button>
                                    {swapBlockReason && <small role="status">{swapBlockReason}</small>}
                                    <small>HP, condição, PP, item consumido e proteção contra Hit Kill continuam vinculados ao próprio Pokémon.</small>
                                </div>
                            )}
                            {role === "narrator" && <ExperienceAward key={selectedToken.id} winnerLevel={selectedToken.level} battleContext={getRoomBattleRewardContext(snapshot, selectedToken.id)} onAward={awardSelectedExperience} disabled={busy} />}
                            {selectedToken.pendingEvs > 0 && <p className="token-growth-reserve">{selectedToken.pendingEvs} EVs para distribuir na ficha do PC.</p>}
                            {selectedToken.volatileEffects?.length > 0 && (
                                <div className="token-volatile-list" role="group" aria-label="Efeitos temporários ativos">
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
                                        <RoomSelect aria-label="Lado" value={selectedToken.side} onChange={event => updateToken({ side: event.target.value })}>
                                            <option value="ally">Treinadores</option>
                                            <option value="opponent">Oponentes</option>
                                            <option value="neutral">Sem lado</option>
                                        </RoomSelect>
                                    </label>
                                    <label>
                                        <span>Quem controla</span>
                                        <RoomSelect aria-label="Quem controla" value={selectedToken.ownerPlayerId} onChange={event => updateToken({ ownerPlayerId: event.target.value })}>
                                            <option value="">Narrador</option>
                                            {players.map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}
                                        </RoomSelect>
                                    </label>
                                    <button type="button" className="token-remove" onClick={removeToken}>Retirar da cena</button>
                                </>
                            )}
                        </section>
                    )}

                    <details className="room-notes-panel" open={snapshot.phase === "interpretacao"}>
                        <summary>Notas da cena</summary>
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
                    </details>
                </section>

                <aside className="room-tools">
                    {!session.local && <VoiceCall session={session} role={role} />}
                    {snapshot.phase === "batalha" && <CombatAssistant
                        role={role}
                        playerId={session.playerId}
                        snapshot={snapshot}
                        selectedTokenId={selectedTokenId}
                        remote={!session.local}
                        onAuthoritativeAction={requestAuthoritativeAction}
                        onSnapshotChange={commitSnapshot}
                        onEvent={sendEvent}
                        onError={showError}
                    />}
                    {["batalha", "exploracao"].includes(snapshot.phase) && <CaptureAssistant role={role} snapshot={snapshot} remote={!session.local} onAuthoritativeAction={requestAuthoritativeAction} onSnapshotChange={commitSnapshot} onEvent={sendEvent} onError={showError} />}
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

                    <details className="room-tool">
                        <summary>
                            <span>
                                <strong>Histórico da aventura</strong>
                            </span>
                            <span className="room-tool-badge">{events.length}</span>
                        </summary>
                        <div className="room-tool-body">
                            {events.some(event => role === "narrator" || event.playerId === session.playerId) && <details className="journal-options">
                                <summary>Opções do histórico</summary>
                                <button type="button" disabled={journalBusy} onClick={() => setDeletingJournal({ all: true, through: {
                                    events: Math.max(0, ...events.filter(event => Number.isSafeInteger(event.id)).map(event => event.id)),
                                    rolls: Math.max(0, ...events.filter(event => /^authority-\d+$/.test(String(event.id))).map(event => Number(String(event.id).slice(10)))),
                                } })}>
                                    {role === "narrator" ? "Limpar histórico" : "Apagar meus registros"}
                                </button>
                            </details>}
                            <div className="event-log" aria-live="polite">
                                {events.slice(-40).reverse().map(event => (
                                    <article key={event.id} className={`event-${event.type}`}>
                                        <span>{timeLabel(event.createdAt)}</span>
                                        <p>{eventSummary(event)}</p>
                                        {(role === "narrator" || event.playerId === session.playerId) && <details className="journal-entry-options">
                                            <summary aria-label={`Opções do registro: ${eventSummary(event)}`}>···</summary>
                                            <button type="button" disabled={journalBusy} onClick={() => setDeletingJournal({ id: event.id })}>Apagar registro</button>
                                        </details>}

                                        {role === "narrator" && event.type === "team-offer" && !acceptedOfferIds.has(integerInRange(event.id, 0, Number.MAX_SAFE_INTEGER, 0)) && (
                                            <button type="button" onClick={() => acceptTeamOffer(event)}>Aceitar equipe</button>
                                        )}
                                        {role === "narrator" && event.type === "team-offer" && acceptedOfferIds.has(integerInRange(event.id, 0, Number.MAX_SAFE_INTEGER, 0)) && (
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
                                <label className="room-message-field"><span>Mensagem</span><input name="message" maxLength={500} /></label>
                                <button type="submit">Enviar</button>
                            </form>
                        </div>
                    </details>

                    {role === "narrator" && (
                        <details className="room-tool">
                            <summary>
                                <span>
                                    <strong>Preferências da cena</strong>
                                </span>
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
                open={Boolean(deletingJournal)}
                title={deletingJournal?.all ? role === "narrator" ? "Limpar o Diário?" : "Apagar seus registros?" : "Apagar este registro?"}
                description="Remove os registros do histórico. HP, PP, turnos e resultados já aplicados continuam como estão."
                confirmLabel={journalBusy ? "Apagando…" : deletingJournal?.all ? role === "narrator" ? "Limpar histórico" : "Apagar meus registros" : "Apagar registro"}
                cancelLabel="Manter registros"
                onConfirm={() => void deleteJournal()}
                onCancel={() => !journalBusy && setDeletingJournal(null)}
            />
            <ConfirmDialog
                open={renewingInvite}
                title="Gerar outro convite?"
                description="Os convites anteriores deixam de funcionar. Quem já entrou continua na aventura."
                confirmLabel={busy ? "Gerando…" : "Gerar convite"}
                tone="info"
                onConfirm={renewInvite}
                onCancel={() => !busy && setRenewingInvite(false)}
            />
            <ConfirmDialog
                open={ending}
                title="Encerrar esta aventura?"
                description="Antes de encerrar, o Narrador avalia a Amizade pela história da sessão. A aventura, o histórico e as trilhas serão apagados; suas Boxes continuam no PC."
                confirmLabel={busy ? "Encerrando…" : "Encerrar aventura"}
                cancelLabel="Continuar aventura"
                danger
                onConfirm={endRoom}
                onCancel={() => setEnding(false)}
            />
        </div>
    );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    CALL_ICE_SERVERS,
    callParticipantId,
    createCallConnectionId,
    normalizeCallMembers,
    shouldCreateCallOffer,
    supportsRoomCall,
} from "../../core/call.js";
import {
    fetchRoomCall,
    joinRoomCall,
    leaveRoomCall,
    sendRoomCallSignal,
    setRoomCallMuted,
} from "../../core/roomClient.js";
import { readStorage, writeStorage } from "../../core/storage.js";
import { clampFinite, integerInRange, MAX_SAFE_GAME_INTEGER } from "../../core/math.js";

const POLL_INTERVAL = 1000;
const CALL_PREFERENCES_KEY = "myowndex_call_preferences_v1";

const friendlyCallError = error => {
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        return "Para entrar, permita o uso do microfone nas configurações do navegador.";
    }
    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        return "Não encontramos um microfone neste aparelho.";
    }
    if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
        return "O microfone está ocupado em outro aplicativo. Libere-o e tente novamente.";
    }
    return error instanceof Error ? error.message : "A chamada não conseguiu começar. Tente novamente.";
};

function RemoteAudio({ name, stream, volume, muted }) {
    const audioRef = useRef(null);
    const [blocked, setBlocked] = useState(false);

    const play = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || muted) return;
        void audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }, [muted]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !stream) return undefined;
        audio.srcObject = stream;
        audio.volume = clampFinite(volume, 0, 1, 0);
        audio.muted = Boolean(muted);
        play();
        return () => {
            if (audio.srcObject === stream) audio.srcObject = null;
        };
    }, [muted, play, stream, volume]);

    return (
        <>
            <audio ref={audioRef} autoPlay playsInline aria-hidden="true" />
            {blocked && !muted && (
                <button type="button" className="call-listen" onClick={play}>Ouvir {name}</button>
            )}
        </>
    );
}

export default function VoiceCall({ session, role }) {
    const selfId = callParticipantId(session);
    const displayName = session?.displayName?.trim() || (role === "narrator" ? "Narrador" : "Jogador");
    const [active, setActive] = useState(false);
    const [phase, setPhase] = useState("idle");
    const [muted, setMuted] = useState(false);
    const [members, setMembers] = useState([]);
    const [remoteAudio, setRemoteAudio] = useState({});
    const [peerStates, setPeerStates] = useState({});
    const [locallyMuted, setLocallyMuted] = useState({});
    const [speaking, setSpeaking] = useState({});
    const [error, setError] = useState("");
    const [supported, setSupported] = useState(false);
    const [callSounds, setCallSounds] = useState(true);
    const [remoteVolume, setRemoteVolume] = useState(0.85);
    const [preferencesReady, setPreferencesReady] = useState(false);
    const streamRef = useRef(null);
    const peersRef = useRef(new Map());
    const lastSignalIdRef = useRef(0);
    const joinedRef = useRef(false);
    const connectionIdRef = useRef("");
    const makeOfferRef = useRef(null);
    const leaveRef = useRef(null);
    const activeRef = useRef(false);
    const phaseRef = useRef("idle");
    const toneContextRef = useRef(null);
    const previousMembersRef = useRef(new Set());

    useEffect(() => {
        setSupported(supportsRoomCall());
        const preferences = readStorage(CALL_PREFERENCES_KEY, {});
        setCallSounds(preferences?.sounds !== false);
        setRemoteVolume(clampFinite(preferences?.volume, 0, 1, 0.85));
        setPreferencesReady(true);
    }, []);

    useEffect(() => {
        if (preferencesReady) writeStorage(CALL_PREFERENCES_KEY, { sounds: callSounds, volume: remoteVolume });
    }, [callSounds, preferencesReady, remoteVolume]);

    const connectionId = useCallback(() => {
        if (!connectionIdRef.current) connectionIdRef.current = createCallConnectionId();
        return connectionIdRef.current;
    }, []);

    const setCallActive = useCallback(value => {
        activeRef.current = value;
        setActive(value);
    }, []);

    const setCallPhase = useCallback(value => {
        phaseRef.current = value;
        setPhase(value);
    }, []);

    const playFeedback = useCallback(kind => {
        if (!callSounds || remoteVolume <= 0 || typeof window === "undefined") return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            const context = toneContextRef.current || new AudioContext();
            toneContextRef.current = context;
            void context.resume();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const now = context.currentTime;
            const notes = {
                join: [520, 700],
                connect: [660, 880],
                leave: [520, 360],
                error: [240, 180],
            };
            const [start, end] = notes[kind] || notes.connect;
            oscillator.type = kind === "error" ? "square" : "sine";
            oscillator.frequency.setValueAtTime(start, now);
            oscillator.frequency.exponentialRampToValueAtTime(end, now + 0.14);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.055 * remoteVolume, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
        } catch {
            // O feedback é complementar; a chamada continua mesmo sem áudio de interface.
        }
    }, [callSounds, remoteVolume]);

    const updatePeerState = useCallback((peerId, state) => {
        setPeerStates(current => ({ ...current, [peerId]: state }));
    }, []);

    const closePeer = useCallback(peerId => {
        const entry = peersRef.current.get(peerId);
        if (entry) {
            entry.pc.onicecandidate = null;
            entry.pc.ontrack = null;
            entry.pc.onconnectionstatechange = null;
            entry.pc.close();
            peersRef.current.delete(peerId);
        }
        setRemoteAudio(current => {
            if (!Object.prototype.hasOwnProperty.call(current, peerId)) return current;
            const next = { ...current };
            delete next[peerId];
            return next;
        });
        setPeerStates(current => {
            if (!Object.prototype.hasOwnProperty.call(current, peerId)) return current;
            const next = { ...current };
            delete next[peerId];
            return next;
        });
    }, []);

    const closeAllPeers = useCallback(() => {
        [...peersRef.current.keys()].forEach(closePeer);
    }, [closePeer]);

    const signal = useCallback(async (peerId, type, payload) => {
        if (!activeRef.current) return;
        await sendRoomCallSignal(session, connectionId(), peerId, type, payload);
    }, [connectionId, session]);

    const ensurePeer = useCallback(peerId => {
        const existing = peersRef.current.get(peerId);
        if (existing) return existing;
        const pc = new window.RTCPeerConnection({ iceServers: CALL_ICE_SERVERS });
        const entry = { pc, makingOffer: false, ignoreOffer: false, offered: false, candidates: [] };
        streamRef.current?.getAudioTracks().forEach(track => pc.addTrack(track, streamRef.current));
        pc.onicecandidate = event => {
            if (!event.candidate) return;
            void signal(peerId, "ice", event.candidate.toJSON()).catch(() => updatePeerState(peerId, "reconnecting"));
        };
        pc.ontrack = event => {
            const [stream] = event.streams;
            if (stream) setRemoteAudio(current => ({ ...current, [peerId]: stream }));
        };
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            updatePeerState(
                peerId,
                state === "connected" ? "connected"
                    : state === "failed" || state === "disconnected" ? "reconnecting"
                        : state,
            );
            if (state === "failed" && shouldCreateCallOffer(selfId, peerId)) {
                entry.offered = false;
                pc.restartIce();
                void makeOfferRef.current?.(peerId, true);
            }
            if (state === "closed") closePeer(peerId);
        };
        peersRef.current.set(peerId, entry);
        updatePeerState(peerId, "connecting");
        return entry;
    }, [closePeer, selfId, signal, updatePeerState]);

    const makeOffer = useCallback(async (peerId, iceRestart = false) => {
        const entry = ensurePeer(peerId);
        if (entry.makingOffer || entry.pc.signalingState !== "stable" || (!iceRestart && entry.offered)) return;
        entry.makingOffer = true;
        entry.offered = true;
        try {
            const offer = await entry.pc.createOffer({ iceRestart });
            await entry.pc.setLocalDescription(offer);
            await signal(peerId, "offer", entry.pc.localDescription.toJSON());
        } catch (offerError) {
            entry.offered = false;
            updatePeerState(peerId, "reconnecting");
            if (offerError?.status !== 404) setError(friendlyCallError(offerError));
        } finally {
            entry.makingOffer = false;
        }
    }, [ensurePeer, signal, updatePeerState]);

    useEffect(() => {
        makeOfferRef.current = makeOffer;
    }, [makeOffer]);

    const flushCandidates = useCallback(async entry => {
        const waiting = entry.candidates.splice(0);
        for (const candidate of waiting) {
            try {
                await entry.pc.addIceCandidate(candidate);
            } catch (candidateError) {
                if (!entry.ignoreOffer) throw candidateError;
            }
        }
    }, []);

    const handleSignal = useCallback(async incoming => {
        const peerId = incoming?.senderId;
        if (!peerId || peerId === selfId) return;
        const entry = ensurePeer(peerId);
        const { pc } = entry;
        if (incoming.type === "offer") {
            const collision = entry.makingOffer || pc.signalingState !== "stable";
            const polite = selfId > peerId;
            entry.ignoreOffer = !polite && collision;
            if (entry.ignoreOffer) return;
            if (collision) await pc.setLocalDescription({ type: "rollback" });
            await pc.setRemoteDescription(incoming.payload);
            await flushCandidates(entry);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await signal(peerId, "answer", pc.localDescription.toJSON());
            return;
        }
        if (incoming.type === "answer") {
            if (pc.signalingState !== "have-local-offer") return;
            await pc.setRemoteDescription(incoming.payload);
            await flushCandidates(entry);
            return;
        }
        if (incoming.type === "ice") {
            const candidate = new window.RTCIceCandidate(incoming.payload);
            if (pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (candidateError) {
                    if (!entry.ignoreOffer) throw candidateError;
                }
            } else entry.candidates.push(candidate);
        }
    }, [ensurePeer, flushCandidates, selfId, signal]);

    const syncMembers = useCallback(nextMembers => {
        const normalized = normalizeCallMembers(nextMembers);
        setMembers(normalized);
        const present = new Set(normalized.map(member => member.participantId));
        [...peersRef.current.keys()].forEach(peerId => {
            if (!present.has(peerId)) closePeer(peerId);
        });
        normalized.forEach(member => {
            const peerId = member.participantId;
            if (peerId === selfId) return;
            ensurePeer(peerId);
            if (shouldCreateCallOffer(selfId, peerId)) void makeOffer(peerId);
        });
    }, [closePeer, ensurePeer, makeOffer, selfId]);

    const stopMedia = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }, []);

    const leave = useCallback(async ({ notify = true, feedback = true } = {}) => {
        const wasJoined = joinedRef.current;
        if (feedback && wasJoined) playFeedback("leave");
        joinedRef.current = false;
        setCallActive(false);
        setCallPhase("idle");
        setError("");
        setMembers([]);
        setMuted(false);
        setSpeaking({});
        setLocallyMuted({});
        previousMembersRef.current = new Set();
        lastSignalIdRef.current = 0;
        closeAllPeers();
        stopMedia();
        if (notify && wasJoined && !session?.local) {
            await leaveRoomCall(session, connectionId(), { keepalive: true }).catch(() => {});
        }
    }, [closeAllPeers, connectionId, playFeedback, session, setCallActive, setCallPhase, stopMedia]);

    const join = useCallback(async () => {
        if (!supported || session?.local || !selfId) return;
        setError("");
        setCallPhase("joining");
        let stream;
        try {
            if (callSounds) playFeedback("connect");
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false,
            });
            streamRef.current = stream;
            await joinRoomCall(session, connectionId(), { displayName, muted: false });
            joinedRef.current = true;
            lastSignalIdRef.current = 0;
            setCallActive(true);
            setCallPhase("connecting");
            playFeedback("join");
        } catch (joinError) {
            stream?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            joinedRef.current = false;
            setCallActive(false);
            setCallPhase("error");
            setError(friendlyCallError(joinError));
            playFeedback("error");
        }
    }, [callSounds, connectionId, displayName, playFeedback, selfId, session, setCallActive, setCallPhase, supported]);

    useEffect(() => {
        leaveRef.current = leave;
    }, [leave]);

    const toggleMuted = useCallback(async () => {
        const nextMuted = !muted;
        streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !nextMuted; });
        setMuted(nextMuted);
        setMembers(current => current.map(member =>
            member.participantId === selfId ? { ...member, muted: nextMuted } : member
        ));
        try {
            await setRoomCallMuted(session, connectionId(), nextMuted);
        } catch (muteError) {
            streamRef.current?.getAudioTracks().forEach(track => { track.enabled = nextMuted; });
            setMuted(!nextMuted);
            setError(friendlyCallError(muteError));
        }
    }, [connectionId, muted, selfId, session]);

    useEffect(() => {
        if (!active || session?.local) return undefined;
        let cancelled = false;
        let timer = 0;
        const poll = async () => {
            try {
                const data = await fetchRoomCall(session, connectionId(), lastSignalIdRef.current);
                if (cancelled || !activeRef.current) return;
                if (!data.joined) {
                    closeAllPeers();
                    lastSignalIdRef.current = 0;
                    setCallPhase("reconnecting");
                    await joinRoomCall(session, connectionId(), { displayName, muted });
                } else {
                    syncMembers(data.members);
                    for (const incoming of data.signals || []) await handleSignal(incoming);
                    lastSignalIdRef.current = Math.max(lastSignalIdRef.current, integerInRange(data.lastSignalId, 0, MAX_SAFE_GAME_INTEGER, 0));
                    if (phaseRef.current !== "connected") playFeedback("connect");
                    setCallPhase("connected");
                    setError("");
                }
            } catch (pollError) {
                if (!cancelled && pollError?.status === 409) {
                    const message = friendlyCallError(pollError);
                    playFeedback("error");
                    void leave({ notify: false, feedback: false });
                    setCallPhase("error");
                    setError(message);
                    return;
                }
                if (!cancelled) {
                    setCallPhase("reconnecting");
                    setError(navigator.onLine
                        ? "A chamada está procurando a aventura novamente…"
                        : "A internet caiu por um instante. A chamada volta assim que a conexão retornar.");
                }
            } finally {
                if (!cancelled && activeRef.current) timer = window.setTimeout(poll, POLL_INTERVAL);
            }
        };
        void poll();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [active, closeAllPeers, connectionId, displayName, handleSignal, leave, muted, playFeedback, session, setCallPhase, syncMembers]);

    useEffect(() => {
        if (!active) return undefined;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return undefined;
        const context = new AudioContext();
        const analysers = new Map();
        let frame = 0;
        const streams = { [selfId]: streamRef.current, ...remoteAudio };
        Object.entries(streams).forEach(([participantId, stream]) => {
            if (!stream?.getAudioTracks?.().length) return;
            try {
                const source = context.createMediaStreamSource(stream);
                const analyser = context.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.72;
                source.connect(analyser);
                analysers.set(participantId, { source, analyser, values: new Uint8Array(analyser.fftSize) });
            } catch {
                // Alguns navegadores suspendem a análise; o áudio principal segue normalmente.
            }
        });
        void context.resume();
        const measure = () => {
            const next = {};
            analysers.forEach(({ analyser, values }, participantId) => {
                analyser.getByteTimeDomainData(values);
                let power = 0;
                for (const value of values) {
                    const centered = (value - 128) / 128;
                    power += centered * centered;
                }
                next[participantId] = Math.sqrt(power / values.length) > 0.035;
            });
            setSpeaking(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
            frame = window.requestAnimationFrame(measure);
        };
        frame = window.requestAnimationFrame(measure);
        return () => {
            window.cancelAnimationFrame(frame);
            analysers.forEach(({ source }) => source.disconnect());
            void context.close();
        };
    }, [active, remoteAudio, selfId]);

    useEffect(() => {
        if (!active || phase !== "connected") return;
        const current = new Set(members.map(member => member.participantId));
        const previous = previousMembersRef.current;
        if (previous.size) {
            const joined = [...current].some(id => id !== selfId && !previous.has(id));
            const left = [...previous].some(id => id !== selfId && !current.has(id));
            if (joined) playFeedback("join");
            else if (left) playFeedback("leave");
        }
        previousMembersRef.current = current;
    }, [active, members, phase, playFeedback, selfId]);

    useEffect(() => {
        const onPageExit = () => {
            if (joinedRef.current) void leaveRoomCall(session, connectionId(), { keepalive: true }).catch(() => {});
        };
        window.addEventListener("pagehide", onPageExit);
        return () => {
            window.removeEventListener("pagehide", onPageExit);
            if (joinedRef.current) void leaveRef.current?.({ notify: true, feedback: false });
            void toneContextRef.current?.close?.();
            toneContextRef.current = null;
        };
    }, [connectionId, session]);

    const memberById = useMemo(() => Object.fromEntries(members.map(member => [member.participantId, member])), [members]);
    const callLabel = phase === "joining" ? "Pedindo acesso ao microfone…"
        : phase === "reconnecting" ? "Reconectando a chamada…"
            : phase === "connected" ? "Chamada conectada"
                : "Preparando a chamada…";

    return (
        <details className="room-tool call-tool" open>
            <summary>
                <span><small>Conversa da mesa</small><strong>Chamada de voz</strong></span>
                <span className={`room-tool-badge call-badge is-${active ? phase : "idle"}`}>
                    {active ? members.length || "•" : "Entrar"}
                </span>
            </summary>
            <div className="room-tool-body">
                {session?.local ? (
                    <p className="call-note">Abra uma aventura compartilhada para conversar com Narrador e jogadores por voz.</p>
                ) : !supported ? (
                    <p className="call-note">Este navegador ainda não oferece chamadas. Abra o MyOwnDex em uma versão atual do navegador.</p>
                ) : !active ? (
                    <>
                        <p className="call-note">Entre com um toque. O áudio segue entre os participantes desta aventura e não é gravado pelo MyOwnDex.</p>
                        {error && <p className="call-error" role="alert">{error}</p>}
                        <button type="button" className="call-enter" disabled={phase === "joining"} onClick={join}>
                            {phase === "joining" ? "Abrindo o microfone…" : "Entrar na chamada"}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="call-status" role="status">
                            <span className={`call-status-dot is-${phase}`} />
                            <span>{callLabel}</span>
                        </div>
                        {error && <p className="call-error" role="status">{error}</p>}
                        <div className="call-members" aria-label="Participantes da chamada">
                            {members.map(member => {
                                const isSelf = member.participantId === selfId;
                                const isSpeaking = !member.muted && !locallyMuted[member.participantId] && speaking[member.participantId];
                                const state = isSelf ? "connected" : peerStates[member.participantId] || "connecting";
                                return (
                                    <div className={`call-member is-${state} ${member.muted ? "is-muted" : ""} ${isSpeaking ? "is-speaking" : ""}`} key={member.participantId}>
                                        <span className="call-avatar" aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</span>
                                        <span>
                                            <strong>{member.displayName}{isSelf ? " (você)" : ""}</strong>
                                            <small>
                                                {member.role === "narrator" ? "Narrador" : "Jogador"}
                                                {member.muted ? " • microfone fechado" : isSpeaking ? " • falando agora" : state === "connected" ? " • na chamada" : " • conectando"}
                                            </small>
                                        </span>
                                        <i aria-label={member.muted ? "Microfone fechado" : isSpeaking ? "Falando agora" : "Microfone aberto"}>{member.muted ? "×" : "●"}</i>
                                        {!isSelf && (
                                            <button
                                                type="button"
                                                className="call-local-mute"
                                                aria-pressed={Boolean(locallyMuted[member.participantId])}
                                                onClick={() => setLocallyMuted(current => ({ ...current, [member.participantId]: !current[member.participantId] }))}
                                            >
                                                {locallyMuted[member.participantId] ? "Ouvir" : "Silenciar"}
                                            </button>
                                        )}
                                        {!isSelf && remoteAudio[member.participantId] && (
                                            <RemoteAudio
                                                name={memberById[member.participantId]?.displayName || "participante"}
                                                stream={remoteAudio[member.participantId]}
                                                volume={remoteVolume}
                                                muted={Boolean(locallyMuted[member.participantId])}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <label className="call-volume">
                            <span>Volume da chamada</span>
                            <input type="range" min="0" max="1" step="0.05" value={remoteVolume} onChange={event => setRemoteVolume(clampFinite(event.target.value, 0, 1, remoteVolume))} />
                        </label>
                        <label className="call-sounds">
                            <input type="checkbox" checked={callSounds} onChange={event => setCallSounds(event.target.checked)} />
                            <span>Sons discretos de entrada e conexão</span>
                        </label>
                        <div className="call-actions">
                            <button type="button" className={muted ? "is-muted" : ""} onClick={toggleMuted}>{muted ? "Abrir microfone" : "Fechar microfone"}</button>
                            <button type="button" className="call-leave" onClick={() => void leave()}>Sair da chamada</button>
                        </div>
                    </>
                )}
            </div>
        </details>
    );
}

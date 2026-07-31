import React, { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import { activateAudio, playSoundEffect, SOUND_EFFECTS } from "../../core/audio.js";
import { formatNumberPtBr } from "../../core/mechanics.js";
import { readStorage, writeStorage } from "../../core/storage.js";
import {
    deleteRoomAudio,
    fetchRoomAudioUrl,
    uploadRoomAudio,
} from "../../core/roomClient.js";

const formatBytes = value => {
    const bytes = Number(value) || 0;
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${formatNumberPtBr(bytes / 1024 / 1024)} MB`;
};

export default function AudioDeck({
    session,
    role,
    snapshot,
    media,
    events,
    onSnapshotChange,
    onEvent,
    onRefresh,
    onError,
}) {
    const isLocal = Boolean(session?.local);
    const [enabled, setEnabled] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [audioUrl, setAudioUrl] = useState("");
    const [pendingRemove, setPendingRemove] = useState(null);
    const [localVolume, setLocalVolume] = useState(0.85);
    const [localMuted, setLocalMuted] = useState(false);
    const [preferencesReady, setPreferencesReady] = useState(false);
    const audioRef = useRef(null);
    const heardEventRef = useRef(0);

    useEffect(() => {
        const preferences = readStorage("myowndex_audio_preferences_v1", {});
        const savedVolume = Number(preferences?.volume);
        if (Number.isFinite(savedVolume)) setLocalVolume(Math.min(1, Math.max(0, savedVolume)));
        setLocalMuted(Boolean(preferences?.muted));
        setPreferencesReady(true);
    }, []);

    useEffect(() => {
        if (preferencesReady) writeStorage("myowndex_audio_preferences_v1", { volume: localVolume, muted: localMuted });
    }, [localMuted, localVolume, preferencesReady]);

    useEffect(() => {
        if (isLocal || !enabled || !snapshot.audio.trackId) {
            setAudioUrl(current => {
                if (current) URL.revokeObjectURL(current);
                return "";
            });
            return undefined;
        }
        let active = true;
        fetchRoomAudioUrl(session, snapshot.audio.trackId)
            .then(url => {
                if (!active) {
                    URL.revokeObjectURL(url);
                    return;
                }
                setAudioUrl(current => {
                    if (current) URL.revokeObjectURL(current);
                    return url;
                });
            })
            .catch(onError);
        return () => { active = false; };
    }, [enabled, isLocal, onError, session, snapshot.audio.trackId]);

    useEffect(() => () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
    }, [audioUrl]);

    const syncPlayback = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !enabled || !audioUrl) return;
        audio.volume = localMuted ? 0 : snapshot.audio.volume * localVolume;
        const elapsed = snapshot.audio.playing && snapshot.audio.startedAt
            ? Math.max(0, (Date.now() - snapshot.audio.startedAt) / 1000)
            : 0;
        const rawTarget = Math.max(0, snapshot.audio.offset + elapsed);
        const target = Number.isFinite(audio.duration) && audio.duration > 0
            ? rawTarget % audio.duration
            : rawTarget;
        if (Number.isFinite(target) && Math.abs(audio.currentTime - target) > 1.25) {
            try {
                audio.currentTime = target;
            } catch {
                // O evento loadedmetadata repetirá a sincronização quando a faixa estiver pronta.
            }
        }
        if (snapshot.audio.playing) audio.play().catch(() => {});
        else audio.pause();
    }, [
        audioUrl,
        enabled,
        snapshot.audio.offset,
        snapshot.audio.playing,
        snapshot.audio.startedAt,
        snapshot.audio.volume,
        localMuted,
        localVolume,
    ]);

    useEffect(() => {
        syncPlayback();
        if (!snapshot.audio.playing) return undefined;
        const timer = window.setInterval(syncPlayback, 8000);
        return () => window.clearInterval(timer);
    }, [snapshot.audio.playing, syncPlayback]);

    useEffect(() => {
        if (!enabled || !events.length) return;
        const recent = events.filter(event => event.id > heardEventRef.current);
        heardEventRef.current = Math.max(heardEventRef.current, ...events.map(event => Number(event.id) || 0));
        recent.filter(event => event.type === "sfx").forEach(event => {
            void playSoundEffect(event.payload?.effectId, localMuted ? 0 : snapshot.audio.volume * localVolume);
        });
    }, [enabled, events, localMuted, localVolume, snapshot.audio.volume]);

    const enable = async () => {
        const active = await activateAudio();
        heardEventRef.current = Math.max(0, ...events.map(event => Number(event.id) || 0));
        setEnabled(active);
        if (!active) onError(new Error("O áudio não pôde ser ativado neste aparelho."));
    };

    const triggerEffect = async effect => {
        await enable();
        if (role === "narrator") {
            await onEvent("sfx", { effectId: effect.id, label: effect.label });
        }
    };

    const upload = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setUploading(true);
        setProgress(0);
        try {
            const result = await uploadRoomAudio(session, file, file.name.replace(/\.[^.]+$/, ""), setProgress);
            await onRefresh();
            onSnapshotChange({
                ...snapshot,
                audio: {
                    ...snapshot.audio,
                    trackId: result.media.id,
                    title: result.media.title,
                    playing: false,
                    offset: 0,
                    startedAt: 0,
                },
            });
        } catch (error) {
            onError(error);
        } finally {
            setUploading(false);
        }
    };

    const selectTrack = item => onSnapshotChange({
        ...snapshot,
        audio: {
            ...snapshot.audio,
            trackId: item.id,
            title: item.title,
            playing: false,
            offset: 0,
            startedAt: 0,
        },
    });

    const removeTrack = async item => {
        try {
            await deleteRoomAudio(session, item.id);
            if (snapshot.audio.trackId === item.id) {
                onSnapshotChange({
                    ...snapshot,
                    audio: { ...snapshot.audio, trackId: null, title: "", playing: false, offset: 0, startedAt: 0 },
                });
            }
            await onRefresh();
            setPendingRemove(null);
        } catch (error) {
            onError(error);
        }
    };

    return (
        <details className="room-tool" open>
            <summary>
                <span>
                    <small>Rádio Rotom</small>
                    <strong>Trilha da aventura</strong>
                </span>
                <span className={`audio-indicator ${enabled ? "is-on" : ""}`} aria-hidden="true" />
            </summary>
            <div className="room-tool-body">
                {!enabled && (
                    <button type="button" className="room-primary-button" onClick={enable}>
                        Ativar áudio neste aparelho
                    </button>
                )}
                <div className="sfx-grid" aria-label="Efeitos sonoros">
                    {SOUND_EFFECTS.map(effect => (
                        <button
                            key={effect.id}
                            type="button"
                            disabled={role !== "narrator"}
                            onClick={() => triggerEffect(effect)}
                            title={role === "narrator" ? `Tocar ${effect.label} na aventura` : "O Narrador escolhe os efeitos sonoros"}
                        >
                            {effect.label}
                        </button>
                    ))}
                </div>

                <div className="audio-now">
                    <div>
                        <small>Trilha atual</small>
                        <strong>{snapshot.audio.title || "Escolha uma trilha para a cena"}</strong>
                    </div>
                    {role === "narrator" && snapshot.audio.trackId && (
                        <button
                            type="button"
                            className="audio-play"
                            onClick={() => onSnapshotChange({
                                ...snapshot,
                                audio: {
                                    ...snapshot.audio,
                                    playing: !snapshot.audio.playing,
                                    offset: snapshot.audio.playing
                                        ? snapshot.audio.offset + (snapshot.audio.startedAt
                                            ? Math.max(0, (Date.now() - snapshot.audio.startedAt) / 1000)
                                            : 0)
                                        : snapshot.audio.offset,
                                    startedAt: snapshot.audio.playing ? 0 : Date.now(),
                                },
                            })}
                        >
                            {snapshot.audio.playing ? "Pausar" : "Reproduzir"}
                        </button>
                    )}
                </div>
                <audio ref={audioRef} src={audioUrl || undefined} loop preload="metadata" onLoadedMetadata={syncPlayback} />
                <label className="audio-volume">
                    <span>Meu volume</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={localVolume}
                        onChange={event => setLocalVolume(Number(event.target.value))}
                    />
                </label>
                <label className="audio-local-toggle">
                    <input type="checkbox" checked={localMuted} onChange={event => setLocalMuted(event.target.checked)} />
                    <span>Silenciar trilha e efeitos neste aparelho</span>
                </label>
                {role === "narrator" && (
                    <label className="audio-volume">
                        <span>Volume para a aventura</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={snapshot.audio.volume}
                            onChange={event => onSnapshotChange({
                                ...snapshot,
                                audio: { ...snapshot.audio, volume: Number(event.target.value) },
                            })}
                        />
                    </label>
                )}

                {role === "narrator" && (
                    isLocal ? (
                        <p className="audio-local-note">Comece uma aventura compartilhada para tocar trilhas para todos. Os efeitos sonoros continuam disponíveis neste aparelho.</p>
                    ) : (
                        <label className={`audio-upload ${uploading ? "is-uploading" : ""}`}>
                            <input type="file" accept="audio/*" disabled={uploading} onChange={upload} />
                            <span>{uploading ? `Enviando ${Math.round(progress * 100)}%` : "Adicionar trilha • até 24 MB"}</span>
                        </label>
                    )
                )}

                {media.length > 0 && (
                    <div className="audio-library">
                        {media.map(item => (
                            <div key={item.id} className={snapshot.audio.trackId === item.id ? "is-active" : ""}>
                                <button type="button" disabled={role !== "narrator"} onClick={() => selectTrack(item)}>
                                    <strong>{item.title}</strong>
                                    <small>{formatBytes(item.size)}</small>
                                </button>
                                {role === "narrator" && (
                                    <button type="button" className="audio-remove" onClick={() => setPendingRemove(item)} aria-label={`Remover ${item.title}`}>×</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <ConfirmDialog
                open={Boolean(pendingRemove)}
                title="Remover esta trilha?"
                description={pendingRemove ? `“${pendingRemove.title}” deixará de ficar disponível nesta aventura para todos os participantes.` : ""}
                confirmLabel="Remover trilha"
                onConfirm={() => pendingRemove && void removeTrack(pendingRemove)}
                onCancel={() => setPendingRemove(null)}
            />
        </details>
    );
}

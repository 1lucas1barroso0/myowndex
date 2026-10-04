import React, { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "../Shared/ConfirmDialog.jsx";
import { activateAudio, playSoundEffect, SOUND_EFFECTS } from "../../core/audio.js";
import { formatNumberPtBr } from "../../core/mechanics.js";
import { clampFinite, MAX_SAFE_GAME_INTEGER } from "../../core/math.js";
import { readStorage, writeStorage } from "../../core/storage.js";
import {
    deleteRoomAudio,
    fetchRoomAudioUrl,
    uploadRoomAudio,
} from "../../core/roomClient.js";

const formatBytes = value => {
    const bytes = clampFinite(value, 0, MAX_SAFE_GAME_INTEGER, 0);
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${formatNumberPtBr(bytes / 1024 / 1024)} MB`;
};

const roomEventKey = (code, event) => `${code || "local"}:${String(event?.id ?? "")}`;

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
    const [localTrack, setLocalTrack] = useState(null);
    const [playbackError, setPlaybackError] = useState("");
    const [pendingRemove, setPendingRemove] = useState(null);
    const [localVolume, setLocalVolume] = useState(0.85);
    const [localMuted, setLocalMuted] = useState(false);
    const [preferencesReady, setPreferencesReady] = useState(false);
    const audioRef = useRef(null);
    const heardEventRef = useRef(new Set());
    const localUrlRef = useRef("");
    const currentSnapshotRef = useRef(snapshot);
    useEffect(() => { currentSnapshotRef.current = snapshot; }, [snapshot]);
    const playbackUrl = isLocal ? localTrack?.url || "" : audioUrl;
    const trackTitle = isLocal ? localTrack?.title || "" : snapshot.audio.title;
    const hasTrack = isLocal ? Boolean(localTrack) : Boolean(snapshot.audio.trackId);

    useEffect(() => {
        audioRef.current?.pause();
        if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
        localUrlRef.current = "";
        setLocalTrack(null);
        setPlaybackError("");
        setEnabled(false);
        heardEventRef.current = new Set();
    }, [isLocal, session?.code, session?.key]);

    useEffect(() => {
        const restore = event => {
            if (event?.detail?.key && event.detail.key !== "myowndex_audio_preferences_v1") return;
            if (event?.type === "storage" && event.key && !event.key.endsWith("myowndex_audio_preferences_v1")) return;
            const preferences = readStorage("myowndex_audio_preferences_v1", {});
            setLocalVolume(current => { const next = clampFinite(preferences?.volume, 0, 1, 0.85); return current === next ? current : next; });
            setLocalMuted(current => { const next = Boolean(preferences?.muted); return current === next ? current : next; });
            setPreferencesReady(true);
        };
        restore();
        window.addEventListener("storage", restore);
        window.addEventListener("myowndex:storage", restore);
        return () => { window.removeEventListener("storage", restore); window.removeEventListener("myowndex:storage", restore); };
    }, [session?.code, session?.key]);

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
        const controller = new AbortController();
        fetchRoomAudioUrl(session, snapshot.audio.trackId, { signal: controller.signal })
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
            .catch(error => { if (active && error.name !== "AbortError") onError(error); });
        return () => { active = false; controller.abort(); };
    }, [enabled, isLocal, onError, session, snapshot.audio.trackId]);

    useEffect(() => () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
    }, [audioUrl]);

    useEffect(() => () => {
        if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    }, []);

    const syncPlayback = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !enabled || !playbackUrl) return;
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
        if (snapshot.audio.playing) audio.play().then(() => setPlaybackError(""), error => { if (error.name !== "AbortError") setPlaybackError("Toque em Reproduzir para ouvir a trilha."); });
        else audio.pause();
    }, [
        playbackUrl,
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
        const recent = events.filter(event => !heardEventRef.current.has(roomEventKey(session?.code, event)));
        heardEventRef.current = new Set(events.map(event => roomEventKey(session?.code, event)));
        if (localMuted) return;
        recent.filter(event => event.type === "sfx").forEach(event => {
            void playSoundEffect(event.payload?.effectId, localMuted ? 0 : snapshot.audio.volume * localVolume);
        });
    }, [enabled, events, localMuted, localVolume, session?.code, snapshot.audio.volume]);

    const enable = useCallback(async () => {
        const active = localMuted || await activateAudio();
        heardEventRef.current = new Set(events.map(event => roomEventKey(session?.code, event)));
        setEnabled(active);
        if (!active) onError(new Error("O áudio não pôde ser ativado neste dispositivo."));
        return active;
    }, [events, localMuted, onError, session?.code]);

    const triggerEffect = async effect => {
        if (!await enable()) return;
        if (role === "narrator") {
            await onEvent("sfx", { effectId: effect.id, label: effect.label });
        }
    };

    const upload = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.size || file.size > 24 * 1024 * 1024) {
            onError(new Error("Escolha uma trilha de até 24 MB."));
            return;
        }
        if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) {
            onError(new Error("Escolha um arquivo de áudio."));
            return;
        }
        if (isLocal) {
            audioRef.current?.pause();
            const url = URL.createObjectURL(file);
            if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
            localUrlRef.current = url;
            setLocalTrack({ id: "local-track", title: file.name.replace(/\.[^.]+$/, ""), size: file.size, url });
            setPlaybackError("");
            const current = currentSnapshotRef.current;
            onSnapshotChange({ ...current, audio: { ...current.audio, trackId: null, title: "", playing: false, offset: 0, startedAt: 0 } });
            return;
        }
        setUploading(true);
        setProgress(0);
        try {
            const result = await uploadRoomAudio(session, file, file.name.replace(/\.[^.]+$/, ""), setProgress);
            await onRefresh();
            const current = currentSnapshotRef.current;
            onSnapshotChange({
                ...current,
                audio: {
                    ...current.audio,
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

    const handleSelectTrack = async (item, startedAt) => {
        if (!await enable()) return;
        audioRef.current?.pause();
        setPlaybackError("");
        const current = currentSnapshotRef.current;
        onSnapshotChange({
            ...current,
            audio: { ...current.audio, trackId: item.id, title: item.title, playing: true, offset: 0, startedAt },
        });
    };

    const handleTogglePlayback = useCallback(async () => {
        const now = Date.now();
        const current = currentSnapshotRef.current;
        if (current.audio.playing && !playbackError) {
            const position = audioRef.current?.currentTime;
            const offset = Number.isFinite(position) ? position : current.audio.offset + (current.audio.startedAt ? Math.max(0, (now - current.audio.startedAt) / 1000) : 0);
            audioRef.current?.pause();
            onSnapshotChange({ ...current, audio: { ...current.audio, playing: false, offset, startedAt: 0 } });
            return;
        }
        if (!await enable()) return;
        setPlaybackError("");
        if (current.audio.playing) {
            void audioRef.current?.play().then(() => setPlaybackError(""), error => { if (error.name !== "AbortError") setPlaybackError("Esta trilha não pôde ser reproduzida. Escolha outro arquivo."); });
            return;
        }
        onSnapshotChange({ ...current, audio: { ...current.audio, playing: true, startedAt: now } });
    }, [enable, onSnapshotChange, playbackError]);

    const removeTrack = async item => {
        try {
            if (isLocal) {
                audioRef.current?.pause();
                if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
                localUrlRef.current = "";
                setLocalTrack(null);
                setPlaybackError("");
                const current = currentSnapshotRef.current;
                onSnapshotChange({ ...current, audio: { ...current.audio, trackId: null, title: "", playing: false, offset: 0, startedAt: 0 } });
                setPendingRemove(null);
                return;
            }
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
        <details className="room-tool audio-tool">
            <summary>
                <span>
                    <strong>Trilha da aventura</strong>
                </span>
                <span className={`audio-indicator ${enabled && snapshot.audio.playing && hasTrack ? "is-on" : ""}`} aria-hidden="true" />
            </summary>
            <div className="room-tool-body">
                {hasTrack && <div className="audio-now">
                    <div><small>Trilha</small><strong>{trackTitle}</strong></div>
                    {role === "narrator" && <button type="button" className="audio-play room-primary-button" onClick={handleTogglePlayback}>
                        {snapshot.audio.playing && !playbackError ? "Pausar" : "Reproduzir"}
                    </button>}
                    {isLocal && role === "narrator" && <button type="button" className="audio-clear" onClick={() => setPendingRemove(localTrack)} aria-label={`Remover ${trackTitle}`}>×</button>}
                </div>}
                <audio ref={audioRef} src={playbackUrl || undefined} loop preload="metadata" onLoadedMetadata={syncPlayback} onError={() => setPlaybackError("Esta trilha não pôde ser aberta. Escolha outro arquivo.")} />
                {playbackError && <p className="audio-error" role="alert">{playbackError}</p>}
                {role === "narrator" && <label className={`audio-upload ${uploading ? "is-uploading" : ""}`}>
                    <input type="file" accept="audio/*" disabled={uploading} onChange={upload} aria-label={hasTrack && isLocal ? "Trocar trilha" : "Adicionar trilha"} />
                    <span>{uploading ? `Enviando ${Math.round(progress * 100)}%` : hasTrack && isLocal ? "Trocar trilha" : "Adicionar trilha"}</span>
                </label>}
                {(!enabled || playbackError) && role !== "narrator" && <button type="button" className="room-primary-button" onClick={async () => { if (await enable()) syncPlayback(); }}>Ouvir a aventura</button>}
                {role === "narrator" && <details className="audio-effects">
                    <summary>Efeitos sonoros</summary>
                    <div className="sfx-grid" role="group" aria-label="Efeitos sonoros">
                        {SOUND_EFFECTS.map(effect => <button key={effect.id} type="button" onClick={() => void triggerEffect(effect)} aria-label={`Tocar ${effect.label}`}>{effect.label}</button>)}
                    </div>
                </details>}
                <details className="audio-preferences">
                    <summary>Volume e opções</summary>
                    <label className="audio-volume"><span>Meu volume</span><input type="range" min="0" max="1" step="0.05" value={localVolume} aria-valuetext={`${Math.round(localVolume * 100)}%`} onChange={event => setLocalVolume(clampFinite(event.target.value, 0, 1, localVolume))} /></label>
                    <label className="audio-local-toggle"><input type="checkbox" checked={localMuted} onChange={event => setLocalMuted(event.target.checked)} /><span>Silenciar</span></label>
                    {role === "narrator" && !isLocal && <label className="audio-volume"><span>Volume da aventura</span><input type="range" min="0" max="1" step="0.05" value={snapshot.audio.volume} aria-valuetext={`${Math.round(snapshot.audio.volume * 100)}%`} onChange={event => { const current = currentSnapshotRef.current; onSnapshotChange({ ...current, audio: { ...current.audio, volume: clampFinite(event.target.value, 0, 1, current.audio.volume) } }); }} /></label>}
                    {role === "narrator" && <small>Até 24 MB por trilha.{isLocal ? " O arquivo toca nesta sessão e pode ser trocado ou removido." : " Todos ouvem após ativar o áudio."}</small>}
                </details>

                {media.length > 0 && (
                    <div className="audio-library">
                        {media.map(item => (
                            <div key={item.id} className={snapshot.audio.trackId === item.id ? "is-active" : ""}>
                                <button type="button" disabled={role !== "narrator"} onClick={() => void handleSelectTrack(item, Date.now())}>
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
                description={pendingRemove ? isLocal ? `“${pendingRemove.title}” sairá desta sessão.` : `“${pendingRemove.title}” deixará de ficar disponível nesta aventura para todos os participantes.` : ""}
                confirmLabel="Remover trilha"
                onConfirm={() => pendingRemove && void removeTrack(pendingRemove)}
                onCancel={() => setPendingRemove(null)}
            />
        </details>
    );
}

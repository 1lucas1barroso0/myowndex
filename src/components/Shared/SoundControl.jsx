import React, { useEffect, useState } from "react";
import { readStorage, writeStorage } from "../../core/storage.js";

const preferencesKey = "myowndex_audio_preferences_v1";

/** The same mute preference for the adventure and private practice sounds. */
export default function SoundControl() {
    const [muted, setMuted] = useState(false);
    useEffect(() => {
        const refresh = () => setMuted(Boolean(readStorage(preferencesKey, {})?.muted));
        refresh();
        window.addEventListener("storage", refresh);
        window.addEventListener("myowndex:storage", refresh);
        return () => { window.removeEventListener("storage", refresh); window.removeEventListener("myowndex:storage", refresh); };
    }, []);
    const toggle = () => {
        const current = readStorage(preferencesKey, {});
        const next = !Boolean(current?.muted);
        writeStorage(preferencesKey, { ...current, muted: next });
        setMuted(next);
    };
    return <button type="button" className="local-dice-sound-control" aria-label={muted ? "Ativar som" : "Silenciar som"} aria-pressed={muted} onClick={toggle}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h4l5-4v14l-5-4H4Z" />{muted ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M17 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" /></>}</svg>
        <span className="sr-only">Som</span>
    </button>;
}

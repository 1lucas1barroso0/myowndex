import React, { useEffect, useState } from "react";
import { readStorage, writeStorage } from "../../core/storage.js";

const APPEARANCE_KEY = "myowndex_appearance_v1";
const THEMES = [
    { id: "normal", label: "Claro", icon: "☀" },
    { id: "night", label: "Escuro", icon: "☾" },
    { id: "system", label: "Como o aparelho", icon: "◐" },
];

const validTheme = value => THEMES.some(theme => theme.id === value) ? value : "system";

export default function AppearanceControl() {
    const [preference, setPreference] = useState("system");
    const [ready, setReady] = useState(false);
    const current = THEMES.find(theme => theme.id === preference) || THEMES[2];
    const next = THEMES[(THEMES.findIndex(theme => theme.id === preference) + 1) % THEMES.length];

    useEffect(() => {
        setPreference(validTheme(readStorage(APPEARANCE_KEY, "system")));
        setReady(true);
    }, []);

    useEffect(() => {
        if (!ready) return undefined;
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const apply = () => {
            const resolved = preference === "system" ? (media.matches ? "night" : "normal") : preference;
            document.documentElement.dataset.theme = resolved;
            document.documentElement.dataset.themePreference = preference;
            document.documentElement.style.colorScheme = resolved === "night" ? "dark" : "light";
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "night" ? "#0f172a" : "#7f1d1d");
        };
        apply();
        writeStorage(APPEARANCE_KEY, preference);
        media.addEventListener?.("change", apply);
        return () => media.removeEventListener?.("change", apply);
    }, [preference, ready]);

    return (
        <button
            type="button"
            className="appearance-control"
            title={`Aparência atual: ${current.label}. Usar ${next.label}.`}
            aria-label={`A aparência está em ${current.label}. Alterar para ${next.label}.`}
            onClick={() => setPreference(next.id)}
        >
            <span aria-hidden="true">{current.icon}</span>
            <small>{current.label}</small>
        </button>
    );
}

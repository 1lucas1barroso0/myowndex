import React, { useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "../../core/storage.js";
import GameIcon from "./GameIcon.jsx";

const APPEARANCE_KEY = "myowndex_appearance_v1";
const THEMES = [
    { id: "normal", label: "Claro", icon: "sun" },
    { id: "night", label: "Escuro", icon: "moon" },
];

const validTheme = value => THEMES.some(theme => theme.id === value) ? value
    : value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "normal";
const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export default function AppearanceControl() {
    const [preference, setPreference] = useState("normal");
    const [ready, setReady] = useState(false);
    const optionRefs = useRef([]);

    const moveSelection = (event, index) => {
        if (!movementKeys.has(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? THEMES.length - 1
            : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % THEMES.length
                : (index - 1 + THEMES.length) % THEMES.length;
        setPreference(THEMES[nextIndex].id);
        optionRefs.current[nextIndex]?.focus();
    };

    useEffect(() => {
        setPreference(validTheme(readStorage(APPEARANCE_KEY, "normal")));
        setReady(true);
    }, []);

    useEffect(() => {
        if (!ready) return;
        const resolved = preference;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.dataset.themePreference = preference;
        document.documentElement.style.colorScheme = resolved === "night" ? "dark" : "light";
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "night" ? "#17283e" : "#da3041");
        writeStorage(APPEARANCE_KEY, preference);
    }, [preference, ready]);

    return (
        <section className="appearance-control" aria-label="Aparência">
            <span className="appearance-label">Aparência</span>
            <div className="appearance-options" role="radiogroup" aria-label="Escolha a aparência">
                {THEMES.map((theme, index) => (
                    <button
                        key={theme.id}
                        ref={node => { optionRefs.current[index] = node; }}
                        type="button"
                        role="radio"
                        aria-checked={preference === theme.id}
                        aria-label={theme.label}
                        tabIndex={preference === theme.id ? 0 : -1}
                        className={preference === theme.id ? "is-selected" : ""}
                        data-appearance={theme.id}
                        onClick={() => setPreference(theme.id)}
                        onKeyDown={event => moveSelection(event, index)}
                    >
                        <GameIcon name={theme.icon} />
                        <span>{theme.label}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

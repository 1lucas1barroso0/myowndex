import React, { useRef } from "react";
import { EXPERIENCE_MODES } from "../../core/rpgRules.js";

const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export default function GameStyleControl({ value, onChange }) {
    const optionRefs = useRef([]);
    const modes = Object.values(EXPERIENCE_MODES);
    const selectedIndex = Math.max(0, modes.findIndex(mode => mode.id === value));
    const selectedMode = modes[selectedIndex] || EXPERIENCE_MODES.rpg;

    const moveSelection = (event, index) => {
        if (!movementKeys.has(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = modes.length - 1;
        else if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % modes.length;
        else nextIndex = (index - 1 + modes.length) % modes.length;
        onChange(modes[nextIndex].id);
        optionRefs.current[nextIndex]?.focus();
    };

    return (
        <section className="game-style-control" aria-label="Estilo de jogo">
            <span className="game-style-label">Estilo de jogo</span>
            <div className="game-style-options" role="radiogroup" aria-label="Escolha como o MyOwnDex aplica as regras">
                {modes.map((mode, index) => {
                    const selected = mode.id === selectedMode.id;
                    return (
                        <button
                            key={mode.id}
                            ref={node => { optionRefs.current[index] = node; }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${mode.label}. ${mode.description}`}
                            className={selected ? "is-selected" : ""}
                            data-mode={mode.id}
                            onClick={() => onChange(mode.id)}
                            onKeyDown={event => moveSelection(event, index)}
                        >
                            <span>{mode.shortLabel}</span>
                        </button>
                    );
                })}
            </div>
            <details className="choice-help game-style-help">
                <summary aria-label="Entender os estilos de jogo">?</summary>
                <div className="choice-help-popover" role="note">
                    <strong>{selectedMode.label}</strong>
                    <p>{selectedMode.description}</p>
                </div>
            </details>
        </section>
    );
}

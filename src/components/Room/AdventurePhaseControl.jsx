import React, { useId, useRef } from "react";
import { ROOM_PHASES } from "../../core/room.js";

const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export default function AdventurePhaseControl({ value, readOnly, onChange }) {
    const descriptionId = useId();
    const optionRefs = useRef([]);
    const selectedIndex = Math.max(0, ROOM_PHASES.findIndex(phase => phase.id === value));
    const selectedPhase = ROOM_PHASES[selectedIndex] || ROOM_PHASES[0];

    const moveSelection = (event, index) => {
        if (readOnly || !movementKeys.has(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = ROOM_PHASES.length - 1;
        else if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % ROOM_PHASES.length;
        else nextIndex = (index - 1 + ROOM_PHASES.length) % ROOM_PHASES.length;
        onChange(ROOM_PHASES[nextIndex].id);
        optionRefs.current[nextIndex]?.focus();
    };

    return (
        <section className="room-phase-control" aria-labelledby={`${descriptionId}-title`}>
            <header className="room-phase-heading">
                <span id={`${descriptionId}-title`}>Fase da aventura</span>
                <strong>{selectedPhase.label}</strong>
                <small>{readOnly ? "O Narrador conduz esta fase" : "Escolha o que acontece agora"}</small>
            </header>
            <div
                className="room-phase-options"
                role="radiogroup"
                aria-label="Fase atual da aventura"
                aria-describedby={descriptionId}
                aria-readonly={readOnly}
            >
                {ROOM_PHASES.map((phase, index) => {
                    const selected = phase.id === selectedPhase.id;
                    return (
                        <button
                            key={phase.id}
                            ref={node => { optionRefs.current[index] = node; }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${phase.label}. ${phase.description}`}
                            className={selected ? "is-selected" : ""}
                            data-phase={phase.id}
                            disabled={readOnly}
                            onClick={() => onChange(phase.id)}
                            onKeyDown={event => moveSelection(event, index)}
                        >
                            <span className="room-phase-pixel" aria-hidden="true">{phase.consoleLabel}</span>
                            <strong>{phase.label}</strong>
                        </button>
                    );
                })}
            </div>
            <p id={descriptionId} aria-live="polite">{selectedPhase.description}</p>
        </section>
    );
}

import React, { useRef } from "react";
import { ROOM_PHASES } from "../../core/room.js";

const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export default function AdventurePhaseControl({ value, readOnly, onChange }) {
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
        <section className="room-phase-control" aria-label="Fase da aventura">
            <span className="room-phase-label">Fase da aventura</span>
            <div
                className="room-phase-options"
                role="radiogroup"
                aria-label="Fase atual da aventura"
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
                            <strong>{phase.label}</strong>
                        </button>
                    );
                })}
            </div>
            <details className="choice-help room-phase-help">
                <summary aria-label="Entender as fases da aventura">?</summary>
                <div className="choice-help-popover" role="note">
                    <strong>{selectedPhase.label}</strong>
                    <p>{selectedPhase.description}</p>
                    <small>{readOnly ? "O Narrador escolhe a fase atual." : "Você pode mudar a fase quando a aventura pedir."}</small>
                </div>
            </details>
        </section>
    );
}

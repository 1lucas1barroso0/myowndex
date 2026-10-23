import React, { useRef } from "react";
import { ROOM_PHASES } from "../../core/room.js";
import GameIcon from "../Shared/GameIcon.jsx";
import NewBattleButton from "../Shared/NewBattleButton.jsx";

const phaseIcons = { exploracao: "adventure", interpretacao: "guide", batalha: "move", intervalo: "moon" };

const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export default function AdventurePhaseControl({ value, readOnly, onChange, onStartBattle, onEndBattle, battleStarted = false, battleEnded = false, activeRound = false, busy = false, onError }) {
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
                            tabIndex={selected ? 0 : -1}
                            className={selected ? "is-selected" : ""}
                            data-phase={phase.id}
                            disabled={readOnly}
                            onClick={() => onChange(phase.id)}
                            onKeyDown={event => moveSelection(event, index)}
                        >
                            <GameIcon name={phaseIcons[phase.id]} />
                            <strong>{phase.label}</strong>
                        </button>
                    );
                })}
            </div>
            {!readOnly && (value === "batalha" || battleStarted) && <div className="turn-order-actions">
                {battleStarted && !battleEnded && onEndBattle && <NewBattleButton ending onStart={onEndBattle} activeRound={activeRound} disabled={busy} onError={onError} />}
                {onStartBattle && <NewBattleButton onStart={onStartBattle} activeRound={activeRound} disabled={busy} onError={onError} />}
            </div>}
            {battleEnded && <p className="capture-note">Confronto encerrado. Os gastos foram preservados; escolha Nova batalha para outro combate.</p>}
            <details className="room-phase-help">
                <summary>Sobre as fases</summary>
                <div className="room-phase-help-content" role="note">
                    <strong>{selectedPhase.label}</strong>
                    <p>{selectedPhase.description}</p>
                    <small>{readOnly ? "O Narrador escolhe a fase atual." : "Mudar a fase mantém a batalha e seus registros."}</small>
                </div>
            </details>
        </section>
    );
}

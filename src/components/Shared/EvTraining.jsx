import React, { useEffect, useId, useRef, useState } from "react";
import { allocatePokemonEvs, getAllocatedEvTotal, getAvailableEvAmount } from "../../core/experience.js";
import { STAT_MAP } from "../../core/mechanics.js";
import { integerInRange, MAX_SAFE_GAME_INTEGER } from "../../core/math.js";
import { STAT_KEYS } from "../../core/team.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import RoomSelect from "./RoomSelect.jsx";

export default function EvTraining({ pokemon, onChange, disabled = false }) {
    const fieldId = useId();
    const [stat, setStat] = useState("hp");
    const [amount, setAmount] = useState(1);
    const [discard, setDiscard] = useState(false);
    const [notice, setNotice] = useState("");
    const pokemonRef = useRef(pokemon);
    useEffect(() => { pokemonRef.current = pokemon; }, [pokemon]);
    const pending = integerInRange(pokemon.rpg?.pendingEvs, 0, MAX_SAFE_GAME_INTEGER, 0);
    const available = getAvailableEvAmount(pokemon, stat);
    const chosenAmount = Math.min(available, integerInRange(amount, 1, 510, 1));

    const train = () => {
        if (disabled || chosenAmount < 1) return;
        const current = pokemonRef.current;
        const next = allocatePokemonEvs(current, { stat, amount: chosenAmount });
        pokemonRef.current = next;
        onChange(next);
        const gained = integerInRange(next.evs?.[stat], 0, 252, 0) - integerInRange(current.evs?.[stat], 0, 252, 0);
        setNotice(`${STAT_MAP[stat]} recebeu ${gained} ${gained === 1 ? "EV" : "EVs"}.`);
    };

    return <section className="ev-training" aria-labelledby={`${fieldId}-heading`}>
        <header><h4 id={`${fieldId}-heading`}>EVs disponíveis</h4><strong>{pending}</strong></header>
        {pending > 0 && <>
            <div className="ev-training-controls">
                <label htmlFor={`${fieldId}-stat`}>Treinar<RoomSelect id={`${fieldId}-stat`} value={stat} disabled={disabled} onChange={event => { setStat(event.target.value); setNotice(""); }}>{STAT_KEYS.map(key => <option key={key} value={key}>{STAT_MAP[key]}</option>)}</RoomSelect></label>
                <label htmlFor={`${fieldId}-amount`}>EVs<input id={`${fieldId}-amount`} type="number" inputMode="numeric" min="1" max={available || 1} step="1" disabled={disabled || !available} value={amount === "" ? "" : available ? chosenAmount : 0} onChange={event => setAmount(event.target.value === "" ? "" : integerInRange(event.target.value, 1, available, 1))} /></label>
                <button type="button" className="room-primary-button" disabled={disabled || !available} onClick={train}>Treinar</button>
            </div>
            {!available && <p>{getAllocatedEvTotal(pokemon) >= 510 ? "Limite de 510 EVs atingido." : "Este atributo já tem 252 EVs. Escolha outro."}</p>}
            <details className="ev-training-options"><summary>Mais opções</summary><button type="button" disabled={disabled} className="ev-training-discard" onClick={() => setDiscard(true)}>Apagar EVs disponíveis</button></details>
        </>}
        {notice && <p role="status">{notice}</p>}
        <ConfirmDialog open={discard} title="Apagar EVs disponíveis?" description="Os EVs já usados nos atributos continuam iguais." confirmLabel="Apagar EVs disponíveis" onCancel={() => setDiscard(false)} onConfirm={() => { const current = pokemonRef.current; const next = { ...current, rpg: { ...current.rpg, pendingEvs: 0 } }; pokemonRef.current = next; onChange(next); setDiscard(false); setNotice(""); }} />
    </section>;
}

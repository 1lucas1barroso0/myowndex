import React, { useEffect, useId, useRef, useState } from "react";
import { adjustPokemonFriendship, getFriendshipScale } from "../../core/experience.js";
import { integerInRange } from "../../core/math.js";

export default function FriendshipControl({ pokemon, onChange, isTTRPG = true, disabled = false }) {
    const fieldId = useId();
    const currentRef = useRef(pokemon);
    useEffect(() => { currentRef.current = pokemon; }, [pokemon]);
    const friendship = integerInRange(pokemon.friendship, 0, 255, 70);
    const [draft, setDraft] = useState(friendship);
    useEffect(() => setDraft(friendship), [friendship]);
    const adjust = delta => {
        if (disabled) return;
        const next = adjustPokemonFriendship(currentRef.current, delta);
        currentRef.current = next;
        setDraft(next.friendship);
        onChange(next);
    };

    return <div className="friendship-control editor-wide-field">
        <header><label htmlFor={`${fieldId}-friendship`} className="editor-label">Amizade</label>{isTTRPG && <output>RPG {getFriendshipScale(friendship)} de 25</output>}</header>
        <div className="friendship-controls"><input id={`${fieldId}-friendship`} type="number" inputMode="numeric" min="0" max="255" step="5" disabled={disabled} value={draft} onBlur={() => setDraft(friendship)} onChange={event => { const value = event.target.value; setDraft(value); if (value !== "") { const next = { ...currentRef.current, friendship: integerInRange(value, 0, 255, friendship) }; currentRef.current = next; onChange(next); } }} className="editor-input" /><div role="group" aria-label="Ajustar Amizade por decisão do Narrador">{[-50, -5, 5, 50].map(delta => <button key={delta} type="button" disabled={disabled || (delta < 0 ? friendship === 0 : friendship === 255)} onClick={() => adjust(delta)} aria-label={`${delta > 0 ? "Aumentar" : "Diminuir"} Amizade em ${Math.abs(delta)}`}>{delta > 0 ? "+" : "−"}{Math.abs(delta)}</button>)}</div></div>
        <details className="friendship-help"><summary>Decisão do Narrador</summary><p>O vínculo muda pela história, nunca automaticamente. Ao terminar a sessão, o Narrador decide se a Amizade muda ou continua igual.</p><p>Nos jogos, a escala vai de 0 a 255. No RPG, divida por 10 e arredonde para baixo: o máximo é 25.</p></details>
    </div>;
}
